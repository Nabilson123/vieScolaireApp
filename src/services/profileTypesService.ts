import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { DEFAULT_ROLE_LABELS, type BuiltInRole, type ProfileRole } from '../data/profiles'

/** Type de profil (CPE, Surveillant, Direction de la vie scolaire…). `cle` est la valeur stockée dans
 * `profiles.role` ; seul `libelle` se modifie. */
export interface ProfileType {
  cle: string
  libelle: string
  ordre: number
}

interface ProfileTypeRow {
  cle: string
  libelle: string
  ordre: number
}

const QUERY_KEY = ['profileTypes']

async function fetchProfileTypes(): Promise<ProfileType[]> {
  const { data, error } = await supabase.from('profile_types').select('*').order('ordre', { ascending: true })
  if (error) throw error
  return (data as ProfileTypeRow[]).map((r) => ({ cle: r.cle, libelle: r.libelle, ordre: r.ordre }))
}

export function useProfileTypes(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchProfileTypes, enabled })
  // Affectation synchrone (comme profilesService) : `roleLabel` est lu hors-React, notamment par les documents
  // imprimés, dès que les types sont chargés.
  if (query.data) cachedTypes = query.data
  return query
}

let cachedTypes: ProfileType[] = []

export function getProfileTypesSnapshot(): ProfileType[] {
  return cachedTypes
}

/** Libellé affiché d'un type de profil : celui du Référentiel, à défaut le libellé d'origine, à défaut la clé. */
export function roleLabel(role: ProfileRole | null | undefined): string {
  if (!role) return DEFAULT_ROLE_LABELS.Autre
  return cachedTypes.find((t) => t.cle === role)?.libelle ?? DEFAULT_ROLE_LABELS[role as BuiltInRole] ?? role
}

export function useAddProfileType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (libelle: string) => {
      const ordre = cachedTypes.reduce((max, t) => Math.max(max, t.ordre), 0) + 1
      const cle = `type-${crypto.randomUUID().slice(0, 8)}`
      const { error } = await supabase.from('profile_types').insert({ cle, libelle, ordre })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useRenameProfileType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ cle, libelle }: { cle: string; libelle: string }) => {
      const { error } = await supabase.from('profile_types').update({ libelle }).eq('cle', cle)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useDeleteProfileType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (cle: string) => {
      const { error } = await supabase.from('profile_types').delete().eq('cle', cle)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
