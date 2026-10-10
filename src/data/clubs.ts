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

/** Une séance hebdomadaire d'un club : un jour, des heures et (facultatif) une salle. */
export interface ClubSeance {
  jour: JourClub
  /** HH:MM */
  heureDebut: string
  heureFin: string
  salleId: string | null
}

/**
 * Un club : une activité encadrée par un enseignant de l'école ou un intervenant externe, avec une mensualité unique pour
 * tous ses inscrits, quel que soit le nombre de ses séances par semaine. Les montants sont des centimes entiers.
 *
 * Une catégorie (U9, U12…) est une fiche de club à part qui porte le même `nom` que ses sœurs (« Football ») : elle a ses
 * propres séances, encadrant, places, niveaux, tarif et inscrits.
 */
export interface Club {
  id: string
  /** Nom de l'activité (« Football ») : les catégories d'une même activité le partagent. */
  nom: string
  /** Catégorie au sein de l'activité (« U9 ») ; vide pour un club sans catégories. */
  categorie: string
  description: string
  /** Enseignant de l'école ; `null` si l'encadrant est un intervenant externe. */
  teacherId: string | null
  /** Intervenant externe (nom libre) ; vide si l'encadrant est un enseignant. */
  intervenantNom: string
  /** Séances de la semaine (au moins une). */
  seances: ClubSeance[]
  /** `null` = places illimitées. */
  placesMax: number | null
  /** Niveaux admis (ex. « CE1 »), vide = tous les niveaux. */
  niveaux: string[]
  mensualiteCentimes: number
  /**
   * Frais d'inscription : un montant unique par élève, dû à la date d'inscription (0 = aucun frais). Un élève exonéré ne les
   * doit pas ; un élève qui revient après un arrêt ne les repaie pas.
   */
  fraisInscriptionCentimes: number
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

/** Nom affiché d'un club : « Football U9 » (activité et catégorie), ou simplement « Théâtre » sans catégorie. */
export function libelleClub(club: Pick<Club, 'nom' | 'categorie'>): string {
  const categorie = club.categorie.trim()
  return categorie ? `${club.nom} ${categorie}` : club.nom
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

/** Ce que paie une échéance : une mensualité du club, ou les frais d'inscription (une seule fois par inscription). */
export type TypeEcheance = 'mensualite' | 'inscription'

/** Une somme à payer pour une inscription : une mensualité, ou les frais d'inscription. */
export interface ClubEcheance {
  id: string
  inscriptionId: string
  type: TypeEcheance
  /** AAAA-MM-01 ; pour les frais d'inscription, le mois de l'inscription. */
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
