import { teacherName, type Teacher } from '../data/teachers'
import { timeToMinutes, minutesToTime, SCHEDULE_DAYS } from '../data/classSchedules'
import { computeTeacherSchedule } from './teacherAggregation'
import { getWeekdayName, subtractCoveredIntervals, type TimeInterval } from './replacementAggregation'
import { getStudentsSnapshot } from '../services/studentsService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { getSuiviProfsSnapshot } from '../services/suiviProfsService'

const JOUR_DEBUT = '07:30'
const JOUR_FIN = '18:00'
// Fenêtre "confortable" pour une réunion suggérée : évite de proposer un créneau collé au tout
// début ou à la toute fin de la journée, même s'il est techniquement libre.
const FENETRE_CONFORT_DEBUT = '08:30'
const FENETRE_CONFORT_FIN = '17:00'

export interface CreneauLibre {
  start: string
  end: string
}

/** Un vacataire n'est réputé présent que les jours où il a au moins un cours réel à l'emploi du
 * temps — contrairement à un permanent, sa présence n'est pas garantie un jour sans cours. */
export function isVacataireAbsentThatDay(teacher: Teacher, date: string): boolean {
  if (teacher.statut !== 'Vacataire') return false
  const weekday = getWeekdayName(date)
  if (!weekday) return true
  return (computeTeacherSchedule(teacher)[weekday] ?? []).length === 0
}

/** Intervalles occupés d'un prof à une date donnée : cours réels ce jour-là, RDV parents déjà pris
 * (matchés par nom, seul lien disponible sur RendezVousRecord.enseignant), et autres suivis profs
 * déjà planifiés où il figure — tout sauf 'Annulé'. Un vacataire sans cours ce jour-là est traité
 * comme absent toute la journée (cf. isVacataireAbsentThatDay) plutôt que "entièrement libre". */
function getBusyIntervals(teacher: Teacher, date: string, excludeSuiviId?: string): TimeInterval[] {
  const weekday = getWeekdayName(date)
  const busy: TimeInterval[] = []

  if (isVacataireAbsentThatDay(teacher, date)) {
    busy.push({ start: JOUR_DEBUT, end: JOUR_FIN })
  } else if (weekday) {
    const schedule = computeTeacherSchedule(teacher)[weekday] ?? []
    schedule.forEach((s) => busy.push({ start: s.start, end: s.end }))
  }

  const nom = teacherName(teacher)
  getStudentsSnapshot().forEach((s) => {
    getStudentExtraSnapshot(s.id).rendezVous.forEach((r) => {
      if (r.enseignant !== nom || r.date !== date || r.statut === 'Annulé') return
      busy.push({ start: r.heure, end: minutesToTime(timeToMinutes(r.heure) + r.duree) })
    })
  })

  getSuiviProfsSnapshot().forEach((sp) => {
    if (sp.id === excludeSuiviId) return
    if (!sp.teacherIds.includes(teacher.id) || sp.date !== date || sp.statut === 'Annulé') return
    busy.push({ start: sp.heure, end: minutesToTime(timeToMinutes(sp.heure) + sp.duree) })
  })

  return busy
}

/** Créneaux libres communs à TOUS les profs donnés, pour une date et une durée voulue (minutes) —
 * un créneau proposé par trou réel (début du trou, longueur = dureeMin), trous trop courts exclus.
 * Aucun prof sélectionné ou date hors semaine scolaire (week-end) → liste vide. */
export function computeCreneauxLibres(teachers: Teacher[], date: string, dureeMin: number, excludeSuiviId?: string): CreneauLibre[] {
  if (teachers.length === 0 || !getWeekdayName(date)) return []

  const allBusy: TimeInterval[] = []
  teachers.forEach((t) => allBusy.push(...getBusyIntervals(t, date, excludeSuiviId)))

  const gaps = subtractCoveredIntervals(JOUR_DEBUT, JOUR_FIN, allBusy)
  return gaps
    .filter((g) => timeToMinutes(g.end) - timeToMinutes(g.start) >= dureeMin)
    .map((g) => ({ start: g.start, end: minutesToTime(timeToMinutes(g.start) + dureeMin) }))
}

/** Vrai si [heure, heure+dureeMin) est libre pour TOUS les profs donnés à cette date précise —
 * contrairement à computeCreneauxLibres (qui ne propose que des créneaux démarrant en début de
 * trou), sert à vérifier une heure fixe déjà choisie (ex. suivi hebdomadaire récurrent) sur
 * plusieurs dates différentes, quelle que soit la position de cette heure dans le trou réel. */
export function isTimeSlotFree(teachers: Teacher[], date: string, heure: string, dureeMin: number, excludeSuiviId?: string): boolean {
  if (teachers.length === 0 || !getWeekdayName(date)) return false
  const startMin = timeToMinutes(heure)
  const endMin = startMin + dureeMin
  if (startMin < timeToMinutes(JOUR_DEBUT) || endMin > timeToMinutes(JOUR_FIN)) return false
  return teachers.every((t) =>
    getBusyIntervals(t, date, excludeSuiviId).every((b) => endMin <= timeToMinutes(b.start) || startMin >= timeToMinutes(b.end))
  )
}

export interface PPConflict {
  teacherId: string
  teacherName: string
  busyStart: string
  busyEnd: string
}

/** Détaille, pour un créneau [heure, heure+dureeMin) déjà retenu à une date précise, quels profs
 * parmi `teachers` ont un engagement qui chevauche réellement (cours, RDV parent, ou autre suivi
 * déjà planifié) — contrairement à `isTimeSlotFree` (booléen seul), donne de quoi composer un
 * message réel ("Untel indisponible 11:30–12:30"). `excludeSuiviId` évite qu'un suivi déjà planifié
 * ne se signale lui-même comme conflit en se comparant à sa propre ligne. */
export function findPPConflicts(teachers: Teacher[], date: string, heure: string, dureeMin: number, excludeSuiviId?: string): PPConflict[] {
  const startMin = timeToMinutes(heure)
  const endMin = startMin + dureeMin
  const conflicts: PPConflict[] = []
  teachers.forEach((t) => {
    const busy = getBusyIntervals(t, date, excludeSuiviId).find((b) => endMin > timeToMinutes(b.start) && startMin < timeToMinutes(b.end))
    if (busy) conflicts.push({ teacherId: t.id, teacherName: teacherName(t), busyStart: busy.start, busyEnd: busy.end })
  })
  return conflicts
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Les `count` prochaines occurrences de `jourSemaine` (SCHEDULE_DAYS) à partir d'aujourd'hui inclus. */
export function generateWeeklyDates(jourSemaine: string, count: number): string[] {
  const dates: string[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  while (dates.length < count) {
    const iso = toISO(cursor)
    if (getWeekdayName(iso) === jourSemaine) dates.push(iso)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export interface SuggestedWeeklySlot {
  jour: string
  start: string
  end: string
}

/** Meilleur créneau hebdomadaire suggéré commun à un ou plusieurs profs (ex. le ou les Professeurs
 * Principaux des divisions d'un même niveau — CE1-A et CE1-B partagent une seule réunion) : scanne
 * les 5 jours de la semaine (prochaine occurrence de chacun), calcule les créneaux libres communs
 * à TOUS les profs donnés pour `dureeMin`, ne retient que ceux dans la fenêtre de confort quand il
 * y en a (sinon retombe sur tous les créneaux libres de ce jour), puis choisit le jour offrant le
 * plus de créneaux (proxy de robustesse — moins de risque qu'un imprévu ponctuel un jour donné
 * fasse disparaître le seul créneau possible) et son créneau le plus tôt dans la journée. `null` si
 * aucun prof fourni ou aucun créneau commun libre nulle part dans la semaine. */
export function suggestBestWeeklySlot(teachers: Teacher[], dureeMin: number): SuggestedWeeklySlot | null {
  if (teachers.length === 0) return null

  const parJour = SCHEDULE_DAYS.map((jour) => {
    const [nextDate] = generateWeeklyDates(jour, 1)
    const tous = computeCreneauxLibres(teachers, nextDate, dureeMin)
    const confortables = tous.filter((c) => c.start >= FENETRE_CONFORT_DEBUT && c.end <= FENETRE_CONFORT_FIN)
    return { jour, creneaux: confortables.length > 0 ? confortables : tous }
  }).filter((d) => d.creneaux.length > 0)

  if (parJour.length === 0) return null

  const meilleur = parJour.reduce((a, b) => (b.creneaux.length > a.creneaux.length ? b : a))
  const creneau = meilleur.creneaux[0]
  return { jour: meilleur.jour, start: creneau.start, end: creneau.end }
}
