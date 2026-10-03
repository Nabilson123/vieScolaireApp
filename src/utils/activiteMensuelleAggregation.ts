import type { Student } from '../data/students'
import type { StudentExtra } from '../data/studentDetails'
import { RECLAMATION_CATEGORIES } from '../data/studentDetails'
import type { Teacher } from '../data/teachers'
import type { TeacherExtra } from '../data/teacherExtras'
import type { CycleKey } from '../data/alertRules'
import { cycleOfClasse } from './alertEngine'
import { isWithinPeriod, parseAnyDate } from './period'
import { type MonthBucket, countByMonth } from './monthlyBuckets'

export function computeReclamationsParMois(students: Student[], studentExtras: Record<string, StudentExtra>, buckets: MonthBucket[]) {
  return countByMonth(students.flatMap((s) => (studentExtras[s.id]?.reclamations ?? []).map((r) => r.date)), buckets)
}

export function computeReclamationsParType(students: Student[], studentExtras: Record<string, StudentExtra>) {
  const counts = Object.fromEntries(RECLAMATION_CATEGORIES.map((c) => [c, 0])) as Record<string, number>
  students.forEach((s) =>
    (studentExtras[s.id]?.reclamations ?? []).forEach((r) => {
      if (r.type in counts) counts[r.type] += 1
    })
  )
  return RECLAMATION_CATEGORIES.map((c) => ({ label: c, value: counts[c] }))
}

/** Copie de computeReclamationsParType, scopée à periodStart/periodEnd — la fonction non scopée
 * reste utilisée telle quelle par l'onglet écran "Activité Mensuelle" (année scolaire complète). */
export function computeReclamationsParTypeForPeriod(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  periodStart: string,
  periodEnd: string
) {
  const counts = Object.fromEntries(RECLAMATION_CATEGORIES.map((c) => [c, 0])) as Record<string, number>
  students.forEach((s) =>
    (studentExtras[s.id]?.reclamations ?? []).forEach((r) => {
      if (r.type in counts && isWithinPeriod(r.date, periodStart, periodEnd)) counts[r.type] += 1
    })
  )
  return RECLAMATION_CATEGORIES.map((c) => ({ label: c, value: counts[c] }))
}

export function computeAbsencesProfsParMois(teachers: Teacher[], teacherExtras: Record<string, TeacherExtra>, buckets: MonthBucket[]) {
  return countByMonth(
    teachers.flatMap((t) => (teacherExtras[t.id]?.absences ?? []).filter((a) => a.type === 'ABSENCE').map((a) => a.date)),
    buckets
  )
}

export function computeAbsencesElevesParMois(students: Student[], studentExtras: Record<string, StudentExtra>, buckets: MonthBucket[]) {
  return countByMonth(
    students.flatMap((s) => (studentExtras[s.id]?.events ?? []).filter((e) => e.type === 'ABSENCE').map((e) => e.date)),
    buckets
  )
}

export function computeRetardsElevesParMois(students: Student[], studentExtras: Record<string, StudentExtra>, buckets: MonthBucket[]) {
  return countByMonth(
    students.flatMap((s) => (studentExtras[s.id]?.events ?? []).filter((e) => e.type === 'RETARD').map((e) => e.date)),
    buckets
  )
}

/** "Problème disciplinaire" = même convention que ClasseDisciplineRow.incidents (adminReportAggregation.ts) : points <= 0. */
export function computeDisciplineElevesParMois(students: Student[], studentExtras: Record<string, StudentExtra>, buckets: MonthBucket[]) {
  return countByMonth(
    students.flatMap((s) => (studentExtras[s.id]?.discipline ?? []).filter((d) => d.points <= 0).map((d) => d.date)),
    buckets
  )
}

// --- Vue par Cycle ---

export interface CycleTileCounts {
  total: number
  maternelle: number
  primaire: number
  college: number
}

export interface CycleSnapshotTiles {
  /** Élèves distincts touchés au moins une fois sur la période. */
  absencesEleves: CycleTileCounts
  retardsEleves: CycleTileCounts
  disciplineEleves: CycleTileCounts
  /** Nombre d'événements (séances), pas de personnes distinctes. */
  absencesSeances: CycleTileCounts
  retardsSeances: CycleTileCounts
}

function emptyCycleTileCounts(): CycleTileCounts {
  return { total: 0, maternelle: 0, primaire: 0, college: 0 }
}

function bumpCycle(counts: CycleTileCounts, cycle: CycleKey | undefined): void {
  counts.total += 1
  if (cycle === 'maternelle') counts.maternelle += 1
  else if (cycle === 'primaire') counts.primaire += 1
  else if (cycle === 'college') counts.college += 1
}

export function computeCycleSnapshotTiles(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  periodStart: string,
  periodEnd: string
): CycleSnapshotTiles {
  const absencesEleves = emptyCycleTileCounts()
  const retardsEleves = emptyCycleTileCounts()
  const disciplineEleves = emptyCycleTileCounts()
  const absencesSeances = emptyCycleTileCounts()
  const retardsSeances = emptyCycleTileCounts()

  students.forEach((s) => {
    const cycle = cycleOfClasse(s.classe)
    const extra = studentExtras[s.id]
    if (!extra) return

    let hasAbsence = false
    let hasRetard = false
    extra.events.forEach((e) => {
      if (!isWithinPeriod(e.date, periodStart, periodEnd)) return
      if (e.type === 'ABSENCE') {
        bumpCycle(absencesSeances, cycle)
        hasAbsence = true
      } else {
        bumpCycle(retardsSeances, cycle)
        hasRetard = true
      }
    })
    if (hasAbsence) bumpCycle(absencesEleves, cycle)
    if (hasRetard) bumpCycle(retardsEleves, cycle)

    const hasDiscipline = extra.discipline.some((d) => isWithinPeriod(d.date, periodStart, periodEnd) && d.points <= 0)
    if (hasDiscipline) bumpCycle(disciplineEleves, cycle)
  })

  return { absencesEleves, retardsEleves, disciplineEleves, absencesSeances, retardsSeances }
}

export interface MonthCycleStack {
  label: string
  maternelle: number
  primaire: number
  college: number
  [key: string]: string | number
}

function countByMonthAndCycle(entries: { date: string; cycle: CycleKey | undefined }[], buckets: MonthBucket[]): MonthCycleStack[] {
  const counts = new Map(buckets.map((b) => [b.ymKey, { maternelle: 0, primaire: 0, college: 0 }]))
  entries.forEach(({ date, cycle }) => {
    if (cycle !== 'maternelle' && cycle !== 'primaire' && cycle !== 'college') return
    const d = parseAnyDate(date)
    if (!d) return
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = counts.get(ym)
    if (!bucket) return
    bucket[cycle] += 1
  })
  return buckets.map((b) => ({ label: b.label, ...(counts.get(b.ymKey) ?? { maternelle: 0, primaire: 0, college: 0 }) }))
}

export function computeAbsencesElevesParMoisEtCycle(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  buckets: MonthBucket[]
): MonthCycleStack[] {
  const entries = students.flatMap((s) => {
    const cycle = cycleOfClasse(s.classe)
    return (studentExtras[s.id]?.events ?? []).filter((e) => e.type === 'ABSENCE').map((e) => ({ date: e.date, cycle }))
  })
  return countByMonthAndCycle(entries, buckets)
}

export function computeRetardsElevesParMoisEtCycle(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  buckets: MonthBucket[]
): MonthCycleStack[] {
  const entries = students.flatMap((s) => {
    const cycle = cycleOfClasse(s.classe)
    return (studentExtras[s.id]?.events ?? []).filter((e) => e.type === 'RETARD').map((e) => ({ date: e.date, cycle }))
  })
  return countByMonthAndCycle(entries, buckets)
}

export function computeDisciplineElevesParMoisEtCycle(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  buckets: MonthBucket[]
): MonthCycleStack[] {
  const entries = students.flatMap((s) => {
    const cycle = cycleOfClasse(s.classe)
    return (studentExtras[s.id]?.discipline ?? []).filter((d) => d.points <= 0).map((d) => ({ date: d.date, cycle }))
  })
  return countByMonthAndCycle(entries, buckets)
}
