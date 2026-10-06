import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { ReclamationService } from '../data/reclamationServices'

interface ReclamationServiceRow {
  id: string
  nom: string
  categories: string[] | null
  ordre: number
}

function rowToService(row: ReclamationServiceRow): ReclamationService {
  return { id: row.id, nom: row.nom, categories: row.categories ?? [], ordre: row.ordre }
}

const QUERY_KEY = ['reclamationServices']

async function fetchServices(): Promise<ReclamationService[]> {
  const { data, error } = await supabase.from('reclamation_services').select('*').order('ordre', { ascending: true })
  if (error) throw error
  return (data as ReclamationServiceRow[]).map(rowToService)
}

export function useReclamationServices(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchServices, enabled })
  // Instantané synchrone pour les utilitaires hors-React (tri et filtres des réclamations).
  useEffect(() => {
    if (query.data) cachedServices = query.data
  }, [query.data])
  return query
}

let cachedServices: ReclamationService[] = []

export function getReclamationServicesSnapshot(): ReclamationService[] {
  return cachedServices
}

export function useAddReclamationService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { nom: string; categories?: string[] }) => {
      const ordre = cachedServices.reduce((max, s) => Math.max(max, s.ordre), 0) + 1
      const { error } = await supabase.from('reclamation_services').insert({ nom: input.nom, categories: input.categories ?? [], ordre })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateReclamationService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (service: ReclamationService) => {
      const { error } = await supabase.from('reclamation_services').update({ nom: service.nom, categories: service.categories }).eq('id', service.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteReclamationService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reclamation_services').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
