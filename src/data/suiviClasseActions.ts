export type SuiviClasseActionStatut = 'a_faire' | 'en_cours' | 'a_relancer' | 'faite'

export const SUIVI_CLASSE_ACTION_STATUT_LABELS: Record<SuiviClasseActionStatut, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  a_relancer: 'À relancer',
  faite: 'Faite',
}

export interface SuiviClasseAction {
  id: string
  niveau: string
  texte: string
  ownerName: string
  echeance?: string
  statut: SuiviClasseActionStatut
  createdBy?: string
  createdAt: string
}
