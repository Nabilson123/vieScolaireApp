import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type PersonnelType = 'chauffeur' | 'vigile'

export interface GardeAffectation {
  id: string
  periodeId: string
  personnelType: PersonnelType
  personnelId: string
  fromIndex: number
  toIndex: number
  evenementId: string
}

interface GardeAffectationRow {
  id: string
  periode_id: string
  personnel_type: PersonnelType
  personnel_id: string
  from_index: number
  to_index: number
  evenement_id: string
}

function rowToAffectation(row: GardeAffectationRow): GardeAffectation {
  return {
    id: row.id,
    periodeId: row.periode_id,
    personnelType: row.personnel_type,
    personnelId: row.personnel_id,
    fromIndex: row.from_index,
    toIndex: row.to_index,
    evenementId: row.evenement_id,
  }
}

const QUERY_KEY = ['gardeAffectations']

async function fetchGardeAffectations(periodeId: string): Promise<GardeAffectation[]> {
  const { data, error } = await supabase.from('garde_affectations').select('*').eq('periode_id', periodeId)
  if (error) throw error
  return (data as GardeAffectationRow[]).map(rowToAffectation)
}

export function useGardeAffectations(periodeId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, periodeId],
    queryFn: () => fetchGardeAffectations(periodeId as string),
    enabled: enabled && !!periodeId,
  })
}

export function useAddGardeAffectation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (a: Omit<GardeAffectation, 'id'>) => {
      const { error } = await supabase.from('garde_affectations').insert({
        periode_id: a.periodeId,
        personnel_type: a.personnelType,
        personnel_id: a.personnelId,
        from_index: a.fromIndex,
        to_index: a.toIndex,
        evenement_id: a.evenementId,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateBlockEvenement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, evenementId }: { id: string; evenementId: string }) => {
      const { error } = await supabase.from('garde_affectations').update({ evenement_id: evenementId }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteGardeAffectation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('garde_affectations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** Port exact de clearRange() du handoff (.dc.html lignes 346-354) : libère les créneaux
 * [from..to] de cet agent avant d'y poser un bloc — un bloc traversé est tronqué avant/après, un
 * bloc entièrement recouvert disparaît. Un agent ne peut jamais avoir deux affectations sur le
 * même créneau. */
function clearRange(
  blocks: GardeAffectation[],
  personnelType: PersonnelType,
  personnelId: string,
  from: number,
  to: number,
  keepId: string
): GardeAffectation[] {
  const out: GardeAffectation[] = []
  blocks.forEach((b) => {
    const sameAgent = b.personnelType === personnelType && b.personnelId === personnelId
    if (!sameAgent || b.id === keepId || b.toIndex < from || b.fromIndex > to) {
      out.push(b)
      return
    }
    if (b.fromIndex < from) out.push({ ...b, toIndex: from - 1 })
    if (b.toIndex > to) out.push({ ...b, fromIndex: to + 1 })
  })
  return out
}

/** Change la plage (from/to) d'un bloc avec résolution de chevauchement. Re-fetch frais (pas le
 * cache react-query) avant calcul pour réduire la fenêtre de désynchronisation en cas d'édition
 * concurrente — pas une transaction, juste une fenêtre resserrée (cf. plan Phase 7 §5). */
export function useUpdateBlockRange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      periodeId,
      personnelType,
      personnelId,
      blockId,
      fromIndex,
      toIndex,
    }: {
      periodeId: string
      personnelType: PersonnelType
      personnelId: string
      blockId: string
      fromIndex: number
      toIndex: number
    }) => {
      const { data, error } = await supabase.from('garde_affectations').select('*').eq('periode_id', periodeId)
      if (error) throw error
      const fresh = (data as GardeAffectationRow[]).map(rowToAffectation)

      const target = fresh.find((b) => b.id === blockId)
      if (!target) return

      const survivors = clearRange(fresh, personnelType, personnelId, fromIndex, toIndex, blockId)
      const survivorsWithTarget = survivors.map((b) => (b.id === blockId ? { ...b, fromIndex, toIndex } : b))

      const survivorIds = new Set(survivorsWithTarget.map((b) => b.id))
      const deleteIds = fresh.filter((b) => !survivorIds.has(b.id)).map((b) => b.id)
      const upsertRows = survivorsWithTarget.filter((b) => {
        const orig = fresh.find((f) => f.id === b.id)
        return !orig || orig.fromIndex !== b.fromIndex || orig.toIndex !== b.toIndex
      })

      await Promise.all([
        deleteIds.length ? supabase.from('garde_affectations').delete().in('id', deleteIds) : Promise.resolve(),
        upsertRows.length
          ? supabase.from('garde_affectations').upsert(
              upsertRows.map((b) => ({
                id: b.id,
                periode_id: b.periodeId,
                personnel_type: b.personnelType,
                personnel_id: b.personnelId,
                from_index: b.fromIndex,
                to_index: b.toIndex,
                evenement_id: b.evenementId,
              }))
            )
          : Promise.resolve(),
      ])
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
