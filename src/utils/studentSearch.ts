import type { Student } from '../data/students'
import { normalizeText } from './textMatch'

const byName = (a: Student, b: Student) => a.name.localeCompare(b.name, 'fr')

/**
 * Recherche d'élèves pour un menu de sélection : sans saisie, les élèves de la classe de référence (ou tous) par ordre
 * alphabétique ; avec une saisie, tous les élèves dont le nom ou la classe contient chacun des mots tapés (sans tenir
 * compte des accents, de la casse ni de l'ordre des mots). Les noms dont les mots commencent par la saisie passent
 * d'abord, puis ceux de la classe de référence, puis l'ordre alphabétique.
 */
export function searchStudents(students: Student[], query: string, opts: { preferredClasse?: string; limit?: number } = {}): Student[] {
  const { preferredClasse, limit = 60 } = opts
  const tokens = normalizeText(query).split(' ').filter(Boolean)

  if (tokens.length === 0) {
    const pool = preferredClasse ? students.filter((s) => s.classe === preferredClasse) : students
    return [...pool].sort(byName).slice(0, limit)
  }

  const matches = students.flatMap((student) => {
    const name = normalizeText(student.name)
    const classe = normalizeText(student.classe)
    if (!tokens.every((t) => name.includes(t) || classe.includes(t))) return []
    const words = name.split(' ')
    const startsWithQuery = tokens.every((t) => words.some((w) => w.startsWith(t)))
    return [{ student, rank: startsWithQuery ? 0 : 1, otherClasse: preferredClasse && student.classe === preferredClasse ? 0 : 1 }]
  })
  matches.sort((a, b) => a.rank - b.rank || a.otherClasse - b.otherClasse || byName(a.student, b.student))
  return matches.slice(0, limit).map((m) => m.student)
}
