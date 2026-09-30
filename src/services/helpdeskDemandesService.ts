import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { STATUT_DEMANDE_LABELS, makeDemandeHistoryEntry, type Demande, type StatutDemande, type TypeDemande } from '../data/helpdeskDemandes'
import { emptyBC, nextBCNumero, type Priorite, type BonCommande } from '../data/helpdesk'
import { getIncidentsSnapshot } from './helpdeskService'

interface DemandeRow {
  id: string
  type: TypeDemande
  titre: string
  lieu: string
  description: string
  priorite: Priorite
  date_cible: string
  heure_cible: string | null
  statut: StatutDemande
  declarant: string
  date_signalement: string
  bc: BonCommande
  historique: Demande['historique']
}

function rowToDemande(row: DemandeRow): Demande {
  return {
    id: row.id,
    type: row.type,
    titre: row.titre,
    lieu: row.lieu,
    description: row.description,
    priorite: row.priorite,
    dateCible: row.date_cible,
    heureCible: row.heure_cible ?? undefined,
    statut: row.statut,
    declarant: row.declarant,
    dateSignalement: row.date_signalement,
    bc: row.bc,
    historique: row.historique,
  }
}

const DEMANDES_KEY = ['helpdeskDemandes']

async function fetchDemandes(): Promise<Demande[]> {
  const { data, error } = await supabase.from('helpdesk_demandes').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as DemandeRow[]).map(rowToDemande)
}

export function useDemandes(enabled = true) {
  const query = useQuery({ queryKey: DEMANDES_KEY, queryFn: fetchDemandes, enabled })
  useEffect(() => {
    if (query.data) cachedDemandes = query.data
  }, [query.data])
  return query
}

let cachedDemandes: Demande[] = []
export function getDemandesSnapshot(): Demande[] {
  return cachedDemandes
}

async function insertDemande(data: {
  type: TypeDemande
  titre: string
  lieu: string
  description: string
  priorite: Priorite
  dateCible: string
  heureCible?: string
  declarant: string
}): Promise<Demande> {
  const historique = [makeDemandeHistoryEntry('Demande créée', data.declarant)]
  // Même séquence de numérotation que les pannes (helpdeskService.ts:insertIncident) : les deux
  // listes combinées, pour ne jamais attribuer le même numéro de BC à une panne et une demande.
  const bc = emptyBC(nextBCNumero([...cachedDemandes, ...getIncidentsSnapshot()]))
  const row = {
    type: data.type,
    titre: data.titre,
    lieu: data.lieu,
    description: data.description,
    priorite: data.priorite,
    statut: 'A_PREPARER' as StatutDemande,
    date_cible: data.dateCible,
    heure_cible: data.heureCible || null,
    declarant: data.declarant,
    date_signalement: new Date().toISOString().slice(0, 10),
    bc,
    historique,
  }
  const { data: inserted, error } = await supabase.from('helpdesk_demandes').insert(row).select('*').single()
  if (error) throw error
  return rowToDemande(inserted as DemandeRow)
}

async function updateDemandeStatutRow(id: string, statut: StatutDemande, auteur: string): Promise<void> {
  const demande = cachedDemandes.find((d) => d.id === id)
  if (!demande) return
  const historique = [makeDemandeHistoryEntry(`Statut changé : ${STATUT_DEMANDE_LABELS[statut]}`, auteur), ...demande.historique]
  const { error } = await supabase.from('helpdesk_demandes').update({ statut, historique }).eq('id', id)
  if (error) throw error
}

async function deleteDemandeRow(id: string): Promise<void> {
  const { error } = await supabase.from('helpdesk_demandes').delete().eq('id', id)
  if (error) throw error
}

async function updateDemandeBonCommandeRow(demandeId: string, bc: BonCommande, action: string, auteur: string): Promise<void> {
  const demande = cachedDemandes.find((d) => d.id === demandeId)
  if (!demande) return
  const historique = [makeDemandeHistoryEntry(action, auteur), ...demande.historique]
  const { error } = await supabase.from('helpdesk_demandes').update({ bc, historique }).eq('id', demandeId)
  if (error) throw error
}

function useInvalidateDemandes() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: DEMANDES_KEY })
}

export function useAddDemande() {
  const invalidate = useInvalidateDemandes()
  return useMutation({ mutationFn: insertDemande, onSuccess: invalidate })
}

export function useUpdateDemandeStatut() {
  const invalidate = useInvalidateDemandes()
  return useMutation({
    mutationFn: ({ id, statut, auteur }: { id: string; statut: StatutDemande; auteur: string }) => updateDemandeStatutRow(id, statut, auteur),
    onSuccess: invalidate,
  })
}

export function useDeleteDemande() {
  const invalidate = useInvalidateDemandes()
  return useMutation({ mutationFn: (id: string) => deleteDemandeRow(id), onSuccess: invalidate })
}

export function useUpdateDemandeBonCommande() {
  const invalidate = useInvalidateDemandes()
  return useMutation({
    mutationFn: ({ demandeId, bc, action, auteur }: { demandeId: string; bc: BonCommande; action: string; auteur: string }) =>
      updateDemandeBonCommandeRow(demandeId, bc, action, auteur),
    onSuccess: invalidate,
  })
}
