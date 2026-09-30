import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface TransportRotationEntry {
  id: string
  changedAt: string
  lignesCollege: string[]
}

interface TransportRotationHistoryRow {
  id: string
  changed_at: string
  lignes_college: string[]
}

function rowToEntry(row: TransportRotationHistoryRow): TransportRotationEntry {
  return { id: row.id, changedAt: row.changed_at, lignesCollege: row.lignes_college }
}

const QUERY_KEY = ['transportRotationHistory']

async function fetchTransportRotationHistory(): Promise<TransportRotationEntry[]> {
  const { data, error } = await supabase
    .from('transport_rotation_history')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data as TransportRotationHistoryRow[]).map(rowToEntry)
}

export function useTransportRotationHistory(enabled = true) {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchTransportRotationHistory, enabled })
}

export function useLogTransportRotationChange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (lignesCollege: string[]) => {
      const { error } = await supabase.from('transport_rotation_history').insert({ lignes_college: lignesCollege })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
