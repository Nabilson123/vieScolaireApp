import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface Chauffeur {
  id: string
  nom: string
  telephone: string
}

interface ChauffeurRow {
  id: string
  nom: string
  telephone: string
}

function rowToChauffeur(row: ChauffeurRow): Chauffeur {
  return { id: row.id, nom: row.nom, telephone: row.telephone }
}

const QUERY_KEY = ['chauffeurs']

async function fetchChauffeurs(): Promise<Chauffeur[]> {
  const { data, error } = await supabase.from('chauffeurs').select('*').order('nom', { ascending: true })
  if (error) throw error
  return (data as ChauffeurRow[]).map(rowToChauffeur)
}

export function useChauffeurs(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchChauffeurs, enabled })
  useEffect(() => {
    if (query.data) cachedChauffeurs = query.data
  }, [query.data])
  return query
}

export function useAddChauffeur() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (c: Omit<Chauffeur, 'id'>) => {
      const { error } = await supabase.from('chauffeurs').insert({ nom: c.nom, telephone: c.telephone })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateChauffeur() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (c: Chauffeur) => {
      const { error } = await supabase.from('chauffeurs').update({ nom: c.nom, telephone: c.telephone }).eq('id', c.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteChauffeur() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chauffeurs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

let cachedChauffeurs: Chauffeur[] = []

/** Instantané synchrone pour les utilitaires hors-React. */
export function getChauffeursSnapshot(): Chauffeur[] {
  return cachedChauffeurs
}
