import { useEffect, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { AnneeScolaire } from '../data/anneesScolaires'

interface AnneeScolaireRow {
  id: string
  annee_debut: number
  libelle: string
  date_debut: string | null
  date_fin: string | null
  active: boolean
}

function rowToAnnee(row: AnneeScolaireRow): AnneeScolaire {
  return {
    id: row.id,
    anneeDebut: row.annee_debut,
    libelle: row.libelle,
    dateDebut: row.date_debut ?? '',
    dateFin: row.date_fin ?? '',
    active: row.active,
  }
}

const QUERY_KEY = ['anneesScolaires']

async function fetchAnneesScolaires(): Promise<AnneeScolaire[]> {
  const { data, error } = await supabase.from('annees_scolaires').select('*').order('annee_debut', { ascending: true })
  if (error) throw error
  return (data as AnneeScolaireRow[]).map(rowToAnnee)
}

export function useAnneesScolaires(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAnneesScolaires, enabled })
  // Affectation synchrone (pas un useEffect) : sinon getActiveYearIdSnapshot()/cachedAnnees
  // resteraient en retard d'un rendu par rapport à query.data. Voir le commentaire détaillé dans
  // classSchedulesService.ts (useClassSchedules), où ce décalage a été diagnostiqué.
  if (query.data) cachedAnnees = query.data
  // La notification aux abonnés de useAnneesLoaded() reste dans un effet : c'est un vrai effet de
  // bord inter-composants (déclenche le re-rendu d'AUTRES composants), pas une simple mise à jour
  // de cache — donc il doit s'exécuter après le commit, pas pendant le rendu.
  useEffect(() => {
    if (query.data && !anneesLoaded) {
      anneesLoaded = true
      notifyLoadedListeners()
    }
  }, [query.data])
  return query
}

let anneesLoaded = false
const loadedListeners = new Set<() => void>()

function notifyLoadedListeners(): void {
  loadedListeners.forEach((listener) => listener())
}

function subscribeLoaded(listener: () => void): () => void {
  loadedListeners.add(listener)
  return () => loadedListeners.delete(listener)
}

function getLoadedSnapshot(): boolean {
  return anneesLoaded
}

/**
 * true une fois que la vraie liste des années a chargé au moins une fois (par opposition au
 * repli `cachedAnnees` initial). Léger `useSyncExternalStore` plutôt qu'un second `useQuery`
 * imbriqué, pour que les services année-scopés (classesService, teachersService) puissent
 * attendre ce signal sans multiplier les observateurs sur la même query key.
 */
export function useAnneesLoaded(): boolean {
  return useSyncExternalStore(subscribeLoaded, getLoadedSnapshot)
}

export function useUpdateAnneeScolaire() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (annee: Pick<AnneeScolaire, 'id' | 'dateDebut' | 'dateFin'>) => {
      const { error } = await supabase
        .from('annees_scolaires')
        .update({ date_debut: annee.dateDebut || null, date_fin: annee.dateFin || null })
        .eq('id', annee.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useSetActiveYear() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Ordre volontaire : désactiver d'abord ne peut jamais violer l'index unique partiel
      // "au plus une ligne active" ; seule l'étape d'activation peut échouer.
      const { error: deactivateError } = await supabase.from('annees_scolaires').update({ active: false }).eq('active', true)
      if (deactivateError) throw deactivateError
      const { error: activateError } = await supabase.from('annees_scolaires').update({ active: true }).eq('id', id)
      if (activateError) throw activateError
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

let cachedAnnees: AnneeScolaire[] = [
  { id: 'bootstrap-2025', anneeDebut: 2025, libelle: '2025/2026', dateDebut: '2025-09-01', dateFin: '2026-08-31', active: true },
]

export function getAnneesScolairesSnapshot(): AnneeScolaire[] {
  return cachedAnnees
}

/** Année active (éditable) — retombe sur l'année la plus récente si aucune n'est marquée active. */
export function getActiveYearIdSnapshot(): string {
  const active = cachedAnnees.find((a) => a.active)
  if (active) return active.id
  const latest = [...cachedAnnees].sort((a, b) => b.anneeDebut - a.anneeDebut)[0]
  return latest?.id ?? ''
}

/**
 * Crée l'année scolaire suivante (inactive par défaut, donc en lecture seule tant qu'elle
 * n'est pas explicitement activée) et y duplique les classes actives et les enseignants de
 * l'année active — jamais les élèves, ni les emplois du temps, ni les autres données, qui
 * démarrent vides pour la nouvelle année.
 */
export async function createNextYear(): Promise<string> {
  const sourceId = getActiveYearIdSnapshot()
  const source = cachedAnnees.find((a) => a.id === sourceId)
  if (!source) throw new Error('Aucune année active trouvée.')

  const nextAnneeDebut = source.anneeDebut + 1
  if (cachedAnnees.some((a) => a.anneeDebut === nextAnneeDebut)) {
    throw new Error(`L'année ${nextAnneeDebut}/${nextAnneeDebut + 1} existe déjà.`)
  }

  const { data: newYearRow, error: yearError } = await supabase
    .from('annees_scolaires')
    .insert({
      annee_debut: nextAnneeDebut,
      libelle: `${nextAnneeDebut}/${nextAnneeDebut + 1}`,
      date_debut: `${nextAnneeDebut}-09-01`,
      date_fin: `${nextAnneeDebut + 1}-08-31`,
      active: false,
    })
    .select('id')
    .single()
  if (yearError) throw yearError
  const newYearId = newYearRow.id as string

  const { data: sourceTeachers, error: teachersError } = await supabase.from('teachers').select('*').eq('annee_scolaire_id', sourceId)
  if (teachersError) throw teachersError

  const teacherIdMap = new Map<string, string>()
  const newTeacherRows = (sourceTeachers ?? []).map((t: Record<string, unknown>) => {
    const newId = crypto.randomUUID()
    teacherIdMap.set(t.id as string, newId)
    const { id: _id, annee_scolaire_id: _yearId, ...rest } = t
    return { ...rest, id: newId, annee_scolaire_id: newYearId }
  })
  if (newTeacherRows.length > 0) {
    const { error } = await supabase.from('teachers').insert(newTeacherRows)
    if (error) throw error
  }

  const { data: sourceClasses, error: classesError } = await supabase
    .from('classes')
    .select('*')
    .eq('annee_scolaire_id', sourceId)
    .eq('statut', 'Active')
  if (classesError) throw classesError

  const newClassRows = (sourceClasses ?? []).map((c: Record<string, unknown>) => {
    const { id: _id, annee_scolaire_id: _yearId, professeur_principal_id, ...rest } = c
    return {
      ...rest,
      annee_scolaire_id: newYearId,
      professeur_principal_id: professeur_principal_id ? (teacherIdMap.get(professeur_principal_id as string) ?? null) : null,
    }
  })
  if (newClassRows.length > 0) {
    const { error } = await supabase.from('classes').insert(newClassRows)
    if (error) throw error
  }

  return newYearId
}

export function useCreateNextYear() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createNextYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
    },
  })
}
