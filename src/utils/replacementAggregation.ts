import { teacherName, type Teacher } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import type { RemplacementRecord, TeacherAbsenceRecord } from '../data/teacherExtras'
import { getTeacherExtraSnapshot } from '../services/teacherExtrasService'
import { getClassesSnapshot } from '../services/classesService'
import { NIVEAUX } from '../data/referentiel'
import { getClassScheduleSnapshot, findSlotOwner } from '../services/classSchedulesService'
import { computeTeacherSchedule } from './teacherAggregation'
import { parseAnyDate } from './period'

const WEEKDAY_NAMES = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']

export function getWeekdayName(dateStr: string): string | null {
  const d = parseAnyDate(dateStr)
  if (!d) return null
  return WEEKDAY_NAMES[d.getDay()]
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export interface TimeInterval {
  start: string
  end: string
}

/** Fusionne les intervalles qui se chevauchent ou se touchent, triés chronologiquement. */
export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  return intervals
    .map((c) => ({ start: timeToMinutes(c.start), end: timeToMinutes(c.end) }))
    .sort((a, b) => a.start - b.start)
    .reduce<{ start: number; end: number }[]>((acc, c) => {
      const last = acc[acc.length - 1]
      if (last && c.start <= last.end) {
        last.end = Math.max(last.end, c.end)
      } else {
        acc.push({ ...c })
      }
      return acc
    }, [])
    .map((iv) => ({ start: minutesToTime(iv.start), end: minutesToTime(iv.end) }))
}

/**
 * Retire les intervalles `covered` de l'intervalle [`fullStart`, `fullEnd`] et renvoie les segments
 * restants non couverts, triés chronologiquement. Utilisé pour savoir quelle portion d'une séance
 * reste à affecter quand elle a été divisée entre plusieurs remplaçants.
 */
export function subtractCoveredIntervals(fullStart: string, fullEnd: string, covered: TimeInterval[]): TimeInterval[] {
  const merged = mergeIntervals(covered).map((iv) => ({ start: timeToMinutes(iv.start), end: timeToMinutes(iv.end) }))

  const gaps: TimeInterval[] = []
  let cursor = timeToMinutes(fullStart)
  const end = timeToMinutes(fullEnd)
  for (const c of merged) {
    if (c.start > cursor) gaps.push({ start: minutesToTime(cursor), end: minutesToTime(Math.min(c.start, end)) })
    cursor = Math.max(cursor, c.end)
    if (cursor >= end) break
  }
  if (cursor < end) gaps.push({ start: minutesToTime(cursor), end: minutesToTime(end) })
  return gaps.filter((g) => timeToMinutes(g.end) > timeToMinutes(g.start))
}

export function intervalHours(interval: TimeInterval): number {
  return Math.round(((timeToMinutes(interval.end) - timeToMinutes(interval.start)) / 60) * 100) / 100
}

export interface PendingReplacement {
  teacher: Teacher
  absenceIndex: number
  date: string
  weekday: string
  classe: string
  subject: string
  start: string
  end: string
  hours: number
  motif: string
}

/**
 * Intervalles déjà couverts par un remplaçant pour cette absence. Un remplacement enregistré avant
 * l'ajout du créneau exact (pas de `start`/`end`) est traité comme couvrant toute la séance, pour
 * rester compatible avec l'historique existant.
 */
function getCoveredIntervals(absentTeacherName: string, date: string, classe: string, fullSlot: TimeInterval): TimeInterval[] {
  const covered: TimeInterval[] = []
  getTeachersSnapshot().forEach((t) => {
    getTeacherExtraSnapshot(t.id).remplacements.forEach((r) => {
      if (r.profRemplace !== absentTeacherName || r.date !== date || r.classe !== classe) return
      covered.push(r.start && r.end ? { start: r.start, end: r.end } : fullSlot)
    })
  })
  return covered
}

interface ScheduleSlot {
  subject: string
  start: string
  end: string
  hours: number
}

/** Retrouve le créneau (matière/horaire) que couvrait `teacherId` au moment de `absence`. */
function resolveAbsenceSlot(teacherId: string, absence: TeacherAbsenceRecord, weekday: string): ScheduleSlot | undefined {
  if (absence.slotId) {
    const owner = findSlotOwner(absence.slotId)
    if (owner && owner.slot.teacherId === teacherId) return owner.slot
  }
  // Repli si le slotId est périmé (emploi du temps modifié depuis la déclaration de l'absence) : un
  // prof peut enseigner plusieurs matières à la même classe le même jour (ex. Maths ET Éveil
  // Scientifique), donc le premier créneau trouvé n'est pas forcément le bon — désambiguïser par la
  // durée la plus proche de celle enregistrée sur l'absence, sinon deux absences distinctes du même
  // jour se résolvent silencieusement sur le même créneau (doublon dans les remplacements en attente).
  const daySchedule = getClassScheduleSnapshot(absence.classe)[weekday] ?? []
  const candidates = daySchedule.filter((s) => s.teacherId === teacherId)
  if (candidates.length <= 1) return candidates[0]
  return candidates.reduce((best, s) => (Math.abs(s.hours - absence.duree) < Math.abs(best.hours - absence.duree) ? s : best))
}

/**
 * Un enseignant qui a signalé une absence ce jour-là n'est pas disponible comme remplaçant, même sur
 * un créneau en dehors de ses propres cours (il n'est simplement pas à l'école ce jour-là).
 */
function isTeacherAbsentOnDate(teacherId: string, date: string): boolean {
  return getTeacherExtraSnapshot(teacherId).absences.some((a) => a.type === 'ABSENCE' && a.date === date)
}

export function getPendingReplacements(): PendingReplacement[] {
  const pending: PendingReplacement[] = []
  getTeachersSnapshot().forEach((teacher) => {
    const extra = getTeacherExtraSnapshot(teacher.id)
    extra.absences.forEach((absence, idx) => {
      if (absence.type !== 'ABSENCE') return
      const weekday = getWeekdayName(absence.date)
      if (!weekday) return

      const matchedSlot = resolveAbsenceSlot(teacher.id, absence, weekday)
      if (!matchedSlot) return

      const fullSlot = { start: matchedSlot.start, end: matchedSlot.end }
      const covered = getCoveredIntervals(teacherName(teacher), absence.date, absence.classe, fullSlot)
      const gaps = subtractCoveredIntervals(fullSlot.start, fullSlot.end, covered)
      const ignoredGaps = absence.ignoredGaps ?? []

      gaps.forEach((gap) => {
        if (ignoredGaps.some((ig) => ig.start === gap.start && ig.end === gap.end)) return
        pending.push({
          teacher,
          absenceIndex: idx,
          date: absence.date,
          weekday,
          classe: absence.classe,
          subject: matchedSlot.subject,
          start: gap.start,
          end: gap.end,
          hours: intervalHours(gap),
          motif: absence.motif,
        })
      })
    })
  })
  return pending.sort((a, b) => (a.date < b.date ? -1 : 1))
}

/**
 * Créneaux explicitement écartés de la liste d'attente (via "Supprimer") — même forme que
 * `getPendingReplacements()`, pour un écran de restauration ("Remettre en attente"). Contrairement
 * aux gaps réels, ceux-ci ne sont pas recalculés depuis les remplacements couverts : ils reflètent
 * simplement `absence.ignoredGaps` tel qu'enregistré.
 */
export function getIgnoredGaps(): PendingReplacement[] {
  const ignored: PendingReplacement[] = []
  getTeachersSnapshot().forEach((teacher) => {
    const extra = getTeacherExtraSnapshot(teacher.id)
    extra.absences.forEach((absence, idx) => {
      if (absence.type !== 'ABSENCE' || !absence.ignoredGaps?.length) return
      const weekday = getWeekdayName(absence.date)
      if (!weekday) return
      const matchedSlot = resolveAbsenceSlot(teacher.id, absence, weekday)
      if (!matchedSlot) return
      absence.ignoredGaps.forEach((gap) => {
        ignored.push({
          teacher,
          absenceIndex: idx,
          date: absence.date,
          weekday,
          classe: absence.classe,
          subject: matchedSlot.subject,
          start: gap.start,
          end: gap.end,
          hours: intervalHours(gap),
          motif: absence.motif,
        })
      })
    })
  })
  return ignored.sort((a, b) => (a.date < b.date ? -1 : 1))
}

export interface TeacherAbsenceDetail {
  teacher: Teacher
  date: string
  classe: string
  subject: string
  start: string
  end: string
  hours: number
  motif: string
  /** Noms des profs ayant couvert au moins une partie de ce créneau — vide si aucun remplacement enregistré. */
  remplacants: string[]
}

/**
 * Chaque absence prof réelle (pas seulement les créneaux encore non couverts, contrairement à
 * getPendingReplacements) avec la matière/l'horaire réel et le(s) remplaçant(s) éventuel(s) —
 * pour un rapport qui doit montrer TOUT ce qui s'est passé, pas seulement ce qui reste à traiter.
 */
export function getAllTeacherAbsenceDetails(): TeacherAbsenceDetail[] {
  const result: TeacherAbsenceDetail[] = []
  getTeachersSnapshot().forEach((teacher) => {
    getTeacherExtraSnapshot(teacher.id).absences.forEach((absence) => {
      if (absence.type !== 'ABSENCE') return
      const weekday = getWeekdayName(absence.date)
      if (!weekday) return
      // Un prof peut être signalé absent un jour où il n'a aucun cours (ex. jour hors emploi du
      // temps personnel) — matchedSlot reste alors undefined : on garde quand même l'entrée (ce
      // rapport doit montrer TOUT ce qui s'est passé), avec matière/horaire vides et 0h, plutôt que
      // de la faire disparaître silencieusement.
      const matchedSlot = resolveAbsenceSlot(teacher.id, absence, weekday)

      const remplacants = new Set<string>()
      if (matchedSlot) {
        getTeachersSnapshot().forEach((t) => {
          getTeacherExtraSnapshot(t.id).remplacements.forEach((r) => {
            if (r.profRemplace === teacherName(teacher) && r.date === absence.date && r.classe === absence.classe) {
              remplacants.add(teacherName(t))
            }
          })
        })
      }

      result.push({
        teacher,
        date: absence.date,
        classe: absence.classe,
        subject: matchedSlot?.subject ?? '',
        start: matchedSlot?.start ?? '',
        end: matchedSlot?.end ?? '',
        hours: matchedSlot?.hours ?? absence.duree,
        motif: absence.motif,
        remplacants: Array.from(remplacants),
      })
    })
  })
  return result.sort((a, b) => (a.date < b.date ? -1 : 1))
}

export interface SubstituteSuggestion {
  teacher: Teacher
  score: number
  sameSubject: boolean
  enseigneCetteClasse: boolean
  remplacementsCeMois: number
}

export function suggestSubstitutes(pending: PendingReplacement): SubstituteSuggestion[] {
  const candidates = getTeachersSnapshot().filter((t) => t.id !== pending.teacher.id)
  const suggestions: SubstituteSuggestion[] = []

  candidates.forEach((t) => {
    const schedule = computeTeacherSchedule(t)
    const daySlots = schedule[pending.weekday] ?? []
    const busy = daySlots.some(
      (s) => timeToMinutes(s.start) < timeToMinutes(pending.end) && timeToMinutes(pending.start) < timeToMinutes(s.end)
    )
    if (busy) return
    if (isTeacherAbsentOnDate(t.id, pending.date)) return

    const sameSubject = t.matieres.includes(pending.subject)
    const enseigneCetteClasse = t.classes.includes(pending.classe)

    const pendingMonth = pending.date.slice(0, 7)
    const remplacementsCeMois = getTeacherExtraSnapshot(t.id).remplacements.filter((r) => r.date.slice(0, 7) === pendingMonth).length

    let score = 10
    if (sameSubject) score += 40
    if (enseigneCetteClasse) score += 20
    if (t.type === 'Remplaçant') score += 30
    score -= remplacementsCeMois * 5

    suggestions.push({ teacher: t, score, sameSubject, enseigneCetteClasse, remplacementsCeMois })
  })

  return suggestions.sort((a, b) => b.score - a.score)
}

export interface FlatRemplacement extends RemplacementRecord {
  remplacantId: string
  remplacantName: string
  sourceIndex: number
}

export function getAllRemplacementsFlat(): FlatRemplacement[] {
  const rows: FlatRemplacement[] = []
  getTeachersSnapshot().forEach((t) => {
    getTeacherExtraSnapshot(t.id).remplacements.forEach((r, idx) => {
      rows.push({ ...r, remplacantId: t.id, remplacantName: teacherName(t), sourceIndex: idx })
    })
  })
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export interface EquiteRow {
  teacher: Teacher
  count: number
  heures: number
}

export function computeEquiteStats(historique: FlatRemplacement[]): EquiteRow[] {
  const map = new Map<string, EquiteRow>()
  historique.forEach((r) => {
    let row = map.get(r.remplacantId)
    if (!row) {
      const teacher = getTeachersSnapshot().find((t) => t.id === r.remplacantId)
      if (!teacher) return
      row = { teacher, count: 0, heures: 0 }
      map.set(r.remplacantId, row)
    }
    row.count += 1
    row.heures += r.heures
  })
  return Array.from(map.values()).sort((a, b) => b.heures - a.heures)
}

export interface MatiereForClasseRow {
  matiere: string
  count: number
  profsAbsents: string[]
  remplacants: string[]
  heures: number
}

export interface ClasseGroupBreakdown {
  classe: string
  matieres: MatiereForClasseRow[]
}

/** Vue fusionnée pour le PDF : les matières regroupées sous chaque classe. */
export function computeClasseMatiereBreakdown(historique: FlatRemplacement[]): ClasseGroupBreakdown[] {
  const classeMap: Record<string, Record<string, MatiereForClasseRow>> = {}
  historique.forEach((r) => {
    if (!classeMap[r.classe]) classeMap[r.classe] = {}
    const matiereMap = classeMap[r.classe]
    if (!matiereMap[r.matiere]) matiereMap[r.matiere] = { matiere: r.matiere, count: 0, profsAbsents: [], remplacants: [], heures: 0 }
    const row = matiereMap[r.matiere]
    row.count += 1
    row.heures += r.heures
    if (!row.profsAbsents.includes(r.profRemplace)) row.profsAbsents.push(r.profRemplace)
    if (!row.remplacants.includes(r.remplacantName)) row.remplacants.push(r.remplacantName)
  })
  return Object.keys(classeMap)
    .sort((a, b) => a.localeCompare(b))
    .map((classe) => ({
      classe,
      matieres: Object.values(classeMap[classe]).sort((a, b) => a.matiere.localeCompare(b.matiere)),
    }))
}

export interface RemplacementGlobalStats {
  totalRemplacements: number
  totalHeures: number
  profsMobilises: number
  profsAbsentsCouverts: number
}

export function computeRemplacementGlobalStats(historique: FlatRemplacement[]): RemplacementGlobalStats {
  return {
    totalRemplacements: historique.length,
    totalHeures: historique.reduce((sum, r) => sum + r.heures, 0),
    profsMobilises: new Set(historique.map((r) => r.remplacantId)).size,
    profsAbsentsCouverts: new Set(historique.map((r) => r.profRemplace)).size,
  }
}

export interface MatiereBreakdownRow {
  matiere: string
  count: number
  heures: number
  profsAbsents: string[]
  niveaux: string[]
}

export function computeMatiereBreakdown(historique: FlatRemplacement[]): MatiereBreakdownRow[] {
  const classeToNiveau = new Map(getClassesSnapshot().map((c) => [c.nom, c.niveau]))
  const map: Record<string, MatiereBreakdownRow> = {}
  historique.forEach((r) => {
    if (!map[r.matiere]) map[r.matiere] = { matiere: r.matiere, count: 0, heures: 0, profsAbsents: [], niveaux: [] }
    const row = map[r.matiere]
    row.count += 1
    row.heures += r.heures
    if (!row.profsAbsents.includes(r.profRemplace)) row.profsAbsents.push(r.profRemplace)
    const niveau = classeToNiveau.get(r.classe) ?? r.classe
    if (!row.niveaux.includes(niveau)) row.niveaux.push(niveau)
  })
  return Object.values(map).sort((a, b) => b.count - a.count)
}

export interface ClasseBreakdownRow {
  classe: string
  niveau: string
  count: number
  heures: number
}

export function computeClasseBreakdown(historique: FlatRemplacement[]): ClasseBreakdownRow[] {
  const classeToNiveau = new Map(getClassesSnapshot().map((c) => [c.nom, c.niveau]))
  const map: Record<string, ClasseBreakdownRow> = {}
  historique.forEach((r) => {
    if (!map[r.classe]) map[r.classe] = { classe: r.classe, niveau: classeToNiveau.get(r.classe) ?? r.classe, count: 0, heures: 0 }
    map[r.classe].count += 1
    map[r.classe].heures += r.heures
  })
  return Object.values(map).sort((a, b) => b.count - a.count)
}

interface ClasseRef {
  nom: string
  niveau: string
  statut: string
}

/** Version pure de computeClasseBreakdownAllClasses (sans lire le cache des classes) : toutes les
 * classes actives, y compris celles à 0h, dans l'ordre pédagogique réel PS-A → 3APIC (rang du niveau
 * via NIVEAUX, puis nom). Une classe qui n'apparaît que dans l'historique (archivée depuis) est
 * rangée au bon endroit grâce à son niveau déduit du nom. */
export function buildClasseBreakdownAllClasses(classes: ClasseRef[], historique: FlatRemplacement[]): ClasseBreakdownRow[] {
  const rang = (niveau: string) => {
    const i = NIVEAUX.indexOf(niveau)
    return i === -1 ? NIVEAUX.length : i
  }
  const map: Record<string, ClasseBreakdownRow> = {}
  classes
    .filter((c) => c.statut === 'Active')
    .forEach((c) => {
      map[c.nom] = { classe: c.nom, niveau: c.niveau, count: 0, heures: 0 }
    })
  historique.forEach((r) => {
    if (!map[r.classe]) map[r.classe] = { classe: r.classe, niveau: r.classe.replace(/-[A-Z]$/, ''), count: 0, heures: 0 }
    map[r.classe].count += 1
    map[r.classe].heures += r.heures
  })
  return Object.values(map).sort((a, b) => rang(a.niveau) - rang(b.niveau) || a.classe.localeCompare(b.classe))
}

/** Variante de computeClasseBreakdown qui n'omet jamais une classe : le rapport imprimé doit
 * montrer tout l'effectif de classes, y compris celles à 0h de remplacement, dans l'ordre PS-A →
 * 3APIC (computeClasseBreakdown lui-même reste inchangé — toujours utilisé tel quel par le graphe
 * écran, qui n'a pas cette exigence). */
export function computeClasseBreakdownAllClasses(historique: FlatRemplacement[]): ClasseBreakdownRow[] {
  return buildClasseBreakdownAllClasses(getClassesSnapshot(), historique)
}

export interface OccupancyCell {
  status: 'libre' | 'occupe'
  subject?: string
  classe?: string
}

export interface OccupancyRow {
  teacher: Teacher
  cells: OccupancyCell[]
}

export interface DayOccupancy {
  weekday: string | null
  periods: { start: string; end: string }[]
  rows: OccupancyRow[]
}

export function buildDayOccupancy(dateStr: string): DayOccupancy {
  const weekday = getWeekdayName(dateStr)
  if (!weekday) return { weekday, periods: [], rows: [] }

  const periodsMap = new Map<string, { start: string; end: string }>()
  getClassesSnapshot().forEach((cls) => {
    ;(getClassScheduleSnapshot(cls.nom)[weekday] ?? []).forEach((s) => periodsMap.set(`${s.start}-${s.end}`, { start: s.start, end: s.end }))
  })
  const periods = Array.from(periodsMap.values()).sort((a, b) => (a.start < b.start ? -1 : 1))
  if (periods.length === 0) return { weekday, periods: [], rows: [] }

  const rows: OccupancyRow[] = getTeachersSnapshot().map((t) => {
    const schedule = computeTeacherSchedule(t)
    const slots = schedule[weekday] ?? []
    const cells: OccupancyCell[] = periods.map((p) => {
      const match = slots.find((s) => s.start === p.start && s.end === p.end)
      if (match) return { status: 'occupe' as const, subject: match.subject, classe: match.classe }
      return { status: 'libre' as const }
    })
    return { teacher: t, cells }
  })

  return { weekday, periods, rows }
}
