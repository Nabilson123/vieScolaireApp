import type { EventRecord, SubjectBreakdown, StudentExtra, NoteRow } from '../data/studentDetails'
import type { Student } from '../data/students'
import { isWithinPeriod } from './period'

export function computeSubjectMoyenne(row: NoteRow): number | null {
  if (row.evaluations.length === 0) return null
  const totalCoef = row.evaluations.reduce((sum, ev) => sum + ev.coef, 0)
  if (totalCoef === 0) return null
  const weighted = row.evaluations.reduce((sum, ev) => sum + ev.value * ev.coef, 0)
  return weighted / totalCoef
}

export function computeMoyenneGenerale(notes: NoteRow[]): number | null {
  const withGrades = notes
    .map((row) => ({ moyenne: computeSubjectMoyenne(row), coef: row.coef }))
    .filter((r): r is { moyenne: number; coef: number } => r.moyenne !== null)
  if (withGrades.length === 0) return null
  const totalCoef = withGrades.reduce((sum, r) => sum + r.coef, 0)
  if (totalCoef === 0) return null
  const weighted = withGrades.reduce((sum, r) => sum + r.moyenne * r.coef, 0)
  return weighted / totalCoef
}

export interface AssiduiteBadge {
  label: string
  color: string
}

export function computeAssiduiteBadge(taux: number): AssiduiteBadge {
  if (taux >= 95) return { label: '🎓 Élève régulier', color: '#1F9D6B' }
  if (taux >= 85) return { label: '⚠️ Assiduité à surveiller', color: '#C08A17' }
  return { label: '🔴 Absences fréquentes', color: '#E0473F' }
}

export function parseDuration(value: string): number {
  const hMatch = value.match(/(\d+)\s*h/)
  const mMatch = value.match(/(\d+)\s*min/)
  const h = hMatch ? parseInt(hMatch[1], 10) : 0
  const m = mMatch ? parseInt(mMatch[1], 10) : 0
  return h * 60 + m
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0 && m === 0) return '0h'
  if (m === 0) return `${h}h`
  if (h === 0) return `${m}min`
  return `${h}h ${m}min`
}

export function computeSubjectBreakdown(events: EventRecord[]): SubjectBreakdown[] {
  const map = new Map<string, { color: SubjectBreakdown['color']; absencesMin: number; retardsMin: number }>()

  for (const e of events) {
    const entry = map.get(e.subject) ?? { color: e.subjectColor, absencesMin: 0, retardsMin: 0 }
    const minutes = parseDuration(e.duree)
    if (e.type === 'ABSENCE') entry.absencesMin += minutes
    else entry.retardsMin += minutes
    map.set(e.subject, entry)
  }

  const rows = Array.from(map.entries()).map(([subject, v]) => ({
    subject,
    color: v.color,
    absences: formatDuration(v.absencesMin),
    retards: formatDuration(v.retardsMin),
    total: formatDuration(v.absencesMin + v.retardsMin),
    totalMin: v.absencesMin + v.retardsMin,
  }))

  const maxTotal = Math.max(...rows.map((r) => r.totalMin), 1)

  return rows.map(({ totalMin, ...rest }) => ({
    ...rest,
    barPct: Math.round((totalMin / maxTotal) * 100),
  }))
}

export interface AbsenceRetardStats {
  absencesFois: number
  absencesHeures: string
  retardsFois: number
  retardsMin: string
  totalHeures: string
}

export function computeAbsenceRetardStats(events: EventRecord[]): AbsenceRetardStats {
  let absencesFois = 0
  let absencesMinTotal = 0
  let retardsFois = 0
  let retardsMinTotal = 0

  for (const e of events) {
    const minutes = parseDuration(e.duree)
    if (e.type === 'ABSENCE') {
      absencesFois += 1
      absencesMinTotal += minutes
    } else {
      retardsFois += 1
      retardsMinTotal += minutes
    }
  }

  return {
    absencesFois,
    absencesHeures: formatDuration(absencesMinTotal),
    retardsFois,
    retardsMin: formatDuration(retardsMinTotal),
    totalHeures: formatDuration(absencesMinTotal + retardsMinTotal),
  }
}

export interface FilteredNoteRow {
  subject: string
  coef: number
  classeAverage: number | null
  values: number[]
  moyenne: number | null
}

export function computeClasseAverageForSubject(
  subject: string,
  start: string,
  end: string,
  classe: string,
  students: Student[],
  studentExtras: Record<string, StudentExtra>
): number | null {
  const moyennes = students
    .filter((s) => s.classe === classe)
    .map((s) => {
      const row = studentExtras[s.id]?.notes.find((n) => n.subject === subject)
      if (!row) return null
      const values = row.evaluations.filter((ev) => isWithinPeriod(ev.date, start, end)).map((ev) => ev.value)
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
    })
    .filter((m): m is number => m !== null)
  if (moyennes.length === 0) return null
  return moyennes.reduce((a, b) => a + b, 0) / moyennes.length
}

export interface FilteredStudentView {
  events: EventRecord[]
  discipline: StudentExtra['discipline']
  reclamations: StudentExtra['reclamations']
  rendezVous: StudentExtra['rendezVous']
  notes: FilteredNoteRow[]
  subjectBreakdown: SubjectBreakdown[]
  faitsDisciplinaires: number
  absencesFois: number
  absencesHeures: string
  retardsFois: number
  retardsMin: string
  totalHeures: string
}

export function buildFilteredView(
  extra: StudentExtra,
  start: string,
  end: string,
  classe: string,
  students: Student[],
  studentExtras: Record<string, StudentExtra>
): FilteredStudentView {
  // Excludes zero-duration events: an artifact of multi-slot retard declarations where the
  // student arrived before some of the selected slots had even started.
  const events = extra.events.filter((e) => isWithinPeriod(e.date, start, end) && parseDuration(e.duree) > 0)
  const discipline = extra.discipline.filter((d) => isWithinPeriod(d.date, start, end))
  const reclamations = extra.reclamations.filter((r) => isWithinPeriod(r.date, start, end))
  const rendezVous = extra.rendezVous.filter((r) => isWithinPeriod(r.date, start, end))

  const notes: FilteredNoteRow[] = extra.notes.map((row) => {
    const values = row.evaluations.filter((ev) => isWithinPeriod(ev.date, start, end)).map((ev) => ev.value)
    const moyenne = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
    const classeAverage = computeClasseAverageForSubject(row.subject, start, end, classe, students, studentExtras)
    return { subject: row.subject, coef: row.coef, classeAverage, values, moyenne }
  })

  const stats = computeAbsenceRetardStats(events)

  return {
    events,
    discipline,
    reclamations,
    rendezVous,
    notes,
    subjectBreakdown: computeSubjectBreakdown(events),
    faitsDisciplinaires: discipline.filter((d) => d.points < 0).length,
    ...stats,
  }
}
