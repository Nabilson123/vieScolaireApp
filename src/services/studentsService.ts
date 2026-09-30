import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Student } from '../data/students'
import { useViewedYearId, getViewedYearIdSnapshot } from './viewedYear'
import { useAnneesLoaded } from './anneesScolairesService'
import { logAudit } from './auditLogService'

interface StudentRow {
  id: string
  name: string
  sexe: 'M' | 'F'
  classe: string
  absences_heures: string
  absences_fois: number
  retards_min: string
  retards_fois: number
  total_heures: string
  taux: number
  annee_scolaire_id: string
  dossier_id: string
}

function rowToStudent(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    sexe: row.sexe,
    classe: row.classe,
    absencesHeures: row.absences_heures,
    absencesFois: row.absences_fois,
    retardsMin: row.retards_min,
    retardsFois: row.retards_fois,
    totalHeures: row.total_heures,
    taux: row.taux,
    anneeScolaireId: row.annee_scolaire_id,
    dossierId: row.dossier_id,
  }
}

function studentPatchToRow(patch: Partial<Student>) {
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.sexe !== undefined) row.sexe = patch.sexe
  if (patch.classe !== undefined) row.classe = patch.classe
  if (patch.absencesHeures !== undefined) row.absences_heures = patch.absencesHeures
  if (patch.absencesFois !== undefined) row.absences_fois = patch.absencesFois
  if (patch.retardsMin !== undefined) row.retards_min = patch.retardsMin
  if (patch.retardsFois !== undefined) row.retards_fois = patch.retardsFois
  if (patch.totalHeures !== undefined) row.total_heures = patch.totalHeures
  if (patch.taux !== undefined) row.taux = patch.taux
  return row
}

export async function fetchStudents(yearId: string): Promise<Student[]> {
  const { data, error } = await supabase.from('students').select('*').eq('annee_scolaire_id', yearId).order('name', { ascending: true })
  if (error) throw error
  return (data as StudentRow[]).map(rowToStudent)
}

export function useStudents(enabled = true) {
  // Attend que la liste des années ait réellement chargé avant de filtrer par année : sinon
  // getViewedYearIdSnapshot() retombe sur l'id de secours (non-UUID), rejeté par Postgres.
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({ queryKey: ['students', viewedYearId], queryFn: () => fetchStudents(viewedYearId), enabled: enabled && anneesLoaded })
  // Affectation synchrone (pas un useEffect) : sinon getStudentsSnapshot() resterait en retard
  // d'un rendu par rapport à query.data à chaque changement d'année. Voir le commentaire détaillé
  // dans classSchedulesService.ts (useClassSchedules), où ce décalage a été diagnostiqué.
  if (query.data) cachedStudents = query.data
  return query
}

let cachedStudents: Student[] = []

/** Instantané synchrone pour les utilitaires hors-React. */
export function getStudentsSnapshot(): Student[] {
  return cachedStudents
}

/**
 * Cherche si un élève avec ce code Massar existe déjà dans une année précédente, pour réutiliser
 * son dossier_id à la réinscription plutôt que d'en générer un nouveau — c'est ce qui relie les
 * fiches d'un même élève d'une année sur l'autre (onglet "Historique" de la fiche élève).
 */
async function findDossierIdByCodeMassar(codeMassar: string): Promise<string | undefined> {
  if (!codeMassar.trim()) return undefined
  const { data, error } = await supabase
    .from('student_identities')
    .select('students!inner(dossier_id)')
    .eq('code_massar', codeMassar)
    .limit(1)
    .maybeSingle<{ students: { dossier_id: string } }>()
  if (error) throw error
  return data?.students?.dossier_id
}

/**
 * Écritures directes (hors hook React) pour l'import Excel en masse et le recalcul d'assiduité.
 * codeMassar (si fourni) sert uniquement au rapprochement dossier_id avec une année précédente —
 * il n'est pas stocké sur la ligne students elle-même (c'est student_identities qui le porte).
 */
export async function insertStudent(data: Omit<Student, 'id' | 'dossierId'>, codeMassar?: string): Promise<string> {
  const dossierId = codeMassar ? await findDossierIdByCodeMassar(codeMassar) : undefined
  const row: Record<string, unknown> = { ...studentPatchToRow(data), annee_scolaire_id: getViewedYearIdSnapshot() }
  if (dossierId) row.dossier_id = dossierId
  const { data: inserted, error } = await supabase.from('students').insert(row).select('id').single()
  if (error) throw error
  void logAudit({ tableName: 'students', recordId: inserted.id as string, action: 'insert', newData: row })
  return inserted.id as string
}

/** Toutes les fiches (années confondues) partageant ce dossier_id — alimente l'onglet "Historique". */
export async function fetchStudentDossierHistory(dossierId: string): Promise<Student[]> {
  const { data, error } = await supabase.from('students').select('*').eq('dossier_id', dossierId)
  if (error) throw error
  return (data as StudentRow[]).map(rowToStudent)
}

export async function updateStudentRow(id: string, patch: Partial<Student>): Promise<void> {
  const previous = cachedStudents.find((s) => s.id === id)
  const oldData: Record<string, unknown> | undefined = previous
    ? Object.fromEntries(Object.keys(patch).map((key) => [key, (previous as unknown as Record<string, unknown>)[key]]))
    : undefined
  const { error } = await supabase.from('students').update(studentPatchToRow(patch)).eq('id', id)
  if (error) throw error
  void logAudit({ tableName: 'students', recordId: id, action: 'update', oldData, newData: patch as Record<string, unknown> })
}

export async function deleteStudentRow(id: string): Promise<void> {
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw error
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['students'] })
}

export function useAddStudent() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ data, codeMassar }: { data: Omit<Student, 'id' | 'dossierId'>; codeMassar?: string }) => insertStudent(data, codeMassar),
    onSuccess: invalidate,
  })
}

export function useUpdateStudent() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Student> }) => updateStudentRow(id, patch),
    onSuccess: invalidate,
  })
}

/**
 * Suppression définitive d'un élève (cascade sur student_identities/student_extras — notes,
 * absences, discipline, santé...). name/classe ne servent qu'à l'audit log : une fois la ligne
 * supprimée, record_id (l'UUID) seul ne dit plus qui était l'élève concerné.
 */
export function useDeleteStudent() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, name, classe }: { id: string; name: string; classe: string }) => {
      await deleteStudentRow(id)
      void logAudit({ tableName: 'students', recordId: id, action: 'delete', oldData: { name, classe } })
    },
    onSuccess: invalidate,
  })
}
