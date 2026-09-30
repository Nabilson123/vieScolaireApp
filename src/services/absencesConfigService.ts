import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { AbsencesConfig } from '../data/absencesConfig'

interface AbsencesConfigRow {
  id: string
  motifs: string[]
  seuil_heures: number
  heure_debut_matin: string
  heure_fin_matin: string
  heure_debut_apres_midi: string
  heure_fin_apres_midi: string
}

function rowToConfig(row: AbsencesConfigRow): AbsencesConfig {
  return {
    motifs: row.motifs,
    seuilHeures: row.seuil_heures,
    heureDebutMatin: row.heure_debut_matin.slice(0, 5),
    heureFinMatin: row.heure_fin_matin.slice(0, 5),
    heureDebutApresMidi: row.heure_debut_apres_midi.slice(0, 5),
    heureFinApresMidi: row.heure_fin_apres_midi.slice(0, 5),
  }
}

const QUERY_KEY = ['absencesConfig']

async function fetchAbsencesConfig(): Promise<AbsencesConfig & { id: string }> {
  const { data, error } = await supabase.from('absences_config').select('*').limit(1).single()
  if (error) throw error
  const row = data as AbsencesConfigRow
  return { ...rowToConfig(row), id: row.id }
}

export function useAbsencesConfig(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAbsencesConfig, enabled })
  // Garde un instantané synchrone à jour pour les fonctions utilitaires hors-React
  // (génération de modèles Excel, import de fichiers) qui ne peuvent pas utiliser de hook.
  useEffect(() => {
    if (query.data) cachedAbsencesConfig = query.data
  }, [query.data])
  return query
}

export function useUpdateAbsencesConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (config: AbsencesConfig & { id: string }) => {
      const { id, motifs, seuilHeures, heureDebutMatin, heureFinMatin, heureDebutApresMidi, heureFinApresMidi } = config
      const { error } = await supabase
        .from('absences_config')
        .update({
          motifs,
          seuil_heures: seuilHeures,
          heure_debut_matin: heureDebutMatin,
          heure_fin_matin: heureFinMatin,
          heure_debut_apres_midi: heureDebutApresMidi,
          heure_fin_apres_midi: heureFinApresMidi,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

let cachedAbsencesConfig: AbsencesConfig = {
  motifs: ['Maladie', 'Rendez-vous médical', 'Raison familiale', 'Convocation administrative', 'Non justifié', 'Autre'],
  seuilHeures: 10,
  heureDebutMatin: '08:30',
  heureFinMatin: '12:00',
  heureDebutApresMidi: '13:00',
  heureFinApresMidi: '17:00',
}

/** Instantané synchrone pour les utilitaires hors-React (excelTemplates, excelImport). */
export function getAbsencesConfigSnapshot(): AbsencesConfig {
  return cachedAbsencesConfig
}
