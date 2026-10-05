import type { StudentExtra } from '../data/studentDetails'
import { parseDuration, weeklyVolumeMinutes, type Student } from '../data/students'
import { teacherName, type Teacher } from '../data/teachers'
import type { TeacherExtra } from '../data/teacherExtras'
import { isWithinPeriod, parseAnyDate } from './period'

const TEACHER_BASELINE_HOURS_PER_WEEK = 40

export interface WeeklyTrendPoint {
  week: string
  label: string
  /** Lundi de la semaine (date locale AAAA-MM-JJ) — pour rattacher la semaine à une période. */
  mondayISO: string
  eleves: number
  enseignants: number
  heuresManqueesEleves: number
  heuresManqueesProfs: number
  elevesAbsentsCount: number
  profsAbsentsCount: number
}

function mondayOf(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function computeEcoleWeeklyTrend(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  teachers: Teacher[],
  teacherExtras: Record<string, TeacherExtra>,
  weeksCount = 8,
  referenceDate: Date = new Date()
): WeeklyTrendPoint[] {
  const thisMonday = mondayOf(referenceDate)
  const points: WeeklyTrendPoint[] = []

  for (let i = weeksCount - 1; i >= 0; i--) {
    const weekStart = new Date(thisMonday)
    weekStart.setDate(thisMonday.getDate() - i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const startISO = toISO(weekStart)
    const endISO = toISO(weekEnd)

    let studentMinutesMissed = 0
    let studentPossibleMinutes = 0
    const elevesAbsentsSet = new Set<string>()
    students.forEach((s) => {
      const events = studentExtras[s.id]?.events ?? []
      events.forEach((e) => {
        if (isWithinPeriod(e.date, startISO, endISO)) {
          studentMinutesMissed += parseDuration(e.duree)
          if (e.type === 'ABSENCE') elevesAbsentsSet.add(s.id)
        }
      })
      studentPossibleMinutes += weeklyVolumeMinutes(s.classe)
    })
    const elevesTaux =
      studentPossibleMinutes > 0 ? Math.max(0, Math.min(100, (1 - studentMinutesMissed / studentPossibleMinutes) * 100)) : 100

    let teacherHoursMissed = 0
    const profsAbsentsSet = new Set<string>()
    teachers.forEach((t) => {
      const absences = teacherExtras[t.id]?.absences ?? []
      absences.forEach((a) => {
        if (isWithinPeriod(a.date, startISO, endISO)) {
          teacherHoursMissed += a.duree
          if (a.type === 'ABSENCE') profsAbsentsSet.add(t.id)
        }
      })
    })
    const teacherPossibleHours = teachers.length * TEACHER_BASELINE_HOURS_PER_WEEK
    const enseignantsTaux =
      teacherPossibleHours > 0 ? Math.max(0, Math.min(100, (1 - teacherHoursMissed / teacherPossibleHours) * 100)) : 100

    const weekLabel = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    const weekTick = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })

    points.push({
      week: weekTick(weekStart),
      label: `${weekLabel(weekStart)} au ${weekLabel(weekEnd)}`,
      mondayISO: `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`,
      eleves: Math.round(elevesTaux * 10) / 10,
      enseignants: Math.round(enseignantsTaux * 10) / 10,
      heuresManqueesEleves: Math.round((studentMinutesMissed / 60) * 10) / 10,
      heuresManqueesProfs: Math.round(teacherHoursMissed * 10) / 10,
      elevesAbsentsCount: elevesAbsentsSet.size,
      profsAbsentsCount: profsAbsentsSet.size,
    })
  }

  return points
}

const WEEKDAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export interface PersonHeures {
  name: string
  heures: number
  dates: string[]
}

export interface JourImpacteRow {
  label: string
  heures: number
  heuresEleves: number
  heuresProfs: number
  topEleves: PersonHeures[]
  topProfs: PersonHeures[]
}

const TOP_CONTRIBUTORS_COUNT = 3

interface PersonAgg {
  minutes: number
  dates: Set<string>
}

function formatDateFRShort(iso: string): string {
  const d = parseAnyDate(iso)
  if (!d) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Cumul (tout historique) des heures manquées élèves+profs, réparti par jour de la semaine. */
export function computeHeuresManqueesParJour(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  teachers: Teacher[],
  teacherExtras: Record<string, TeacherExtra>
): JourImpacteRow[] {
  const elevesMinutesByDay = new Map<number, number>()
  const profsMinutesByDay = new Map<number, number>()
  const eleveAggByDayPerson = new Map<number, Map<string, PersonAgg>>()
  const profAggByDayPerson = new Map<number, Map<string, PersonAgg>>()

  const addContribution = (
    aggByDayPerson: Map<number, Map<string, PersonAgg>>,
    day: number,
    personId: string,
    mins: number,
    isoDate: string
  ) => {
    const perPerson = aggByDayPerson.get(day) ?? new Map<string, PersonAgg>()
    const agg = perPerson.get(personId) ?? { minutes: 0, dates: new Set<string>() }
    agg.minutes += mins
    agg.dates.add(isoDate)
    perPerson.set(personId, agg)
    aggByDayPerson.set(day, perPerson)
  }

  students.forEach((s) => {
    const events = studentExtras[s.id]?.events ?? []
    events.forEach((e) => {
      const d = parseAnyDate(e.date)
      if (!d) return
      const day = d.getDay()
      const mins = parseDuration(e.duree)
      elevesMinutesByDay.set(day, (elevesMinutesByDay.get(day) ?? 0) + mins)
      addContribution(eleveAggByDayPerson, day, s.id, mins, e.date)
    })
  })

  teachers.forEach((t) => {
    const absences = teacherExtras[t.id]?.absences ?? []
    absences.forEach((a) => {
      const d = parseAnyDate(a.date)
      if (!d) return
      const day = d.getDay()
      const mins = a.duree * 60
      profsMinutesByDay.set(day, (profsMinutesByDay.get(day) ?? 0) + mins)
      addContribution(profAggByDayPerson, day, t.id, mins, a.date)
    })
  })

  const round1 = (mins: number) => Math.round((mins / 60) * 10) / 10
  const studentNameById = (id: string) => students.find((s) => s.id === id)?.name ?? id
  const teacherNameById = (id: string) => {
    const t = teachers.find((t) => t.id === id)
    return t ? teacherName(t) : id
  }

  const topContributors = (
    aggByDayPerson: Map<number, Map<string, PersonAgg>>,
    day: number,
    nameOf: (id: string) => string
  ): PersonHeures[] => {
    const perPerson = aggByDayPerson.get(day)
    if (!perPerson) return []
    return Array.from(perPerson.entries())
      .map(([id, agg]) => ({
        name: nameOf(id),
        heures: round1(agg.minutes),
        dates: Array.from(agg.dates)
          .sort()
          .map(formatDateFRShort),
      }))
      .sort((a, b) => b.heures - a.heures)
      .slice(0, TOP_CONTRIBUTORS_COUNT)
  }

  return [1, 2, 3, 4, 5, 6].map((day) => {
    const heuresEleves = round1(elevesMinutesByDay.get(day) ?? 0)
    const heuresProfs = round1(profsMinutesByDay.get(day) ?? 0)
    return {
      label: WEEKDAY_LABELS[day],
      heures: Math.round((heuresEleves + heuresProfs) * 10) / 10,
      heuresEleves,
      heuresProfs,
      topEleves: topContributors(eleveAggByDayPerson, day, studentNameById),
      topProfs: topContributors(profAggByDayPerson, day, teacherNameById),
    }
  })
}
