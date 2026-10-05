import type { ReclamationRecord, StudentExtra } from '../data/studentDetails'
import { getStudentsSnapshot } from '../services/studentsService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { cycleOfClasse, type StudentAlert } from './alertEngine'
import { isHorsDelai, joursOuverts } from './reclamationsLogic'

export interface ReclamationRef {
  studentId: string
  studentName: string
  classe: string
  record: ReclamationRecord
}

/** Toutes les réclamations de l'année consultée, avec leur élève — lues depuis les instantanés. */
export function collectAllReclamations(): ReclamationRef[] {
  const out: ReclamationRef[] = []
  getStudentsSnapshot().forEach((s) => {
    getStudentExtraSnapshot(s.id).reclamations.forEach((record) => out.push({ studentId: s.id, studentName: s.name, classe: s.classe, record }))
  })
  return out
}

/** Élèves ayant au moins une réclamation non résolue au-delà de 72 h, les plus en retard d'abord — même
 * forme que les autres alertes élèves du Centre d'Alertes (`id` = élève, `value` = jours d'attente de
 * leur réclamation la plus ancienne). */
export function computeReclamationsHorsDelai(now: Date = new Date()): StudentAlert[] {
  const byStudent = new Map<string, StudentAlert>()
  collectAllReclamations().forEach(({ studentId, studentName, classe, record }) => {
    if (!isHorsDelai(record, now)) return
    const cycle = cycleOfClasse(classe)
    if (!cycle) return
    const jours = joursOuverts(record.date, now)
    const existing = byStudent.get(studentId)
    if (!existing || jours > existing.value) byStudent.set(studentId, { id: studentId, name: studentName, classe, cycle, value: jours, unit: ' j' })
  })
  return Array.from(byStudent.values()).sort((a, b) => b.value - a.value)
}

export function countReclamationsHorsDelai(now: Date = new Date()): number {
  return collectAllReclamations().filter(({ record }) => isHorsDelai(record, now)).length
}

/** Même compte, calculé depuis les données de la requête (et non des instantanés) : réagit au rendu même
 * quand l'instantané n'est pas encore rempli — pour le badge du menu. */
export function countHorsDelaiIn(students: { id: string }[], extras: Record<string, StudentExtra> | undefined, now: Date = new Date()): number {
  if (!extras) return 0
  return students.reduce((sum, s) => sum + (extras[s.id]?.reclamations ?? []).filter((r) => isHorsDelai(r, now)).length, 0)
}
