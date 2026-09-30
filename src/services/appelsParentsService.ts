import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useViewedYearId, getViewedYearIdSnapshot } from './viewedYear'
import { useAnneesLoaded } from './anneesScolairesService'

export interface AppelParentRecord {
  id: string
  studentId: string
  date: string
  markedBy: string
  markedAt: string
  note?: string
  parentAppele: string
}

interface AppelParentRow {
  id: string
  student_id: string
  date: string
  marked_by: string
  marked_at: string
  note: string | null
  parent_appele: string
}

function rowToAppelParent(row: AppelParentRow): AppelParentRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    date: row.date,
    markedBy: row.marked_by,
    markedAt: row.marked_at,
    note: row.note ?? undefined,
    parentAppele: row.parent_appele,
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function fetchAppelsParentsForToday(yearId: string): Promise<AppelParentRecord[]> {
  const { data, error } = await supabase.from('appels_parents').select('*').eq('annee_scolaire_id', yearId).eq('date', todayISO())
  if (error) throw error
  return (data as AppelParentRow[]).map(rowToAppelParent)
}

export async function fetchAppelsParentsHistory(yearId: string): Promise<AppelParentRecord[]> {
  const { data, error } = await supabase
    .from('appels_parents')
    .select('*')
    .eq('annee_scolaire_id', yearId)
    .order('marked_at', { ascending: false })
  if (error) throw error
  return (data as AppelParentRow[]).map(rowToAppelParent)
}

/** Journal complet (toutes les dates) pour l'année consultée — distinct de useAppelsParentsToday
 * qui ne sert que la liste "Parents à appeler" du jour. */
export function useAppelsParentsHistory(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  return useQuery({
    queryKey: ['appelsParentsHistory', viewedYearId],
    queryFn: () => fetchAppelsParentsHistory(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
}

let cachedAppelsParentsToday: AppelParentRecord[] = []

export function useAppelsParentsToday(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: ['appelsParents', viewedYearId, todayISO()],
    queryFn: () => fetchAppelsParentsForToday(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  // Affectation synchrone (pas un useEffect) : même raison que useAppelsToday — les utilitaires
  // hors-React lisant getAppelsParentsTodaySnapshot() dans le même rendu doivent voir la valeur
  // fraîche immédiatement, pas après le prochain commit.
  if (query.data) cachedAppelsParentsToday = query.data
  return query
}

/** Instantané synchrone pour les utilitaires hors-React. */
export function getAppelsParentsTodaySnapshot(): AppelParentRecord[] {
  return cachedAppelsParentsToday
}

export interface MarkAppelParentInput {
  studentId: string
  markedBy: string
  note?: string
  parentAppele: string
}

async function markAppelParentDone(input: MarkAppelParentInput): Promise<void> {
  const { error } = await supabase.from('appels_parents').upsert(
    {
      annee_scolaire_id: getViewedYearIdSnapshot(),
      date: todayISO(),
      student_id: input.studentId,
      marked_by: input.markedBy,
      marked_at: new Date().toISOString(),
      note: input.note || null,
      parent_appele: input.parentAppele,
    },
    { onConflict: 'student_id,date' }
  )
  if (error) throw error
}

export function useMarkAppelParentDone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAppelParentDone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appelsParents'] })
      queryClient.invalidateQueries({ queryKey: ['appelsParentsHistory'] })
    },
  })
}
