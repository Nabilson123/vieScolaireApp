import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { ExamPeriod } from '../data/examPeriod'
import { useViewedYearId, getViewedYearIdSnapshot } from './viewedYear'
import { useAnneesLoaded } from './anneesScolairesService'

interface ExamPeriodRow {
  id: string
  label: string
  created_at: string
}

function rowToPeriod(row: ExamPeriodRow): ExamPeriod {
  return { id: row.id, label: row.label, createdAt: row.created_at }
}

async function fetchExamPeriods(yearId: string): Promise<ExamPeriod[]> {
  const { data, error } = await supabase.from('exam_periods').select('*').eq('annee_scolaire_id', yearId).order('created_at', { ascending: false })
  if (error) throw error
  return (data as ExamPeriodRow[]).map(rowToPeriod)
}

export function useExamPeriods(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: ['examPeriods', viewedYearId],
    queryFn: () => fetchExamPeriods(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  // Affectation synchrone (pas un useEffect) : voir classSchedulesService.ts (useClassSchedules)
  // pour le détail du décalage d'un rendu qu'un useEffect provoquerait ici.
  if (query.data) cachedPeriods = query.data
  return query
}

let cachedPeriods: ExamPeriod[] = []

export function getExamPeriodsSnapshot(): ExamPeriod[] {
  return cachedPeriods
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['examPeriods'] })
}

export function useAddExamPeriod() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (label: string) => {
      const { data, error } = await supabase
        .from('exam_periods')
        .insert({ label, annee_scolaire_id: getViewedYearIdSnapshot() })
        .select()
        .single()
      if (error) throw error
      return rowToPeriod(data as ExamPeriodRow)
    },
    onSuccess: invalidate,
  })
}

export function useDeleteExamPeriod() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exam_periods').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
