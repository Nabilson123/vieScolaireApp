import type { AnneeScolaire } from '../data/anneesScolaires'
import type { MultiYearStudentRow, MultiYearClasseRow } from '../services/multiYearStatsService'

export interface AnneeEffectifPoint {
  anneeId: string
  label: string
  effectif: number
  nbClasses: number
  pctGarcons: number
  pctFilles: number
}

/** "2025/2026" -> "25/26" pour l'affichage compact sur l'axe X — ne modifie pas le libellé stocké. */
export function shortAnneeLabel(libelle: string): string {
  const m = libelle.match(/^(\d{4})\/(\d{4})$/)
  return m ? `${m[1].slice(2)}/${m[2].slice(2)}` : libelle
}

export function computeEffectifParAnnee(
  annees: AnneeScolaire[],
  students: MultiYearStudentRow[],
  classes: MultiYearClasseRow[]
): AnneeEffectifPoint[] {
  return [...annees]
    .sort((a, b) => a.anneeDebut - b.anneeDebut)
    .map((a) => {
      const anneeStudents = students.filter((s) => s.anneeScolaireId === a.id)
      const garcons = anneeStudents.filter((s) => s.sexe === 'M').length
      const filles = anneeStudents.filter((s) => s.sexe === 'F').length
      const total = garcons + filles
      return {
        anneeId: a.id,
        label: shortAnneeLabel(a.libelle),
        effectif: anneeStudents.length,
        nbClasses: classes.filter((c) => c.anneeScolaireId === a.id && c.statut === 'Active').length,
        pctGarcons: total > 0 ? Math.round((garcons / total) * 1000) / 10 : 0,
        pctFilles: total > 0 ? Math.round((filles / total) * 1000) / 10 : 0,
      }
    })
}
