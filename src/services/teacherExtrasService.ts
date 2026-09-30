import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { TeacherAbsenceRecord, RemplacementRecord, TeacherExtra } from '../data/teacherExtras'
import { useViewedYearId, getViewedYearIdSnapshot } from './viewedYear'
import { useAnneesLoaded } from './anneesScolairesService'

interface AbsenceRow {
  id: string
  teacher_id: string
  date: string
  type: 'ABSENCE' | 'RETARD'
  justified: boolean
  classe: string
  duree: number
  motif: string
  slot_id: string | null
  ignored_gaps: { start: string; end: string }[]
}

interface RemplacementRow {
  id: string
  teacher_id: string
  date: string
  classe: string
  matiere: string
  prof_remplace: string
  heures: number
  start_time: string | null
  end_time: string | null
  consignes: string | null
}

function rowToAbsence(row: AbsenceRow): TeacherAbsenceRecord {
  return {
    date: row.date,
    type: row.type,
    justified: row.justified,
    classe: row.classe,
    duree: row.duree,
    motif: row.motif,
    slotId: row.slot_id ?? undefined,
    ignoredGaps: row.ignored_gaps ?? [],
  }
}

function rowToRemplacement(row: RemplacementRow): RemplacementRecord {
  return {
    date: row.date,
    classe: row.classe,
    matiere: row.matiere,
    profRemplace: row.prof_remplace,
    heures: row.heures,
    start: row.start_time ?? undefined,
    end: row.end_time ?? undefined,
    consignes: row.consignes ?? undefined,
  }
}

const defaultExtra: TeacherExtra = { absences: [], remplacements: [] }

export async function fetchTeacherExtras(yearId: string): Promise<Record<string, TeacherExtra>> {
  const [absencesRes, remplacementsRes] = await Promise.all([
    supabase.from('teacher_absences').select('*').eq('annee_scolaire_id', yearId),
    supabase.from('teacher_remplacements').select('*').eq('annee_scolaire_id', yearId),
  ])
  if (absencesRes.error) throw absencesRes.error
  if (remplacementsRes.error) throw remplacementsRes.error
  const absenceRows = absencesRes.data as AbsenceRow[]
  const remplacementRows = remplacementsRes.data as RemplacementRow[]

  const result: Record<string, TeacherExtra> = {}
  absenceRows.forEach((row) => {
    const extra = result[row.teacher_id] ?? { absences: [], remplacements: [] }
    extra.absences.push(rowToAbsence(row))
    result[row.teacher_id] = extra
  })
  remplacementRows.forEach((row) => {
    const extra = result[row.teacher_id] ?? { absences: [], remplacements: [] }
    extra.remplacements.push(rowToRemplacement(row))
    result[row.teacher_id] = extra
  })
  return result
}

export function useTeacherExtras(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: ['teacherExtras', viewedYearId],
    queryFn: () => fetchTeacherExtras(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  // Affectation synchrone (pas un useEffect) : voir classSchedulesService.ts (useClassSchedules)
  // pour le détail du décalage d'un rendu qu'un useEffect provoquerait ici.
  if (query.data) cachedExtras = query.data
  return query
}

let cachedExtras: Record<string, TeacherExtra> = {}

/** Instantanés synchrones pour les utilitaires hors-React. */
export function getAllTeacherExtrasSnapshot(): Record<string, TeacherExtra> {
  return cachedExtras
}

export function getTeacherExtraSnapshot(id: string): TeacherExtra {
  return cachedExtras[id] ?? defaultExtra
}

/** Écritures directes (hors hook React) pour l'import Excel en masse. */
export async function replaceTeacherAbsencesDirect(teacherId: string, absences: TeacherAbsenceRecord[]): Promise<void> {
  const { error: deleteError } = await supabase.from('teacher_absences').delete().eq('teacher_id', teacherId)
  if (deleteError) throw deleteError
  if (absences.length === 0) return
  const { error: insertError } = await supabase.from('teacher_absences').insert(
    absences.map((a) => ({
      teacher_id: teacherId,
      date: a.date,
      type: a.type,
      justified: a.justified,
      classe: a.classe,
      duree: a.duree,
      motif: a.motif,
      slot_id: a.slotId ?? null,
      ignored_gaps: a.ignoredGaps ?? [],
      annee_scolaire_id: getViewedYearIdSnapshot(),
    }))
  )
  if (insertError) throw insertError
}

export async function replaceTeacherRemplacementsDirect(teacherId: string, remplacements: RemplacementRecord[]): Promise<void> {
  const { error: deleteError } = await supabase.from('teacher_remplacements').delete().eq('teacher_id', teacherId)
  if (deleteError) throw deleteError
  if (remplacements.length === 0) return
  const { error: insertError } = await supabase.from('teacher_remplacements').insert(
    remplacements.map((r) => ({
      teacher_id: teacherId,
      date: r.date,
      classe: r.classe,
      matiere: r.matiere,
      prof_remplace: r.profRemplace,
      heures: r.heures,
      start_time: r.start ?? null,
      end_time: r.end ?? null,
      consignes: r.consignes ?? null,
      annee_scolaire_id: getViewedYearIdSnapshot(),
    }))
  )
  if (insertError) throw insertError
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['teacherExtras'] })
}

export function useUpdateTeacherAbsences() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ teacherId, absences }: { teacherId: string; absences: TeacherAbsenceRecord[] }) =>
      replaceTeacherAbsencesDirect(teacherId, absences),
    onSuccess: invalidate,
  })
}

export function useUpdateTeacherRemplacements() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ teacherId, remplacements }: { teacherId: string; remplacements: RemplacementRecord[] }) =>
      replaceTeacherRemplacementsDirect(teacherId, remplacements),
    onSuccess: invalidate,
  })
}
