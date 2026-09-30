import type { Student } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import { teacherName, type Teacher } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import { NIVEAUX_ORDER, type SchoolClass } from '../data/schoolStructure'
import { getClassesSnapshot } from '../services/classesService'
import { SCHEDULE_DAYS } from '../data/classSchedules'
import { getClassScheduleSnapshot } from '../services/classSchedulesService'

export interface ClassScheduleSlot {
  id: string
  subject: string
  start: string
  end: string
  hours: number
  teacherId: string
  teacherName: string
}

export function getClassTeachers(className: string): Teacher[] {
  return getTeachersSnapshot().filter((t) => t.classes.includes(className))
}

export function getClassStudents(className: string): Student[] {
  return getStudentsSnapshot().filter((s) => s.classe === className)
}

export function getClassEffectif(className: string): number {
  return getClassStudents(className).length
}

export function computeClassSchedule(className: string): Record<string, ClassScheduleSlot[]> {
  const schedule = getClassScheduleSnapshot(className)
  const result: Record<string, ClassScheduleSlot[]> = {}
  SCHEDULE_DAYS.forEach((day) => {
    result[day] = (schedule[day] ?? []).map((s) => {
      const teacher = getTeachersSnapshot().find((t) => t.id === s.teacherId)
      return {
        id: s.id,
        subject: s.subject,
        start: s.start,
        end: s.end,
        hours: s.hours,
        teacherId: s.teacherId,
        teacherName: teacher ? teacherName(teacher) : 'Inconnu',
      }
    })
  })
  return result
}

export function computeClassVolume(className: string): { seances: number; heures: number } {
  const schedule = computeClassSchedule(className)
  const allSlots = Object.values(schedule).flat()
  return { seances: allSlots.length, heures: allSlots.reduce((sum, s) => sum + s.hours, 0) }
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export interface ScheduleConflict {
  day: string
  slotA: ClassScheduleSlot
  slotB: ClassScheduleSlot
}

export function detectScheduleConflicts(className: string): ScheduleConflict[] {
  const schedule = computeClassSchedule(className)
  const conflicts: ScheduleConflict[] = []
  Object.entries(schedule).forEach(([day, slots]) => {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i]
        const b = slots[j]
        const overlap = timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end)
        if (overlap) conflicts.push({ day, slotA: a, slotB: b })
      }
    }
  })
  return conflicts
}

export interface NiveauImbalance {
  niveau: string
  min: number
  max: number
  diff: number
  classes: { nom: string; effectif: number }[]
}

const IMBALANCE_THRESHOLD = 5

export function detectNiveauImbalance(): NiveauImbalance[] {
  const active = getClassesSnapshot().filter((c) => c.statut === 'Active')
  const result: NiveauImbalance[] = []
  NIVEAUX_ORDER.forEach((niveau) => {
    const siblings = active.filter((c) => c.niveau === niveau)
    if (siblings.length < 2) return
    const withEffectif = siblings.map((c) => ({ nom: c.nom, effectif: getClassEffectif(c.nom) }))
    const effectifs = withEffectif.map((c) => c.effectif)
    const min = Math.min(...effectifs)
    const max = Math.max(...effectifs)
    if (max - min >= IMBALANCE_THRESHOLD) {
      result.push({ niveau, min, max, diff: max - min, classes: withEffectif })
    }
  })
  return result
}

export interface SalleConflict {
  salle: string
  classes: string[]
}

export function detectSalleConflicts(): SalleConflict[] {
  const active = getClassesSnapshot().filter((c) => c.statut === 'Active')
  const bySalle = new Map<string, string[]>()
  active.forEach((c) => {
    const list = bySalle.get(c.salle) ?? []
    list.push(c.nom)
    bySalle.set(c.salle, list)
  })
  return Array.from(bySalle.entries())
    .filter(([, noms]) => noms.length > 1)
    .map(([salle, classesNoms]) => ({ salle, classes: classesNoms }))
}

export interface GlobalClassStats {
  totalActives: number
  totalEleves: number
  moyenneElevesParClasse: number
  classesSansPP: SchoolClass[]
  classesSansEleve: SchoolClass[]
}

export function computeGlobalStats(): GlobalClassStats {
  const active = getClassesSnapshot().filter((c) => c.statut === 'Active')
  const totalActives = active.length
  const effectifs = active.map((c) => getClassEffectif(c.nom))
  const totalEleves = effectifs.reduce((sum, e) => sum + e, 0)
  const classesAvecEleves = active.filter((c) => getClassEffectif(c.nom) > 0)
  const moyenneElevesParClasse = classesAvecEleves.length > 0 ? totalEleves / classesAvecEleves.length : 0
  const classesSansPP = active.filter((c) => !c.professeurPrincipalId)
  const classesSansEleve = active.filter((c) => getClassEffectif(c.nom) === 0)
  return { totalActives, totalEleves, moyenneElevesParClasse, classesSansPP, classesSansEleve }
}
