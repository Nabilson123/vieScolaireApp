import type { ProfileRole } from './profiles'

export type NoteType = 'INFORMATION' | 'RAPPEL' | 'AVERTISSEMENT' | 'CONVOCATION' | 'ATTESTATION'
export type NoteAudience = 'PARENTS' | 'ENSEIGNANTS' | 'ADMINISTRATIF' | 'TOUS'
export type NoteCibleType = 'etablissement' | 'niveau' | 'classe' | 'eleves' | 'personnes'
export type NoteStatut = 'BROUILLON' | 'EN_ATTENTE_VALIDATION' | 'VALIDEE' | 'DIFFUSEE' | 'ANNULEE'
export type CouponType = 'autorisation' | 'accuse_lecture' | 'libre'

export interface NoteHistoryEntry {
  action: string
  auteur: string
  date: string
}

export interface NoteService {
  id: string
  reference: string
  type: NoteType
  audience: NoteAudience
  cibleType: NoteCibleType
  cibleNiveau: string | null
  cibleClasse: string | null
  cibleEleveIds: string[] | null
  ciblePersonneIds: string[] | null
  objet: string
  corps: string
  couponActif: boolean
  couponType: CouponType | null
  couponDateLimite: string | null
  signataireId: string | null
  statut: NoteStatut
  dateDiffusion: string | null
  rectificatifDeId: string | null
  historique: NoteHistoryEntry[]
  createdBy: string | null
  createdAt: string
}

export function makeNoteHistoryEntry(action: string, auteur: string): NoteHistoryEntry {
  return { action, auteur, date: new Date().toISOString() }
}

export interface NoteTypeConfig {
  label: string
  /** Couleur du filet de tête et de la pastille — Attestation reste blanche (cf. bordered). */
  color: string
  textOnColor: string
  /** Attestation seule : pas d'aplat de couleur, juste un filet gris (charte §4, normative — le
   * mockup §6 de la charte l'affiche par erreur en bleu, bug déjà identifié, non reproduit ici). */
  bordered?: boolean
  usage: string
  defaultSignataireRole: ProfileRole
}

export const NOTE_TYPE_CONFIG: Record<NoteType, NoteTypeConfig> = {
  INFORMATION: {
    label: 'Information',
    color: '#1160AE',
    textOnColor: '#FFFFFF',
    usage: 'Organisation, sorties, calendrier',
    defaultSignataireRole: 'CPE',
  },
  RAPPEL: {
    label: 'Rappel',
    color: '#F6DF43',
    textOnColor: '#141414',
    usage: 'Retards, oublis, tenue, matériel',
    defaultSignataireRole: 'AED',
  },
  AVERTISSEMENT: {
    label: 'Avertissement',
    color: '#E1252B',
    textOnColor: '#FFFFFF',
    usage: 'Sanction, exclusion de cours',
    defaultSignataireRole: 'Direction',
  },
  CONVOCATION: {
    label: 'Convocation',
    color: '#141414',
    textOnColor: '#FFFFFF',
    usage: 'Rendez-vous famille, conseil',
    defaultSignataireRole: 'Direction',
  },
  ATTESTATION: {
    label: 'Attestation',
    color: '#FFFFFF',
    textOnColor: '#141414',
    bordered: true,
    usage: 'Justificatif, sortie anticipée',
    defaultSignataireRole: 'Secrétariat',
  },
}

export const NOTE_TYPES: NoteType[] = ['INFORMATION', 'RAPPEL', 'AVERTISSEMENT', 'CONVOCATION', 'ATTESTATION']

export const NOTE_STATUT_LABELS: Record<NoteStatut, string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_VALIDATION: 'En attente de validation',
  VALIDEE: 'Validée',
  DIFFUSEE: 'Diffusée',
  ANNULEE: 'Annulée',
}

/** Rappel se diffuse directement, sans étape de validation (README §3). */
export function requiresValidation(type: NoteType): boolean {
  return type !== 'RAPPEL'
}

/** Qui peut rédiger un brouillon de ce type — tableau de rôles du README (§ "Droits par rôle"). */
export function canDraftType(role: ProfileRole, type: NoteType): boolean {
  if (role === 'Direction' || role === 'CPE') return true
  if (role === 'AED') return type === 'RAPPEL'
  if (role === 'Secrétariat') return type === 'ATTESTATION'
  return false
}

/** Qui peut valider ce type — Direction valide tout, CPE seulement Information/Rappel, Secrétariat
 * seulement Attestation. Rappel ne passe jamais par cette étape (cf. requiresValidation). */
export function canValidateType(role: ProfileRole, type: NoteType): boolean {
  if (role === 'Direction') return true
  if (role === 'CPE') return type === 'INFORMATION' || type === 'RAPPEL'
  if (role === 'Secrétariat') return type === 'ATTESTATION'
  return false
}

/** Qui peut diffuser — même droit que rédiger dans le tableau du README (tous les rôles habilités
 * à rédiger un type peuvent aussi le diffuser une fois validé). */
export function canDiffuserType(role: ProfileRole, type: NoteType): boolean {
  return canDraftType(role, type)
}

/** Miroir de nextBCNumero (data/helpdesk.ts) : scanne les références déjà chargées pour l'année en
 * cours et incrémente le suffixe max — pas de séquence PostgreSQL. */
export function nextNoteReference(existing: NoteService[]): string {
  const year = new Date().getFullYear()
  const prefix = `VS-${year}-`
  let max = 0
  existing.forEach((n) => {
    if (n.reference.startsWith(prefix)) {
      const num = Number(n.reference.slice(prefix.length))
      if (!Number.isNaN(num) && num > max) max = num
    }
  })
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  autorisation: 'Autorise / N\'autorise pas',
  accuse_lecture: 'Accusé de lecture',
  libre: 'Champ libre',
}
