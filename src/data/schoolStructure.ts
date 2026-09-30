import { NIVEAUX } from './referentiel'

export interface SchoolClass {
  id: string
  nom: string
  niveau: string
  capaciteMax: number
  salle: string
  statut: 'Active' | 'Archivée'
  professeurPrincipalId?: string
  anneeScolaireId?: string
  /** FICHE PG-11 du Cahier de Procédures — délégué titulaire/suppléant de la classe. */
  delegueTitulaireId?: string
  delegueSuppleantId?: string
  delegueElectionDate?: string
}

export const NIVEAUX_ORDER = NIVEAUX
