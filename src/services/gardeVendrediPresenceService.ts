import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface GardeVendrediPresence {
  id: string
  vendrediId: string
  periodeAgentId: string
  present: boolean
}

interface GardeVendrediPresenceRow {
  id: string
  vendredi_id: string
  periode_agent_id: string
  present: boolean
  garde_vendredi: { periode_id: string } | { periode_id: string }[]
}

function rowToPresence(row: GardeVendrediPresenceRow): GardeVendrediPresence {
  return { id: row.id, vendrediId: row.vendredi_id, periodeAgentId: row.periode_agent_id, present: row.present }
}

const QUERY_KEY = ['gardeVendrediPresence']

async function fetchPresence(periodeId: string): Promise<GardeVendrediPresence[]> {
  const { data, error } = await supabase
    .from('garde_vendredi_presence')
    .select('*, garde_vendredi!inner(periode_id)')
    .eq('garde_vendredi.periode_id', periodeId)
  if (error) throw error
  return (data as GardeVendrediPresenceRow[]).map(rowToPresence)
}

export function useGardeVendrediPresence(periodeId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, periodeId],
    queryFn: () => fetchPresence(periodeId as string),
    enabled: enabled && !!periodeId,
  })
}

export function useTogglePresence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ vendrediId, periodeAgentId, present }: { vendrediId: string; periodeAgentId: string; present: boolean }) => {
      const { error } = await supabase
        .from('garde_vendredi_presence')
        .upsert({ vendredi_id: vendrediId, periode_agent_id: periodeAgentId, present }, { onConflict: 'vendredi_id,periode_agent_id' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
