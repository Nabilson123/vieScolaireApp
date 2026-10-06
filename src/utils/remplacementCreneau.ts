import type { RemplacementRecord } from '../data/teacherExtras'

/** Un cours de l'emploi du temps d'une classe, avec le nom de son professeur. */
export interface SlotInfo {
  subject: string
  teacherName: string
  start: string
  end: string
  hours: number
}

export interface CreneauRemplacement {
  start: string
  end: string
  /** Heure retrouvée dans l'emploi du temps, faute d'avoir été enregistrée avec le remplacement. */
  derived: boolean
}

const TOLERANCE_HEURES = 0.02

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Durée en heures entre deux heures HH:MM, arrondie au centième (1h40 → 1,67). */
export function heuresEntre(start: string, end: string): number {
  return Math.round(((toMinutes(end) - toMinutes(start)) / 60) * 100) / 100
}

/**
 * Créneau exact d'un remplacement. Quand l'heure a été enregistrée (affectation par portion, assistant, Cockpit) elle fait
 * foi. Sinon — remplacement affecté directement depuis l'emploi du temps — on la retrouve dans le cours de la classe ce
 * jour-là : même matière, même professeur absent, même durée. S'il y a le moindre doute (aucun cours, plusieurs cours
 * possibles, durée différente comme une portion de séance), on ne devine pas.
 */
export function creneauDuRemplacement(r: Pick<RemplacementRecord, 'matiere' | 'profRemplace' | 'heures' | 'start' | 'end'>, slotsDeLaClasse: SlotInfo[]): CreneauRemplacement | null {
  if (r.start && r.end) return { start: r.start, end: r.end, derived: false }
  const candidats = slotsDeLaClasse.filter((s) => s.subject === r.matiere && s.teacherName === r.profRemplace && Math.abs(s.hours - r.heures) <= TOLERANCE_HEURES)
  return candidats.length === 1 ? { start: candidats[0].start, end: candidats[0].end, derived: true } : null
}
