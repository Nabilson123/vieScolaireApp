import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Salle } from '../data/salles'

interface SalleRow {
  id: string
  nom: string
  batiment: string
  capacite: number
  code: string | null
}

function rowToSalle(row: SalleRow): Salle {
  return { id: row.id, nom: row.nom, batiment: row.batiment, capacite: row.capacite, code: row.code ?? undefined }
}

const QUERY_KEY = ['salles']

async function fetchSalles(): Promise<Salle[]> {
  const { data, error } = await supabase.from('salles').select('*').order('batiment', { ascending: true })
  if (error) throw error
  return (data as SalleRow[]).map(rowToSalle)
}

export function useSalles(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchSalles, enabled })
  // Garde un instantané synchrone à jour pour excelImport.ts, appelé hors-React.
  useEffect(() => {
    if (query.data) cachedSalles = query.data
  }, [query.data])
  return query
}

export function useAddSalle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (salle: Omit<Salle, 'id'>) => {
      const { error } = await supabase.from('salles').insert({ nom: salle.nom, batiment: salle.batiment, capacite: salle.capacite, code: salle.code ?? null })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateSalle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (salle: Salle) => {
      const { error } = await supabase
        .from('salles')
        .update({ nom: salle.nom, batiment: salle.batiment, capacite: salle.capacite, code: salle.code ?? null })
        .eq('id', salle.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteSalle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('salles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

let cachedSalles: Salle[] = []

/** Instantané synchrone pour les utilitaires hors-React (excelImport.ts). */
export function getSallesSnapshot(): Salle[] {
  return cachedSalles
}
