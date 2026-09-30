import { NIVEAUX } from './referentiel'

export interface Teacher {
  id: string
  prenom: string
  nom: string
  email: string
  telephoneMobile: string
  telephoneDomicile: string
  matricule: string
  plateforme: string
  idMeeting: string
  lienVisio: string
  statut: 'Permanent' | 'Vacataire' | 'Contractuel'
  type: 'Principal' | 'Remplaçant' | 'Stagiaire'
  niveaux: string[]
  matieres: string[]
  classes: string[]
  anneeScolaireId?: string
}

export const ALL_NIVEAUX = NIVEAUX

export const PLATEFORME_OPTIONS = ['Zoom', 'Google Meet', 'Microsoft Teams', 'Autre']
export const STATUT_OPTIONS: Teacher['statut'][] = ['Permanent', 'Vacataire', 'Contractuel']
export const TYPE_OPTIONS: Teacher['type'][] = ['Principal', 'Remplaçant', 'Stagiaire']

export function teacherName(t: Teacher) {
  return `${t.prenom} ${t.nom}`
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
