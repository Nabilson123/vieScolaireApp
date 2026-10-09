import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { SCHEDULE_DAYS, emptyWeek, timeToMinutes, minutesToTime, type ClassSchedule, type CourseSlot, type HistoryEntry } from '../data/classSchedules'
import { getTeachersSnapshot, updateTeacherRow } from './teachersService'
import { getClassesSnapshot } from './classesService'
import { useViewedYearId, getViewedYearIdSnapshot } from './viewedYear'
import { useAnneesLoaded } from './anneesScolairesService'
import { getSoutienSeancesSnapshot } from './soutienService'
import { getClubsSnapshot } from './clubsService'
import { clubTermine, intervallesClubEnseignant } from '../utils/clubs'
import { aujourdhuiLocalISO, intervallesSoutienEnseignant, seancesEnCours } from '../utils/soutienSeances'

interface ScheduleRow {
  classe: string
  schedule: ClassSchedule
}

async function fetchClassSchedules(yearId: string): Promise<Record<string, ClassSchedule>> {
  const { data, error } = await supabase.from('class_schedules').select('*').eq('annee_scolaire_id', yearId)
  if (error) throw error
  const result: Record<string, ClassSchedule> = {}
  ;(data as ScheduleRow[]).forEach((row) => {
    result[row.classe] = row.schedule
  })
  return result
}

export function useClassSchedules(enabled = true) {
  // Attend que la liste des années ait réellement chargé avant de filtrer par année : sinon
  // getViewedYearIdSnapshot() retombe sur l'id de secours (non-UUID), rejeté par Postgres.
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: ['classSchedules', viewedYearId],
    queryFn: () => fetchClassSchedules(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  // Affectation synchrone (pas un useEffect) : un useEffect ne s'exécute qu'après la peinture du
  // composant, donc computeClassSchedule() (appelé plus loin dans le MÊME rendu par les pages
  // consommatrices) lirait encore l'ancienne valeur de cachedSchedules — et rien ne force ensuite
  // de nouveau rendu tant que query.data ne change plus. En l'assignant ici, cachedSchedules est
  // à jour avant même que le reste du rendu ne s'exécute.
  if (query.data) cachedSchedules = query.data
  return query
}

let cachedSchedules: Record<string, ClassSchedule> = {}
export function getAllClassSchedulesSnapshot(): Record<string, ClassSchedule> {
  return cachedSchedules
}
export function getClassScheduleSnapshot(className: string): ClassSchedule {
  return cachedSchedules[className] ?? emptyWeek()
}

interface HistoryRow {
  id: string
  date: string
  classe: string
  action: HistoryEntry['action']
  details: string
}

async function fetchHistory(yearId: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from('class_schedule_history')
    .select('*')
    .eq('annee_scolaire_id', yearId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data as HistoryRow[]).map((row) => ({ id: row.id, date: row.date, classe: row.classe, action: row.action, details: row.details }))
}

export function useScheduleHistory(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: ['classScheduleHistory', viewedYearId],
    queryFn: () => fetchHistory(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  // Affectation synchrone : voir le commentaire équivalent dans useClassSchedules() ci-dessus.
  if (query.data) cachedHistory = query.data
  return query
}

let cachedHistory: HistoryEntry[] = []
export function getHistorySnapshot(): HistoryEntry[] {
  return cachedHistory
}

async function logHistory(classe: string, action: HistoryEntry['action'], details: string): Promise<void> {
  const { error } = await supabase
    .from('class_schedule_history')
    .insert({ classe, action, details, annee_scolaire_id: getViewedYearIdSnapshot() })
  if (error) throw error
}

async function writeSchedule(className: string, week: ClassSchedule): Promise<void> {
  const { error } = await supabase
    .from('class_schedules')
    .upsert({ classe: className, schedule: week, annee_scolaire_id: getViewedYearIdSnapshot() }, { onConflict: 'annee_scolaire_id,classe' })
  if (error) throw error
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  return a.every((x) => setB.has(x))
}

/**
 * Niveaux/matières/classes d'un prof, dérivés uniquement de son emploi du temps réel — jamais saisis à la
 * main. `overrides` permet de passer l'état d'une classe qui vient d'être modifiée en mémoire mais pas
 * encore répercutée dans le snapshot global (mis à jour de façon asynchrone par React Query).
 */
function computeTeacherProfileFromSchedule(
  teacherId: string,
  overrides: Record<string, ClassSchedule> = {}
): { niveaux: string[]; matieres: string[]; classes: string[] } {
  const allSchedules = { ...getAllClassSchedulesSnapshot(), ...overrides }
  const classes = new Set<string>()
  const matieres = new Set<string>()
  Object.entries(allSchedules).forEach(([className, week]) => {
    Object.values(week).forEach((slots) => {
      ;(slots ?? []).forEach((s) => {
        if (s.teacherId === teacherId) {
          classes.add(className)
          matieres.add(s.subject)
        }
      })
    })
  })
  const niveaux = new Set<string>()
  classes.forEach((c) => {
    const niveau = getClassesSnapshot().find((cls) => cls.nom === c)?.niveau
    if (niveau) niveaux.add(niveau)
  })
  return { niveaux: Array.from(niveaux), matieres: Array.from(matieres), classes: Array.from(classes) }
}

/**
 * Recale Niveaux/Matières/Classes d'un prof sur son emploi du temps réel. Appelé après toute mutation de
 * cours qui le concerne, pour que sa fiche (Corps Professoral) ne dérive jamais de ce qu'il enseigne
 * vraiment — sans ça ces champs restent figés à leur valeur de création (souvent vide après un import Excel
 * des profs, ou obsolète après une modification manuelle de l'emploi du temps).
 */
export async function syncTeacherProfileFromSchedule(teacherId: string, overrides: Record<string, ClassSchedule> = {}): Promise<boolean> {
  if (!teacherId) return false
  const teacher = getTeachersSnapshot().find((t) => t.id === teacherId)
  if (!teacher) return false
  const derived = computeTeacherProfileFromSchedule(teacherId, overrides)
  if (sameSet(teacher.niveaux, derived.niveaux) && sameSet(teacher.matieres, derived.matieres) && sameSet(teacher.classes, derived.classes)) {
    return false
  }
  const { id, ...data } = teacher
  await updateTeacherRow(id, { ...data, niveaux: derived.niveaux, matieres: derived.matieres, classes: derived.classes })
  return true
}

export async function replaceClassScheduleWeek(className: string, week: ClassSchedule): Promise<void> {
  const previousWeek = getClassScheduleSnapshot(className)
  await writeSchedule(className, week)
  const total = Object.values(week).flat().length
  await logHistory(className, 'Modification', `Import Excel : emploi du temps remplacé (${total} créneau${total > 1 ? 'x' : ''})`)
  const teacherIds = new Set<string>()
  Object.values(previousWeek).forEach((slots) => slots.forEach((s) => s.teacherId && teacherIds.add(s.teacherId)))
  Object.values(week).forEach((slots) => slots.forEach((s) => s.teacherId && teacherIds.add(s.teacherId)))
  for (const teacherId of teacherIds) await syncTeacherProfileFromSchedule(teacherId, { [className]: week })
}

export async function addCourseSlot(className: string, day: string, data: Omit<CourseSlot, 'id'>): Promise<CourseSlot> {
  const week = { ...getClassScheduleSnapshot(className) }
  const newSlot: CourseSlot = { id: crypto.randomUUID(), ...data }
  week[day] = [...(week[day] ?? []), newSlot]
  await writeSchedule(className, week)
  await logHistory(className, 'Ajout', `${data.subject} le ${day.toLowerCase()} ${data.start}-${data.end}`)
  if (data.teacherId) await syncTeacherProfileFromSchedule(data.teacherId, { [className]: week })
  return newSlot
}

export async function updateCourseSlot(className: string, day: string, slotId: string, data: Omit<CourseSlot, 'id'>): Promise<void> {
  const week = { ...getClassScheduleSnapshot(className) }
  const previous = (week[day] ?? []).find((s) => s.id === slotId)
  week[day] = (week[day] ?? []).map((s) => (s.id === slotId ? { ...s, ...data } : s))
  await writeSchedule(className, week)
  await logHistory(className, 'Modification', `${data.subject} le ${day.toLowerCase()} ${data.start}-${data.end}`)
  const affectedTeacherIds = new Set([previous?.teacherId, data.teacherId].filter((t): t is string => !!t))
  for (const teacherId of affectedTeacherIds) await syncTeacherProfileFromSchedule(teacherId, { [className]: week })
}

export async function deleteCourseSlot(className: string, day: string, slotId: string): Promise<void> {
  const week = { ...getClassScheduleSnapshot(className) }
  const target = (week[day] ?? []).find((s) => s.id === slotId)
  week[day] = (week[day] ?? []).filter((s) => s.id !== slotId)
  await writeSchedule(className, week)
  if (target) await logHistory(className, 'Suppression', `${target.subject} le ${day.toLowerCase()} ${target.start}-${target.end}`)
  if (target?.teacherId) await syncTeacherProfileFromSchedule(target.teacherId, { [className]: week })
}

export async function moveCourseSlot(className: string, fromDay: string, slotId: string, toDay: string, newStart?: string): Promise<void> {
  const week = { ...getClassScheduleSnapshot(className) }
  const target = (week[fromDay] ?? []).find((s) => s.id === slotId)
  if (!target) return
  week[fromDay] = (week[fromDay] ?? []).filter((s) => s.id !== slotId)
  let updated = target
  if (newStart && newStart !== target.start) {
    const durationMin = timeToMinutes(target.end) - timeToMinutes(target.start)
    const newStartMin = timeToMinutes(newStart)
    updated = { ...target, start: newStart, end: minutesToTime(newStartMin + durationMin) }
  }
  week[toDay] = [...(week[toDay] ?? []), updated]
  await writeSchedule(className, week)
  const moveDetail =
    fromDay === toDay
      ? `déplacé à ${updated.start}`
      : `déplacé de ${fromDay.toLowerCase()} vers ${toDay.toLowerCase()}${newStart ? ` à ${updated.start}` : ''}`
  await logHistory(className, 'Déplacement', `${target.subject} ${moveDetail}`)
}

export async function duplicateClassSchedule(sourceClassName: string, targetClassName: string): Promise<void> {
  const source = getClassScheduleSnapshot(sourceClassName)
  const copy: ClassSchedule = {}
  SCHEDULE_DAYS.forEach((day) => {
    copy[day] = (source[day] ?? []).map((s) => ({ ...s, id: crypto.randomUUID() }))
  })
  await writeSchedule(targetClassName, copy)
  await logHistory(targetClassName, 'Ajout', `Planning dupliqué depuis ${sourceClassName}`)
  const teacherIds = new Set<string>()
  Object.values(copy).forEach((slots) => slots.forEach((s) => s.teacherId && teacherIds.add(s.teacherId)))
  for (const teacherId of teacherIds) await syncTeacherProfileFromSchedule(teacherId, { [targetClassName]: copy })
}

function slotsOverlap(a: CourseSlot, b: CourseSlot): boolean {
  return timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end)
}

export function detectConflictForTeacher(teacherId: string, day: string, start: string, end: string, excludeSlotId?: string): boolean {
  if (!teacherId) return false
  const coursEnConflit = Object.values(getAllClassSchedulesSnapshot()).some((week) =>
    (week[day] ?? []).some(
      (s) =>
        s.teacherId === teacherId &&
        s.id !== excludeSlotId &&
        timeToMinutes(s.start) < timeToMinutes(end) &&
        timeToMinutes(start) < timeToMinutes(s.end)
    )
  )
  if (coursEnConflit) return true
  const chevauche = (s: { start: string; end: string }) => timeToMinutes(s.start) < timeToMinutes(end) && timeToMinutes(start) < timeToMinutes(s.end)
  // Un soutien en cours rend aussi l'enseignant indisponible (sans compter dans son quota d'heures).
  if (intervallesSoutienEnseignant(seancesEnCours(getSoutienSeancesSnapshot(), aujourdhuiLocalISO()), teacherId, day).some(chevauche)) return true
  // Un club qu'il encadre aussi (les clubs dont la période est passée ne comptent plus).
  const aujourdhui = aujourdhuiLocalISO()
  return intervallesClubEnseignant(getClubsSnapshot().filter((c) => !clubTermine(c, aujourdhui)), teacherId, day).some(chevauche)
}

export function getClassConflictSlotIds(className: string): Set<string> {
  const week = getClassScheduleSnapshot(className)
  const ids = new Set<string>()
  SCHEDULE_DAYS.forEach((day) => {
    const slots = week[day] ?? []
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (slotsOverlap(slots[i], slots[j])) {
          ids.add(slots[i].id)
          ids.add(slots[j].id)
        }
      }
      if (detectConflictForTeacher(slots[i].teacherId, day, slots[i].start, slots[i].end, slots[i].id)) {
        ids.add(slots[i].id)
      }
    }
  })
  return ids
}

export function getTeacherConflictSlotIds(teacherId: string): Set<string> {
  const ids = new Set<string>()
  Object.values(getAllClassSchedulesSnapshot()).forEach((week) => {
    SCHEDULE_DAYS.forEach((day) => {
      ;(week[day] ?? []).forEach((s) => {
        if (s.teacherId === teacherId && detectConflictForTeacher(teacherId, day, s.start, s.end, s.id)) {
          ids.add(s.id)
        }
      })
    })
  })
  return ids
}

export function computeTeacherWeeklyHours(teacherId: string): number {
  let total = 0
  Object.values(getAllClassSchedulesSnapshot()).forEach((week) => {
    Object.values(week).forEach((slots) => {
      slots.forEach((s) => {
        if (s.teacherId === teacherId) total += s.hours
      })
    })
  })
  return total
}

export function findSlotOwner(slotId: string): { className: string; day: string; slot: CourseSlot } | undefined {
  for (const [className, week] of Object.entries(getAllClassSchedulesSnapshot())) {
    for (const [day, slots] of Object.entries(week)) {
      const found = slots.find((s) => s.id === slotId)
      if (found) return { className, day, slot: found }
    }
  }
  return undefined
}
