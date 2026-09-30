import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useViewedYearId, getViewedYearIdSnapshot } from './viewedYear'
import { useAnneesLoaded } from './anneesScolairesService'

export interface AppelRecord {
  id: string
  date: string
  classe: string
  slotId: string
  markedBy: string
  markedAt: string
  note?: string
}

interface AppelRow {
  id: string
  date: string
  classe: string
  slot_id: string
  marked_by: string
  marked_at: string
  note: string | null
}

function rowToAppel(row: AppelRow): AppelRecord {
  return { id: row.id, date: row.date, classe: row.classe, slotId: row.slot_id, markedBy: row.marked_by, markedAt: row.marked_at, note: row.note ?? undefined }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function fetchAppelsForToday(yearId: string): Promise<AppelRecord[]> {
  const { data, error } = await supabase.from('appels').select('*').eq('annee_scolaire_id', yearId).eq('date', todayISO())
  if (error) throw error
  return (data as AppelRow[]).map(rowToAppel)
}

let cachedAppelsToday: AppelRecord[] = []

export function useAppelsToday(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: ['appels', viewedYearId, todayISO()],
    queryFn: () => fetchAppelsForToday(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  // Affectation synchrone (pas un useEffect) : même raison que useClassSchedules/useClasses —
  // les utilitaires hors-React lisant getAppelsTodaySnapshot() dans le même rendu doivent voir la
  // valeur fraîche immédiatement, pas après le prochain commit.
  if (query.data) cachedAppelsToday = query.data
  return query
}

/** Instantané synchrone pour les utilitaires hors-React. */
export function getAppelsTodaySnapshot(): AppelRecord[] {
  return cachedAppelsToday
}

export interface MarkAppelInput {
  classe: string
  slotId: string
  markedBy: string
}

async function markAppelDone(input: MarkAppelInput): Promise<void> {
  const { error } = await supabase.from('appels').upsert(
    {
      annee_scolaire_id: getViewedYearIdSnapshot(),
      date: todayISO(),
      classe: input.classe,
      slot_id: input.slotId,
      marked_by: input.markedBy,
      marked_at: new Date().toISOString(),
    },
    { onConflict: 'annee_scolaire_id,date,slot_id' }
  )
  if (error) throw error
}

export function useMarkAppelDone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAppelDone,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appels'] }),
  })
}
