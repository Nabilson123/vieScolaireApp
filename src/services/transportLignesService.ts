import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface TransportLigne {
  id: string
  nom: string
  trajet: string
  capacite: number
  chauffeurId: string | null
  aideId: string | null
  faitCollege: boolean
}

interface TransportLigneRow {
  id: string
  nom: string
  trajet: string
  capacite: number
  chauffeur_id: string | null
  aide_id: string | null
  fait_college: boolean
}

function rowToLigne(row: TransportLigneRow): TransportLigne {
  return {
    id: row.id,
    nom: row.nom,
    trajet: row.trajet,
    capacite: row.capacite,
    chauffeurId: row.chauffeur_id,
    aideId: row.aide_id,
    faitCollege: row.fait_college,
  }
}

const QUERY_KEY = ['transportLignes']

async function fetchTransportLignes(): Promise<TransportLigne[]> {
  const { data, error } = await supabase.from('transport_lignes').select('*').order('nom', { ascending: true })
  if (error) throw error
  return (data as TransportLigneRow[]).map(rowToLigne)
}

export function useTransportLignes(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchTransportLignes, enabled })
  useEffect(() => {
    if (query.data) cachedLignes = query.data
  }, [query.data])
  return query
}

let cachedLignes: TransportLigne[] = []

/** Instantané synchrone pour les utilitaires hors-React (Rapports BI). */
export function getTransportLignesSnapshot(): TransportLigne[] {
  return cachedLignes
}

/** Somme des capacités des 5 lignes — remplace l'ancienne capacité globale unique pour Rapports BI. */
export function getTransportCapaciteTotaleSnapshot(): number {
  return cachedLignes.reduce((sum, l) => sum + l.capacite, 0)
}

export function useUpdateTransportLigne() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: {
      id: string
      trajet?: string
      capacite?: number
      chauffeurId?: string | null
      aideId?: string | null
      faitCollege?: boolean
    }) => {
      const { id, trajet, capacite, chauffeurId, aideId, faitCollege } = patch
      const row: Record<string, string | number | boolean | null> = {}
      if (trajet !== undefined) row.trajet = trajet
      if (capacite !== undefined) row.capacite = capacite
      if (chauffeurId !== undefined) row.chauffeur_id = chauffeurId
      if (aideId !== undefined) row.aide_id = aideId
      if (faitCollege !== undefined) row.fait_college = faitCollege
      const { error } = await supabase.from('transport_lignes').update(row).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
