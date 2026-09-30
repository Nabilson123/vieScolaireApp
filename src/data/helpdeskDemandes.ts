import type { Priorite, BonCommande } from './helpdesk'

export type TypeDemande = 'AMELIORATION' | 'ACTIVITE_PREPARATION'
export type StatutDemande = 'A_PREPARER' | 'EN_PREPARATION' | 'PRET'

export const STATUT_DEMANDE_ORDER: StatutDemande[] = ['A_PREPARER', 'EN_PREPARATION', 'PRET']

export const STATUT_DEMANDE_LABELS: Record<StatutDemande, string> = {
  A_PREPARER: 'À Préparer',
  EN_PREPARATION: 'En Préparation',
  PRET: 'Prêt · Réalisé',
}

export const TYPE_DEMANDE_LABELS: Record<TypeDemande, string> = {
  AMELIORATION: 'Amélioration',
  ACTIVITE_PREPARATION: 'Activité nécessitant préparation',
}

export const TYPE_DEMANDE_ICONS: Record<TypeDemande, string> = {
  AMELIORATION: '💡',
  ACTIVITE_PREPARATION: '📅',
}

export interface DemandeHistoryEntry {
  id: string
  date: string
  action: string
  auteur: string
}

export interface Demande {
  id: string
  type: TypeDemande
  titre: string
  lieu: string
  description: string
  priorite: Priorite
  dateCible: string
  heureCible?: string
  statut: StatutDemande
  declarant: string
  dateSignalement: string
  bc: BonCommande
  historique: DemandeHistoryEntry[]
}

export function makeDemandeHistoryEntry(action: string, auteur: string): DemandeHistoryEntry {
  return { id: crypto.randomUUID(), date: new Date().toISOString(), action, auteur }
}
