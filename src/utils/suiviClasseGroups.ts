import type { SchoolClass } from '../data/schoolStructure'
import { NIVEAUX, cycleOfNiveau } from '../data/referentiel'
import type { Teacher } from '../data/teachers'
import { suggestBestWeeklySlot, type SuggestedWeeklySlot } from './suiviProfsAggregation'

export interface NiveauDivision {
  classe: SchoolClass
  pp?: Teacher
}

export interface LogicalGroup {
  key: string
  label: string
  niveauxBruts: string[]
  divisions: NiveauDivision[]
  teachers: Teacher[]
  allHavePP: boolean
  suggestion: SuggestedWeeklySlot | null
  color: string
}

const LEVEL_PALETTE = ['#9333ea', '#059669', '#0284c7', '#e11d48', '#d97706', '#4f46e5', '#0891b2']

/** Regroupement logique des niveaux pour le suivi de classe : chaque niveau Primaire (ses divisions
 * A/B réunies) forme un groupe, tout le Collège (1APIC+2APIC+3APIC) fusionne en un seul groupe
 * "1-3APIC", et la Maternelle est exclue (pas de notation chiffrée, pas concernée par ce suivi). */
export function computeLogicalGroups(classes: SchoolClass[], allTeachers: Teacher[]): LogicalGroup[] {
  const activeClasses = classes.filter((c) => c.statut === 'Active' && cycleOfNiveau(c.niveau)?.key !== 'maternelle')
  const primaireNiveaux = Array.from(new Set(activeClasses.filter((c) => cycleOfNiveau(c.niveau)?.key === 'primaire').map((c) => c.niveau))).sort(
    (a, b) => NIVEAUX.indexOf(a) - NIVEAUX.indexOf(b)
  )
  const collegeClasses = activeClasses.filter((c) => cycleOfNiveau(c.niveau)?.key === 'college')

  const buildGroup = (key: string, niveauxBruts: string[], groupClasses: SchoolClass[], color: string): LogicalGroup => {
    const divisions: NiveauDivision[] = groupClasses
      .slice()
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .map((c) => ({ classe: c, pp: c.professeurPrincipalId ? allTeachers.find((t) => t.id === c.professeurPrincipalId) : undefined }))
    const allHavePP = divisions.every((d) => !!d.pp)
    const teacherIds = Array.from(new Set(divisions.map((d) => d.pp?.id).filter((id): id is string => !!id)))
    const teachers = allTeachers.filter((t) => teacherIds.includes(t.id))
    const suggestion = allHavePP && teachers.length > 0 ? suggestBestWeeklySlot(teachers, 30) : null
    return { key, label: key, niveauxBruts, divisions, teachers, allHavePP, suggestion, color }
  }

  return [
    ...primaireNiveaux.map((n, i) => buildGroup(n, [n], activeClasses.filter((c) => c.niveau === n), LEVEL_PALETTE[i % LEVEL_PALETTE.length])),
    ...(collegeClasses.length > 0 ? [buildGroup('1-3APIC', ['1APIC', '2APIC', '3APIC'], collegeClasses, LEVEL_PALETTE[primaireNiveaux.length % LEVEL_PALETTE.length])] : []),
  ]
}
