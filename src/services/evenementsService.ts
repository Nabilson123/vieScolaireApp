import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Evenement } from '../data/evenements'
import { getCurrentUserIdSnapshot } from './currentUser'

interface EvenementRow {
  id: string
  titre: string
  date: string
  heure: string | null
  description: string
  classes: string[]
  created_by: string | null
  created_at: string
}

function rowToEvenement(row: EvenementRow): Evenement {
  return {
    id: row.id,
    titre: row.titre,
    date: row.date,
    heure: row.heure ?? undefined,
    description: row.description,
    classes: row.classes,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  }
}

const EVENEMENTS_KEY = ['evenements']

async function fetchEvenements(): Promise<Evenement[]> {
  const { data, error } = await supabase.from('evenements').select('*').order('date', { ascending: true })
  if (error) throw error
  return (data as EvenementRow[]).map(rowToEvenement)
}

export function useEvenements(enabled = true) {
  const query = useQuery({ queryKey: EVENEMENTS_KEY, queryFn: fetchEvenements, enabled })
  useEffect(() => {
    if (query.data) cachedEvenements = query.data
  }, [query.data])
  return query
}

let cachedEvenements: Evenement[] = []
export function getEvenementsSnapshot(): Evenement[] {
  return cachedEvenements
}

async function insertEvenement(data: { titre: string; date: string; heure?: string; description: string; classes: string[] }): Promise<Evenement> {
  const row = {
    titre: data.titre,
    date: data.date,
    heure: data.heure || null,
    description: data.description,
    classes: data.classes,
    created_by: getCurrentUserIdSnapshot(),
  }
  const { data: inserted, error } = await supabase.from('evenements').insert(row).select('*').single()
  if (error) throw error
  return rowToEvenement(inserted as EvenementRow)
}

async function updateEvenementRow(id: string, data: { titre: string; date: string; heure?: string; description: string; classes: string[] }): Promise<void> {
  const { error } = await supabase
    .from('evenements')
    .update({ titre: data.titre, date: data.date, heure: data.heure || null, description: data.description, classes: data.classes })
    .eq('id', id)
  if (error) throw error
}

async function deleteEvenementRow(id: string): Promise<void> {
  const { error } = await supabase.from('evenements').delete().eq('id', id)
  if (error) throw error
}

function useInvalidateEvenements() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: EVENEMENTS_KEY })
}

export function useAddEvenement() {
  const invalidate = useInvalidateEvenements()
  return useMutation({ mutationFn: insertEvenement, onSuccess: invalidate })
}

export function useUpdateEvenement() {
  const invalidate = useInvalidateEvenements()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; titre: string; date: string; heure?: string; description: string; classes: string[] }) =>
      updateEvenementRow(id, data),
    onSuccess: invalidate,
  })
}

export function useDeleteEvenement() {
  const invalidate = useInvalidateEvenements()
  return useMutation({ mutationFn: (id: string) => deleteEvenementRow(id), onSuccess: invalidate })
}
