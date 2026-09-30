export interface CourseSlot {
  id: string
  subject: string
  teacherId: string
  salleId?: string
  start: string
  end: string
  hours: number
}

export type ClassSchedule = Record<string, CourseSlot[]>

export const SCHEDULE_DAYS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']

export interface HistoryEntry {
  id: string
  date: string
  classe: string
  action: 'Ajout' | 'Modification' | 'Suppression' | 'Déplacement'
  details: string
}

export function emptyWeek(): ClassSchedule {
  const week: ClassSchedule = {}
  SCHEDULE_DAYS.forEach((d) => {
    week[d] = []
  })
  return week
}

export function makeCourseSlot(subject: string, teacherId: string, start: string, end: string, hours: number, salleId?: string): CourseSlot {
  return { id: crypto.randomUUID(), subject, teacherId, start, end, hours, salleId }
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
