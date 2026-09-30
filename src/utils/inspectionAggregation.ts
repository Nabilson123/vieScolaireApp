import type { Teacher } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import type { InspectionRecord } from '../data/inspections'
import { getInspectionsSnapshot } from '../services/inspectionsService'
import { parseAnyDate } from './period'

export function getInspectionsForTeacher(teacherId: string): InspectionRecord[] {
  return getInspectionsSnapshot()
    .filter((r) => r.teacherId === teacherId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getLatestInspection(teacherId: string): InspectionRecord | undefined {
  return getInspectionsForTeacher(teacherId)[0]
}

export function getPreviousInspection(record: InspectionRecord): InspectionRecord | undefined {
  return getInspectionsForTeacher(record.teacherId).filter((r) => r.id !== record.id && r.date < record.date)[0]
}

export interface TeamStats {
  total: number
  ppCount: number
  excellenceCount: number
  moyenne: number
}

export function computeTeamStats(): TeamStats {
  const list = getInspectionsSnapshot()
  const total = list.length
  const ppCount = list.filter((r) => r.isPP).length
  const excellenceCount = list.filter((r) => r.noteGlobale >= 16).length
  const moyenne = total > 0 ? list.reduce((sum, r) => sum + r.noteGlobale, 0) / total : 0
  return { total, ppCount, excellenceCount, moyenne }
}

export function getTeachersStaleInspected(months: number): Teacher[] {
  const now = new Date()
  const thresholdMs = months * 30 * 24 * 60 * 60 * 1000
  return getTeachersSnapshot().filter((t) => {
    const latest = getLatestInspection(t.id)
    if (!latest) return true
    const d = parseAnyDate(latest.date)
    if (!d) return true
    return now.getTime() - d.getTime() > thresholdMs
  })
}

export interface HeatmapRow {
  teacher: Teacher
  clarte: number | null
  tenue: number | null
  innovation: number | null
  note: number | null
}

export function buildHeatmapRows(): HeatmapRow[] {
  return getTeachersSnapshot().map((t) => {
    const latest = getLatestInspection(t.id)
    return {
      teacher: t,
      clarte: latest?.criteresBase.clarte ?? null,
      tenue: latest?.criteresBase.tenue ?? null,
      innovation: latest?.criteresBase.innovation ?? null,
      note: latest?.noteGlobale ?? null,
    }
  })
}

export interface RadarPoint {
  critere: string
  valeur: number
  max: number
}

export function buildRadarData(record: InspectionRecord): RadarPoint[] {
  const points: RadarPoint[] = [
    { critere: 'Clarté', valeur: record.criteresBase.clarte, max: 5 },
    { critere: 'Tenue de classe', valeur: record.criteresBase.tenue, max: 5 },
    { critere: 'Innovation', valeur: record.criteresBase.innovation, max: 5 },
  ]
  if (record.criteresPP) {
    points.push(
      { critere: 'Suivi & Orientation', valeur: record.criteresPP.suivi, max: 5 },
      { critere: 'Relation Familles', valeur: record.criteresPP.relation, max: 5 },
      { critere: 'Conseil & Projets', valeur: record.criteresPP.conseil, max: 5 }
    )
  }
  if (record.criteresMaternelle) {
    points.push(
      { critere: 'Éveil & Motricité', valeur: record.criteresMaternelle.eveil, max: 5 },
      { critere: 'Autonomie & Hygiène', valeur: record.criteresMaternelle.autonomie, max: 5 },
      { critere: 'Relation Bienveillante', valeur: record.criteresMaternelle.relationBienveillante, max: 5 }
    )
  }
  if (record.feedbackParents !== undefined) {
    points.push({ critere: 'Feedback Élèves/Parents', valeur: record.feedbackParents, max: 5 })
  }
  return points
}

export function getTeachersBelowThreshold(threshold: number): { teacher: Teacher; note: number }[] {
  return getTeachersSnapshot()
    .map((t) => ({ teacher: t, latest: getLatestInspection(t.id) }))
    .filter((x): x is { teacher: Teacher; latest: InspectionRecord } => !!x.latest && x.latest.noteGlobale < threshold)
    .map((x) => ({ teacher: x.teacher, note: x.latest.noteGlobale }))
    .sort((a, b) => a.note - b.note)
}

export interface EvolutionPoint {
  date: string
  note: number
}

export function buildEvolutionData(teacherId: string): EvolutionPoint[] {
  return getInspectionsForTeacher(teacherId)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => ({ date: r.date, note: r.noteGlobale }))
}

export interface EtablissementMoyenneBase {
  clarte: number
  tenue: number
  innovation: number
  count: number
}

export function computeEtablissementMoyenneBase(): EtablissementMoyenneBase {
  const latestRecords = getTeachersSnapshot().map((t) => getLatestInspection(t.id)).filter((r): r is InspectionRecord => !!r)
  const count = latestRecords.length
  if (count === 0) return { clarte: 0, tenue: 0, innovation: 0, count: 0 }
  return {
    clarte: latestRecords.reduce((s, r) => s + r.criteresBase.clarte, 0) / count,
    tenue: latestRecords.reduce((s, r) => s + r.criteresBase.tenue, 0) / count,
    innovation: latestRecords.reduce((s, r) => s + r.criteresBase.innovation, 0) / count,
    count,
  }
}

export interface RadarComparisonPoint {
  critere: string
  prof: number
  etablissement: number
  max: number
}

export function buildRadarComparisonData(record: InspectionRecord): RadarComparisonPoint[] {
  const moyenne = computeEtablissementMoyenneBase()
  return [
    { critere: 'Clarté', prof: record.criteresBase.clarte, etablissement: Number(moyenne.clarte.toFixed(1)), max: 5 },
    { critere: 'Tenue de classe', prof: record.criteresBase.tenue, etablissement: Number(moyenne.tenue.toFixed(1)), max: 5 },
    { critere: 'Innovation', prof: record.criteresBase.innovation, etablissement: Number(moyenne.innovation.toFixed(1)), max: 5 },
  ]
}

export interface PendingObjective {
  teacher: Teacher
  inspection: InspectionRecord
  objectif: string
  echeance: string
  isLate: boolean
}

export function getAllPendingObjectives(): PendingObjective[] {
  const today = new Date().toISOString().slice(0, 10)
  const items: PendingObjective[] = []
  getInspectionsSnapshot().forEach((record) => {
    const teacher = getTeachersSnapshot().find((t) => t.id === record.teacherId)
    if (!teacher) return
    record.planProgres
      .filter((p) => p.statut === 'En cours')
      .forEach((p) => {
        items.push({ teacher, inspection: record, objectif: p.objectif, echeance: p.echeance, isLate: p.echeance < today })
      })
  })
  return items.sort((a, b) => (a.echeance < b.echeance ? -1 : 1))
}
