import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { defaultIdentity, type StudentIdentity } from '../data/studentIdentity'
import { logAudit } from './auditLogService'

interface StudentIdentityRow {
  student_id: string
  prenom: string
  nom: string
  nom_ar: string
  prenom_ar: string
  code_massar: string
  cantine: boolean
  garde_apres_midi: boolean
  garde_matin: boolean
  garde_midi: boolean
  transport: boolean
  transport_ligne: string | null
  transport_ligne_soir: string | null
  transport_sortie_17h: boolean
  transport_motif_exception: string | null
  transport_motif_autre: string | null
  date_naissance: string
  lieu_naissance: string
  date_entree: string
  parent1_nom: string
  parent1_prenom: string
  parent1_tel: string
  parent1_email: string
  parent2_nom: string
  parent2_prenom: string
  parent2_tel: string
  parent2_email: string
}

function rowToIdentity(row: StudentIdentityRow): StudentIdentity {
  return {
    prenom: row.prenom,
    nom: row.nom,
    nomAr: row.nom_ar,
    prenomAr: row.prenom_ar,
    codeMassar: row.code_massar,
    cantine: row.cantine,
    gardeApresMidi: row.garde_apres_midi,
    gardeMatin: row.garde_matin,
    gardeMidi: row.garde_midi,
    transport: row.transport,
    transportLigne: row.transport_ligne,
    transportLigneSoir: row.transport_ligne_soir,
    transportSortie17h: row.transport_sortie_17h,
    transportMotifException: row.transport_motif_exception,
    transportMotifAutre: row.transport_motif_autre,
    dateNaissance: row.date_naissance,
    lieuNaissance: row.lieu_naissance,
    dateEntree: row.date_entree,
    parent1Nom: row.parent1_nom,
    parent1Prenom: row.parent1_prenom,
    parent1Tel: row.parent1_tel,
    parent1Email: row.parent1_email,
    parent2Nom: row.parent2_nom,
    parent2Prenom: row.parent2_prenom,
    parent2Tel: row.parent2_tel,
    parent2Email: row.parent2_email,
  }
}

function identityToRow(studentId: string, identity: StudentIdentity) {
  return {
    student_id: studentId,
    prenom: identity.prenom,
    nom: identity.nom,
    nom_ar: identity.nomAr,
    prenom_ar: identity.prenomAr,
    code_massar: identity.codeMassar,
    cantine: identity.cantine,
    garde_apres_midi: identity.gardeApresMidi,
    garde_matin: identity.gardeMatin,
    garde_midi: identity.gardeMidi,
    transport: identity.transport,
    transport_ligne: identity.transportLigne,
    transport_ligne_soir: identity.transportLigneSoir,
    transport_sortie_17h: identity.transportSortie17h,
    transport_motif_exception: identity.transportMotifException,
    transport_motif_autre: identity.transportMotifAutre,
    date_naissance: identity.dateNaissance,
    lieu_naissance: identity.lieuNaissance,
    date_entree: identity.dateEntree,
    parent1_nom: identity.parent1Nom,
    parent1_prenom: identity.parent1Prenom,
    parent1_tel: identity.parent1Tel,
    parent1_email: identity.parent1Email,
    parent2_nom: identity.parent2Nom,
    parent2_prenom: identity.parent2Prenom,
    parent2_tel: identity.parent2Tel,
    parent2_email: identity.parent2Email,
  }
}

const QUERY_KEY = ['studentIdentities']

export async function fetchStudentIdentities(): Promise<Record<string, StudentIdentity>> {
  const { data, error } = await supabase.from('student_identities').select('*')
  if (error) throw error
  const result: Record<string, StudentIdentity> = {}
  ;(data as StudentIdentityRow[]).forEach((row) => {
    result[row.student_id] = rowToIdentity(row)
  })
  return result
}

export function useStudentIdentities(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchStudentIdentities, enabled })
  useEffect(() => {
    if (query.data) cachedIdentities = query.data
  }, [query.data])
  return query
}

let cachedIdentities: Record<string, StudentIdentity> = {}

export function getStudentIdentitySnapshot(id: string): StudentIdentity {
  return cachedIdentities[id] ?? defaultIdentity
}

export function findStudentIdByCodeMassarSnapshot(codeMassar: string): string | undefined {
  return Object.keys(cachedIdentities).find((id) => cachedIdentities[id].codeMassar === codeMassar)
}

export async function upsertStudentIdentity(studentId: string, identity: StudentIdentity): Promise<void> {
  const previous = cachedIdentities[studentId]
  const { error } = await supabase.from('student_identities').upsert(identityToRow(studentId, identity))
  if (error) throw error
  void logAudit({
    tableName: 'student_identities',
    recordId: studentId,
    action: 'update',
    oldData: previous as unknown as Record<string, unknown> | undefined,
    newData: identity as unknown as Record<string, unknown>,
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
}

export function useUpsertStudentIdentity() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ studentId, identity }: { studentId: string; identity: StudentIdentity }) =>
      upsertStudentIdentity(studentId, identity),
    onSuccess: invalidate,
  })
}

/**
 * Mutation ciblée sur les seuls champs d'affectation transport (ligne + exception horaire),
 * éditée depuis le module Transport. Ne passe pas par useUpsertStudentIdentity() (qui écrit
 * l'objet complet) pour éviter d'écraser le reste de la fiche identité si l'état local du
 * module Transport n'a pas la dernière version des autres champs.
 */
export function useUpdateStudentTransportAffectation() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (patch: {
      studentId: string
      transportLigne?: string | null
      transportLigneSoir?: string | null
      transportSortie17h?: boolean
      transportMotifException?: string | null
      transportMotifAutre?: string | null
    }) => {
      const { studentId, transportLigne, transportLigneSoir, transportSortie17h, transportMotifException, transportMotifAutre } = patch
      const row: Record<string, string | boolean | null> = {}
      if (transportLigne !== undefined) row.transport_ligne = transportLigne
      if (transportLigneSoir !== undefined) row.transport_ligne_soir = transportLigneSoir
      if (transportSortie17h !== undefined) row.transport_sortie_17h = transportSortie17h
      if (transportMotifException !== undefined) row.transport_motif_exception = transportMotifException
      if (transportMotifAutre !== undefined) row.transport_motif_autre = transportMotifAutre
      const { error } = await supabase.from('student_identities').update(row).eq('student_id', studentId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
