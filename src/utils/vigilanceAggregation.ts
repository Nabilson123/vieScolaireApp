import { parseDuration } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import { teacherName } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import { getTeacherExtraSnapshot } from '../services/teacherExtrasService'
import { computeTeacherStats, formatHeures } from './teacherAggregation'

export const VIGILANCE_THRESHOLD_HOURS = 10

export interface VigilanceRow {
  kind: 'eleve' | 'prof'
  id: string
  name: string
  classe: string
  heuresLabel: string
  hours: number
}

export function computeVigilanceRows(): VigilanceRow[] {
  const eleves: VigilanceRow[] = getStudentsSnapshot()
    .map((s) => ({ s, hours: parseDuration(s.totalHeures) / 60 }))
    .filter((r) => r.hours > VIGILANCE_THRESHOLD_HOURS)
    .map(({ s, hours }) => ({
      kind: 'eleve' as const,
      id: s.id,
      name: s.name,
      classe: s.classe,
      heuresLabel: s.totalHeures,
      hours,
    }))

  const profs: VigilanceRow[] = getTeachersSnapshot()
    .map((t) => {
      const extra = getTeacherExtraSnapshot(t.id)
      const stats = computeTeacherStats(extra.absences, extra.remplacements, '', '')
      return { t, hours: stats.heuresPerdues }
    })
    .filter((r) => r.hours > VIGILANCE_THRESHOLD_HOURS)
    .map(({ t, hours }) => ({
      kind: 'prof' as const,
      id: t.id,
      name: `Prof. ${teacherName(t)}`,
      classe: t.matieres.join(', ') || '—',
      heuresLabel: formatHeures(hours),
      hours,
    }))

  return [...eleves, ...profs].sort((a, b) => b.hours - a.hours)
}
