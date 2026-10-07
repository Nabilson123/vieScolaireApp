import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { JourSoutien, SoutienInscription, SoutienSeance, StatutSoutien } from '../data/soutien'
import { creneauModifie } from '../utils/soutienSeances'
import { getCurrentUserIdSnapshot } from './currentUser'
import { logAudit } from './auditLogService'
import { useAnneesLoaded } from './anneesScolairesService'
import { getViewedYearIdSnapshot, useViewedYearId } from './viewedYear'

interface SeanceRow {
  id: string
  matiere: string
  jour: JourSoutien
  heure_debut: string
  heure_fin: string
  teacher_id: string | null
  salle_id: string | null
  classes: string[]
  date_debut: string
  date_fin: string | null
  dates_annulees: string[]
  note: string
  created_at: string
}

interface InscriptionRow {
  id: string
  seance_id: string
  student_id: string
  statut: StatutSoutien
  message_envoye_le: string | null
  repondu_le: string | null
  created_at: string
}

// Les colonnes `time` reviennent en HH:MM:SS.
const hhmm = (t: string) => t.slice(0, 5)

function rowToSeance(row: SeanceRow): SoutienSeance {
  return {
    id: row.id,
    matiere: row.matiere,
    jour: row.jour,
    heureDebut: hhmm(row.heure_debut),
    heureFin: hhmm(row.heure_fin),
    teacherId: row.teacher_id,
    salleId: row.salle_id,
    classes: row.classes ?? [],
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
    datesAnnulees: row.dates_annulees ?? [],
    note: row.note ?? '',
    createdAt: row.created_at,
  }
}

function rowToInscription(row: InscriptionRow): SoutienInscription {
  return {
    id: row.id,
    seanceId: row.seance_id,
    studentId: row.student_id,
    statut: row.statut,
    messageEnvoyeLe: row.message_envoye_le,
    reponduLe: row.repondu_le,
    createdAt: row.created_at,
  }
}

const SEANCES_KEY = ['soutienSeances']
const INSCRIPTIONS_KEY = ['soutienInscriptions']

let cachedSeances: SoutienSeance[] = []
let cachedInscriptions: SoutienInscription[] = []

/** Instantanés synchrones pour les utilitaires hors-React (disponibilité des enseignants et des salles, grilles). */
export function getSoutienSeancesSnapshot(): SoutienSeance[] {
  return cachedSeances
}

export function getSoutienInscriptionsSnapshot(): SoutienInscription[] {
  return cachedInscriptions
}

async function fetchSeances(yearId: string): Promise<SoutienSeance[]> {
  const { data, error } = await supabase
    .from('soutien_seances')
    .select('*')
    .eq('annee_scolaire_id', yearId)
    .order('date_debut', { ascending: true })
  if (error) throw error
  return (data as SeanceRow[]).map(rowToSeance)
}

async function fetchInscriptions(yearId: string): Promise<SoutienInscription[]> {
  const { data, error } = await supabase
    .from('soutien_inscriptions')
    .select('*, soutien_seances!inner(annee_scolaire_id)')
    .eq('soutien_seances.annee_scolaire_id', yearId)
  if (error) throw error
  return (data as InscriptionRow[]).map(rowToInscription)
}

export function useSoutienSeances(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: [...SEANCES_KEY, viewedYearId],
    queryFn: () => fetchSeances(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  // Affectation synchrone : les agrégats hors React voient les données dès ce rendu.
  if (query.data) cachedSeances = query.data
  return query
}

export function useSoutienInscriptions(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: [...INSCRIPTIONS_KEY, viewedYearId],
    queryFn: () => fetchInscriptions(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  if (query.data) cachedInscriptions = query.data
  return query
}

function useInvalidateSoutien() {
  const queryClient = useQueryClient()
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: SEANCES_KEY }), queryClient.invalidateQueries({ queryKey: INSCRIPTIONS_KEY })])
}

/** Champs d'une séance saisis par la vie scolaire (le reste est calculé). */
export interface SeanceInput {
  matiere: string
  jour: JourSoutien
  heureDebut: string
  heureFin: string
  teacherId: string | null
  salleId: string | null
  classes: string[]
  dateDebut: string
  dateFin: string | null
  note: string
}

function seanceToRow(input: SeanceInput) {
  return {
    matiere: input.matiere,
    jour: input.jour,
    heure_debut: input.heureDebut,
    heure_fin: input.heureFin,
    teacher_id: input.teacherId,
    salle_id: input.salleId,
    classes: input.classes,
    date_debut: input.dateDebut,
    date_fin: input.dateFin,
    note: input.note,
  }
}

export function useAddSoutienSeance() {
  const invalidate = useInvalidateSoutien()
  return useMutation({
    mutationFn: async ({ seance, studentIds }: { seance: SeanceInput; studentIds: string[] }): Promise<string> => {
      const { data, error } = await supabase
        .from('soutien_seances')
        .insert({ ...seanceToRow(seance), annee_scolaire_id: getViewedYearIdSnapshot(), created_by: getCurrentUserIdSnapshot() })
        .select('id')
        .single()
      if (error) throw error
      const id = (data as { id: string }).id
      if (studentIds.length > 0) {
        const { error: inscError } = await supabase.from('soutien_inscriptions').insert(studentIds.map((student_id) => ({ seance_id: id, student_id })))
        if (inscError) throw inscError
      }
      await logAudit({ tableName: 'soutien_seances', recordId: id, action: 'insert', newData: { ...seanceToRow(seance), eleves: studentIds.length } })
      return id
    },
    onSuccess: invalidate,
  })
}

export interface UpdateSeanceResult {
  /** Familles remises « à confirmer » parce que le jour ou l'horaire a changé. */
  remisesEnAttente: number
}

/**
 * Modifie une séance et ses inscrits. Si le jour ou l'horaire change, les réponses déjà notées repassent « à confirmer »
 * (et le message n'est plus considéré comme envoyé) : les parents doivent confirmer le nouveau créneau.
 */
export function useUpdateSoutienSeance() {
  const invalidate = useInvalidateSoutien()
  return useMutation({
    mutationFn: async ({ id, seance, studentIds }: { id: string; seance: SeanceInput; studentIds: string[] }): Promise<UpdateSeanceResult> => {
      const avant = cachedSeances.find((s) => s.id === id)
      const { error } = await supabase.from('soutien_seances').update(seanceToRow(seance)).eq('id', id)
      if (error) throw error

      const existants = cachedInscriptions.filter((i) => i.seanceId === id)
      const voulus = new Set(studentIds)
      const aRetirer = existants.filter((i) => !voulus.has(i.studentId)).map((i) => i.id)
      const dejaLa = new Set(existants.map((i) => i.studentId))
      const aAjouter = studentIds.filter((sid) => !dejaLa.has(sid))
      if (aRetirer.length > 0) {
        const { error: delError } = await supabase.from('soutien_inscriptions').delete().in('id', aRetirer)
        if (delError) throw delError
      }
      if (aAjouter.length > 0) {
        const { error: addError } = await supabase.from('soutien_inscriptions').insert(aAjouter.map((student_id) => ({ seance_id: id, student_id })))
        if (addError) throw addError
      }

      let remisesEnAttente = 0
      if (avant && creneauModifie(avant, seance)) {
        const aReinitialiser = existants.filter((i) => voulus.has(i.studentId) && (i.statut !== 'a_confirmer' || i.messageEnvoyeLe))
        if (aReinitialiser.length > 0) {
          const { error: resetError } = await supabase
            .from('soutien_inscriptions')
            .update({ statut: 'a_confirmer', repondu_le: null, message_envoye_le: null })
            .in(
              'id',
              aReinitialiser.map((i) => i.id)
            )
          if (resetError) throw resetError
        }
        remisesEnAttente = aReinitialiser.length
      }
      await logAudit({
        tableName: 'soutien_seances',
        recordId: id,
        action: 'update',
        oldData: avant ? { jour: avant.jour, heure_debut: avant.heureDebut, heure_fin: avant.heureFin, matiere: avant.matiere } : undefined,
        newData: { ...seanceToRow(seance), eleves: studentIds.length, remises_en_attente: remisesEnAttente },
      })
      return { remisesEnAttente }
    },
    onSuccess: invalidate,
  })
}

export function useDeleteSoutienSeance() {
  const invalidate = useInvalidateSoutien()
  return useMutation({
    mutationFn: async (id: string) => {
      const avant = cachedSeances.find((s) => s.id === id)
      // Les inscriptions partent en cascade.
      const { error } = await supabase.from('soutien_seances').delete().eq('id', id)
      if (error) throw error
      await logAudit({ tableName: 'soutien_seances', recordId: id, action: 'delete', oldData: avant ? { matiere: avant.matiere, jour: avant.jour } : undefined })
    },
    onSuccess: invalidate,
  })
}

/** Annule (ou rétablit) la séance à une date précise. */
export function useSetSoutienDateAnnulee() {
  const invalidate = useInvalidateSoutien()
  return useMutation({
    mutationFn: async ({ id, date, annulee }: { id: string; date: string; annulee: boolean }) => {
      const courante = cachedSeances.find((s) => s.id === id)?.datesAnnulees ?? []
      const dates = annulee ? [...new Set([...courante, date])].sort() : courante.filter((d) => d !== date)
      const { error } = await supabase.from('soutien_seances').update({ dates_annulees: dates }).eq('id', id)
      if (error) throw error
      await logAudit({ tableName: 'soutien_seances', recordId: id, action: 'update', newData: { date, annulee } })
    },
    onSuccess: invalidate,
  })
}

/** Note la réponse des parents (`a_confirmer` la retire). */
export function useSetSoutienStatut() {
  const invalidate = useInvalidateSoutien()
  return useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: StatutSoutien }) => {
      const avant = cachedInscriptions.find((i) => i.id === id)
      const { error } = await supabase
        .from('soutien_inscriptions')
        .update({ statut, repondu_le: statut === 'a_confirmer' ? null : new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      await logAudit({
        tableName: 'soutien_inscriptions',
        recordId: id,
        action: 'update',
        oldData: avant ? { statut: avant.statut } : undefined,
        newData: { statut },
      })
    },
    onSuccess: invalidate,
  })
}

/** Marque le message comme envoyé (idempotent : rejouer ne fait que rafraîchir la date). */
export function useMarkSoutienMessageEnvoye() {
  const invalidate = useInvalidateSoutien()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return
      const { error } = await supabase.from('soutien_inscriptions').update({ message_envoye_le: new Date().toISOString() }).in('id', ids)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
