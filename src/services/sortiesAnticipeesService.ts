import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { SortieAnticipee } from '../data/sortiesAnticipees'
import { getCurrentUserIdSnapshot } from './currentUser'
import { getActiveYearIdSnapshot } from './anneesScolairesService'
import { getViewedYearIdSnapshot } from './viewedYear'
import { getStudentExtraSnapshot, updateStudentEvents } from './studentDetailsService'
import { recomputeStudentAttendance } from '../data/students'
import { logAudit } from './auditLogService'

interface SortieAnticipeeRow {
  id: string
  student_id: string
  date: string
  heure: string
  recupere_par: string
  motif: string
  source: 'staff' | 'parent'
  created_by: string | null
  parent_id: string | null
  heure_retour: string | null
}

function rowToSortie(row: SortieAnticipeeRow): SortieAnticipee {
  return {
    id: row.id,
    studentId: row.student_id,
    date: row.date,
    heure: row.heure,
    recuperePar: row.recupere_par,
    motif: row.motif,
    source: row.source,
    createdBy: row.created_by,
    parentId: row.parent_id,
    heureRetour: row.heure_retour,
  }
}

const QUERY_KEY = ['sortiesAnticipees']

export async function fetchSortiesAnticipees(): Promise<SortieAnticipee[]> {
  const { data, error } = await supabase
    .from('sorties_anticipees')
    .select('id, student_id, date, heure, recupere_par, motif, source, created_by, parent_id, heure_retour')
    .order('date', { ascending: false })
    .order('heure', { ascending: false })
  if (error) throw error
  return (data as SortieAnticipeeRow[]).map(rowToSortie)
}

/** Retire les absences auto-générées pour une sortie (EventRecord.sortieAnticipeeId) et recalcule
 * le taux de présence — commun à la suppression et à la réintégration. */
async function clearSortieAbsences(sortieId: string, studentId: string): Promise<void> {
  const currentEvents = getStudentExtraSnapshot(studentId).events
  const remainingEvents = currentEvents.filter((e) => e.sortieAnticipeeId !== sortieId)
  if (remainingEvents.length !== currentEvents.length) {
    await updateStudentEvents(studentId, remainingEvents)
    await recomputeStudentAttendance(studentId, remainingEvents)
  }
}

export function useSortiesAnticipees(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchSortiesAnticipees, enabled })
  // Affectation synchrone (pas un useEffect) : même raison que parentsService.ts/classesService.ts.
  if (query.data) cachedSorties = query.data
  return query
}

let cachedSorties: SortieAnticipee[] = []

export function getSortiesAnticipeesSnapshot(): SortieAnticipee[] {
  return cachedSorties
}

/** Déclaration côté staff, depuis la fiche élève ou l'écran Absences & Retards. */
export function useDeclareSortieAnticipeeStaff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { studentId: string; date: string; heure: string; recuperePar: string; motif: string }) => {
      const { data, error } = await supabase
        .from('sorties_anticipees')
        .insert({
          student_id: input.studentId,
          date: input.date,
          heure: input.heure,
          recupere_par: input.recuperePar,
          motif: input.motif,
          source: 'staff',
          created_by: getCurrentUserIdSnapshot(),
          annee_scolaire_id: getViewedYearIdSnapshot(),
        })
        .select('id')
        .single()
      if (error) throw error
      return (data as { id: string }).id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/**
 * Déclaration côté portail parent — fonction hors-React (le portail n'a pas de useMutation ici,
 * appelée directement depuis un handler comme declareSortieAnticipeeParent()).
 */
export async function declareSortieAnticipeeParent(input: {
  studentId: string
  date: string
  heure: string
  recuperePar: string
  motif: string
  parentId: string
}): Promise<void> {
  const { error } = await supabase.from('sorties_anticipees').insert({
    student_id: input.studentId,
    date: input.date,
    heure: input.heure,
    recupere_par: input.recuperePar,
    motif: input.motif,
    source: 'parent',
    parent_id: input.parentId,
    annee_scolaire_id: getActiveYearIdSnapshot(),
  })
  if (error) throw error
}

/**
 * Supprime une sortie anticipée déclarée par erreur (staff uniquement, RLS is_staff() sur la
 * table). Retire aussi les absences que la déclaration avait automatiquement créées pour les cours
 * restants de la journée (repérées via EventRecord.sortieAnticipeeId, posé à la création dans
 * DeclarerSortieAnticipeeModal.tsx) et recalcule le taux de présence — sinon la suppression de la
 * sortie laisserait des absences fictives sur la fiche de l'élève.
 */
export function useDeleteSortieAnticipee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, studentId }: { id: string; studentId: string }) => {
      const { error } = await supabase.from('sorties_anticipees').delete().eq('id', id)
      if (error) throw error
      await clearSortieAbsences(id, studentId)
      void logAudit({ tableName: 'sorties_anticipees', recordId: id, action: 'delete' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

/**
 * L'élève sorti de façon anticipée est finalement revenu terminer sa journée — contrairement à
 * useDeleteSortieAnticipee (réservé à une déclaration par erreur), la sortie elle-même reste un
 * fait réel et n'est pas supprimée : seule l'heure de retour est enregistrée, et les absences
 * auto-générées pour les cours qu'il a finalement suivis sont retirées.
 */
export function useReintegrerSortieAnticipee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, studentId, heureRetour }: { id: string; studentId: string; heureRetour: string }) => {
      const { error } = await supabase.from('sorties_anticipees').update({ heure_retour: heureRetour }).eq('id', id)
      if (error) throw error
      await clearSortieAbsences(id, studentId)
      void logAudit({ tableName: 'sorties_anticipees', recordId: id, action: 'update', newData: { heureRetour } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })
}
