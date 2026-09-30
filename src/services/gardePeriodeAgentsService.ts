import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { PersonnelType } from './gardeAffectationsService'

export interface GardePeriodeAgent {
  id: string
  periodeId: string
  personnelType: PersonnelType
  personnelId: string
  ordre: number
}

interface GardePeriodeAgentRow {
  id: string
  periode_id: string
  personnel_type: PersonnelType
  personnel_id: string
  ordre: number
}

function rowToAgent(row: GardePeriodeAgentRow): GardePeriodeAgent {
  return { id: row.id, periodeId: row.periode_id, personnelType: row.personnel_type, personnelId: row.personnel_id, ordre: row.ordre }
}

const QUERY_KEY = ['gardePeriodeAgents']

async function fetchGardePeriodeAgents(periodeId: string): Promise<GardePeriodeAgent[]> {
  const { data, error } = await supabase.from('garde_periode_agents').select('*').eq('periode_id', periodeId).order('ordre', { ascending: true })
  if (error) throw error
  return (data as GardePeriodeAgentRow[]).map(rowToAgent)
}

export function useGardePeriodeAgents(periodeId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, periodeId],
    queryFn: () => fetchGardePeriodeAgents(periodeId as string),
    enabled: enabled && !!periodeId,
  })
}

export function useAddPeriodeAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      periodeId,
      personnelType,
      personnelId,
      ordre,
    }: {
      periodeId: string
      personnelType: PersonnelType
      personnelId: string
      ordre: number
    }) => {
      const { error } = await supabase
        .from('garde_periode_agents')
        .insert({ periode_id: periodeId, personnel_type: personnelType, personnel_id: personnelId, ordre })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useRemovePeriodeAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('garde_periode_agents').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
