import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { ExamSession, ExamType, SurveillantAssignment } from '../data/examPlanner'
import { useViewedYearId, getViewedYearIdSnapshot } from './viewedYear'
import { useAnneesLoaded } from './anneesScolairesService'

interface ExamSessionRow {
  id: string
  date: string
  start_time: string
  end_time: string
  classe: string
  matiere: string
  salle_label: string
  surveillants: SurveillantAssignment[]
  consignes: string
  type: string
  period_id: string | null
}

function rowToSession(row: ExamSessionRow): ExamSession {
  return {
    id: row.id,
    date: row.date,
    start: row.start_time,
    end: row.end_time,
    classe: row.classe,
    matiere: row.matiere,
    salleLabel: row.salle_label,
    surveillants: row.surveillants ?? [],
    consignes: row.consignes,
    type: (row.type as ExamType) ?? 'Examen Officiel',
    periodId: row.period_id ?? undefined,
  }
}

async function fetchExamSessions(yearId: string): Promise<ExamSession[]> {
  const { data, error } = await supabase.from('exam_sessions').select('*').eq('annee_scolaire_id', yearId).order('date', { ascending: true })
  if (error) throw error
  return (data as ExamSessionRow[]).map(rowToSession)
}

export function useExamSessions(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: ['examSessions', viewedYearId],
    queryFn: () => fetchExamSessions(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  // Affectation synchrone (pas un useEffect) : voir classSchedulesService.ts (useClassSchedules)
  // pour le détail du décalage d'un rendu qu'un useEffect provoquerait ici.
  if (query.data) cachedSessions = query.data
  return query
}

let cachedSessions: ExamSession[] = []

export function getExamSessionsSnapshot(): ExamSession[] {
  return cachedSessions
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['examSessions'] })
}

export function useAddExamSession() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (s: Omit<ExamSession, 'id'>) => {
      const { error } = await supabase.from('exam_sessions').insert({
        date: s.date,
        start_time: s.start,
        end_time: s.end,
        classe: s.classe,
        matiere: s.matiere,
        salle_label: s.salleLabel,
        surveillants: s.surveillants,
        consignes: s.consignes,
        type: s.type,
        period_id: s.periodId ?? null,
        annee_scolaire_id: getViewedYearIdSnapshot(),
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateExamSession() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (s: ExamSession) => {
      const { error } = await supabase
        .from('exam_sessions')
        .update({
          date: s.date,
          start_time: s.start,
          end_time: s.end,
          classe: s.classe,
          matiere: s.matiere,
          salle_label: s.salleLabel,
          surveillants: s.surveillants,
          consignes: s.consignes,
          type: s.type,
          period_id: s.periodId ?? null,
        })
        .eq('id', s.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteExamSession() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exam_sessions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
