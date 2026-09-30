import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface GardeCreneau {
  id: string
  periodeId: string
  index: number
  debut: string
  fin: string
}

interface GardeCreneauRow {
  id: string
  periode_id: string
  index: number
  debut: string
  fin: string
}

function rowToCreneau(row: GardeCreneauRow): GardeCreneau {
  return { id: row.id, periodeId: row.periode_id, index: row.index, debut: row.debut.slice(0, 5), fin: row.fin.slice(0, 5) }
}

const QUERY_KEY = ['gardeCreneaux']
const AFFECTATIONS_QUERY_KEY = ['gardeAffectations']

async function fetchGardeCreneaux(periodeId: string): Promise<GardeCreneau[]> {
  const { data, error } = await supabase.from('garde_creneaux').select('*').eq('periode_id', periodeId).order('index', { ascending: true })
  if (error) throw error
  return (data as GardeCreneauRow[]).map(rowToCreneau)
}

export function useGardeCreneaux(periodeId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, periodeId],
    queryFn: () => fetchGardeCreneaux(periodeId as string),
    enabled: enabled && !!periodeId,
  })
}

export function useAddCreneau() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ periodeId, index, debut, fin }: { periodeId: string; index: number; debut: string; fin: string }) => {
      const { error } = await supabase.from('garde_creneaux').insert({ periode_id: periodeId, index, debut, fin })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** Journée type par défaut (07:30 → 18:00, durées irrégulières, dernier créneau 16:00-18:00) —
 * pré-remplie à la création d'une nouvelle période, ensuite librement éditable. */
const DEFAULT_CRENEAUX: [string, string][] = [
  ['07:30', '07:45'], ['07:45', '08:00'], ['08:00', '08:15'], ['08:15', '08:30'],
  ['08:30', '08:45'], ['08:45', '09:00'], ['09:00', '09:15'], ['09:15', '09:30'],
  ['09:30', '09:45'], ['09:45', '10:00'], ['10:00', '10:15'], ['10:15', '10:30'],
  ['10:30', '10:45'], ['10:45', '11:00'], ['11:00', '11:15'], ['11:15', '11:30'],
  ['11:30', '11:45'], ['11:45', '12:00'], ['12:00', '12:15'], ['12:15', '12:30'],
  ['12:30', '12:45'], ['12:45', '13:00'], ['13:00', '13:15'], ['13:15', '13:30'],
  ['13:30', '13:45'], ['13:45', '14:00'], ['14:00', '14:15'], ['14:15', '14:30'],
  ['14:30', '14:45'], ['14:45', '15:00'], ['15:00', '15:15'], ['15:15', '15:30'],
  ['15:30', '15:45'], ['15:45', '16:00'], ['16:00', '18:00'],
]

export function useSeedDefaultCreneaux() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (periodeId: string) => {
      const { error } = await supabase.from('garde_creneaux').insert(
        DEFAULT_CRENEAUX.map(([debut, fin], index) => ({ periode_id: periodeId, index, debut, fin }))
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateCreneauTime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, debut, fin }: { id: string; debut: string; fin: string }) => {
      const { error } = await supabase.from('garde_creneaux').update({ debut, fin }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** Supprime le créneau d'index `index` : remappe les affectations de la période (port exact de
 * removeSlot() du handoff — from/to décrémentés si > i / >= i, blocs devenus vides supprimés) puis
 * renumérote les créneaux restants pour garder un index contigu 0..N-1. Re-fetch frais (pas le
 * cache react-query) pour réduire la fenêtre de désynchronisation en cas d'édition concurrente. */
export function useRemoveCreneau() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ periodeId, index }: { periodeId: string; index: number }) => {
      const [creneauxRes, affRes] = await Promise.all([
        supabase.from('garde_creneaux').select('*').eq('periode_id', periodeId).order('index', { ascending: true }),
        supabase.from('garde_affectations').select('*').eq('periode_id', periodeId),
      ])
      if (creneauxRes.error) throw creneauxRes.error
      if (affRes.error) throw affRes.error

      const creneaux = (creneauxRes.data as GardeCreneauRow[]).map(rowToCreneau)
      // Ligne complète (toutes colonnes not-null) — un upsert partiel {id,from_index,to_index}
      // échoue silencieusement (violation not-null sur periode_id/personnel_type/... non vérifiée)
      // puisque Postgres construit la ligne INSERT candidate avant de retomber sur ON CONFLICT.
      interface FullAffRow {
        id: string
        periode_id: string
        personnel_type: string
        personnel_id: string
        from_index: number
        to_index: number
        evenement_id: string
      }
      const affectations = affRes.data as FullAffRow[]
      const removed = creneaux.find((c) => c.index === index)
      if (!removed) return

      const remapped = affectations
        .map((a) => ({
          ...a,
          from_index: a.from_index > index ? a.from_index - 1 : a.from_index,
          to_index: a.to_index >= index ? a.to_index - 1 : a.to_index,
        }))
        .filter((a) => a.to_index >= a.from_index)
      const remappedIds = new Set(remapped.map((r) => r.id))
      const droppedIds = affectations.filter((a) => !remappedIds.has(a.id)).map((a) => a.id)
      const changedAff = remapped.filter((r) => {
        const orig = affectations.find((a) => a.id === r.id)!
        return orig.from_index !== r.from_index || orig.to_index !== r.to_index
      })

      const renumbered = creneaux
        .filter((c) => c.index !== index)
        .sort((a, b) => a.index - b.index)
        .map((c, i) => ({ ...c, index: i }))
      const changedCreneaux = renumbered.filter((c) => {
        const orig = creneaux.find((x) => x.id === c.id)!
        return orig.index !== c.index
      })

      const [delAffRes, upsertAffRes, delCreneauRes] = await Promise.all([
        droppedIds.length ? supabase.from('garde_affectations').delete().in('id', droppedIds) : Promise.resolve({ error: null }),
        changedAff.length ? supabase.from('garde_affectations').upsert(changedAff) : Promise.resolve({ error: null }),
        supabase.from('garde_creneaux').delete().eq('id', removed.id),
      ])
      if (delAffRes.error) throw delAffRes.error
      if (upsertAffRes.error) throw upsertAffRes.error
      if (delCreneauRes.error) throw delCreneauRes.error

      if (changedCreneaux.length) {
        // Renumérotation en deux passes (index temporaire hors plage puis index final) pour
        // éviter toute collision transitoire avec la contrainte unique (periode_id, index).
        const OFFSET = 100000
        const { error: tempError } = await supabase
          .from('garde_creneaux')
          .upsert(changedCreneaux.map((c) => ({ id: c.id, periode_id: c.periodeId, index: -(c.index + OFFSET), debut: c.debut, fin: c.fin })))
        if (tempError) throw tempError
        const { error: finalError } = await supabase
          .from('garde_creneaux')
          .upsert(changedCreneaux.map((c) => ({ id: c.id, periode_id: c.periodeId, index: c.index, debut: c.debut, fin: c.fin })))
        if (finalError) throw finalError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: AFFECTATIONS_QUERY_KEY })
    },
  })
}
