import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface Vigile {
  id: string
  nom: string
  telephone: string
}

interface VigileRow {
  id: string
  nom: string
  telephone: string
}

function rowToVigile(row: VigileRow): Vigile {
  return { id: row.id, nom: row.nom, telephone: row.telephone }
}

const QUERY_KEY = ['vigiles']

async function fetchVigiles(): Promise<Vigile[]> {
  const { data, error } = await supabase.from('vigiles').select('*').order('nom', { ascending: true })
  if (error) throw error
  return (data as VigileRow[]).map(rowToVigile)
}

export function useVigiles(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchVigiles, enabled })
  useEffect(() => {
    if (query.data) cachedVigiles = query.data
  }, [query.data])
  return query
}

export function useAddVigile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: Omit<Vigile, 'id'>) => {
      const { error } = await supabase.from('vigiles').insert({ nom: v.nom, telephone: v.telephone })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateVigile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: Vigile) => {
      const { error } = await supabase.from('vigiles').update({ nom: v.nom, telephone: v.telephone }).eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteVigile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vigiles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

let cachedVigiles: Vigile[] = []

/** Instantané synchrone pour les utilitaires hors-React. */
export function getVigilesSnapshot(): Vigile[] {
  return cachedVigiles
}
