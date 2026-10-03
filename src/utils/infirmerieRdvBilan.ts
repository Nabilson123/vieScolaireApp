import type { Student } from '../data/students'
import type { StudentExtra, RendezVousRecord } from '../data/studentDetails'
import { isWithinPeriod } from './period'

export interface CountRow {
  label: string
  value: number
}

function sortedCounts(counts: Map<string, number>): CountRow[] {
  return Array.from(counts, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

/** Regroupe les motifs saisis en texte libre sans tenir compte de la casse ni des espaces autour
 * (« Mal de tête » et « mal de tête  » comptent ensemble) ; garde la première écriture rencontrée,
 * avec majuscule initiale. */
function groupMotifs(motifs: string[]): CountRow[] {
  const byKey = new Map<string, { label: string; value: number }>()
  motifs.forEach((raw) => {
    const trimmed = raw.trim()
    const label = trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : 'Non précisé'
    const key = label.toLowerCase()
    const existing = byKey.get(key)
    if (existing) existing.value += 1
    else byKey.set(key, { label, value: 1 })
  })
  return Array.from(byKey.values()).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

/** Au-delà de `max` lignes, le reste est regroupé en « Autres motifs » pour que le rapport reste
 * lisible même quand les motifs saisis à la main sont très variés. */
function topWithOthers(rows: CountRow[], max: number): CountRow[] {
  if (rows.length <= max) return rows
  const head = rows.slice(0, max)
  const rest = rows.slice(max).reduce((s, r) => s + r.value, 0)
  return [...head, { label: 'Autres motifs', value: rest }]
}

export interface InfirmerieBilan {
  passages: number
  eleves: number
  parClasse: CountRow[]
  parMotif: CountRow[]
}

/** Passages à l'infirmerie sur la période : volumes, répartition par classe et par motif — jamais de
 * noms d'élèves (données de santé, le rapport circule). */
export function computeInfirmerieBilan(students: Student[], studentExtras: Record<string, StudentExtra>, periodStart: string, periodEnd: string): InfirmerieBilan {
  let passages = 0
  const eleves = new Set<string>()
  const parClasse = new Map<string, number>()
  const motifs: string[] = []
  students.forEach((s) => {
    const visits = (studentExtras[s.id]?.sante.visits ?? []).filter((v) => isWithinPeriod(v.date, periodStart, periodEnd))
    if (visits.length === 0) return
    passages += visits.length
    eleves.add(s.id)
    parClasse.set(s.classe, (parClasse.get(s.classe) ?? 0) + visits.length)
    visits.forEach((v) => motifs.push(v.motif))
  })
  return { passages, eleves: eleves.size, parClasse: sortedCounts(parClasse), parMotif: topWithOthers(groupMotifs(motifs), 8) }
}

export interface RdvBilanRow {
  date: string
  heure: string
  studentName: string
  classe: string
  enseignants: string[]
  motif: string
  statut: RendezVousRecord['statut']
}

export interface RdvBilan {
  total: number
  planifies: number
  realises: number
  annules: number
  comptesRendus: number
  enAttenteSignature: number
  /** Répartition hors rendez-vous annulés, qui n'ont pas eu lieu. */
  parMotif: CountRow[]
  parClasse: CountRow[]
  rows: RdvBilanRow[]
}

/** Rendez-vous avec les parents sur la période : statuts, comptes-rendus, répartition par motif et par
 * classe, et liste détaillée (la plus récente d'abord). */
export function computeRdvBilan(students: Student[], studentExtras: Record<string, StudentExtra>, periodStart: string, periodEnd: string): RdvBilan {
  const rows: RdvBilanRow[] = []
  let comptesRendus = 0
  let enAttenteSignature = 0
  students.forEach((s) => {
    ;(studentExtras[s.id]?.rendezVous ?? []).forEach((r) => {
      if (!isWithinPeriod(r.date, periodStart, periodEnd)) return
      rows.push({ date: r.date, heure: r.heure, studentName: s.name, classe: s.classe, enseignants: r.enseignants, motif: r.motif, statut: r.statut })
      if (r.compteRendu) {
        comptesRendus += 1
        if (!r.compteRendu.signeParent) enAttenteSignature += 1
      }
    })
  })
  rows.sort((a, b) => (a.date + a.heure < b.date + b.heure ? 1 : -1))
  const tenus = rows.filter((r) => r.statut !== 'Annulé')
  const parClasse = new Map<string, number>()
  tenus.forEach((r) => parClasse.set(r.classe, (parClasse.get(r.classe) ?? 0) + 1))
  return {
    total: rows.length,
    planifies: rows.filter((r) => r.statut === 'Planifié').length,
    realises: rows.filter((r) => r.statut === 'Réalisé').length,
    annules: rows.filter((r) => r.statut === 'Annulé').length,
    comptesRendus,
    enAttenteSignature,
    parMotif: topWithOthers(groupMotifs(tenus.map((r) => r.motif)), 8),
    parClasse: sortedCounts(parClasse),
    rows,
  }
}
