import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface GardeFamille {
  key: string
  label: string
  color: string
  soft: string
  fg: string
}

const QUERY_KEY = ['gardeFamilles']

async function fetchGardeFamilles(): Promise<GardeFamille[]> {
  const { data, error } = await supabase.from('garde_familles').select('*').order('key', { ascending: true })
  if (error) throw error
  return data as GardeFamille[]
}

export function useGardeFamilles(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchGardeFamilles, enabled })
  useEffect(() => {
    if (query.data) cachedFamilles = query.data
  }, [query.data])
  return query
}

export function useUpdateGardeFamilleColor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (f: GardeFamille) => {
      const { error } = await supabase.from('garde_familles').update({ color: f.color, soft: f.soft, fg: f.fg }).eq('key', f.key)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

let cachedFamilles: GardeFamille[] = []

/** Instantané synchrone pour les utilitaires hors-React. */
export function getGardeFamillesSnapshot(): GardeFamille[] {
  return cachedFamilles
}
