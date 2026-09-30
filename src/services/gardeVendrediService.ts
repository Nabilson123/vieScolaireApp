import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type VendrediMode = 'marks' | 'note'

export interface GardeVendredi {
  id: string
  periodeId: string
  ordre: number
  dateLabel: string
  mode: VendrediMode
  note: string
}

interface GardeVendrediRow {
  id: string
  periode_id: string
  ordre: number
  date_label: string
  mode: VendrediMode
  note: string
}

function rowToVendredi(row: GardeVendrediRow): GardeVendredi {
  return { id: row.id, periodeId: row.periode_id, ordre: row.ordre, dateLabel: row.date_label, mode: row.mode, note: row.note }
}

const QUERY_KEY = ['gardeVendredi']
const PRESENCE_QUERY_KEY = ['gardeVendrediPresence']

async function fetchGardeVendredi(periodeId: string): Promise<GardeVendredi[]> {
  const { data, error } = await supabase.from('garde_vendredi').select('*').eq('periode_id', periodeId).order('ordre', { ascending: true })
  if (error) throw error
  return (data as GardeVendrediRow[]).map(rowToVendredi)
}

export function useGardeVendredi(periodeId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, periodeId],
    queryFn: () => fetchGardeVendredi(periodeId as string),
    enabled: enabled && !!periodeId,
  })
}

export function useAddVendredi() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ periodeId, ordre, dateLabel }: { periodeId: string; ordre: number; dateLabel: string }) => {
      const { error } = await supabase.from('garde_vendredi').insert({ periode_id: periodeId, ordre, date_label: dateLabel, mode: 'marks', note: '' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateVendrediDate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dateLabel }: { id: string; dateLabel: string }) => {
      const { error } = await supabase.from('garde_vendredi').update({ date_label: dateLabel }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateVendrediNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase.from('garde_vendredi').update({ note }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useRemoveVendredi() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('garde_vendredi').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** Bascule le mode ET, si passage à 'note', marque tous les agents de la période présents dans le
 * modèle (pas seulement visuellement) — "la garde est annulée, tous les agents sont présents". */
export function useToggleVendrediMode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      vendrediId,
      periodeAgentIds,
      newMode,
    }: {
      vendrediId: string
      periodeAgentIds: string[]
      newMode: VendrediMode
    }) => {
      const { error } = await supabase.from('garde_vendredi').update({ mode: newMode }).eq('id', vendrediId)
      if (error) throw error
      if (newMode === 'note' && periodeAgentIds.length) {
        const { error: presError } = await supabase
          .from('garde_vendredi_presence')
          .upsert(
            periodeAgentIds.map((periodeAgentId) => ({ vendredi_id: vendrediId, periode_agent_id: periodeAgentId, present: true })),
            { onConflict: 'vendredi_id,periode_agent_id' }
          )
        if (presError) throw presError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: PRESENCE_QUERY_KEY })
    },
  })
}
