import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface MultiYearStudentRow {
  id: string
  sexe: 'M' | 'F'
  anneeScolaireId: string
}

export interface MultiYearClasseRow {
  id: string
  statut: 'Active' | 'Archivée'
  anneeScolaireId: string
}

async function fetchAllStudentsAllYears(): Promise<MultiYearStudentRow[]> {
  const { data, error } = await supabase.from('students').select('id, sexe, annee_scolaire_id')
  if (error) throw error
  return (data as { id: string; sexe: 'M' | 'F'; annee_scolaire_id: string }[]).map((r) => ({
    id: r.id,
    sexe: r.sexe,
    anneeScolaireId: r.annee_scolaire_id,
  }))
}

async function fetchAllClassesAllYears(): Promise<MultiYearClasseRow[]> {
  const { data, error } = await supabase.from('classes').select('id, statut, annee_scolaire_id')
  if (error) throw error
  return (data as { id: string; statut: 'Active' | 'Archivée'; annee_scolaire_id: string }[]).map((r) => ({
    id: r.id,
    statut: r.statut,
    anneeScolaireId: r.annee_scolaire_id,
  }))
}

/** Effectifs/classes toutes années confondues — hors du scope habituel useViewedYearId(), volontairement. */
export function useMultiYearEffectifStats(enabled = true) {
  return useQuery({
    queryKey: ['multiYearEffectifStats'],
    queryFn: async () => {
      const [students, classes] = await Promise.all([fetchAllStudentsAllYears(), fetchAllClassesAllYears()])
      return { students, classes }
    },
    enabled,
  })
}
