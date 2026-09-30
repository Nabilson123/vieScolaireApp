import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Periode } from '../data/periodes'

interface PeriodeRow {
  id: string
  type: Periode['type']
  nom: string
  date_debut: string
  date_fin: string
}

function rowToPeriode(row: PeriodeRow): Periode {
  return { id: row.id, type: row.type, nom: row.nom, dateDebut: row.date_debut, dateFin: row.date_fin }
}

const QUERY_KEY = ['periodes']

async function fetchPeriodes(): Promise<Periode[]> {
  const { data, error } = await supabase.from('periodes').select('*').order('date_debut', { ascending: true })
  if (error) throw error
  return (data as PeriodeRow[]).map(rowToPeriode)
}

export function usePeriodes(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchPeriodes, enabled })
  // Garde un instantané synchrone à jour pour students.ts (recomputeStudentAttendance),
  // appelé en dehors du rendu React.
  useEffect(() => {
    if (query.data) cachedPeriodes = query.data
  }, [query.data])
  return query
}

export function useAddPeriode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (periode: Omit<Periode, 'id'>) => {
      const { error } = await supabase
        .from('periodes')
        .insert({ type: periode.type, nom: periode.nom, date_debut: periode.dateDebut, date_fin: periode.dateFin })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdatePeriode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (periode: Periode) => {
      const { error } = await supabase
        .from('periodes')
        .update({ type: periode.type, nom: periode.nom, date_debut: periode.dateDebut, date_fin: periode.dateFin })
        .eq('id', periode.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeletePeriode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('periodes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

let cachedPeriodes: Periode[] = [
  { id: 'per-1', type: 'Trimestre', nom: 'Trimestre 1', dateDebut: '2026-09-07', dateFin: '2026-12-18' },
  { id: 'per-2', type: 'Trimestre', nom: 'Trimestre 2', dateDebut: '2027-01-05', dateFin: '2027-03-26' },
  { id: 'per-3', type: 'Trimestre', nom: 'Trimestre 3', dateDebut: '2027-04-06', dateFin: '2027-06-25' },
]

/** Instantané synchrone pour les utilitaires hors-React (students.ts: recomputeStudentAttendance). */
export function getPeriodesSnapshot(): Periode[] {
  return cachedPeriodes
}
