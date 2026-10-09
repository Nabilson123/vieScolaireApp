import type { JourSoutien } from './soutien'

/** Un club a lieu un jour de semaine, comme une séance de soutien (mêmes clés que `SCHEDULE_DAYS`). */
export type JourClub = JourSoutien

/** Statut d'une inscription : `attente` = liste d'attente (rien n'est facturé), `arrete` = a quitté le club. */
export type StatutInscriptionClub = 'actif' | 'attente' | 'arrete'

export const STATUT_INSCRIPTION_LABELS: Record<StatutInscriptionClub, string> = {
  actif: 'Inscrit',
  attente: "Liste d'attente",
  arrete: 'Arrêté',
}

export type ModeReglement = 'especes' | 'cheque' | 'virement'

export const MODES_REGLEMENT: ModeReglement[] = ['especes', 'cheque', 'virement']

export const MODE_REGLEMENT_LABELS: Record<ModeReglement, string> = {
  especes: 'Espèces',
  cheque: 'Chèque',
  virement: 'Virement',
}

export type StatutReglement = 'valide' | 'annule'

export type LangueRelance = 'fr' | 'ar' | 'both'

/**
 * Un club : une activité hebdomadaire encadrée par un enseignant de l'école ou un intervenant externe, avec une
 * mensualité unique pour tous ses inscrits. Les montants sont des centimes entiers.
 */
export interface Club {
  id: string
  nom: string
  description: string
  /** Enseignant de l'école ; `null` si l'encadrant est un intervenant externe. */
  teacherId: string | null
  /** Intervenant externe (nom libre) ; vide si l'encadrant est un enseignant. */
  intervenantNom: string
  jour: JourClub
  /** HH:MM */
  heureDebut: string
  heureFin: string
  salleId: string | null
  /** `null` = places illimitées. */
  placesMax: number | null
  /** Niveaux admis (ex. « CE1 »), vide = tous les niveaux. */
  niveaux: string[]
  mensualiteCentimes: number
  /** AAAA-MM-01 : premier mois facturé. */
  moisDebut: string
  /** AAAA-MM-01 : dernier mois facturé. */
  moisFin: string
  /** Jour du mois (1 à 28) où la mensualité est due. */
  jourEcheance: number
  /** Jours de grâce après l'échéance avant que la mensualité soit « en retard ». */
  delaiGraceJours: number
  archive: boolean
  createdAt: string
}

export interface ClubInscription {
  id: string
  clubId: string
  studentId: string
  statut: StatutInscriptionClub
  /** AAAA-MM-JJ : le mois d'inscription est dû en entier. */
  dateInscription: string
  /** AAAA-MM-JJ : le mois d'arrêt est dû aussi ; les mois suivants non réglés disparaissent. */
  dateArret: string | null
  exonere: boolean
  motifExoneration: string
  /** Niveau hors des niveaux admis, inscrit malgré tout après confirmation. */
  derogationNiveau: boolean
  createdAt: string
}

/** Une mensualité à payer pour une inscription. */
export interface ClubEcheance {
  id: string
  inscriptionId: string
  /** AAAA-MM-01 */
  mois: string
  montantCentimes: number
  /** AAAA-MM-JJ */
  dateEcheance: string
}

export interface ClubReglement {
  id: string
  /** REC-2026-0001 */
  numero: string
  familleCle: string
  familleLibelle: string
  dateReglement: string
  mode: ModeReglement
  reference: string
  montantCentimes: number
  statut: StatutReglement
  motifAnnulation: string
  annuleLe: string | null
  createdAt: string
}

/** Ce qu'un règlement paie : une ligne par mensualité couverte. */
export interface ClubImputation {
  id: string
  reglementId: string
  echeanceId: string
  montantCentimes: number
}

export interface ClubRelance {
  id: string
  familleCle: string
  familleLibelle: string
  montantDuCentimes: number
  langue: LangueRelance
  envoyeLe: string
}
