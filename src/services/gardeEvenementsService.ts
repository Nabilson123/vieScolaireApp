import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface GardeEvenement {
  id: string
  label: string
  familleKey: string
  ordre: number
}

interface GardeEvenementRow {
  id: string
  label: string
  famille_key: string
  ordre: number
}

function rowToEvenement(row: GardeEvenementRow): GardeEvenement {
  return { id: row.id, label: row.label, familleKey: row.famille_key, ordre: row.ordre }
}

const QUERY_KEY = ['gardeEvenements']

async function fetchGardeEvenements(): Promise<GardeEvenement[]> {
  const { data, error } = await supabase.from('garde_evenements').select('*').order('ordre', { ascending: true })
  if (error) throw error
  return (data as GardeEvenementRow[]).map(rowToEvenement)
}

export function useGardeEvenements(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchGardeEvenements, enabled })
  useEffect(() => {
    if (query.data) cachedEvenements = query.data
  }, [query.data])
  return query
}

export function useAddGardeEvenement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (e: { id: string; label: string; familleKey: string }) => {
      const maxOrdre = cachedEvenements.reduce((m, x) => Math.max(m, x.ordre), 0)
      const { error } = await supabase.from('garde_evenements').insert({ id: e.id, label: e.label, famille_key: e.familleKey, ordre: maxOrdre + 1 })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateGardeEvenement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (e: GardeEvenement) => {
      const { error } = await supabase.from('garde_evenements').update({ label: e.label, famille_key: e.familleKey }).eq('id', e.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteGardeEvenement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('garde_evenements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

let cachedEvenements: GardeEvenement[] = []

/** Instantané synchrone pour les utilitaires hors-React. */
export function getGardeEvenementsSnapshot(): GardeEvenement[] {
  return cachedEvenements
}
