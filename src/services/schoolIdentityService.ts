import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { SchoolIdentity } from '../data/schoolIdentity'

interface SchoolIdentityRow {
  id: string
  nom: string
  nom_ar: string
  tel1: string
  tel2: string
  fax: string
  cycle_maternelle: boolean
  cycle_primaire: boolean
  cycle_college: boolean
  cycle_lycee: boolean
  adresse: string
  site_web: string
  email: string
  facebook: string
  instagram: string
  linkedin: string
  logo: string | null
  cachet: string | null
  association_nom: string | null
  association_logo: string | null
}

function rowToIdentity(row: SchoolIdentityRow): SchoolIdentity {
  return {
    nom: row.nom,
    nomAr: row.nom_ar,
    tel1: row.tel1,
    tel2: row.tel2,
    fax: row.fax,
    cycles: {
      maternelle: row.cycle_maternelle,
      primaire: row.cycle_primaire,
      college: row.cycle_college,
      lycee: row.cycle_lycee,
    },
    adresse: row.adresse,
    siteWeb: row.site_web,
    email: row.email,
    facebook: row.facebook,
    instagram: row.instagram,
    linkedin: row.linkedin,
    logo: row.logo ?? undefined,
    cachet: row.cachet ?? undefined,
    associationNom: row.association_nom ?? '',
    associationLogo: row.association_logo ?? undefined,
  }
}

function identityToRow(identity: SchoolIdentity): Omit<SchoolIdentityRow, 'id'> {
  return {
    nom: identity.nom,
    nom_ar: identity.nomAr,
    tel1: identity.tel1,
    tel2: identity.tel2,
    fax: identity.fax,
    cycle_maternelle: identity.cycles.maternelle,
    cycle_primaire: identity.cycles.primaire,
    cycle_college: identity.cycles.college,
    cycle_lycee: identity.cycles.lycee,
    adresse: identity.adresse,
    site_web: identity.siteWeb,
    email: identity.email,
    facebook: identity.facebook,
    instagram: identity.instagram,
    linkedin: identity.linkedin,
    logo: identity.logo ?? null,
    cachet: identity.cachet ?? null,
    association_nom: identity.associationNom,
    association_logo: identity.associationLogo ?? null,
  }
}

const QUERY_KEY = ['schoolIdentity']

async function fetchSchoolIdentity(): Promise<SchoolIdentity & { id: string }> {
  const { data, error } = await supabase.from('school_identity').select('*').limit(1).single()
  if (error) throw error
  return { ...rowToIdentity(data as SchoolIdentityRow), id: (data as SchoolIdentityRow).id }
}

export function useSchoolIdentity() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchSchoolIdentity })
}

/**
 * Nom et logo affichés sur les documents des clubs : ceux de l'association sportive, pas ceux de l'école. Sans nom
 * d'association renseigné on retombe sur le nom de l'école ; sans logo, aucun logo n'est affiché.
 */
export function useAssociationIdentity(): { nom: string; logo?: string } {
  const { data } = useSchoolIdentity()
  return { nom: data?.associationNom?.trim() || data?.nom || '', logo: data?.associationLogo }
}

export function useUpdateSchoolIdentity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (identity: SchoolIdentity & { id: string }) => {
      const { id, ...rest } = identity
      const { error } = await supabase.from('school_identity').update(identityToRow(rest)).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
