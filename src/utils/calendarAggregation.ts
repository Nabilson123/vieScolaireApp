import { initials as studentInitials } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { teacherName, initials as teacherInitials } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import { getTeacherExtraSnapshot } from '../services/teacherExtrasService'

export type CalendarTarget = 'eleves' | 'enseignants'
export type CalendarEventKind = 'ABSENCE' | 'RETARD' | 'RDV'
export type CalendarEventStatus = 'plein' | 'pointille'

export interface CalendarEvent {
  id: string
  date: string
  kind: CalendarEventKind
  status: CalendarEventStatus
  cancelled: boolean
  label: string
  personId: string
  personName: string
  personType: 'eleve' | 'enseignant'
  classe?: string
  subject?: string
  motif?: string
  justified?: boolean
  statutRdv?: 'Planifié' | 'Réalisé' | 'Annulé'
  rdvWith?: string
}

export interface CalendarFilters {
  classe?: string
  personId?: string
}

export const SCHOOL_YEAR_START = { year: 2025, month: 9 }
export const SCHOOL_YEAR_END = { year: 2027, month: 8 }

const FR_MONTHS: Record<string, number> = {
  janvier: 1,
  jan: 1,
  février: 2,
  fevrier: 2,
  fév: 2,
  fev: 2,
  mars: 3,
  avril: 4,
  avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  juil: 7,
  août: 8,
  aout: 8,
  septembre: 9,
  sept: 9,
  sep: 9,
  octobre: 10,
  oct: 10,
  novembre: 11,
  nov: 11,
  décembre: 12,
  decembre: 12,
  déc: 12,
  dec: 12,
}

export function parseAnyDate(value: string): string {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return value
  const frMatch = value.match(/^(\d{1,2})\s+([^\s]+)\s+(\d{4})$/)
  if (frMatch) {
    const [, day, monthRaw, year] = frMatch
    const month = FR_MONTHS[monthRaw.toLowerCase()]
    if (month) {
      return `${year}-${String(month).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
    }
  }
  return value
}

export function computeCalendarEvents(target: CalendarTarget, filters: CalendarFilters): CalendarEvent[] {
  const events: CalendarEvent[] = []

  if (target === 'eleves') {
    const filtered = getStudentsSnapshot().filter(
      (s) =>
        (!filters.classe || filters.classe === 'Toutes les classes' || s.classe === filters.classe) &&
        (!filters.personId || s.id === filters.personId)
    )
    filtered.forEach((s) => {
      const extra = getStudentExtraSnapshot(s.id)
      const ini = studentInitials(s.name)
      extra.events.forEach((e, idx) => {
        events.push({
          id: `${s.id}-ev-${idx}`,
          date: parseAnyDate(e.date),
          kind: e.type,
          status: e.justified ? 'plein' : 'pointille',
          cancelled: false,
          label: `${ini}: ${e.subject}`,
          personId: s.id,
          personName: s.name,
          personType: 'eleve',
          classe: s.classe,
          subject: e.subject,
          motif: e.motif,
          justified: e.justified,
        })
      })
      extra.rendezVous.forEach((r, idx) => {
        events.push({
          id: `${s.id}-rdv-${idx}`,
          date: r.date,
          kind: 'RDV',
          status: r.statut === 'Réalisé' ? 'plein' : 'pointille',
          cancelled: r.statut === 'Annulé',
          label: `${ini}: RDV`,
          personId: s.id,
          personName: s.name,
          personType: 'eleve',
          classe: s.classe,
          motif: r.motif,
          statutRdv: r.statut,
          rdvWith: r.enseignant,
        })
      })
    })
  } else {
    const filtered = getTeachersSnapshot().filter((t) => !filters.personId || t.id === filters.personId)
    filtered.forEach((t) => {
      const name = teacherName(t)
      const ini = teacherInitials(name)
      const extra = getTeacherExtraSnapshot(t.id)
      extra.absences.forEach((a, idx) => {
        events.push({
          id: `${t.id}-ab-${idx}`,
          date: parseAnyDate(a.date),
          kind: a.type,
          status: a.justified ? 'plein' : 'pointille',
          cancelled: false,
          label: `${ini}: ${a.classe}`,
          personId: t.id,
          personName: name,
          personType: 'enseignant',
          classe: a.classe,
          motif: a.motif,
          justified: a.justified,
        })
      })
      getStudentsSnapshot().forEach((s) => {
        const sExtra = getStudentExtraSnapshot(s.id)
        sExtra.rendezVous.forEach((r, idx) => {
          if (r.enseignant !== name) return
          events.push({
            id: `${t.id}-rdv-${s.id}-${idx}`,
            date: r.date,
            kind: 'RDV',
            status: r.statut === 'Réalisé' ? 'plein' : 'pointille',
            cancelled: r.statut === 'Annulé',
            label: `${ini}: RDV ${studentInitials(s.name)}`,
            personId: t.id,
            personName: name,
            personType: 'enseignant',
            motif: r.motif,
            statutRdv: r.statut,
            rdvWith: s.name,
          })
        })
      })
    })
  }

  return events
}

export function groupEventsByDay(events: CalendarEvent[], year: number, month: number): Record<string, CalendarEvent[]> {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  const grouped: Record<string, CalendarEvent[]> = {}
  events
    .filter((e) => e.date.startsWith(prefix))
    .forEach((e) => {
      grouped[e.date] = [...(grouped[e.date] ?? []), e]
    })
  return grouped
}

export interface MonthStats {
  totalAbsences: number
  totalRetards: number
  totalRdv: number
  pctJustifie: number
}

export function computeMonthStats(events: CalendarEvent[], year: number, month: number): MonthStats {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  const monthEvents = events.filter((e) => e.date.startsWith(prefix) && !e.cancelled)
  const absences = monthEvents.filter((e) => e.kind === 'ABSENCE')
  const retards = monthEvents.filter((e) => e.kind === 'RETARD')
  const rdv = monthEvents.filter((e) => e.kind === 'RDV')
  const justifiable = [...absences, ...retards]
  const justifiedCount = justifiable.filter((e) => e.justified).length
  const pctJustifie = justifiable.length ? Math.round((justifiedCount / justifiable.length) * 100) : 100
  return { totalAbsences: absences.length, totalRetards: retards.length, totalRdv: rdv.length, pctJustifie }
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export function isBeforeSchoolYear(year: number, month: number): boolean {
  return year < SCHOOL_YEAR_START.year || (year === SCHOOL_YEAR_START.year && month < SCHOOL_YEAR_START.month)
}

export function isAfterSchoolYear(year: number, month: number): boolean {
  return year > SCHOOL_YEAR_END.year || (year === SCHOOL_YEAR_END.year && month > SCHOOL_YEAR_END.month)
}

export function findNearestMonthWithEvent(
  events: CalendarEvent[],
  fromYear: number,
  fromMonth: number
): { year: number; month: number } | undefined {
  const dates = events.map((e) => e.date).sort()
  if (dates.length === 0) return undefined
  const fromPrefix = `${fromYear}-${String(fromMonth).padStart(2, '0')}`
  const upcoming = dates.find((d) => d.slice(0, 7) >= fromPrefix)
  const target = upcoming ?? dates[dates.length - 1]
  return { year: Number(target.slice(0, 4)), month: Number(target.slice(5, 7)) }
}

const MONTH_LABELS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

export function monthLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month - 1]} ${year}`
}

export interface MonthGridCell {
  date: string
  day: number
  isCurrentMonth: boolean
}

export function buildMonthGrid(year: number, month: number): MonthGridCell[] {
  const firstOfMonth = new Date(year, month - 1, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(year, month - 1, 1 - startOffset)
  const cells: MonthGridCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      day: d.getDate(),
      isCurrentMonth: d.getMonth() === month - 1,
    })
  }
  return cells
}
