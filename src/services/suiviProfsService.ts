import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { SuiviProf } from '../data/suiviProfs'
import type { SuiviCompteRendu } from '../data/suiviCompteRendu'
import { getCurrentUserIdSnapshot } from './currentUser'

interface SuiviProfRow {
  id: string
  teacher_ids: string[]
  date: string
  heure: string
  duree: number
  lieu: string
  motif: string
  statut: SuiviProf['statut']
  notes: string
  created_by: string | null
  created_at: string
  niveau: string | null
  compte_rendu: SuiviCompteRendu | null
}

function rowToSuiviProf(row: SuiviProfRow): SuiviProf {
  return {
    id: row.id,
    teacherIds: row.teacher_ids,
    date: row.date,
    heure: row.heure,
    duree: row.duree,
    lieu: row.lieu,
    motif: row.motif,
    statut: row.statut,
    notes: row.notes,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    niveau: row.niveau ?? undefined,
    compteRendu: row.compte_rendu && Object.keys(row.compte_rendu).length > 0 ? row.compte_rendu : undefined,
  }
}

const SUIVI_PROFS_KEY = ['suiviProfs']

async function fetchSuiviProfs(): Promise<SuiviProf[]> {
  const { data, error } = await supabase.from('suivi_profs').select('*').order('date', { ascending: true })
  if (error) throw error
  return (data as SuiviProfRow[]).map(rowToSuiviProf)
}

export function useSuiviProfs(enabled = true) {
  const query = useQuery({ queryKey: SUIVI_PROFS_KEY, queryFn: fetchSuiviProfs, enabled })
  useEffect(() => {
    if (query.data) cachedSuiviProfs = query.data
  }, [query.data])
  return query
}

let cachedSuiviProfs: SuiviProf[] = []
export function getSuiviProfsSnapshot(): SuiviProf[] {
  return cachedSuiviProfs
}

interface SuiviProfInput {
  teacherIds: string[]
  date: string
  heure: string
  duree: number
  lieu: string
  motif: string
  notes: string
  niveau?: string
}

async function insertSuiviProf(data: SuiviProfInput): Promise<SuiviProf> {
  const row = {
    teacher_ids: data.teacherIds,
    date: data.date,
    heure: data.heure,
    duree: data.duree,
    lieu: data.lieu,
    motif: data.motif,
    statut: 'Planifié' as const,
    notes: data.notes,
    created_by: getCurrentUserIdSnapshot(),
    niveau: data.niveau ?? null,
  }
  const { data: inserted, error } = await supabase.from('suivi_profs').insert(row).select('*').single()
  if (error) throw error
  return rowToSuiviProf(inserted as SuiviProfRow)
}

async function updateSuiviProfRow(id: string, data: SuiviProfInput): Promise<void> {
  const { error } = await supabase
    .from('suivi_profs')
    .update({
      teacher_ids: data.teacherIds,
      date: data.date,
      heure: data.heure,
      duree: data.duree,
      lieu: data.lieu,
      motif: data.motif,
      notes: data.notes,
      niveau: data.niveau ?? null,
    })
    .eq('id', id)
  if (error) throw error
}

async function updateSuiviProfStatutRow(id: string, statut: SuiviProf['statut']): Promise<void> {
  const { error } = await supabase.from('suivi_profs').update({ statut }).eq('id', id)
  if (error) throw error
}

async function deleteSuiviProfRow(id: string): Promise<void> {
  const { error } = await supabase.from('suivi_profs').delete().eq('id', id)
  if (error) throw error
}

/** Rédiger/modifier le compte-rendu marque aussi le suivi comme Réalisé — même principe que le
 * compte-rendu des RDV parents (updateOne(...,{statut:'Réalisé', compteRendu}) dans RendezVousGlobal). */
async function completeSuiviProfRow(id: string, notes: string): Promise<void> {
  const { error } = await supabase.from('suivi_profs').update({ notes, statut: 'Réalisé' }).eq('id', id)
  if (error) throw error
}

/** Enregistre le compte-rendu structuré sans toucher au statut — "brouillon", modifiable tant que
 * la réunion n'a pas été formellement validée. */
async function saveCompteRenduRow(id: string, compteRendu: SuiviCompteRendu): Promise<void> {
  const { error } = await supabase.from('suivi_profs').update({ compte_rendu: compteRendu }).eq('id', id)
  if (error) throw error
}

/** Valide le compte-rendu et marque le suivi Réalisé en une seule écriture — même principe que
 * completeSuiviProfRow, mais avec le contenu structuré au lieu du texte libre. */
async function validateCompteRenduRow(id: string, compteRendu: SuiviCompteRendu): Promise<void> {
  const { error } = await supabase.from('suivi_profs').update({ compte_rendu: compteRendu, statut: 'Réalisé' }).eq('id', id)
  if (error) throw error
}

function useInvalidateSuiviProfs() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: SUIVI_PROFS_KEY })
}

export function useAddSuiviProf() {
  const invalidate = useInvalidateSuiviProfs()
  return useMutation({ mutationFn: insertSuiviProf, onSuccess: invalidate })
}

export function useUpdateSuiviProf() {
  const invalidate = useInvalidateSuiviProfs()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & SuiviProfInput) => updateSuiviProfRow(id, data),
    onSuccess: invalidate,
  })
}

export function useUpdateSuiviProfStatut() {
  const invalidate = useInvalidateSuiviProfs()
  return useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: SuiviProf['statut'] }) => updateSuiviProfStatutRow(id, statut),
    onSuccess: invalidate,
  })
}

export function useDeleteSuiviProf() {
  const invalidate = useInvalidateSuiviProfs()
  return useMutation({ mutationFn: (id: string) => deleteSuiviProfRow(id), onSuccess: invalidate })
}

export function useCompleteSuiviProf() {
  const invalidate = useInvalidateSuiviProfs()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => completeSuiviProfRow(id, notes),
    onSuccess: invalidate,
  })
}

export function useSaveCompteRendu() {
  const invalidate = useInvalidateSuiviProfs()
  return useMutation({
    mutationFn: ({ id, compteRendu }: { id: string; compteRendu: SuiviCompteRendu }) => saveCompteRenduRow(id, compteRendu),
    onSuccess: invalidate,
  })
}

export function useValidateCompteRendu() {
  const invalidate = useInvalidateSuiviProfs()
  return useMutation({
    mutationFn: ({ id, compteRendu }: { id: string; compteRendu: SuiviCompteRendu }) => validateCompteRenduRow(id, compteRendu),
    onSuccess: invalidate,
  })
}
