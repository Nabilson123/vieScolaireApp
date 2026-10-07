/** Jours possibles d'une séance de soutien (mêmes clés que `SCHEDULE_DAYS` des emplois du temps). */
export type JourSoutien = 'LUNDI' | 'MARDI' | 'MERCREDI' | 'JEUDI' | 'VENDREDI'

export const JOURS_SOUTIEN: JourSoutien[] = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']

export const JOUR_LABELS: Record<JourSoutien, string> = {
  LUNDI: 'Lundi',
  MARDI: 'Mardi',
  MERCREDI: 'Mercredi',
  JEUDI: 'Jeudi',
  VENDREDI: 'Vendredi',
}

export const JOUR_LABELS_AR: Record<JourSoutien, string> = {
  LUNDI: 'الاثنين',
  MARDI: 'الثلاثاء',
  MERCREDI: 'الأربعاء',
  JEUDI: 'الخميس',
  VENDREDI: 'الجمعة',
}

/** Réponse des parents : `a_confirmer` tant que la vie scolaire n'a pas noté de réponse. */
export type StatutSoutien = 'a_confirmer' | 'reste' | 'ne_reste_pas'

export const STATUTS_SOUTIEN: StatutSoutien[] = ['a_confirmer', 'reste', 'ne_reste_pas']

/**
 * Une séance de soutien : une matière, un jour et un horaire hebdomadaires sur une période, un enseignant, une salle
 * et les classes visées. Les élèves y sont inscrits (`SoutienInscription`).
 */
export interface SoutienSeance {
  id: string
  matiere: string
  jour: JourSoutien
  /** HH:MM */
  heureDebut: string
  heureFin: string
  teacherId: string | null
  salleId: string | null
  /** Classes visées : proposées à l'inscription et affichées dans leur emploi du temps. */
  classes: string[]
  /** AAAA-MM-JJ : première semaine de la période. */
  dateDebut: string
  /** AAAA-MM-JJ, `null` = jusqu'à la fin de l'année. */
  dateFin: string | null
  /** Dates précises où la séance n'a pas lieu. */
  datesAnnulees: string[]
  note: string
  createdAt: string
}

export interface SoutienInscription {
  id: string
  seanceId: string
  studentId: string
  statut: StatutSoutien
  /** ISO : dernier message envoyé aux parents ; `null` = pas encore prévenus. */
  messageEnvoyeLe: string | null
  /** ISO : moment où la réponse des parents a été notée. */
  reponduLe: string | null
  createdAt: string
}

/**
 * Libellé d'une réponse. Pour un élève qui prend le car du soir, ne pas rester revient à partir en transport ;
 * pour les autres, c'est simplement qu'il ne reste pas.
 */
export function statutSoutienLabel(statut: StatutSoutien, aTransportSoir: boolean): string {
  if (statut === 'reste') return 'Reste au soutien'
  if (statut === 'ne_reste_pas') return aTransportSoir ? 'Part en transport' : 'Ne reste pas'
  return 'À confirmer'
}
