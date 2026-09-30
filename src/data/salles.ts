import type { SchoolClass } from './schoolStructure'
import { getClassesSnapshot } from '../services/classesService'

export interface Salle {
  id: string
  nom: string
  batiment: string
  capacite: number
  code?: string
}

export function fullLabel(s: Salle): string {
  return s.batiment === '—' ? s.nom : `${s.batiment} - ${s.nom}`
}

export interface SalleConflict {
  salleLabel: string
  classes: SchoolClass[]
}

export function detectSalleConflicts(): SalleConflict[] {
  const byLabel = new Map<string, SchoolClass[]>()
  getClassesSnapshot()
    .filter((c) => c.statut === 'Active')
    .forEach((c) => {
      byLabel.set(c.salle, [...(byLabel.get(c.salle) ?? []), c])
    })
  return Array.from(byLabel.entries())
    .filter(([, classes]) => classes.length > 1)
    .map(([salleLabel, classes]) => ({ salleLabel, classes }))
}
