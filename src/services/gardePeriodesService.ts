import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useViewedYearId, getViewedYearIdSnapshot } from './viewedYear'
import { useAnneesLoaded } from './anneesScolairesService'

export interface GardePeriode {
  id: string
  nom: string
  dateDebut: string
  dateFin: string
}

interface GardePeriodeRow {
  id: string
  nom: string
  date_debut: string
  date_fin: string
}

function rowToGardePeriode(row: GardePeriodeRow): GardePeriode {
  return { id: row.id, nom: row.nom, dateDebut: row.date_debut, dateFin: row.date_fin }
}

const QUERY_KEY = ['gardePeriodes']

async function fetchGardePeriodes(yearId: string): Promise<GardePeriode[]> {
  const { data, error } = await supabase
    .from('garde_periodes')
    .select('*')
    .eq('annee_scolaire_id', yearId)
    .order('date_debut', { ascending: false })
  if (error) throw error
  return (data as GardePeriodeRow[]).map(rowToGardePeriode)
}

export function useGardePeriodes(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: [...QUERY_KEY, viewedYearId],
    queryFn: () => fetchGardePeriodes(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  useEffect(() => {
    if (query.data) cachedGardePeriodes = query.data
  }, [query.data])
  return query
}

export function useAddGardePeriode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (periode: Omit<GardePeriode, 'id'>): Promise<GardePeriode> => {
      const { data, error } = await supabase
        .from('garde_periodes')
        .insert({
          nom: periode.nom,
          date_debut: periode.dateDebut,
          date_fin: periode.dateFin,
          annee_scolaire_id: getViewedYearIdSnapshot(),
        })
        .select()
        .single()
      if (error) throw error
      return rowToGardePeriode(data as GardePeriodeRow)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateGardePeriode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (periode: GardePeriode) => {
      const { error } = await supabase
        .from('garde_periodes')
        .update({ nom: periode.nom, date_debut: periode.dateDebut, date_fin: periode.dateFin })
        .eq('id', periode.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteGardePeriode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('garde_periodes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

let cachedGardePeriodes: GardePeriode[] = []

/** Instantané synchrone pour les utilitaires hors-React. */
export function getGardePeriodesSnapshot(): GardePeriode[] {
  return cachedGardePeriodes
}
