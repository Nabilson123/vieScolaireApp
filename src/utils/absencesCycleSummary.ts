import { getStudentsSnapshot } from '../services/studentsService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { getClassesSnapshot } from '../services/classesService'
import { CYCLES, cycleOfNiveau } from '../data/referentiel'

export interface CycleClasseRow {
  classe: string
  effectif: number
  absences: number
  retards: number
  tauxPresence: number
}

export interface CycleSummaryRow {
  key: string
  label: string
  effectif: number
  absences: number
  retards: number
  tauxPresence: number
  classes: CycleClasseRow[]
}

function tauxOf(effectif: number, absences: number): number {
  return effectif === 0 ? 100 : Math.max(0, Math.round((1 - absences / effectif) * 1000) / 10)
}

/** Résumé journalier des absences/retards de toute l'école, groupé par cycle puis par classe. */
export function buildCycleSummaries(date: string): CycleSummaryRow[] {
  const students = getStudentsSnapshot()
  const classes = getClassesSnapshot().filter((c) => c.statut === 'Active')

  const classRows = classes.map((c) => {
    const classStudents = students.filter((s) => s.classe === c.nom)
    let absences = 0
    let retards = 0
    classStudents.forEach((s) => {
      const events = getStudentExtraSnapshot(s.id).events.filter((e) => e.date === date)
      if (events.some((e) => e.type === 'ABSENCE')) absences += 1
      if (events.some((e) => e.type === 'RETARD')) retards += 1
    })
    const effectif = classStudents.length
    return {
      classe: c.nom,
      cycleKey: cycleOfNiveau(c.niveau)?.key ?? 'autre',
      row: { classe: c.nom, effectif, absences, retards, tauxPresence: tauxOf(effectif, absences) } as CycleClasseRow,
    }
  })

  return CYCLES.map((cycle) => {
    const classes = classRows
      .filter((r) => r.cycleKey === cycle.key)
      .sort((a, b) => a.classe.localeCompare(b.classe))
      .map((r) => r.row)
    const effectif = classes.reduce((s, r) => s + r.effectif, 0)
    const absences = classes.reduce((s, r) => s + r.absences, 0)
    const retards = classes.reduce((s, r) => s + r.retards, 0)
    return {
      key: cycle.key,
      label: cycle.label,
      effectif,
      absences,
      retards,
      tauxPresence: tauxOf(effectif, absences),
      classes,
    }
  }).filter((c) => c.classes.length > 0)
}
