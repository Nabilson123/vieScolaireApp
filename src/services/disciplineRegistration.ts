import { computeConduite } from '../data/disciplineTypes'
import type { DisciplinePayload } from '../utils/disciplineIncident'
import { getStudentExtraSnapshot, updateStudentConduite, updateStudentDiscipline } from './studentDetailsService'

/**
 * Écrit les fiches disciplinaires saisies, une par élève (nouvelle fiche en tête du dossier) et recalcule la note de
 * conduite de chacun. Un seul point d'écriture pour l'écran Discipline et le Cockpit, pour qu'aucun champ ne soit perdu.
 * Les élèves sont traités l'un après l'autre : le dossier de chacun est relu juste avant son écriture.
 */
export async function saveDisciplineEntries(payloads: DisciplinePayload[]): Promise<void> {
  for (const { studentId, ...entry } of payloads) {
    const extra = getStudentExtraSnapshot(studentId)
    const nextDiscipline = [entry, ...extra.discipline]
    await updateStudentDiscipline(studentId, nextDiscipline)
    await updateStudentConduite(studentId, computeConduite(nextDiscipline.map((d) => d.points)))
  }
}
