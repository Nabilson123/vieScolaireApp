import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface AideMaitresse {
  id: string
  nom: string
  telephone: string
}

interface AideMaitresseRow {
  id: string
  nom: string
  telephone: string
}

function rowToAide(row: AideMaitresseRow): AideMaitresse {
  return { id: row.id, nom: row.nom, telephone: row.telephone }
}

const QUERY_KEY = ['aidesMaitresses']

async function fetchAidesMaitresses(): Promise<AideMaitresse[]> {
  const { data, error } = await supabase.from('aides_maitresses').select('*').order('nom', { ascending: true })
  if (error) throw error
  return (data as AideMaitresseRow[]).map(rowToAide)
}

export function useAidesMaitresses(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAidesMaitresses, enabled })
  useEffect(() => {
    if (query.data) cachedAides = query.data
  }, [query.data])
  return query
}

export function useAddAideMaitresse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (a: Omit<AideMaitresse, 'id'>) => {
      const { error } = await supabase.from('aides_maitresses').insert({ nom: a.nom, telephone: a.telephone })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateAideMaitresse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (a: AideMaitresse) => {
      const { error } = await supabase.from('aides_maitresses').update({ nom: a.nom, telephone: a.telephone }).eq('id', a.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteAideMaitresse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('aides_maitresses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

let cachedAides: AideMaitresse[] = []

/** Instantané synchrone pour les utilitaires hors-React. */
export function getAidesMaitressesSnapshot(): AideMaitresse[] {
  return cachedAides
}
