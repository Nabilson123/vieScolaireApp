import type { AlertRules } from '../data/alertRules'
import {
  niveauFromClasse,
  computeStudentsBelowMoyenne,
  computeStudentsBelowPresence,
  computeStudentsAboveRetards,
  computeStudentsWithRecentDiscipline,
  type StudentAlert,
} from './alertEngine'
import { getStudentsSnapshot } from '../services/studentsService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'

export interface RiskStudent {
  id: string
  name: string
  classe: string
  reasons: string[]
}

function reasonFor(alert: StudentAlert, label: string): string {
  return `${label} : ${alert.value}${alert.unit.startsWith('/') ? alert.unit : ' ' + alert.unit}`
}

/** Combine les 4 signaux réels de risque pédagogique/assiduité/discipline pour les élèves d'un
 * niveau logique donné (ex. "CE1") — l'appelant résout au préalable un niveau logique fusionné (ex.
 * "1-3APIC") vers la liste de niveaux bruts réels (1APIC, 2APIC, 3APIC) via `niveauxBruts`. Un élève
 * touché par plusieurs signaux à la fois apparaît une seule fois, avec toutes ses raisons. */
export function computeAtRiskStudentsForNiveaux(niveauxBruts: string[], rules: AlertRules): RiskStudent[] {
  const inScope = (classe: string) => niveauxBruts.includes(niveauFromClasse(classe))
  const byId = new Map<string, RiskStudent>()

  const add = (alert: StudentAlert, label: string) => {
    if (!inScope(alert.classe)) return
    const existing = byId.get(alert.id)
    const reason = reasonFor(alert, label)
    if (existing) existing.reasons.push(reason)
    else byId.set(alert.id, { id: alert.id, name: alert.name, classe: alert.classe, reasons: [reason] })
  }

  computeStudentsBelowMoyenne(rules).forEach((a) => add(a, 'Moyenne basse'))
  computeStudentsBelowPresence(rules).forEach((a) => add(a, 'Présence basse'))
  computeStudentsAboveRetards(rules).forEach((a) => add(a, 'Retards cumulés'))
  computeStudentsWithRecentDiscipline().forEach((a) => add(a, 'Discipline récente'))

  return Array.from(byId.values()).sort((a, b) => b.reasons.length - a.reasons.length || a.name.localeCompare(b.name))
}

export interface OpenReclamation {
  studentId: string
  studentName: string
  classe: string
  objet: string
  type: string
  date: string
  statut: 'En cours' | 'En attente' | 'Résolue'
  /** Position dans le tableau `reclamations` de CET élève (pas un index global) — seule clé stable
   * pour réécrire cette entrée précise via `markReclamationTraitee`, `ReclamationRecord` n'ayant pas
   * d'id propre. */
  indexInStudent: number
}

/** Réclamations parents encore ouvertes (pas "Résolue") pour les élèves d'un niveau logique — ce
 * suivi hebdomadaire est aussi l'occasion d'aborder les réclamations en cours avec le PP, pas
 * seulement les signaux de risque pédagogique/assiduité/discipline. */
export function computeOpenReclamationsForNiveaux(niveauxBruts: string[]): OpenReclamation[] {
  const inScope = (classe: string) => niveauxBruts.includes(niveauFromClasse(classe))
  const rows: OpenReclamation[] = []
  getStudentsSnapshot().forEach((s) => {
    if (!inScope(s.classe)) return
    getStudentExtraSnapshot(s.id).reclamations.forEach((r, idx) => {
      if (r.statut === 'Résolue') return
      rows.push({ studentId: s.id, studentName: s.name, classe: s.classe, objet: r.objet, type: r.type, date: r.date, statut: r.statut, indexInStudent: idx })
    })
  })
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** Toutes les réclamations (ouvertes + résolues) des élèves d'un niveau logique, y compris celles
 * déjà traitées — utilisé par la réunion de suivi de classe pour garder visible, dans le
 * compte-rendu, une réclamation qu'on vient de marquer "Traitée" pendant la réunion elle-même,
 * plutôt que de la faire disparaître du tableau sans laisser de trace de son traitement. */
export function computeAllReclamationsForNiveaux(niveauxBruts: string[]): OpenReclamation[] {
  const inScope = (classe: string) => niveauxBruts.includes(niveauFromClasse(classe))
  const rows: OpenReclamation[] = []
  getStudentsSnapshot().forEach((s) => {
    if (!inScope(s.classe)) return
    getStudentExtraSnapshot(s.id).reclamations.forEach((r, idx) => {
      rows.push({ studentId: s.id, studentName: s.name, classe: s.classe, objet: r.objet, type: r.type, date: r.date, statut: r.statut, indexInStudent: idx })
    })
  })
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1))
}
