import type { SuiviCompteRendu } from './suiviCompteRendu'

export interface SuiviProf {
  id: string
  teacherIds: string[]
  date: string
  heure: string
  duree: number
  lieu: string
  motif: string
  statut: 'Planifié' | 'Réalisé' | 'Annulé'
  notes: string
  createdBy?: string
  createdAt: string
  /** Niveau pédagogique couvert par ce suivi (ex. "CE1" pour une réunion réunissant les PP de
   * CE1-A et CE1-B) — rempli quand créé depuis le dashboard "Suivi de Classe", absent sinon. */
  niveau?: string
  /** Compte-rendu structuré en 8 points, rédigé depuis l'onglet "Réunion de suivi de classe" —
   * distinct de `notes` (texte libre du flux générique "Suivi Profs"), jamais les deux à la fois. */
  compteRendu?: SuiviCompteRendu
}
