import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { SchoolClass } from '../data/schoolStructure'
import { useViewedYearId, getViewedYearIdSnapshot } from './viewedYear'
import { useAnneesLoaded } from './anneesScolairesService'

interface ClassRow {
  id: string
  nom: string
  niveau: string
  capacite_max: number
  salle: string
  statut: 'Active' | 'Archivée'
  professeur_principal_id: string | null
  annee_scolaire_id: string
  delegue_titulaire_id: string | null
  delegue_suppleant_id: string | null
  delegue_election_date: string | null
}

function rowToClass(row: ClassRow): SchoolClass {
  return {
    id: row.id,
    nom: row.nom,
    niveau: row.niveau,
    capaciteMax: row.capacite_max,
    salle: row.salle,
    statut: row.statut,
    professeurPrincipalId: row.professeur_principal_id ?? undefined,
    anneeScolaireId: row.annee_scolaire_id,
    delegueTitulaireId: row.delegue_titulaire_id ?? undefined,
    delegueSuppleantId: row.delegue_suppleant_id ?? undefined,
    delegueElectionDate: row.delegue_election_date ?? undefined,
  }
}

async function fetchClasses(yearId: string): Promise<SchoolClass[]> {
  const { data, error } = await supabase.from('classes').select('*').eq('annee_scolaire_id', yearId).order('nom', { ascending: true })
  if (error) throw error
  return (data as ClassRow[]).map(rowToClass)
}

export function useClasses(enabled = true) {
  // Attend que la liste des années ait réellement chargé avant de filtrer par année : sinon
  // getViewedYearIdSnapshot() retombe sur l'id de secours (non-UUID), rejeté par Postgres.
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({ queryKey: ['classes', viewedYearId], queryFn: () => fetchClasses(viewedYearId), enabled: enabled && anneesLoaded })
  // Affectation synchrone (pas un useEffect) : sinon getClassesSnapshot() resterait en retard
  // d'un rendu par rapport à query.data à chaque changement d'année. Voir le commentaire détaillé
  // dans classSchedulesService.ts (useClassSchedules), où ce décalage a été diagnostiqué.
  if (query.data) cachedClasses = query.data
  return query
}

let cachedClasses: SchoolClass[] = []

/** Instantané synchrone pour les utilitaires hors-React. */
export function getClassesSnapshot(): SchoolClass[] {
  return cachedClasses
}

export function getActiveClassNamesSnapshot(): string[] {
  return cachedClasses.filter((c) => c.statut === 'Active').map((c) => c.nom)
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['classes'] })
}

export function useAddClass() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (c: Omit<SchoolClass, 'id' | 'anneeScolaireId'>) => {
      const { error } = await supabase.from('classes').insert({
        nom: c.nom,
        niveau: c.niveau,
        capacite_max: c.capaciteMax,
        salle: c.salle,
        statut: c.statut,
        professeur_principal_id: c.professeurPrincipalId ?? null,
        annee_scolaire_id: getViewedYearIdSnapshot(),
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateClass() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (c: SchoolClass) => {
      const { error } = await supabase
        .from('classes')
        .update({
          nom: c.nom,
          niveau: c.niveau,
          capacite_max: c.capaciteMax,
          salle: c.salle,
          statut: c.statut,
          professeur_principal_id: c.professeurPrincipalId ?? null,
        })
        .eq('id', c.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateClassDelegues() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({
      id,
      delegueTitulaireId,
      delegueSuppleantId,
      delegueElectionDate,
    }: {
      id: string
      delegueTitulaireId: string | undefined
      delegueSuppleantId: string | undefined
      delegueElectionDate: string | undefined
    }) => {
      const { error } = await supabase
        .from('classes')
        .update({
          delegue_titulaire_id: delegueTitulaireId ?? null,
          delegue_suppleant_id: delegueSuppleantId ?? null,
          delegue_election_date: delegueElectionDate || null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useArchiveClass() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('classes').update({ statut: 'Archivée' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteClass() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
