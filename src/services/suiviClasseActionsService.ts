import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { SuiviClasseAction, SuiviClasseActionStatut } from '../data/suiviClasseActions'
import { getCurrentUserIdSnapshot } from './currentUser'

interface SuiviClasseActionRow {
  id: string
  niveau: string
  texte: string
  owner_name: string
  echeance: string | null
  statut: SuiviClasseActionStatut
  created_by: string | null
  created_at: string
}

function rowToAction(row: SuiviClasseActionRow): SuiviClasseAction {
  return {
    id: row.id,
    niveau: row.niveau,
    texte: row.texte,
    ownerName: row.owner_name,
    echeance: row.echeance ?? undefined,
    statut: row.statut,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  }
}

const SUIVI_CLASSE_ACTIONS_KEY = ['suiviClasseActions']

async function fetchSuiviClasseActions(): Promise<SuiviClasseAction[]> {
  const { data, error } = await supabase.from('suivi_classe_actions').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return (data as SuiviClasseActionRow[]).map(rowToAction)
}

export function useSuiviClasseActions(enabled = true) {
  const query = useQuery({ queryKey: SUIVI_CLASSE_ACTIONS_KEY, queryFn: fetchSuiviClasseActions, enabled })
  useEffect(() => {
    if (query.data) cachedActions = query.data
  }, [query.data])
  return query
}

let cachedActions: SuiviClasseAction[] = []
export function getSuiviClasseActionsSnapshot(): SuiviClasseAction[] {
  return cachedActions
}

interface AddSuiviClasseActionInput {
  niveau: string
  texte: string
  ownerName: string
  echeance?: string
}

async function insertSuiviClasseAction(data: AddSuiviClasseActionInput): Promise<SuiviClasseAction> {
  const row = {
    niveau: data.niveau,
    texte: data.texte,
    owner_name: data.ownerName,
    echeance: data.echeance || null,
    statut: 'a_faire' as const,
    created_by: getCurrentUserIdSnapshot(),
  }
  const { data: inserted, error } = await supabase.from('suivi_classe_actions').insert(row).select('*').single()
  if (error) throw error
  return rowToAction(inserted as SuiviClasseActionRow)
}

async function updateSuiviClasseActionStatutRow(id: string, statut: SuiviClasseActionStatut): Promise<void> {
  const { error } = await supabase.from('suivi_classe_actions').update({ statut }).eq('id', id)
  if (error) throw error
}

async function deleteSuiviClasseActionRow(id: string): Promise<void> {
  const { error } = await supabase.from('suivi_classe_actions').delete().eq('id', id)
  if (error) throw error
}

function useInvalidateSuiviClasseActions() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: SUIVI_CLASSE_ACTIONS_KEY })
}

export function useAddSuiviClasseAction() {
  const invalidate = useInvalidateSuiviClasseActions()
  return useMutation({ mutationFn: insertSuiviClasseAction, onSuccess: invalidate })
}

export function useUpdateSuiviClasseActionStatut() {
  const invalidate = useInvalidateSuiviClasseActions()
  return useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: SuiviClasseActionStatut }) => updateSuiviClasseActionStatutRow(id, statut),
    onSuccess: invalidate,
  })
}

export function useDeleteSuiviClasseAction() {
  const invalidate = useInvalidateSuiviClasseActions()
  return useMutation({ mutationFn: (id: string) => deleteSuiviClasseActionRow(id), onSuccess: invalidate })
}
