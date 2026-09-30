import { getStudentsSnapshot } from '../services/studentsService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { teacherName, type Teacher } from '../data/teachers'
import type { TeacherAbsenceRecord, RemplacementRecord } from '../data/teacherExtras'
import { getClassesSnapshot } from '../services/classesService'
import { SCHEDULE_DAYS } from '../data/classSchedules'
import { getClassScheduleSnapshot } from '../services/classSchedulesService'
import { isWithinPeriod } from './period'
import { cycleOfNiveau } from '../data/referentiel'

/** Cycles réellement couverts par un prof (dérivés de ses niveaux réels, pas déclaratifs) — un prof
 * peut apparaître dans plusieurs cycles (ex. sport enseigné en primaire ET collège). */
export function teacherCycles(teacher: Teacher): string[] {
  const keys = new Set<string>()
  teacher.niveaux.forEach((n) => {
    const cycle = cycleOfNiveau(n)
    if (cycle) keys.add(cycle.key)
  })
  return Array.from(keys)
}

export interface TeacherScheduleSlot {
  id: string
  subject: string
  start: string
  end: string
  hours: number
  classe: string
}

export function computeTeacherSchedule(teacher: Teacher): Record<string, TeacherScheduleSlot[]> {
  const result: Record<string, TeacherScheduleSlot[]> = {}
  SCHEDULE_DAYS.forEach((day) => {
    result[day] = []
  })
  getClassesSnapshot().forEach((cls) => {
    const schedule = getClassScheduleSnapshot(cls.nom)
    SCHEDULE_DAYS.forEach((day) => {
      ;(schedule[day] ?? [])
        .filter((s) => s.teacherId === teacher.id)
        .forEach((s) => {
          result[day].push({ id: s.id, subject: s.subject, start: s.start, end: s.end, hours: s.hours, classe: cls.nom })
        })
    })
  })
  SCHEDULE_DAYS.forEach((day) => {
    result[day].sort((a, b) => (a.start < b.start ? -1 : 1))
  })
  return result
}

export function totalHoursForDay(slots: TeacherScheduleSlot[]): number {
  return slots.reduce((sum, s) => sum + s.hours, 0)
}

export interface ClasseHeuresRow {
  classe: string
  absencesHeures: number
  absencesFois: number
  retardsHeures: number
  retardsFois: number
  total: number
}

export interface TeacherStats {
  absencesHeures: number
  absencesFois: number
  retardsHeures: number
  retardsFois: number
  remplacementsHeures: number
  remplacementsFois: number
  heuresPerdues: number
  tauxAssiduite: number
  heuresParClasse: ClasseHeuresRow[]
}

const TAUX_BASELINE_HOURS = 40

export function computeTeacherStats(
  absences: TeacherAbsenceRecord[],
  remplacements: RemplacementRecord[],
  periodStart: string,
  periodEnd: string
): TeacherStats {
  const filteredAbsences = absences.filter((a) => isWithinPeriod(a.date, periodStart, periodEnd))
  const filteredRemplacements = remplacements.filter((r) => isWithinPeriod(r.date, periodStart, periodEnd))

  const absenceList = filteredAbsences.filter((a) => a.type === 'ABSENCE')
  const retardList = filteredAbsences.filter((a) => a.type === 'RETARD')

  const absencesHeures = absenceList.reduce((sum, a) => sum + a.duree, 0)
  const retardsHeures = retardList.reduce((sum, a) => sum + a.duree, 0)
  const remplacementsHeures = filteredRemplacements.reduce((sum, r) => sum + r.heures, 0)
  const heuresPerdues = absencesHeures + retardsHeures

  const tauxAssiduite = Math.max(0, ((TAUX_BASELINE_HOURS - heuresPerdues) / TAUX_BASELINE_HOURS) * 100)

  const classeMap = new Map<string, ClasseHeuresRow>()
  const getRow = (classe: string) => {
    if (!classeMap.has(classe)) {
      classeMap.set(classe, { classe, absencesHeures: 0, absencesFois: 0, retardsHeures: 0, retardsFois: 0, total: 0 })
    }
    return classeMap.get(classe)!
  }
  absenceList.forEach((a) => {
    const row = getRow(a.classe)
    row.absencesHeures += a.duree
    row.absencesFois += 1
    row.total += a.duree
  })
  retardList.forEach((a) => {
    const row = getRow(a.classe)
    row.retardsHeures += a.duree
    row.retardsFois += 1
    row.total += a.duree
  })

  return {
    absencesHeures,
    absencesFois: absenceList.length,
    retardsHeures,
    retardsFois: retardList.length,
    remplacementsHeures,
    remplacementsFois: filteredRemplacements.length,
    heuresPerdues,
    tauxAssiduite,
    heuresParClasse: Array.from(classeMap.values()),
  }
}

export function computeEcoleHeuresManqueesProfs(
  teachers: Teacher[],
  teacherExtras: Record<string, { absences: TeacherAbsenceRecord[] }>,
  periodStart: string,
  periodEnd: string
): number {
  let total = 0
  teachers.forEach((t) => {
    const absences = teacherExtras[t.id]?.absences ?? []
    absences.forEach((a) => {
      if (isWithinPeriod(a.date, periodStart, periodEnd)) total += a.duree
    })
  })
  return Math.round(total * 10) / 10
}

export function formatHeures(h: number): string {
  if (h === 0) return '0h'
  const wholeHours = Math.floor(h)
  const minutes = Math.round((h - wholeHours) * 60)
  if (minutes === 0) return `${wholeHours}h`
  if (wholeHours === 0) return `${minutes}min`
  return `${wholeHours}h ${minutes}min`
}

export function formatFois(n: number): string {
  return `${n} fois`
}

function normalizeName(s: string): string {
  return s.replace(/^Prof\.\s*/i, '').trim().toLowerCase()
}

export function matchesTeacher(enseignantField: string, teacher: Teacher): boolean {
  return normalizeName(enseignantField) === normalizeName(teacherName(teacher))
}

export interface TeacherReclamationRow {
  date: string
  studentName: string
  objet: string
  statut: string
}

export interface TeacherRdvRow {
  date: string
  studentName: string
  motif: string
  statut: string
}

export function collectTeacherReclamations(teacher: Teacher, periodStart: string, periodEnd: string): TeacherReclamationRow[] {
  const rows: TeacherReclamationRow[] = []
  getStudentsSnapshot().forEach((s) => {
    getStudentExtraSnapshot(s.id).reclamations.forEach((r) => {
      if (matchesTeacher(r.enseignant, teacher) && isWithinPeriod(r.date, periodStart, periodEnd)) {
        rows.push({ date: r.date, studentName: s.name, objet: r.objet, statut: r.statut })
      }
    })
  })
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function collectTeacherRendezVous(teacher: Teacher, periodStart: string, periodEnd: string): TeacherRdvRow[] {
  const rows: TeacherRdvRow[] = []
  getStudentsSnapshot().forEach((s) => {
    getStudentExtraSnapshot(s.id).rendezVous.forEach((r) => {
      if (matchesTeacher(r.enseignant, teacher) && isWithinPeriod(r.date, periodStart, periodEnd)) {
        rows.push({ date: r.date, studentName: s.name, motif: r.motif, statut: r.statut })
      }
    })
  })
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1))
}
