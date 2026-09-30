import type { CourseSlot } from '../data/classSchedules'
import { timeToMinutes } from '../data/classSchedules'
import { getClassesSnapshot } from '../services/classesService'
import { getClassScheduleSnapshot } from '../services/classSchedulesService'
import { getStudentsSnapshot } from '../services/studentsService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { getTeachersSnapshot } from '../services/teachersService'
import { getTeacherExtraSnapshot } from '../services/teacherExtrasService'
import { getServicesCapaciteSnapshot, type CreneauFixe } from '../services/servicesCapaciteService'
import { getAppelsTodaySnapshot } from '../services/appelsService'
import { getAppelsParentsTodaySnapshot } from '../services/appelsParentsService'
import { getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { getWeekdayName, getPendingReplacements, mergeIntervals, subtractCoveredIntervals, type TimeInterval } from './replacementAggregation'
import { isWithinPeriod } from './period'

// ---------------------------------------------------------------------------
// Créneau en cours par classe / appels non faits
// ---------------------------------------------------------------------------

export interface CurrentClassSlot {
  classe: string
  slot: CourseSlot
}

/**
 * Résout, pour chaque classe active, le créneau de cours en cours *maintenant*. Weekend ou classe
 * sans emploi du temps importé → liste vide (état positif, pas un crash) : `getClassScheduleSnapshot`
 * retombe sur une semaine vide et `class_schedules` n'a de toute façon pas de clé samedi/dimanche.
 */
export function getCurrentClassSlots(now: Date = new Date()): CurrentClassSlot[] {
  const weekday = getWeekdayName(now.toISOString().slice(0, 10))
  if (!weekday) return []
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const result: CurrentClassSlot[] = []
  getClassesSnapshot()
    .filter((c) => c.statut === 'Active')
    .forEach((c) => {
      const daySlots = getClassScheduleSnapshot(c.nom)[weekday] ?? []
      const current = daySlots.find((s) => timeToMinutes(s.start) <= nowMin && nowMin < timeToMinutes(s.end))
      if (current) result.push({ classe: c.nom, slot: current })
    })
  return result.sort((a, b) => a.classe.localeCompare(b.classe))
}

export interface AppelNonFait {
  classe: string
  slotId: string
  subject: string
  start: string
  end: string
  teacherId: string
}

/**
 * Classes dont le créneau en cours n'a pas encore d'appel marqué aujourd'hui. Volontairement limité
 * au créneau *en cours* (pas un rattrapage de toute la journée) — c'est l'info actionnable "maintenant".
 */
export function getAppelsNonFaits(now: Date = new Date()): AppelNonFait[] {
  const markedSlotIds = new Set(getAppelsTodaySnapshot().map((a) => a.slotId))
  return getCurrentClassSlots(now)
    .filter((cs) => !markedSlotIds.has(cs.slot.id))
    .map((cs) => ({ classe: cs.classe, slotId: cs.slot.id, subject: cs.slot.subject, start: cs.slot.start, end: cs.slot.end, teacherId: cs.slot.teacherId }))
}

export interface ClasseLiveStatus {
  classe: string
  slot: CourseSlot | null
  appelFait: boolean
}

/**
 * Statut "maintenant" de chaque classe active : matière/prof en cours s'il y en a un, et si l'appel
 * a déjà été marqué pour ce créneau. Contrairement à getCurrentClassSlots (qui ne garde que les
 * classes ayant cours), celle-ci liste TOUTES les classes actives, y compris celles sans cours à
 * l'instant (`slot: null`) — vue d'ensemble "qui fait quoi", pas juste une liste d'exceptions.
 */
export function getClassesLiveStatus(now: Date = new Date()): ClasseLiveStatus[] {
  const weekday = getWeekdayName(now.toISOString().slice(0, 10))
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const markedSlotIds = new Set(getAppelsTodaySnapshot().map((a) => a.slotId))
  return getClassesSnapshot()
    .filter((c) => c.statut === 'Active')
    .map((c) => {
      const daySlots = weekday ? getClassScheduleSnapshot(c.nom)[weekday] ?? [] : []
      const slot = daySlots.find((s) => timeToMinutes(s.start) <= nowMin && nowMin < timeToMinutes(s.end)) ?? null
      return { classe: c.nom, slot, appelFait: slot ? markedSlotIds.has(slot.id) : false }
    })
    .sort((a, b) => a.classe.localeCompare(b.classe))
}

// ---------------------------------------------------------------------------
// Parents à appeler (absence, retard ou incident disciplinaire du jour)
// ---------------------------------------------------------------------------

export interface ParentToCall {
  studentId: string
  studentName: string
  classe: string
  reasons: string[]
  parent1Nom: string
  parent1Tel: string
  parent2Nom: string
  parent2Tel: string
}

/**
 * Un élève par ligne, tous ses événements du jour regroupés (une absence + un incident le même
 * jour ne donnent qu'un seul appel à passer, pas deux) — exclut les élèves déjà appelés aujourd'hui
 * (présents dans `appels_parents`). Contrairement à `buildRecentEvents` (fil d'actualité, retards
 * uniquement côté événements), les absences comptent ici aussi : toute absence mérite un appel.
 */
export function getParentsToCallToday(today: string): ParentToCall[] {
  const alreadyCalled = new Set(getAppelsParentsTodaySnapshot().map((a) => a.studentId))
  const rows: ParentToCall[] = []
  getStudentsSnapshot().forEach((s) => {
    if (alreadyCalled.has(s.id)) return
    const extra = getStudentExtraSnapshot(s.id)
    const reasons: string[] = []
    extra.events.forEach((e) => {
      if (!isWithinPeriod(e.date, today, today)) return
      reasons.push(e.type === 'ABSENCE' ? `Absence — ${e.subject}` : `Retard — ${e.subject}`)
    })
    extra.discipline.forEach((d) => {
      if (d.points >= 0) return
      if (!isWithinPeriod(d.date, today, today)) return
      reasons.push(`Incident — ${d.title}`)
    })
    if (reasons.length === 0) return
    const identity = getStudentIdentitySnapshot(s.id)
    rows.push({
      studentId: s.id,
      studentName: s.name,
      classe: s.classe,
      reasons,
      parent1Nom: identity.parent1Nom,
      parent1Tel: identity.parent1Tel,
      parent2Nom: identity.parent2Nom,
      parent2Tel: identity.parent2Tel,
    })
  })
  return rows
}

// ---------------------------------------------------------------------------
// Timeline de la journée (agrégée école)
// ---------------------------------------------------------------------------

export interface TimelineBlock {
  type: 'cours' | 'pause'
  start: string
  end: string
}

export interface TimelineMarker {
  label: string
  time: string
}

export interface DayTimeline {
  blocks: TimelineBlock[]
  markers: TimelineMarker[]
  fixedSlots: CreneauFixe[]
}

/**
 * Timeline synthétisée à partir des vrais horaires de cours (pas un planning par classe) : union des
 * créneaux de toutes les classes actives pour le jour, fusionnés en blocs "cours" contigus ; les
 * creux entre blocs deviennent des blocs "pause" (pas de vraie récré/cantine en base — synthèse
 * assumée). Marqueurs ponctuels séparés pour les horaires transport (config fixe, pas un bloc).
 * `fixedSlots` (récré/cantine/étude...) est une config récurrente distincte (services_capacite.creneaux_fixes),
 * indépendante des cours — toujours renvoyée, même les jours sans emploi du temps (weekend).
 */
export function buildDayTimeline(dateStr: string): DayTimeline {
  const capacite = getServicesCapaciteSnapshot()
  const weekday = getWeekdayName(dateStr)
  const markers: TimelineMarker[] = []
  if (capacite?.transportHeureMatin) markers.push({ label: 'Départ transport — matin', time: capacite.transportHeureMatin })
  if (capacite?.transportHeureSoirPrimaire) markers.push({ label: 'Retour transport — primaire', time: capacite.transportHeureSoirPrimaire })
  if (capacite?.transportHeureSoirCollege) markers.push({ label: 'Retour transport — collège', time: capacite.transportHeureSoirCollege })
  markers.sort((a, b) => (a.time < b.time ? -1 : 1))
  // Un créneau sans jours précisés s'applique tous les jours (comportement historique) ; sinon
  // uniquement aux jours cochés — ex. cantine décochée le vendredi (sortie à 12h, pas de service).
  const fixedSlots = (capacite?.creneauxFixes ?? []).filter((f) => !f.days?.length || (weekday !== null && f.days.includes(weekday)))

  if (!weekday) return { blocks: [], markers, fixedSlots }

  const rawPeriods: TimeInterval[] = []
  getClassesSnapshot()
    .filter((c) => c.statut === 'Active')
    .forEach((cls) => {
      ;(getClassScheduleSnapshot(cls.nom)[weekday] ?? []).forEach((s) => rawPeriods.push({ start: s.start, end: s.end }))
    })
  if (rawPeriods.length === 0) return { blocks: [], markers, fixedSlots }

  const coursBlocks = mergeIntervals(rawPeriods)
  const dayStart = coursBlocks[0].start
  const dayEnd = coursBlocks[coursBlocks.length - 1].end
  const pauseGaps = subtractCoveredIntervals(dayStart, dayEnd, coursBlocks)

  const blocks: TimelineBlock[] = [
    ...coursBlocks.map((b) => ({ ...b, type: 'cours' as const })),
    ...pauseGaps.map((g) => ({ ...g, type: 'pause' as const })),
  ].sort((a, b) => (a.start < b.start ? -1 : 1))

  return { blocks, markers, fixedSlots }
}

// ---------------------------------------------------------------------------
// Bandeau KPI + statut global
// ---------------------------------------------------------------------------

export interface CockpitKpis {
  presenceRate: number
  studentsPresent: number
  studentsExpected: number
  teachersAbsentToday: number
  replacementsCoveredToday: number
  replacementsTotalToday: number
  incidentsToday: number
}

/**
 * Taux de présence approximé par (effectif − élèves avec une absence saisie aujourd'hui) : il n'y a
 * pas de vrai registre de présence (pas d'appel obligatoire côté enseignant), donc ce chiffre reflète
 * les absences signalées, pas une présence constatée — décision assumée, pas liée à la feature appel.
 */
export function computeCockpitKpis(today: string): CockpitKpis {
  const students = getStudentsSnapshot()
  const studentsExpected = students.length
  const absentIds = new Set(
    students
      .filter((s) => getStudentExtraSnapshot(s.id).events.some((e) => e.type === 'ABSENCE' && isWithinPeriod(e.date, today, today)))
      .map((s) => s.id)
  )
  const studentsPresent = studentsExpected - absentIds.size
  const presenceRate = studentsExpected > 0 ? Math.round((studentsPresent / studentsExpected) * 100) : 100

  const absentTeacherIds = new Set<string>()
  getTeachersSnapshot().forEach((t) => {
    getTeacherExtraSnapshot(t.id).absences.forEach((a) => {
      if (a.type === 'ABSENCE' && isWithinPeriod(a.date, today, today)) absentTeacherIds.add(t.id)
    })
  })
  const uncoveredTeacherIds = new Set(getPendingReplacements().filter((p) => isWithinPeriod(p.date, today, today)).map((p) => p.teacher.id))

  const incidentsToday = students.reduce(
    (sum, s) => sum + getStudentExtraSnapshot(s.id).discipline.filter((d) => d.points < 0 && isWithinPeriod(d.date, today, today)).length,
    0
  )

  return {
    presenceRate,
    studentsPresent,
    studentsExpected,
    teachersAbsentToday: absentTeacherIds.size,
    replacementsCoveredToday: absentTeacherIds.size - uncoveredTeacherIds.size,
    replacementsTotalToday: absentTeacherIds.size,
    incidentsToday,
  }
}

export interface StudentAbsenceRow {
  studentId: string
  studentName: string
  classe: string
  types: ('ABSENCE' | 'RETARD')[]
}

/** Récapitulatif nominatif des élèves absents/en retard sur une période — une ligne par élève (pas
 * par événement : un élève absent sur plusieurs créneaux le même jour n'apparaît qu'une fois, avec
 * ses statuts combinés), trié par classe puis par nom. */
export function getAbsentStudentsDetail(periodStart: string, periodEnd: string): StudentAbsenceRow[] {
  const rows: StudentAbsenceRow[] = []
  getStudentsSnapshot().forEach((s) => {
    const types = new Set<'ABSENCE' | 'RETARD'>()
    getStudentExtraSnapshot(s.id).events.forEach((e) => {
      if (!isWithinPeriod(e.date, periodStart, periodEnd)) return
      types.add(e.type)
    })
    if (types.size === 0) return
    rows.push({ studentId: s.id, studentName: s.name, classe: s.classe, types: Array.from(types) })
  })
  return rows.sort((a, b) => a.classe.localeCompare(b.classe) || a.studentName.localeCompare(b.studentName))
}

export interface InfirmerieAccidentRow {
  studentId: string
  studentName: string
  classe: string
  date: string
  heure: string
  action: string
}

/** Passages à l'infirmerie pour accident/blessure sur une période — filtre sur le motif exact posé
 * par `NewInfirmerieVisitModal.tsx` ("Accident / Blessure dans l'établissement"), à l'exclusion des
 * autres motifs de visite (fièvre, maux de ventre...) qui ne sont pas des accidents. */
export function getInfirmerieAccidentsDetail(periodStart: string, periodEnd: string): InfirmerieAccidentRow[] {
  const result: InfirmerieAccidentRow[] = []
  getStudentsSnapshot().forEach((s) => {
    getStudentExtraSnapshot(s.id).sante.visits.forEach((v) => {
      if (v.motif !== "Accident / Blessure dans l'établissement") return
      if (!isWithinPeriod(v.date, periodStart, periodEnd)) return
      result.push({ studentId: s.id, studentName: s.name, classe: s.classe, date: v.date, heure: v.heure, action: v.action })
    })
  })
  return result.sort((a, b) => (a.date + a.heure < b.date + b.heure ? -1 : 1))
}

export interface CockpitStatus {
  level: 'ok' | 'attention'
  message: string
}

export function computeCockpitStatus(kpis: CockpitKpis): CockpitStatus {
  const uncovered = kpis.replacementsTotalToday - kpis.replacementsCoveredToday
  if (kpis.incidentsToday === 0 && uncovered === 0) {
    return { level: 'ok', message: 'Journée normale — aucun incident, 0 absence non remplacée.' }
  }
  const parts: string[] = []
  if (uncovered > 0) parts.push(`${uncovered} absence${uncovered > 1 ? 's' : ''} non remplacée${uncovered > 1 ? 's' : ''}`)
  if (kpis.incidentsToday > 0) parts.push(`${kpis.incidentsToday} incident${kpis.incidentsToday > 1 ? 's' : ''} du jour`)
  return { level: 'attention', message: `À traiter : ${parts.join(' · ')}.` }
}

// ---------------------------------------------------------------------------
// Incidents disciplinaires (déplacé depuis CockpitLive.tsx — source unique pour la page et les 2
// composants d'impression, qui en avaient chacun une copie locale structurellement identique).
// ---------------------------------------------------------------------------

export interface DisciplineIncident {
  studentId: string
  studentName: string
  classe: string
  date: string
  title: string
  description: string
  points: number
}

export function buildIncidents(periodStart: string, periodEnd: string): DisciplineIncident[] {
  const rows: DisciplineIncident[] = []
  getStudentsSnapshot().forEach((s) => {
    getStudentExtraSnapshot(s.id).discipline.forEach((d) => {
      if (d.points >= 0) return
      if (!isWithinPeriod(d.date, periodStart, periodEnd)) return
      rows.push({ studentId: s.id, studentName: s.name, classe: s.classe, date: d.date, title: d.title, description: d.description, points: d.points })
    })
  })
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1))
}

// ---------------------------------------------------------------------------
// Flux d'événements récents (infirmerie / retards / incidents)
// ---------------------------------------------------------------------------

export interface RecentEvent {
  kind: 'infirmerie' | 'retard' | 'incident' | 'rdv' | 'reclamation'
  studentName: string
  classe: string
  time?: string
  label: string
  detail: string
}

/**
 * Fusion best-effort : l'infirmerie et les rendez-vous ont une vraie heure (tri fiable), les
 * retards ont un `start` optionnel/peu renseigné, les incidents disciplinaires et les réclamations
 * n'ont aucune heure du tout. Les entrées avec heure se trient entre elles ; celles sans heure
 * restent groupées en fin de liste dans leur ordre d'insertion — la donnée ne permet pas une vraie
 * chronologie complète, pas la peine de la simuler.
 */
export function buildRecentEvents(today: string, limit = 20): RecentEvent[] {
  const rows: (RecentEvent & { index: number })[] = []
  let index = 0
  getStudentsSnapshot().forEach((s) => {
    const extra = getStudentExtraSnapshot(s.id)
    extra.sante.visits.forEach((v) => {
      if (!isWithinPeriod(v.date, today, today)) return
      rows.push({ kind: 'infirmerie', studentName: s.name, classe: s.classe, time: v.heure, label: v.motif, detail: v.action, index: index++ })
    })
    extra.events.forEach((e) => {
      if (e.type !== 'RETARD') return
      if (!isWithinPeriod(e.date, today, today)) return
      rows.push({ kind: 'retard', studentName: s.name, classe: s.classe, time: e.start, label: `Retard — ${e.subject}`, detail: e.motif, index: index++ })
    })
    extra.discipline.forEach((d) => {
      if (d.points >= 0) return
      if (!isWithinPeriod(d.date, today, today)) return
      rows.push({ kind: 'incident', studentName: s.name, classe: s.classe, label: d.title, detail: d.description, index: index++ })
    })
    extra.rendezVous.forEach((v) => {
      if (v.statut === 'Annulé') return
      if (!isWithinPeriod(v.date, today, today)) return
      rows.push({
        kind: 'rdv',
        studentName: s.name,
        classe: s.classe,
        time: v.heure,
        label: `RDV — ${v.motif}`,
        detail: `${v.mode} · ${v.lieu} · avec ${v.enseignant}`,
        index: index++,
      })
    })
    extra.reclamations.forEach((r) => {
      if (!isWithinPeriod(r.date, today, today)) return
      rows.push({ kind: 'reclamation', studentName: s.name, classe: s.classe, label: r.objet, detail: r.description, index: index++ })
    })
  })
  return rows
    .sort((a, b) => {
      if (a.time && b.time) return b.time < a.time ? -1 : 1
      if (a.time && !b.time) return -1
      if (!a.time && b.time) return 1
      return a.index - b.index
    })
    .slice(0, limit)
}
