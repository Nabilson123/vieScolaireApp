import type { Student } from '../data/students'
import { parseDuration } from '../data/students'
import type { StudentExtra } from '../data/studentDetails'
import type { Teacher } from '../data/teachers'
import type { TeacherExtra } from '../data/teacherExtras'
import { SANCTION_LEVELS, type SanctionLevel } from '../data/disciplineTypes'
import { fetchStudents } from './studentsService'
import { fetchStudentExtrasForIds } from './studentDetailsService'
import { fetchTeachers } from './teachersService'
import { fetchTeacherExtras } from './teacherExtrasService'
import { computeMoyenneGenerale } from '../utils/studentAggregation'
import { cycleOfClasse } from '../utils/alertEngine'
import { moyenneScale } from '../data/referentiel'
import { CYCLE_KEYS, type CycleKey } from '../data/alertRules'
import { isWithinPeriod } from '../utils/period'

export interface YearDataset {
  students: Student[]
  extras: Record<string, StudentExtra>
}

export interface TeacherYearDataset {
  teachers: Teacher[]
  extras: Record<string, TeacherExtra>
}

/** Élèves + dossiers (extras) d'une année scolaire donnée — pour le mode "comparer deux années". */
export async function fetchYearDataset(yearId: string): Promise<YearDataset> {
  const students = await fetchStudents(yearId)
  const extras = await fetchStudentExtrasForIds(students.map((s) => s.id))
  return { students, extras }
}

/** Enseignants + absences/remplacements d'une année scolaire donnée. */
export async function fetchTeacherYearDataset(yearId: string): Promise<TeacherYearDataset> {
  const [teachers, extras] = await Promise.all([fetchTeachers(yearId), fetchTeacherExtras(yearId)])
  return { teachers, extras }
}

export interface AbsenceRetardSplit {
  absenceHeures: number
  retardHeures: number
}

/** Sépare les heures manquées élèves en absences vs retards — computeEcolePeriodStats les cumule. */
export function computeAbsenceRetardSplit(
  students: Student[],
  extras: Record<string, StudentExtra>,
  periodStart = '',
  periodEnd = ''
): AbsenceRetardSplit {
  let absenceMin = 0
  let retardMin = 0
  students.forEach((s) => {
    ;(extras[s.id]?.events ?? []).forEach((e) => {
      if (!isWithinPeriod(e.date, periodStart, periodEnd)) return
      if (e.type === 'ABSENCE') absenceMin += parseDuration(e.duree)
      else retardMin += parseDuration(e.duree)
    })
  })
  return { absenceHeures: Math.round((absenceMin / 60) * 10) / 10, retardHeures: Math.round((retardMin / 60) * 10) / 10 }
}

/** Moyenne de conduite de l'école — conduite est capturée par élève (student_extras.conduite). */
export function computeMoyenneConduiteForDataset(students: Student[], extras: Record<string, StudentExtra>): number | null {
  const values = students.map((s) => extras[s.id]?.conduite).filter((v): v is number => typeof v === 'number')
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Heures manquées professeurs (absences + retards confondus) sur la période/année donnée. */
export function computeHeuresManqueesProfs(teachers: Teacher[], extras: Record<string, TeacherExtra>, periodStart = '', periodEnd = ''): number {
  let totalHeures = 0
  teachers.forEach((t) => {
    ;(extras[t.id]?.absences ?? []).forEach((a) => {
      if (isWithinPeriod(a.date, periodStart, periodEnd)) totalHeures += a.duree
    })
  })
  return Math.round(totalHeures * 10) / 10
}

export interface CycleMoyenneDataset {
  cycle: CycleKey
  scale: number
  value: number | null
}

/**
 * Moyenne générale par cycle sur un dataset (période ou année) — jamais mélangée entre /10
 * (primaire) et /20 (collège/lycée), même logique que computeSchoolMoyenneGeneraleByCycle.
 */
export function computeMoyenneGeneraleForDatasetByCycle(
  students: Student[],
  extras: Record<string, StudentExtra>
): CycleMoyenneDataset[] {
  const values: Record<CycleKey, number[]> = { maternelle: [], primaire: [], college: [], lycee: [] }
  students.forEach((s) => {
    const cycle = cycleOfClasse(s.classe)
    if (!cycle) return
    const moyenne = computeMoyenneGenerale(extras[s.id]?.notes ?? [])
    if (moyenne === null) return
    values[cycle].push(moyenne)
  })
  return CYCLE_KEYS.map((cycle) => {
    const scale = moyenneScale(cycle)
    const list = values[cycle]
    return { cycle, scale: scale ?? 20, value: list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null }
  }).filter((cm) => cm.value !== null && moyenneScale(cm.cycle) !== null)
}

export function computeSanctionCountsForDataset(
  students: Student[],
  extras: Record<string, StudentExtra>,
  periodStart = '',
  periodEnd = ''
): Record<SanctionLevel, number> {
  const counts = Object.fromEntries(SANCTION_LEVELS.map((s) => [s, 0])) as Record<SanctionLevel, number>
  students.forEach((s) => {
    ;(extras[s.id]?.discipline ?? []).forEach((d) => {
      if (!isWithinPeriod(d.date, periodStart, periodEnd) || !d.sanction) return
      if (d.sanction in counts) counts[d.sanction as SanctionLevel] += 1
    })
  })
  return counts
}

export function totalSanctions(counts: Record<SanctionLevel, number>): number {
  return Object.values(counts).reduce((sum, v) => sum + v, 0)
}

export function diffValue(a: number | null, b: number | null): { delta: number | null; deltaPct: number | null } {
  if (a === null || b === null) return { delta: null, deltaPct: null }
  const delta = b - a
  const deltaPct = a !== 0 ? (delta / a) * 100 : null
  return { delta, deltaPct }
}
