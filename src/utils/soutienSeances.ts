import { timeToMinutes } from '../data/classSchedules'
import {
  JOURS_SOUTIEN,
  JOUR_LABELS,
  type JourSoutien,
  type SoutienInscription,
  type SoutienSeance,
  type StatutSoutien,
} from '../data/soutien'

// Logique pure et légère des séances de soutien (dates, grille, occupation). Volontairement sans import de service ni de
// moteur d'alertes : les agrégats d'emploi du temps et de disponibilité des enseignants l'appellent sans créer de cycle.

const JOUR_PAR_INDEX: (JourSoutien | null)[] = [null, 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', null]

/** Jour de semaine d'une date AAAA-MM-JJ (`null` le week-end ou si la date est illisible). */
export function jourDeDate(dateISO: string): JourSoutien | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO)
  if (!m) return null
  return JOUR_PAR_INDEX[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()]
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ajouterJours(dateISO: string, jours: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO)
  if (!m) return dateISO
  return toISO(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + jours))
}

export const FIN_DES_TEMPS = '9999-12-31'

/** La séance a-t-elle lieu ce jour-là ? Dans la période, bon jour de semaine, et date non annulée. */
export function seanceActiveLe(seance: SoutienSeance, dateISO: string): boolean {
  if (jourDeDate(dateISO) !== seance.jour) return false
  if (dateISO < seance.dateDebut) return false
  if (seance.dateFin && dateISO > seance.dateFin) return false
  return !seance.datesAnnulees.includes(dateISO)
}

/** La période de la séance est-elle close ? (Une séance sans date de fin ne se termine jamais.) */
export function seanceTerminee(seance: SoutienSeance, aujourdhuiISO: string): boolean {
  return seance.dateFin !== null && seance.dateFin < aujourdhuiISO
}

/**
 * Dates où la séance a lieu (une par semaine), de la première à la dernière ; au plus `max` dates quand la période est
 * ouverte. Par défaut les dates annulées sont écartées.
 */
export function occurrencesSeance(seance: SoutienSeance, opts: { max?: number; depuis?: string; avecAnnulees?: boolean } = {}): string[] {
  const max = opts.max ?? 60
  const out: string[] = []
  let cursor = opts.depuis && opts.depuis > seance.dateDebut ? opts.depuis : seance.dateDebut
  // Avance jusqu'au premier bon jour de semaine (au plus 6 jours).
  for (let i = 0; i < 7 && jourDeDate(cursor) !== seance.jour; i++) cursor = ajouterJours(cursor, 1)
  if (jourDeDate(cursor) !== seance.jour) return out
  const fin = seance.dateFin ?? FIN_DES_TEMPS
  while (cursor <= fin && out.length < max) {
    if (opts.avecAnnulees || !seance.datesAnnulees.includes(cursor)) out.push(cursor)
    cursor = ajouterJours(cursor, 7)
  }
  return out
}

/** Prochaine date (à partir de `depuisISO`, incluse) où la séance a lieu. */
export function prochaineOccurrence(seance: SoutienSeance, depuisISO: string): string | null {
  return occurrencesSeance(seance, { depuis: depuisISO, max: 1 })[0] ?? null
}

/** Dates annulées, dans l'ordre chronologique. */
export function occurrencesAnnulees(seance: SoutienSeance): string[] {
  return [...seance.datesAnnulees].sort()
}

/** « Lundi 16:30–17:30 ». */
export function libelleCreneau(seance: Pick<SoutienSeance, 'jour' | 'heureDebut' | 'heureFin'>): string {
  return `${JOUR_LABELS[seance.jour]} ${seance.heureDebut}–${seance.heureFin}`
}

/** Le jour, le début ou la fin changent-ils ? Les familles doivent alors être prévenues et confirmer à nouveau. */
export function creneauModifie(
  avant: Pick<SoutienSeance, 'jour' | 'heureDebut' | 'heureFin'>,
  apres: Pick<SoutienSeance, 'jour' | 'heureDebut' | 'heureFin'>,
): boolean {
  return avant.jour !== apres.jour || avant.heureDebut !== apres.heureDebut || avant.heureFin !== apres.heureFin
}

export function inscritsDeLaSeance(inscriptions: SoutienInscription[], seanceId: string): SoutienInscription[] {
  return inscriptions.filter((i) => i.seanceId === seanceId)
}

export type CompteStatuts = Record<StatutSoutien, number>

export function compterStatuts(inscriptions: SoutienInscription[]): CompteStatuts {
  const c: CompteStatuts = { a_confirmer: 0, reste: 0, ne_reste_pas: 0 }
  inscriptions.forEach((i) => {
    c[i.statut] += 1
  })
  return c
}

// ───────────────────────── Grille et occupation ─────────────────────────

export interface BlocSoutien {
  seanceId: string
  matiere: string
  jour: JourSoutien
  start: string
  end: string
  nbEleves: number
  label: string
}

export function libelleBloc(matiere: string, nbEleves: number): string {
  return `Soutien – ${matiere} · ${nbEleves} élève${nbEleves > 1 ? 's' : ''}`
}

export interface FiltreBlocs {
  /** Grille d'une classe : séances qui la visent ou qui comptent un de ses élèves ; le nombre d'élèves est celui de la classe. */
  classe?: string
  /** Grille d'un enseignant. */
  teacherId?: string
  classeDe: (studentId: string) => string | undefined
  /** Les séances closes avant cette date (AAAA-MM-JJ) ne sont plus affichées. */
  aPartirDe: string
}

/** Blocs de soutien à poser dans une grille hebdomadaire, par jour et triés par heure. */
export function blocsSoutienParJour(seances: SoutienSeance[], inscriptions: SoutienInscription[], filtre: FiltreBlocs): Record<JourSoutien, BlocSoutien[]> {
  const out = {} as Record<JourSoutien, BlocSoutien[]>
  JOURS_SOUTIEN.forEach((j) => {
    out[j] = []
  })
  seances.forEach((s) => {
    if (seanceTerminee(s, filtre.aPartirDe)) return
    if (filtre.teacherId && s.teacherId !== filtre.teacherId) return
    const inscrits = inscritsDeLaSeance(inscriptions, s.id)
    let nb = inscrits.length
    if (filtre.classe) {
      const deLaClasse = inscrits.filter((i) => filtre.classeDe(i.studentId) === filtre.classe)
      if (!s.classes.includes(filtre.classe) && deLaClasse.length === 0) return
      nb = deLaClasse.length
    }
    out[s.jour].push({ seanceId: s.id, matiere: s.matiere, jour: s.jour, start: s.heureDebut, end: s.heureFin, nbEleves: nb, label: libelleBloc(s.matiere, nb) })
  })
  JOURS_SOUTIEN.forEach((j) => out[j].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)))
  return out
}

interface Intervalle {
  start: string
  end: string
}

function intervallesSeances(seances: SoutienSeance[], garde: (s: SoutienSeance) => boolean, jour: string, dateISO?: string): Intervalle[] {
  return seances
    .filter((s) => garde(s) && (dateISO ? seanceActiveLe(s, dateISO) : s.jour === jour))
    .map((s) => ({ start: s.heureDebut, end: s.heureFin }))
}

/**
 * Plages où l'enseignant anime un soutien. Avec une date : seulement si la séance a lieu ce jour-là (période et date
 * annulée comprises) ; sans date : toutes les séances de ce jour de semaine. N'entre pas dans le quota d'heures de
 * l'enseignant, seulement dans sa disponibilité.
 */
export function intervallesSoutienEnseignant(seances: SoutienSeance[], teacherId: string, jour: string, dateISO?: string): Intervalle[] {
  if (!teacherId) return []
  return intervallesSeances(seances, (s) => s.teacherId === teacherId, jour, dateISO)
}

export function intervallesSoutienSalle(seances: SoutienSeance[], salleId: string, jour: string, dateISO?: string): Intervalle[] {
  if (!salleId) return []
  return intervallesSeances(seances, (s) => s.salleId === salleId, jour, dateISO)
}

