import type { EventRecord, StudentExtra } from './studentDetails'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { SCHEDULE_DAYS } from './classSchedules'
import { getClassScheduleSnapshot } from '../services/classSchedulesService'
import { getPeriodesSnapshot } from '../services/periodesService'
import { getActiveClassNamesSnapshot } from '../services/classesService'
import { getStudentsSnapshot, updateStudentRow } from '../services/studentsService'
import { isWithinPeriod } from '../utils/period'

export interface Student {
  id: string
  name: string
  sexe: 'M' | 'F'
  classe: string
  absencesHeures: string
  absencesFois: number
  retardsMin: string
  retardsFois: number
  totalHeures: string
  taux: number
  anneeScolaireId?: string
  dossierId?: string
}

/**
 * Valeur spéciale de `classe` pour un élève dont le dossier est réel mais pas encore complet —
 * cas typique d'un import où le niveau est connu mais pas la section (A/B). Ne correspond à
 * aucune classe active : les fonctions qui dérivent un cycle/niveau depuis `classe`
 * (`cycleOfClasse`, `moyenneScaleForClasse`...) retombent proprement sur `undefined`/`null`, comme
 * pour tout niveau non reconnu — aucun traitement spécial requis ailleurs dans l'appli.
 */
export const CLASSE_DOSSIER_INCOMPLET = 'Dossier incomplet'

export function getClassOptions(): string[] {
  return ['Toutes les classes', ...getActiveClassNamesSnapshot(), CLASSE_DOSSIER_INCOMPLET]
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function parseDuration(value: string): number {
  const hMatch = value.match(/(\d+)\s*h/)
  const mMatch = value.match(/(\d+)\s*min/)
  const h = hMatch ? parseInt(hMatch[1], 10) : 0
  const m = mMatch ? parseInt(mMatch[1], 10) : 0
  return h * 60 + m
}

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0 && m === 0) return '0h'
  if (m === 0) return `${h}h`
  if (h === 0) return `${m}min`
  return `${h}h ${m}min`
}

export function weeklyVolumeMinutes(classe: string): number {
  const schedule = getClassScheduleSnapshot(classe)
  const hours = SCHEDULE_DAYS.reduce((sum, day) => sum + (schedule[day] ?? []).reduce((s, slot) => s + slot.hours, 0), 0)
  return hours * 60
}

function weeksSinceRentree(): number {
  const rentree = getPeriodesSnapshot().reduce<string>((min, p) => (!min || p.dateDebut < min ? p.dateDebut : min), '')
  if (!rentree) return 1
  const start = new Date(`${rentree}T00:00:00`)
  const now = new Date()
  const diffWeeks = (now.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000)
  return Math.max(1, Math.round(diffWeeks))
}

export interface EcoleEffectifSummary {
  effectif: number
  nbClasses: number
}

export function computeEcoleEffectifSummary(students: Student[]): EcoleEffectifSummary {
  return { effectif: students.length, nbClasses: new Set(students.map((s) => s.classe)).size }
}

function periodWeeks(start: string, end: string): number {
  if (!start || !end) return weeksSinceRentree()
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  const diffWeeks = (e.getTime() - s.getTime()) / (7 * 24 * 3600 * 1000)
  return Math.max(1, Math.round(diffWeeks))
}

export interface EcolePeriodStats {
  tauxPresence: number
  heuresManqueesEleves: number
}

export function computeEcolePeriodStats(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  periodStart: string,
  periodEnd: string
): EcolePeriodStats {
  let totalMinutesMissed = 0
  let totalPossibleMinutes = 0
  const weeks = periodWeeks(periodStart, periodEnd)
  students.forEach((s) => {
    const events = studentExtras[s.id]?.events ?? []
    events.forEach((e) => {
      if (isWithinPeriod(e.date, periodStart, periodEnd)) totalMinutesMissed += parseDuration(e.duree)
    })
    totalPossibleMinutes += weeklyVolumeMinutes(s.classe) * weeks
  })
  const heuresManqueesEleves = Math.round((totalMinutesMissed / 60) * 10) / 10
  const tauxPresence =
    totalPossibleMinutes > 0 ? Math.max(0, Math.min(100, Math.round((1 - totalMinutesMissed / totalPossibleMinutes) * 1000) / 10)) : 100
  return { tauxPresence, heuresManqueesEleves }
}

export async function recomputeStudentAttendance(studentId: string, eventsOverride?: EventRecord[]): Promise<void> {
  const student = getStudentsSnapshot().find((s) => s.id === studentId)
  if (!student) return

  const events = eventsOverride ?? getStudentExtraSnapshot(studentId).events
  let absenceMin = 0
  let absenceCount = 0
  let retardMin = 0
  let retardCount = 0
  events.forEach((e) => {
    const minutes = parseDuration(e.duree)
    if (minutes <= 0) return
    if (e.type === 'ABSENCE') {
      absenceMin += minutes
      absenceCount += 1
    } else {
      retardMin += minutes
      retardCount += 1
    }
  })

  const totalMinutesMissed = absenceMin + retardMin
  const totalPossibleMinutes = weeklyVolumeMinutes(student.classe) * weeksSinceRentree()
  const taux = totalPossibleMinutes > 0 ? Math.max(0, Math.min(100, Math.round((1 - totalMinutesMissed / totalPossibleMinutes) * 1000) / 10)) : 100

  await updateStudentRow(studentId, {
    absencesHeures: formatDuration(absenceMin),
    absencesFois: absenceCount,
    retardsMin: formatDuration(retardMin),
    retardsFois: retardCount,
    totalHeures: formatDuration(totalMinutesMissed),
    taux,
  })
}
