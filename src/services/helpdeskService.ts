import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import {
  STATUT_INCIDENT_LABELS,
  emptyBC,
  makeHistoryEntry,
  nextBCNumero,
  type BonCommande,
  type Incident,
  type Priorite,
  type StatutIncident,
  type Prestataire,
} from '../data/helpdesk'
import { getDemandesSnapshot } from './helpdeskDemandesService'

interface IncidentRow {
  id: string
  titre: string
  categorie: string
  lieu: string
  priorite: Priorite
  description: string
  statut: StatutIncident
  declarant: string
  date_signalement: string
  photo: string | null
  bc: BonCommande
  historique: Incident['historique']
}

function rowToIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    titre: row.titre,
    categorie: row.categorie,
    lieu: row.lieu,
    priorite: row.priorite,
    description: row.description,
    statut: row.statut,
    declarant: row.declarant,
    dateSignalement: row.date_signalement,
    photo: row.photo ?? undefined,
    bc: row.bc,
    historique: row.historique,
  }
}

const INCIDENTS_KEY = ['helpdeskIncidents']
const PRESTATAIRES_KEY = ['helpdeskPrestataires']

async function fetchIncidents(): Promise<Incident[]> {
  const { data, error } = await supabase.from('helpdesk_incidents').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as IncidentRow[]).map(rowToIncident)
}

export function useIncidents(enabled = true) {
  const query = useQuery({ queryKey: INCIDENTS_KEY, queryFn: fetchIncidents, enabled })
  useEffect(() => {
    if (query.data) cachedIncidents = query.data
  }, [query.data])
  return query
}

let cachedIncidents: Incident[] = []
export function getIncidentsSnapshot(): Incident[] {
  return cachedIncidents
}

interface PrestataireRow {
  id: string
  nom: string
  type_intervenant: string
  telephone: string
}

function rowToPrestataire(row: PrestataireRow): Prestataire {
  return { id: row.id, nom: row.nom, typeIntervenant: row.type_intervenant, telephone: row.telephone }
}

async function fetchPrestataires(): Promise<Prestataire[]> {
  const { data, error } = await supabase.from('prestataires').select('*').order('nom', { ascending: true })
  if (error) throw error
  return (data as PrestataireRow[]).map(rowToPrestataire)
}

export function usePrestataires(enabled = true) {
  const query = useQuery({ queryKey: PRESTATAIRES_KEY, queryFn: fetchPrestataires, enabled })
  useEffect(() => {
    if (query.data) cachedPrestataires = query.data
  }, [query.data])
  return query
}

let cachedPrestataires: Prestataire[] = []
export function getPrestatairesSnapshot(): Prestataire[] {
  return cachedPrestataires
}

export function findPrestataireByNomSnapshot(nom: string): Prestataire | undefined {
  const target = nom.trim().toLowerCase()
  if (!target) return undefined
  return cachedPrestataires.find((p) => p.nom.trim().toLowerCase() === target)
}

export function countPrestataireInterventionsSnapshot(nom: string): number {
  const target = nom.trim().toLowerCase()
  if (!target) return 0
  return cachedIncidents.filter((inc) => inc.bc.prestataireNom.trim().toLowerCase() === target).length
}

export async function insertPrestataire(nom: string, typeIntervenant: string, telephone: string): Promise<Prestataire> {
  const { data, error } = await supabase
    .from('prestataires')
    .insert({ nom, type_intervenant: typeIntervenant, telephone })
    .select('*')
    .single()
  if (error) throw error
  return rowToPrestataire(data as PrestataireRow)
}

export async function insertIncident(data: {
  titre: string
  categorie: string
  lieu: string
  priorite: Priorite
  description: string
  declarant: string
  photo?: string
}): Promise<Incident> {
  // Même séquence de numérotation que les demandes (helpdeskDemandesService.ts:insertDemande) :
  // les deux listes combinées, pour ne jamais attribuer le même numéro de BC des deux côtés.
  const bc = emptyBC(nextBCNumero([...cachedIncidents, ...getDemandesSnapshot()]))
  const historique = [makeHistoryEntry('Incident déclaré', data.declarant)]
  const row = {
    titre: data.titre,
    categorie: data.categorie,
    lieu: data.lieu,
    priorite: data.priorite,
    description: data.description,
    statut: 'A_TRAITER' as StatutIncident,
    declarant: data.declarant,
    date_signalement: new Date().toISOString().slice(0, 10),
    photo: data.photo ?? null,
    bc,
    historique,
  }
  const { data: inserted, error } = await supabase.from('helpdesk_incidents').insert(row).select('*').single()
  if (error) throw error
  return rowToIncident(inserted as IncidentRow)
}

export async function updateIncidentStatutRow(id: string, statut: StatutIncident, auteur: string): Promise<void> {
  const incident = cachedIncidents.find((inc) => inc.id === id)
  if (!incident) return
  const historique = [makeHistoryEntry(`Statut changé : ${STATUT_INCIDENT_LABELS[statut]}`, auteur), ...incident.historique]
  const { error } = await supabase.from('helpdesk_incidents').update({ statut, historique }).eq('id', id)
  if (error) throw error
}

export async function deleteIncidentRow(id: string): Promise<void> {
  const { error } = await supabase.from('helpdesk_incidents').delete().eq('id', id)
  if (error) throw error
}

export async function updateBonCommandeRow(incidentId: string, bc: BonCommande, action: string, auteur: string): Promise<void> {
  const incident = cachedIncidents.find((inc) => inc.id === incidentId)
  if (!incident) return
  const historique = [makeHistoryEntry(action, auteur), ...incident.historique]
  const { error } = await supabase.from('helpdesk_incidents').update({ bc, historique }).eq('id', incidentId)
  if (error) throw error
}

function useInvalidateIncidents() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: INCIDENTS_KEY })
}

function useInvalidatePrestataires() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: PRESTATAIRES_KEY })
}

export function useAddIncident() {
  const invalidate = useInvalidateIncidents()
  return useMutation({ mutationFn: insertIncident, onSuccess: invalidate })
}

export function useUpdateIncidentStatut() {
  const invalidate = useInvalidateIncidents()
  return useMutation({
    mutationFn: ({ id, statut, auteur }: { id: string; statut: StatutIncident; auteur: string }) =>
      updateIncidentStatutRow(id, statut, auteur),
    onSuccess: invalidate,
  })
}

export function useDeleteIncident() {
  const invalidate = useInvalidateIncidents()
  return useMutation({ mutationFn: (id: string) => deleteIncidentRow(id), onSuccess: invalidate })
}

export function useUpdateBonCommande() {
  const invalidate = useInvalidateIncidents()
  return useMutation({
    mutationFn: ({ incidentId, bc, action, auteur }: { incidentId: string; bc: BonCommande; action: string; auteur: string }) =>
      updateBonCommandeRow(incidentId, bc, action, auteur),
    onSuccess: invalidate,
  })
}

export function useAddPrestataire() {
  const invalidate = useInvalidatePrestataires()
  return useMutation({
    mutationFn: ({ nom, typeIntervenant, telephone }: { nom: string; typeIntervenant: string; telephone: string }) =>
      insertPrestataire(nom, typeIntervenant, telephone),
    onSuccess: invalidate,
  })
}
