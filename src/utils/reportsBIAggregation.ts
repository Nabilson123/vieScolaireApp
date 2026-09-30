import type { Student } from '../data/students'
import type { StudentExtra } from '../data/studentDetails'
import { computeClasseAbsencesSummary, computeClasseDisciplineSummary } from './adminReportAggregation'
import { computeClassesMoyenne } from './pedagogieDisciplineAggregation'
import { cycleOfClasse } from './alertEngine'
import { CYCLES } from '../data/referentiel'
import { getClassesSnapshot } from '../services/classesService'

export interface ClasseStatsRow {
  classe: string
  effectif: number
  tauxPresence: number
  absencesCount: number
  retardsCount: number
  heuresManquees: number
  moyenneGenerale: number | null
  incidents: number
  pointsSanction: number
  moyenneConduite: number
}

/** Croise absences/retards, discipline et moyennes par classe — une ligne par classe. */
export function computeClasseStatsRows(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  periodStart: string,
  periodEnd: string
): ClasseStatsRow[] {
  const absences = computeClasseAbsencesSummary(students, studentExtras, periodStart, periodEnd)
  const discipline = computeClasseDisciplineSummary(students, studentExtras, periodStart, periodEnd)
  const disciplineByClasse = new Map(discipline.map((d) => [d.classe, d]))
  const moyenneByClasse = new Map(computeClassesMoyenne().map((m) => [m.classe, m.moyenne]))

  return absences.map((a) => {
    const d = disciplineByClasse.get(a.classe)
    return {
      classe: a.classe,
      effectif: a.effectif,
      tauxPresence: a.tauxPresence,
      absencesCount: a.absencesCount,
      retardsCount: a.retardsCount,
      heuresManquees: a.heuresManquees,
      moyenneGenerale: moyenneByClasse.get(a.classe) ?? null,
      incidents: d?.incidents ?? 0,
      pointsSanction: d?.pointsSanction ?? 0,
      moyenneConduite: d?.moyenneConduite ?? 20,
    }
  })
}

export interface NiveauGroupComparison {
  niveau: string
  groupes: ClasseStatsRow[]
}

/**
 * Regroupe les classes (ex. "CE1-A", "CE1-B") par niveau (ex. "CE1") pour comparer les groupes
 * d'un même niveau entre eux. Seuls les niveaux ayant au moins 2 groupes actifs sont retenus —
 * comparer un niveau à section unique n'aurait pas de sens.
 */
export function computeNiveauGroupComparisons(rows: ClasseStatsRow[]): NiveauGroupComparison[] {
  const classeToNiveau = new Map(getClassesSnapshot().map((c) => [c.nom, c.niveau]))
  const byNiveau = new Map<string, ClasseStatsRow[]>()
  rows.forEach((row) => {
    const niveau = classeToNiveau.get(row.classe) ?? row.classe
    byNiveau.set(niveau, [...(byNiveau.get(niveau) ?? []), row])
  })
  return Array.from(byNiveau.entries())
    .map(([niveau, groupes]) => ({ niveau, groupes: groupes.sort((a, b) => a.classe.localeCompare(b.classe)) }))
    .filter((g) => g.groupes.length >= 2)
    .sort((a, b) => a.niveau.localeCompare(b.niveau))
}

export type OccupancyLevel = 'ok' | 'warn' | 'over'

/** Même seuil que ClassDetailModal.tsx (85%/100%) — réutilisé pour toute jauge d'occupation du Rapport BI. */
export function occupancyLevel(value: number, capacity: number): OccupancyLevel {
  if (capacity <= 0) return 'ok'
  const pct = (value / capacity) * 100
  if (pct >= 100) return 'over'
  if (pct >= 85) return 'warn'
  return 'ok'
}

export function occupancyPct(value: number, capacity: number): number {
  return capacity > 0 ? Math.min(100, Math.round((value / capacity) * 100)) : 0
}

/** Somme des places (capacite_max) des classes actives — pour le taux d'occupation des classes. */
export function computeClassesCapaciteTotale(): number {
  return getClassesSnapshot()
    .filter((c) => c.statut === 'Active')
    .reduce((sum, c) => sum + c.capaciteMax, 0)
}

export type ClasseStatsSortKey = keyof ClasseStatsRow

function cycleRank(classe: string): number {
  const idx = CYCLES.findIndex((c) => c.key === cycleOfClasse(classe))
  return idx === -1 ? CYCLES.length : idx
}

/**
 * "Moyenne générale" mélange /10 (primaire) et /20 (collège/lycée) selon la classe — un tri
 * numérique brut classerait par exemple 9.5/10 (excellent) sous 15/20 (moyen). On regroupe donc
 * d'abord par cycle (ordre stable, jamais inversé par `dir` pour ne pas faire sauter un cycle
 * au-dessus d'un autre), puis on trie par valeur à l'intérieur de chaque groupe.
 */
function sortByMoyenneGenerale(rows: ClasseStatsRow[], dir: 'asc' | 'desc'): ClasseStatsRow[] {
  return [...rows].sort((a, b) => {
    const rankDiff = cycleRank(a.classe) - cycleRank(b.classe)
    if (rankDiff !== 0) return rankDiff
    const av = a.moyenneGenerale
    const bv = b.moyenneGenerale
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return dir === 'asc' ? av - bv : bv - av
  })
}

export function sortClasseStatsRows(rows: ClasseStatsRow[], key: ClasseStatsSortKey, dir: 'asc' | 'desc'): ClasseStatsRow[] {
  if (key === 'moyenneGenerale') return sortByMoyenneGenerale(rows, dir)
  const sorted = [...rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv))
    return (av as number) - (bv as number)
  })
  return dir === 'asc' ? sorted : sorted.reverse()
}
