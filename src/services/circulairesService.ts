import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { getStudentsSnapshot } from './studentsService'
import { getParentStudentLinksSnapshot } from './parentsService'
import { getViewedYearIdSnapshot } from './viewedYear'
import { getCurrentUserIdSnapshot } from './currentUser'
import { logAudit } from './auditLogService'

export type CibleType = 'etablissement' | 'niveau' | 'classe' | 'eleves'

export interface Circulaire {
  id: string
  titre: string
  corps: string
  cibleType: CibleType
  cibleNiveau: string | null
  cibleClasse: string | null
  cibleEleveIds: string[] | null
  relanceJours: number | null
  publieAt: string
  createdBy: string | null
}

interface CirculaireRow {
  id: string
  titre: string
  corps: string
  cible_type: CibleType
  cible_niveau: string | null
  cible_classe: string | null
  cible_eleve_ids: string[] | null
  relance_jours: number | null
  publie_at: string
  created_by: string | null
}

function rowToCirculaire(row: CirculaireRow): Circulaire {
  return {
    id: row.id,
    titre: row.titre,
    corps: row.corps,
    cibleType: row.cible_type,
    cibleNiveau: row.cible_niveau,
    cibleClasse: row.cible_classe,
    cibleEleveIds: row.cible_eleve_ids,
    relanceJours: row.relance_jours,
    publieAt: row.publie_at,
    createdBy: row.created_by,
  }
}

const QUERY_KEY = ['circulaires']

async function fetchCirculaires(yearId: string): Promise<Circulaire[]> {
  const { data, error } = await supabase
    .from('circulaires')
    .select('*')
    .eq('annee_scolaire_id', yearId)
    .order('publie_at', { ascending: false })
  if (error) throw error
  return (data as CirculaireRow[]).map(rowToCirculaire)
}

export function useCirculaires(enabled = true) {
  const yearId = getViewedYearIdSnapshot()
  return useQuery({ queryKey: [...QUERY_KEY, yearId], queryFn: () => fetchCirculaires(yearId), enabled })
}

// Même regex que niveauFromClasse() (privée dans alertEngine.ts) — dupliquée ici plutôt
// qu'exportée, cohérent avec les autres petits helpers purs déjà dupliqués dans ce projet
// (timeToMinutes etc.).
function niveauFromClasse(classe: string): string {
  return classe.replace(/-[A-Z]$/, '')
}

/** Résout les student_id ciblés par une circulaire, pour le fan-out de publication. */
function resolveTargetStudentIds(input: {
  cibleType: CibleType
  cibleNiveau?: string
  cibleClasse?: string
  cibleEleveIds?: string[]
}): string[] {
  const students = getStudentsSnapshot()
  if (input.cibleType === 'etablissement') return students.map((s) => s.id)
  if (input.cibleType === 'niveau') return students.filter((s) => niveauFromClasse(s.classe) === input.cibleNiveau).map((s) => s.id)
  if (input.cibleType === 'classe') return students.filter((s) => s.classe === input.cibleClasse).map((s) => s.id)
  return input.cibleEleveIds ?? []
}

/**
 * Publie une circulaire ET matérialise le fan-out (une ligne circulaire_lectures par parent
 * concerné) en une seule opération — le ciblage est figé à cet instant, jamais recalculé ensuite.
 */
export function usePublishCirculaire() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      titre: string
      corps: string
      cibleType: CibleType
      cibleNiveau?: string
      cibleClasse?: string
      cibleEleveIds?: string[]
      relanceJours?: number
    }) => {
      const { data: circulaireRow, error } = await supabase
        .from('circulaires')
        .insert({
          titre: input.titre,
          corps: input.corps,
          cible_type: input.cibleType,
          cible_niveau: input.cibleNiveau ?? null,
          cible_classe: input.cibleClasse ?? null,
          cible_eleve_ids: input.cibleEleveIds ?? null,
          relance_jours: input.relanceJours ?? null,
          created_by: getCurrentUserIdSnapshot(),
          annee_scolaire_id: getViewedYearIdSnapshot(),
        })
        .select('id')
        .single()
      if (error) throw error

      const targetStudentIds = new Set(resolveTargetStudentIds(input))
      const parentIds = new Set(
        getParentStudentLinksSnapshot()
          .filter((l) => targetStudentIds.has(l.studentId))
          .map((l) => l.parentId)
      )
      if (parentIds.size > 0) {
        const rows = Array.from(parentIds).map((parentId) => ({ circulaire_id: circulaireRow.id, parent_id: parentId }))
        const { error: fanoutError } = await supabase.from('circulaire_lectures').insert(rows)
        if (fanoutError) throw fanoutError
      }
      void logAudit({
        tableName: 'circulaires',
        recordId: circulaireRow.id,
        action: 'insert',
        newData: { ...input, destinataires: parentIds.size },
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

// --- Statistiques de lecture (vue admin) ---

export interface CirculaireLecture {
  id: string
  circulaireId: string
  parentId: string
  readAt: string | null
}

interface CirculaireLectureRow {
  id: string
  circulaire_id: string
  parent_id: string
  read_at: string | null
}

export function useCirculaireLectures(circulaireId: string | null) {
  return useQuery({
    queryKey: ['circulaireLectures', circulaireId],
    queryFn: async (): Promise<CirculaireLecture[]> => {
      const { data, error } = await supabase.from('circulaire_lectures').select('*').eq('circulaire_id', circulaireId as string)
      if (error) throw error
      return (data as CirculaireLectureRow[]).map((row) => ({
        id: row.id,
        circulaireId: row.circulaire_id,
        parentId: row.parent_id,
        readAt: row.read_at,
      }))
    },
    enabled: !!circulaireId,
  })
}

// --- Côté portail parent ---

export interface ParentCirculaireEntry {
  lectureId: string
  circulaire: Circulaire
  readAt: string | null
}

export function useMyCirculaires(parentId: string | null) {
  return useQuery({
    queryKey: ['myCirculaires', parentId],
    queryFn: async (): Promise<ParentCirculaireEntry[]> => {
      const { data, error } = await supabase
        .from('circulaire_lectures')
        .select('id, read_at, circulaires(*)')
        .eq('parent_id', parentId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as { id: string; read_at: string | null; circulaires: CirculaireRow }[])
        .filter((row) => !!row.circulaires)
        .map((row) => ({ lectureId: row.id, readAt: row.read_at, circulaire: rowToCirculaire(row.circulaires) }))
    },
    enabled: !!parentId,
  })
}

export function useMarkCirculaireRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (lectureId: string) => {
      const { error } = await supabase
        .from('circulaire_lectures')
        .update({ read_at: new Date().toISOString() })
        .eq('id', lectureId)
        .is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myCirculaires'] }),
  })
}
