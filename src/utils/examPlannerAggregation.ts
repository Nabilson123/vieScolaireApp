import type { ExamSession, SurveillantAssignment } from '../data/examPlanner'
import { timeToMinutes, minutesToTime } from '../data/classSchedules'
import type { Salle } from '../data/salles'
import { fullLabel } from '../data/salles'
import { initials, teacherName, type Teacher } from '../data/teachers'
import { CYCLES, cycleOfNiveau } from '../data/referentiel'
import { getWeekdayName } from './replacementAggregation'
import { computeTeacherSchedule } from './teacherAggregation'
import { getClassesSnapshot } from '../services/classesService'
import { getClassScheduleSnapshot } from '../services/classSchedulesService'
import { getSallesSnapshot } from '../services/sallesService'
import { getStudentsSnapshot } from '../services/studentsService'
import { getTeachersSnapshot } from '../services/teachersService'
import { getTeacherExtraSnapshot } from '../services/teacherExtrasService'

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd)
}

const EXAM_NIVEAUX = ['CE6', '3APIC']

/** Seules les classes de CE6 et 3APIC passent des examens dans cet établissement — les sélecteurs de
 * classe du planificateur d'examens ne proposent donc que celles-ci, pas les 20 classes de l'école. */
export function getExamEligibleClassNames(): string[] {
  return getClassesSnapshot()
    .filter((c) => c.statut === 'Active' && EXAM_NIVEAUX.includes(c.niveau))
    .map((c) => c.nom)
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISODate(d: Date): string {
  return d.toLocaleDateString('sv-SE')
}

/** Nombre de jours calendaires entre deux dates ISO (fromDate → toDate, peut être négatif). */
export function daysBetween(fromDateISO: string, toDateISO: string): number {
  const ms = parseISODate(toDateISO).getTime() - parseISODate(fromDateISO).getTime()
  return Math.round(ms / 86400000)
}

/** Décale une date ISO de `days` jours calendaires (peut être négatif). */
export function shiftDateByDays(dateISO: string, days: number): string {
  const d = parseISODate(dateISO)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/**
 * Une autre session occupe déjà cette salle sur un créneau qui chevauche celui-ci, le même jour.
 * Exception : une autre classe qui passe la même épreuve (même matière, même créneau exact) dans
 * cette salle n'est pas un conflit — c'est le cas normal d'une salle partagée entre plusieurs
 * classes pour un même examen (ex: tout un cycle réuni dans une même salle).
 */
export function hasSalleConflict(
  sessions: ExamSession[],
  date: string,
  start: string,
  end: string,
  salleLabel: string,
  matiere: string,
  excludeId?: string
): boolean {
  if (!salleLabel) return false
  return sessions.some(
    (s) =>
      s.id !== excludeId &&
      s.date === date &&
      s.salleLabel === salleLabel &&
      overlaps(start, end, s.start, s.end) &&
      !(s.matiere === matiere && s.start === start && s.end === end)
  )
}

/** Cette classe a déjà un examen sur un créneau qui chevauche celui-ci, le même jour. */
export function hasClasseConflict(
  sessions: ExamSession[],
  date: string,
  start: string,
  end: string,
  classe: string,
  excludeId?: string
): boolean {
  if (!classe) return false
  return sessions.some(
    (s) => s.id !== excludeId && s.date === date && s.classe === classe && overlaps(start, end, s.start, s.end)
  )
}

export interface SalleSuggestion {
  label: string
  capacite: number
  suffisante: boolean
}

/** Classe les salles libres (label pas dans `occupiedLabels`) : capacité suffisante d'abord, puis capacité croissante. */
export function rankSalles(salles: Salle[], effectif: number, occupiedLabels: Set<string>): SalleSuggestion[] {
  return salles
    .filter((salle) => !occupiedLabels.has(fullLabel(salle)))
    .map((salle) => ({ label: fullLabel(salle), capacite: salle.capacite, suffisante: salle.capacite >= effectif }))
    .sort((a, b) => {
      if (a.suffisante !== b.suffisante) return a.suffisante ? -1 : 1
      return a.capacite - b.capacite
    })
}

/** Salles disponibles pour cette classe sur ce créneau, triées par pertinence de capacité. */
export function suggestSalles(
  sessions: ExamSession[],
  classe: string,
  matiere: string,
  date: string,
  start: string,
  end: string,
  excludeId?: string
): SalleSuggestion[] {
  const effectif = getStudentsSnapshot().filter((s) => s.classe === classe).length
  const occupied = new Set(
    sessions
      .filter(
        (s) =>
          s.id !== excludeId &&
          s.date === date &&
          overlaps(start, end, s.start, s.end) &&
          !(s.matiere === matiere && s.start === start && s.end === end)
      )
      .map((s) => s.salleLabel)
  )
  return rankSalles(getSallesSnapshot(), effectif, occupied)
}

function isTeacherAbsentOnDate(teacherId: string, date: string): boolean {
  return getTeacherExtraSnapshot(teacherId).absences.some((a) => a.type === 'ABSENCE' && a.date === date)
}

/** Deux examens dans la MÊME salle sur l'EXACT même créneau sont physiquement la même surveillance —
 * ex: CE6-A et CE6-B passent le même examen ensemble dans la même salle. Un prof qui surveille l'un
 * surveille donc déjà l'autre de fait ; ça ne doit ni le bloquer comme "déjà pris" pour l'autre classe
 * ni consommer une deuxième fois son temps libre. */
function isCoLocated(a: { salleLabel: string; start: string; end: string }, b: { salleLabel: string; start: string; end: string }): boolean {
  return !!a.salleLabel && a.salleLabel === b.salleLabel && a.start === b.start && a.end === b.end
}

/** Ce prof surveille déjà un créneau qui chevauche celui-ci, le même jour — sur son horaire précis
 * assigné (pas la durée complète de l'examen) : un prof qui ne couvre que 09:00-09:30 redevient
 * disponible dès 09:30 pour un autre examen, même sur le même créneau global. Un examen co-localisé
 * (même salle, même créneau exact) ne compte jamais comme "déjà surveillé ailleurs". */
function isTeacherAlreadySurveillant(
  sessions: ExamSession[],
  teacherId: string,
  date: string,
  start: string,
  end: string,
  excludeId?: string,
  salleLabel?: string
): boolean {
  return sessions.some(
    (s) =>
      s.id !== excludeId &&
      s.date === date &&
      !(salleLabel && isCoLocated(s, { salleLabel, start, end })) &&
      s.surveillants.some((a) => a.teacherId === teacherId && overlaps(start, end, a.start, a.end))
  )
}

/** Nombre de surveillants exigés simultanément par défaut, quand aucun effectif cible n'est précisé
 * (badges affichés hors de l'écran de dispatch, qui n'ont pas accès au champ "Nombre" ajustable). */
export const DEFAULT_REQUIRED_SURVEILLANTS = 3

export interface CoverageSegment {
  start: string
  end: string
  /** Nombre de surveillants présents simultanément sur ce segment. */
  depth: number
}

/** Découpe [start, end] en segments contigus, chacun avec le nombre de surveillants présents en même
 * temps sur ce segment (ex: 2 profs se chevauchent 09:00-09:30 puis un seul reste 09:30-10:00). */
function coverageSegments(assignments: SurveillantAssignment[], start: string, end: string): CoverageSegment[] {
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  if (endMin <= startMin) return []
  const clipped = assignments
    .map((a) => [Math.max(timeToMinutes(a.start), startMin), Math.min(timeToMinutes(a.end), endMin)] as const)
    .filter(([s, e]) => e > s)
  const breakpoints = Array.from(new Set([startMin, endMin, ...clipped.flatMap(([s, e]) => [s, e])])).sort((a, b) => a - b)
  const segments: CoverageSegment[] = []
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const segStart = breakpoints[i]
    const segEnd = breakpoints[i + 1]
    if (segEnd <= segStart) continue
    const depth = clipped.filter(([s, e]) => s <= segStart && e >= segEnd).length
    segments.push({ start: minutesToTime(segStart), end: minutesToTime(segEnd), depth })
  }
  return segments
}

/** Vrai si `required` surveillants au moins sont présents SIMULTANÉMENT à chaque instant de [start, end]
 * — pas juste que la durée totale est couverte par des horaires qui se chevauchent mal (ex: 2 profs sur
 * tout le créneau plus un 3e seulement sur la fin ne suffit pas si l'école exige 3 profs en même temps
 * dès le début). */
export function isFullyCovered(
  surveillants: SurveillantAssignment[],
  start: string,
  end: string,
  required: number = DEFAULT_REQUIRED_SURVEILLANTS
): boolean {
  if (surveillants.length === 0) return false
  const segments = coverageSegments(surveillants, start, end)
  return segments.length > 0 && segments.every((s) => s.depth >= required)
}

/** Ce prof enseigne cette matière précise à cette classe précise (d'après l'emploi du temps de la classe). */
function teachesClasseMatiere(teacherId: string, classe: string, matiere: string): boolean {
  if (!classe || !matiere) return false
  const schedule = getClassScheduleSnapshot(classe)
  return Object.values(schedule).some((slots) => slots.some((s) => s.teacherId === teacherId && s.subject === matiere))
}

/**
 * Seuls les profs de Primaire et Collège sont concernés par la surveillance des examens : un prof qui
 * n'enseigne qu'en Maternelle (d'après son emploi du temps réel) ne compte pas. Un prof qui enseigne à la
 * fois en Maternelle et ailleurs reste éligible (il n'est exclu que si TOUTES ses classes sont Maternelle).
 * Les classes de Maternelle n'ont aucun emploi du temps enregistré dans ce système : un prof sans aucun
 * cours nulle part est donc traité comme Maternelle (aucune trace Primaire/Collège), pas comme éligible.
 */
function isMaternelleOnlyTeacher(teacher: Teacher): boolean {
  const schedule = computeTeacherSchedule(teacher)
  const classesTaught = new Set<string>()
  Object.values(schedule).forEach((slots) => slots.forEach((s) => classesTaught.add(s.classe)))
  if (classesTaught.size === 0) return true
  const niveauByClasse = new Map(getClassesSnapshot().map((c) => [c.nom, c.niveau]))
  return Array.from(classesTaught).every((classe) => {
    const niveau = niveauByClasse.get(classe)
    return niveau ? cycleOfNiveau(niveau)?.key === 'maternelle' : false
  })
}

export interface SurveillantSuggestion {
  teacher: Teacher
  chargeSurPeriode: number
}

/**
 * Minutes de surveillance réellement assurées par chaque prof sur `sessions` — sert de mesure de charge
 * (deux surveillances d'1h ne pèsent pas pareil qu'une de 3h et une de 20min, contrairement à un simple
 * comptage de sessions). Un examen co-localisé (ex: CE6-A + CE6-B, même salle même créneau) donne lieu à
 * DEUX enregistrements d'assignation pour le même prof — un par session — alors qu'il ne s'agit que d'une
 * seule présence physique ; on ne compte donc chaque (prof, jour, salle, horaire précis) qu'une seule fois.
 */
function surveillanceMinutesByTeacher(sessions: ExamSession[]): Map<string, number> {
  const seen = new Set<string>()
  const totals = new Map<string, number>()
  sessions.forEach((s) => {
    s.surveillants.forEach((a) => {
      const key = `${a.teacherId}|${s.date}|${s.salleLabel}|${a.start}|${a.end}`
      if (seen.has(key)) return
      seen.add(key)
      const mins = Math.max(0, timeToMinutes(a.end) - timeToMinutes(a.start))
      totals.set(a.teacherId, (totals.get(a.teacherId) ?? 0) + mins)
    })
  })
  return totals
}

/**
 * Profs disponibles comme surveillants (pas en cours, pas absents, pas déjà surveillants ailleurs sur ce
 * créneau, et — pour éviter qu'un prof surveille sa propre matière dans sa propre classe — pas le prof qui
 * enseigne cette matière précise à l'une des classes concernées par cet examen).
 *
 * Classés par charge croissante sur TOUTE la période couverte par `sessions` (et non par mois calendaire) :
 * une session planifiée fin juin et une autre début juillet doivent compter pour la même rotation, sans
 * quoi le compteur repartirait à zéro à cheval sur deux mois et casserait l'équité entre profs.
 */
export function suggestSurveillants(
  sessions: ExamSession[],
  date: string,
  start: string,
  end: string,
  classes: string | string[],
  matiere: string,
  excludeId?: string,
  salleLabel?: string
): SurveillantSuggestion[] {
  const weekday = getWeekdayName(date)
  const classeList = Array.isArray(classes) ? classes : [classes]

  const candidates = getTeachersSnapshot().filter((t) => {
    if (isMaternelleOnlyTeacher(t)) return false
    if (isTeacherAbsentOnDate(t.id, date)) return false
    if (isTeacherAlreadySurveillant(sessions, t.id, date, start, end, excludeId, salleLabel)) return false
    if (classeList.some((c) => teachesClasseMatiere(t.id, c, matiere))) return false

    // Un cours prévu avec une classe qui passe justement cet examen ne compte pas comme "occupé" : cette
    // classe n'est pas en cours avec lui, elle est à l'examen, donc il est en réalité libre sur ce créneau
    // (sauf s'il enseigne la matière même de l'examen à cette classe, déjà exclu ci-dessus).
    const daySlots = weekday ? (computeTeacherSchedule(t)[weekday] ?? []) : []
    const busy = daySlots.some((s) => overlaps(start, end, s.start, s.end) && !classeList.includes(s.classe))
    if (busy) return false

    // Un vacataire n'est présent à l'école que pendant sa propre journée de cours : du début de son
    // premier cours à la fin de son dernier ce jour-là (trous entre deux cours inclus), jamais avant
    // ni après — contrairement à un permanent/contractuel qui peut être sollicité en dehors de ses cours.
    if (t.statut === 'Vacataire') {
      if (daySlots.length === 0) return false
      const windowStart = daySlots.reduce((min, s) => (s.start < min ? s.start : min), daySlots[0].start)
      const windowEnd = daySlots.reduce((max, s) => (s.end > max ? s.end : max), daySlots[0].end)
      if (start < windowStart || end > windowEnd) return false
    }

    return true
  })

  const minutesByTeacher = surveillanceMinutesByTeacher(sessions)

  return candidates
    .map((teacher) => ({
      teacher,
      chargeSurPeriode: minutesByTeacher.get(teacher.id) ?? 0,
    }))
    .sort((a, b) => a.chargeSurPeriode - b.chargeSurPeriode || teacherName(a.teacher).localeCompare(teacherName(b.teacher)))
}

export interface TimeInterval {
  start: string
  end: string
}

function subtractInterval(free: TimeInterval[], busy: TimeInterval): TimeInterval[] {
  const result: TimeInterval[] = []
  free.forEach((f) => {
    if (!overlaps(f.start, f.end, busy.start, busy.end)) {
      result.push(f)
      return
    }
    if (busy.start > f.start) result.push({ start: f.start, end: busy.start })
    if (busy.end < f.end) result.push({ start: busy.end, end: f.end })
  })
  return result
}

/**
 * Plage(s) libre(s) d'un prof à l'intérieur de [start, end] : part de la plage entière, puis retire ses
 * cours ce jour-là et ses autres surveillances déjà assignées qui chevauchent — pour trouver un prof
 * disponible seulement sur une PARTIE du créneau (ex: libre de 09:30 à 10:00 sur un examen 09:00-10:00).
 * Ignore absence/matière-enseignée/Maternelle : ces exclusions restent binaires, gérées en amont.
 */
function freeIntervalsForTeacher(
  teacher: Teacher,
  sessions: ExamSession[],
  date: string,
  start: string,
  end: string,
  excludeId?: string,
  salleLabel?: string,
  classeList: string[] = []
): TimeInterval[] {
  let free: TimeInterval[] = [{ start, end }]
  const weekday = getWeekdayName(date)
  const daySlots = weekday ? (computeTeacherSchedule(teacher)[weekday] ?? []) : []

  // Un cours prévu avec une classe qui passe justement cet examen ne rend pas le prof indisponible :
  // cette classe n'est pas en cours avec lui, elle est à l'examen.
  daySlots.forEach((s) => {
    if (classeList.includes(s.classe)) return
    free = subtractInterval(free, { start: s.start, end: s.end })
  })

  sessions.forEach((s) => {
    if (s.id === excludeId || s.date !== date) return
    if (salleLabel && isCoLocated(s, { salleLabel, start, end })) return
    s.surveillants.forEach((a) => {
      if (a.teacherId === teacher.id) free = subtractInterval(free, { start: a.start, end: a.end })
    })
  })

  if (teacher.statut === 'Vacataire') {
    if (daySlots.length === 0) return []
    const windowStart = daySlots.reduce((min, s) => (s.start < min ? s.start : min), daySlots[0].start)
    const windowEnd = daySlots.reduce((max, s) => (s.end > max ? s.end : max), daySlots[0].end)
    free = free
      .map((f) => ({ start: f.start > windowStart ? f.start : windowStart, end: f.end < windowEnd ? f.end : windowEnd }))
      .filter((f) => f.start < f.end)
  }

  return free.filter((f) => f.start < f.end)
}

export interface PartialSurveillantSuggestion {
  teacher: Teacher
  chargeSurPeriode: number
  /** Plage(s) où ce prof est réellement libre à l'intérieur de [start, end] — peut être plus courte que le créneau entier. */
  freeIntervals: TimeInterval[]
}

/** Le plus grand des intervalles libres — celui utilisé par défaut quand on assigne ce prof en un clic. */
export function largestInterval(intervals: TimeInterval[]): TimeInterval {
  return intervals.reduce((best, cur) => (timeToMinutes(cur.end) - timeToMinutes(cur.start) > timeToMinutes(best.end) - timeToMinutes(best.start) ? cur : best))
}

export function isFullyFreeSuggestion(s: PartialSurveillantSuggestion, start: string, end: string): boolean {
  return s.freeIntervals.length === 1 && s.freeIntervals[0].start === start && s.freeIntervals[0].end === end
}

/**
 * Comme `suggestSurveillants`, mais inclut aussi les profs seulement PARTIELLEMENT libres sur le créneau
 * (ex: libres juste 30min sur les 60min de l'examen) — utilisé dans l'écran de dispatch, où assigner un
 * prof sur une plage plus courte que l'examen entier est justement le but. Les profs entièrement libres
 * restent en tête de liste (triés par charge), les partiellement libres suivent.
 */
export function suggestSurveillantsWithPartial(
  sessions: ExamSession[],
  date: string,
  start: string,
  end: string,
  classes: string | string[],
  matiere: string,
  excludeId?: string,
  salleLabel?: string
): PartialSurveillantSuggestion[] {
  const classeList = Array.isArray(classes) ? classes : [classes]

  const eligible = getTeachersSnapshot().filter((t) => {
    if (isMaternelleOnlyTeacher(t)) return false
    if (isTeacherAbsentOnDate(t.id, date)) return false
    if (classeList.some((c) => teachesClasseMatiere(t.id, c, matiere))) return false
    return true
  })

  const minutesByTeacher = surveillanceMinutesByTeacher(sessions)

  return eligible
    .map((teacher) => ({
      teacher,
      chargeSurPeriode: minutesByTeacher.get(teacher.id) ?? 0,
      freeIntervals: freeIntervalsForTeacher(teacher, sessions, date, start, end, excludeId, salleLabel, classeList),
    }))
    .filter((s) => s.freeIntervals.length > 0)
    .sort((a, b) => {
      const aFull = isFullyFreeSuggestion(a, start, end)
      const bFull = isFullyFreeSuggestion(b, start, end)
      if (aFull !== bFull) return aFull ? -1 : 1
      return a.chargeSurPeriode - b.chargeSurPeriode || teacherName(a.teacher).localeCompare(teacherName(b.teacher))
    })
}

/**
 * Complète `currentAssignments` avec des candidats supplémentaires jusqu'à ce que `required` surveillants
 * soient présents simultanément sur tout [start, end] — ou, si c'est impossible avec les profs disponibles,
 * jusqu'au maximum atteignable. À chaque étape, parmi tous les candidats qui comblent un segment encore
 * sous-couvert, choisit en PRIORITÉ celui qui a le moins de charge de surveillance déjà accumulée sur la
 * période (pour éviter que "Tout compléter" concentre toujours les heures sur les mêmes profs les plus
 * disponibles) ; à charge égale, celui qui comble le plus de temps sous-couvert en un coup. Retourne
 * uniquement les AJOUTS (pas la liste complète) ; chaque candidat n'est utilisé qu'une fois.
 */
export function computeAutoCompletion(
  currentAssignments: SurveillantAssignment[],
  start: string,
  end: string,
  required: number,
  candidates: PartialSurveillantSuggestion[]
): SurveillantAssignment[] {
  const added: SurveillantAssignment[] = []
  let assignments = [...currentAssignments]
  let remaining = [...candidates]

  for (let iteration = 0; iteration < candidates.length + 1; iteration++) {
    const underCovered = coverageSegments(assignments, start, end).filter((seg) => seg.depth < required)
    if (underCovered.length === 0) break

    let best: { candidateIndex: number; interval: TimeInterval; overlapMinutes: number; charge: number } | null = null
    underCovered.forEach((seg) => {
      remaining.forEach((c, candidateIndex) => {
        c.freeIntervals.forEach((interval) => {
          const overlapMinutes =
            Math.min(timeToMinutes(seg.end), timeToMinutes(interval.end)) - Math.max(timeToMinutes(seg.start), timeToMinutes(interval.start))
          if (overlapMinutes <= 0) return
          const intervalSpan = timeToMinutes(interval.end) - timeToMinutes(interval.start)
          const charge = c.chargeSurPeriode
          if (
            !best ||
            charge < best.charge ||
            (charge === best.charge && overlapMinutes > best.overlapMinutes) ||
            (charge === best.charge &&
              overlapMinutes === best.overlapMinutes &&
              intervalSpan > timeToMinutes(best.interval.end) - timeToMinutes(best.interval.start))
          ) {
            best = { candidateIndex, interval, overlapMinutes, charge }
          }
        })
      })
    })

    if (!best) break
    const { candidateIndex, interval } = best as { candidateIndex: number; interval: TimeInterval; overlapMinutes: number; charge: number }
    const chosen = remaining[candidateIndex]
    const assignment: SurveillantAssignment = { teacherId: chosen.teacher.id, start: interval.start, end: interval.end }
    added.push(assignment)
    assignments = [...assignments, assignment]
    remaining = remaining.filter((_, i) => i !== candidateIndex)
  }

  return added
}

export interface SurveillanceSurveillant {
  name: string
  initials: string
  /** Horaire précis, seulement s'il diffère de la plage complète de la ligne (surveillance partagée). */
  timeLabel?: string
}

export interface SurveillanceRow {
  start: string
  end: string
  dureeHeures: number
  matiere: string
  classes: string[]
  surveillants: SurveillanceSurveillant[]
}

export interface SurveillancePeriodGroup {
  period: 'Matin' | 'Après-midi'
  rows: SurveillanceRow[]
}

export interface SurveillanceDayGroup {
  date: string
  periods: SurveillancePeriodGroup[]
}

export interface CycleSurveillanceGroup {
  cycleKey: string
  cycleLabelFr: string
  salleLabel: string
  days: SurveillanceDayGroup[]
}

const MIDDAY = '12:00'
const UNKNOWN_CYCLE_KEY = 'autre'

/** Fusionne les sessions d'une même liste en lignes par jour/période (matin/après-midi), en regroupant
 * sur une même ligne les sessions qui partagent exactement le même créneau/matière (plusieurs classes
 * passant la même épreuve ensemble) — comme dans le planning de surveillance papier de l'école. */
export function buildSurveillanceDayGroups(sessions: ExamSession[], teachers: Teacher[]): SurveillanceDayGroup[] {
  const surveillantOf = (a: SurveillantAssignment, rowStart: string, rowEnd: string): SurveillanceSurveillant => {
    const t = teachers.find((x) => x.id === a.teacherId)
    const name = t ? teacherName(t) : a.teacherId
    const timeLabel = a.start === rowStart && a.end === rowEnd ? undefined : `${a.start}-${a.end}`
    return { name, initials: t ? initials(name) : '?', timeLabel }
  }

  const byDate = new Map<string, ExamSession[]>()
  sessions.forEach((s) => {
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s])
  })

  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, daySessions]) => {
      const merged = new Map<string, SurveillanceRow>()
      daySessions.forEach((s) => {
        const key = `${s.start}|${s.end}|${s.matiere}`
        const row = merged.get(key)
        const surveillants = s.surveillants.map((a) => surveillantOf(a, s.start, s.end))
        if (row) {
          if (!row.classes.includes(s.classe)) row.classes.push(s.classe)
          surveillants.forEach((sv) => {
            if (!row.surveillants.some((x) => x.name === sv.name && x.timeLabel === sv.timeLabel)) row.surveillants.push(sv)
          })
        } else {
          merged.set(key, {
            start: s.start,
            end: s.end,
            dureeHeures: Math.round(((timeToMinutes(s.end) - timeToMinutes(s.start)) / 60) * 100) / 100,
            matiere: s.matiere,
            classes: [s.classe],
            surveillants,
          })
        }
      })

      const rows = Array.from(merged.values()).sort((a, b) => (a.start < b.start ? -1 : 1))
      const matin = rows.filter((r) => r.start < MIDDAY)
      const apresMidi = rows.filter((r) => r.start >= MIDDAY)
      const periods: SurveillancePeriodGroup[] = []
      if (matin.length > 0) periods.push({ period: 'Matin', rows: matin })
      if (apresMidi.length > 0) periods.push({ period: 'Après-midi', rows: apresMidi })

      return { date, periods }
    })
}

/**
 * Regroupe les sessions par cycle (déduit de la classe via son niveau), puis par jour et par période.
 * Chaque cycle affiche la salle la plus utilisée par ses sessions, comme dans le planning de
 * surveillance papier de l'école (une salle dédiée par cycle, ex: tout le collège dans une même salle).
 */
export function groupSessionsByCycle(sessions: ExamSession[], teachers: Teacher[]): CycleSurveillanceGroup[] {
  const niveauByClasse = new Map(getClassesSnapshot().map((c) => [c.nom, c.niveau]))

  const byCycle = new Map<string, ExamSession[]>()
  sessions.forEach((s) => {
    const niveau = niveauByClasse.get(s.classe)
    const cycleKey = (niveau ? cycleOfNiveau(niveau)?.key : undefined) ?? UNKNOWN_CYCLE_KEY
    byCycle.set(cycleKey, [...(byCycle.get(cycleKey) ?? []), s])
  })

  const cycleOrder = [...CYCLES.map((c) => c.key), UNKNOWN_CYCLE_KEY]

  return Array.from(byCycle.entries())
    .sort(([a], [b]) => cycleOrder.indexOf(a) - cycleOrder.indexOf(b))
    .map(([cycleKey, cycleSessions]) => {
      const salleCounts = new Map<string, number>()
      cycleSessions.forEach((s) => {
        const label = s.salleLabel || 'Salle à définir'
        salleCounts.set(label, (salleCounts.get(label) ?? 0) + 1)
      })
      const salleLabel =
        Array.from(salleCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'Salle à définir'

      return {
        cycleKey,
        cycleLabelFr: CYCLES.find((c) => c.key === cycleKey)?.label ?? 'Autre',
        salleLabel,
        days: buildSurveillanceDayGroups(cycleSessions, teachers),
      }
    })
}

export interface TeacherHoursStat {
  teacher: Teacher
  minutes: number
  /** Heures de cours réelles de ce prof sur les jours (de la semaine) où tombent les examens de cette
   * session — pour juger la charge de surveillance en contexte : un prof déjà chargé en cours ces
   * jours-là ne devrait pas, en plus, porter le plus gros de la surveillance. */
  classHoursOnExamDays: number
}

/** Total des minutes de surveillance assignées à chaque prof sur cet ensemble de sessions — pour vérifier
 * l'équité de la répartition (basé sur l'horaire précis de chaque assignation, pas la durée de l'examen). */
export function computeSurveillanceHoursByTeacher(sessions: ExamSession[]): TeacherHoursStat[] {
  const totals = surveillanceMinutesByTeacher(sessions)
  const examWeekdays = new Set<string>()
  sessions.forEach((s) => {
    const weekday = getWeekdayName(s.date)
    if (weekday) examWeekdays.add(weekday)
  })
  const teachers = getTeachersSnapshot()
  return Array.from(totals.entries())
    .map(([teacherId, minutes]) => {
      const teacher = teachers.find((t) => t.id === teacherId)
      if (!teacher) return null
      const schedule = computeTeacherSchedule(teacher)
      const classHoursOnExamDays = Array.from(examWeekdays).reduce(
        (sum, weekday) => sum + (schedule[weekday] ?? []).reduce((s, slot) => s + slot.hours, 0),
        0
      )
      return { teacher, minutes, classHoursOnExamDays }
    })
    .filter((s): s is TeacherHoursStat => !!s)
    .sort((a, b) => b.minutes - a.minutes || teacherName(a.teacher).localeCompare(teacherName(b.teacher)))
}

export interface CreneauCoverageStat {
  date: string
  start: string
  end: string
  covered: number
  partial: number
  uncovered: number
  total: number
}

/** Répartition Couvert / Partiel / Non couvert par créneau exact (date+horaire), pour repérer d'un coup
 * d'œil les journées ou horaires qui posent problème. */
export function computeCoverageByCreneau(sessions: ExamSession[], required: number = DEFAULT_REQUIRED_SURVEILLANTS): CreneauCoverageStat[] {
  const map = new Map<string, ExamSession[]>()
  sessions.forEach((s) => {
    const key = `${s.date}|${s.start}|${s.end}`
    map.set(key, [...(map.get(key) ?? []), s])
  })
  return Array.from(map.entries())
    .map(([key, group]) => {
      const [date, start, end] = key.split('|')
      let covered = 0
      let partial = 0
      let uncovered = 0
      group.forEach((s) => {
        if (s.surveillants.length === 0) uncovered++
        else if (isFullyCovered(s.surveillants, s.start, s.end, required)) covered++
        else partial++
      })
      return { date, start, end, covered, partial, uncovered, total: group.length }
    })
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.start < b.start ? -1 : 1))
}

/** Profs éligibles à la surveillance (ni Maternelle-only) qui n'ont encore aucune heure assignée sur cet
 * ensemble de sessions — pour repérer qui reste à solliciter avant la fin de la période. */
export function computeNeverSolicited(sessions: ExamSession[]): Teacher[] {
  const usedIds = new Set(sessions.flatMap((s) => s.surveillants.map((a) => a.teacherId)))
  return getTeachersSnapshot()
    .filter((t) => !isMaternelleOnlyTeacher(t) && !usedIds.has(t.id))
    .sort((a, b) => teacherName(a).localeCompare(teacherName(b)))
}

export interface ClasseMatiereCount {
  classe: string
  matiere: string
  count: number
}

/** Nombre d'épreuves planifiées par classe et par matière sur cet ensemble de sessions. */
export function computeExamCountsByClasseMatiere(sessions: ExamSession[]): ClasseMatiereCount[] {
  const map = new Map<string, number>()
  sessions.forEach((s) => {
    const key = `${s.classe}|${s.matiere}`
    map.set(key, (map.get(key) ?? 0) + 1)
  })
  return Array.from(map.entries())
    .map(([key, count]) => {
      const [classe, matiere] = key.split('|')
      return { classe, matiere, count }
    })
    .sort((a, b) => a.classe.localeCompare(b.classe) || a.matiere.localeCompare(b.matiere))
}
