import { teacherName, type Teacher } from '../data/teachers'
import { normalizeText } from './textMatch'

const byName = (a: Teacher, b: Teacher) => teacherName(a).localeCompare(teacherName(b), 'fr')

/**
 * Recherche d'enseignants pour un menu de sélection : sans saisie, tous par ordre alphabétique ; avec une saisie, ceux dont
 * le nom ou une matière contient chacun des mots tapés (sans tenir compte des accents, de la casse ni de l'ordre des
 * mots). Les noms dont un mot commence par la saisie passent d'abord, puis l'ordre alphabétique.
 */
export function searchTeachers(teachers: Teacher[], query: string, opts: { limit?: number } = {}): Teacher[] {
  const { limit = 200 } = opts
  const tokens = normalizeText(query).split(' ').filter(Boolean)
  if (tokens.length === 0) return [...teachers].sort(byName).slice(0, limit)

  const matches = teachers.flatMap((teacher) => {
    const name = normalizeText(teacherName(teacher))
    const matieres = normalizeText(teacher.matieres.join(' '))
    if (!tokens.every((t) => name.includes(t) || matieres.includes(t))) return []
    const words = name.split(' ')
    return [{ teacher, rank: tokens.every((t) => words.some((w) => w.startsWith(t))) ? 0 : 1 }]
  })
  matches.sort((a, b) => a.rank - b.rank || byName(a.teacher, b.teacher))
  return matches.slice(0, limit).map((m) => m.teacher)
}
