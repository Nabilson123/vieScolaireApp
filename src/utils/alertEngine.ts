import { parseDuration } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import { getTeachersSnapshot } from '../services/teachersService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { getTeacherExtraSnapshot } from '../services/teacherExtrasService'
import { getIncidentsSnapshot } from '../services/helpdeskService'
import { getPendingReplacements } from './replacementAggregation'
import { cycleOfNiveau, moyenneScale } from '../data/referentiel'
import { computeMoyenneGenerale } from './studentAggregation'
import type { AlertRules, CycleKey } from '../data/alertRules'
import { CYCLE_KEYS } from '../data/alertRules'

export function niveauFromClasse(classe: string): string {
  return classe.replace(/-[A-Z]$/, '')
}

export function cycleOfClasse(classe: string): CycleKey | undefined {
  const cycle = cycleOfNiveau(niveauFromClasse(classe))
  return cycle?.key as CycleKey | undefined
}

export function moyenneScaleForClasse(classe: string): number | null {
  const cycle = cycleOfClasse(classe)
  return cycle ? moyenneScale(cycle) : null
}

export interface StudentAlert {
  id: string
  name: string
  classe: string
  cycle: CycleKey
  value: number
  unit: string
}

export interface CycleMetric {
  cycle: CycleKey
  value: number
  seuil: number
  alert: boolean
}

function emptyByCycle(): Record<CycleKey, number> {
  return { maternelle: 0, primaire: 0, college: 0, lycee: 0 }
}

// ---------- Pédagogique ----------

export function computeStudentMoyenne(studentId: string): number | null {
  return computeMoyenneGenerale(getStudentExtraSnapshot(studentId).notes)
}

export function computeStudentsBelowMoyenne(rules: AlertRules): StudentAlert[] {
  return getStudentsSnapshot()
    .map((s) => {
      const cycle = cycleOfClasse(s.classe)
      if (!cycle) return null
      const moyenne = computeStudentMoyenne(s.id)
      if (moyenne === null || moyenne >= rules[cycle].seuilMoyennePedagogique) return null
      return { id: s.id, name: s.name, classe: s.classe, cycle, value: moyenne, unit: `/${moyenneScale(cycle) ?? 20}` }
    })
    .filter((x): x is StudentAlert => x !== null)
    .sort((a, b) => a.value - b.value)
}

// ---------- Présence ----------

export function computeStudentsBelowPresence(rules: AlertRules): StudentAlert[] {
  return getStudentsSnapshot()
    .map((s) => {
      const cycle = cycleOfClasse(s.classe)
      if (!cycle || s.taux >= rules[cycle].seuilTauxPresence) return null
      return { id: s.id, name: s.name, classe: s.classe, cycle, value: s.taux, unit: '%' }
    })
    .filter((x): x is StudentAlert => x !== null)
    .sort((a, b) => a.value - b.value)
}

// ---------- Retards ----------

export function computeStudentsAboveRetards(rules: AlertRules): StudentAlert[] {
  return getStudentsSnapshot()
    .map((s) => {
      const cycle = cycleOfClasse(s.classe)
      if (!cycle) return null
      const minutes = parseDuration(s.retardsMin)
      if (minutes <= rules[cycle].seuilRetardsCumulesMin) return null
      return { id: s.id, name: s.name, classe: s.classe, cycle, value: minutes, unit: 'min' }
    })
    .filter((x): x is StudentAlert => x !== null)
    .sort((a, b) => b.value - a.value)
}

// ---------- Discipline récente (par élève) ----------

/** Élèves ayant au moins un incident disciplinaire à points négatifs dans les `windowDays` derniers
 * jours — contrairement à `computeDisciplinePointsByCycle` (cumul mensuel par cycle, pas par élève)
 * et `computeElevesSousAlerteConduite` (score `conduite` stocké, pas un événement récent), sert à
 * repérer un signal individuel et récent, pas une moyenne. Aucun seuil configuré pour ça dans
 * `AlertRules` — fenêtre glissante en jours, passée en paramètre. */
export function computeStudentsWithRecentDiscipline(windowDays = 30, referenceDate: Date = new Date()): StudentAlert[] {
  const cutoff = new Date(referenceDate)
  cutoff.setDate(cutoff.getDate() - windowDays)
  const cutoffIso = cutoff.toISOString().slice(0, 10)
  return getStudentsSnapshot()
    .map((s) => {
      const cycle = cycleOfClasse(s.classe)
      if (!cycle) return null
      const count = getStudentExtraSnapshot(s.id).discipline.filter((d) => d.points < 0 && d.date >= cutoffIso).length
      if (count === 0) return null
      return { id: s.id, name: s.name, classe: s.classe, cycle, value: count, unit: 'incident(s)' }
    })
    .filter((x): x is StudentAlert => x !== null)
    .sort((a, b) => b.value - a.value)
}

// ---------- Climat scolaire (points disciplinaires retirés, cumul mensuel) ----------

export function computeDisciplinePointsByCycle(rules: AlertRules, referenceDate: Date = new Date()): CycleMetric[] {
  const ym = referenceDate.toISOString().slice(0, 7)
  const totals = emptyByCycle()
  getStudentsSnapshot().forEach((s) => {
    const cycle = cycleOfClasse(s.classe)
    if (!cycle) return
    getStudentExtraSnapshot(s.id).discipline.forEach((d) => {
      if (d.date.startsWith(ym) && d.points < 0) totals[cycle] += Math.abs(d.points)
    })
  })
  return CYCLE_KEYS.map((cycle) => ({
    cycle,
    value: totals[cycle],
    seuil: rules[cycle].seuilPointsClimatScolaire,
    alert: totals[cycle] > rules[cycle].seuilPointsClimatScolaire,
  }))
}

// ---------- Alertes PAI ----------

export function computePAIAlertsByCycle(rules: AlertRules): CycleMetric[] {
  const counts = emptyByCycle()
  getStudentsSnapshot().forEach((s) => {
    const cycle = cycleOfClasse(s.classe)
    if (!cycle) return
    if (getStudentExtraSnapshot(s.id).cantine.alertePAI) counts[cycle] += 1
  })
  return CYCLE_KEYS.map((cycle) => ({
    cycle,
    value: counts[cycle],
    seuil: rules[cycle].seuilAlertesPAI,
    alert: counts[cycle] > rules[cycle].seuilAlertesPAI,
  }))
}

// ---------- Incidents Helpdesk non résolus ----------
// Le lieu d'un incident est un texte libre (ex: « Salle 12 (3APIC-A) ») : on tente d'y retrouver
// un nom de classe entre parenthèses pour en déduire le cycle. Sans classe identifiable, l'incident
// n'est rattaché à aucun cycle (lieux communs type sanitaires, salle des profs...).
function cycleFromLieu(lieu: string): CycleKey | undefined {
  const match = /\(([^)]+)\)/.exec(lieu)
  if (!match) return undefined
  return cycleOfClasse(match[1].trim())
}

export function computeOpenIncidentsByCycle(rules: AlertRules): CycleMetric[] {
  const counts = emptyByCycle()
  getIncidentsSnapshot().forEach((inc) => {
    if (inc.statut === 'RESOLU') return
    const cycle = cycleFromLieu(inc.lieu)
    if (!cycle) return
    counts[cycle] += 1
  })
  return CYCLE_KEYS.map((cycle) => ({
    cycle,
    value: counts[cycle],
    seuil: rules[cycle].seuilIncidentsHelpdesk,
    alert: counts[cycle] > rules[cycle].seuilIncidentsHelpdesk,
  }))
}

// ---------- Taux de remplacement (absences profs couvertes ce mois-ci) ----------

export function computeTauxRemplacementByCycle(rules: AlertRules, referenceDate: Date = new Date()): CycleMetric[] {
  const ym = referenceDate.toISOString().slice(0, 7)
  const totalAbsences = emptyByCycle()
  const uncovered = emptyByCycle()

  getTeachersSnapshot().forEach((t) => {
    getTeacherExtraSnapshot(t.id).absences.forEach((a) => {
      if (a.type !== 'ABSENCE' || !a.date.startsWith(ym)) return
      const cycle = cycleOfClasse(a.classe)
      if (!cycle) return
      totalAbsences[cycle] += 1
    })
  })

  getPendingReplacements()
    .filter((p) => p.date.startsWith(ym))
    .forEach((p) => {
      const cycle = cycleOfClasse(p.classe)
      if (!cycle) return
      uncovered[cycle] += 1
    })

  return CYCLE_KEYS.map((cycle) => {
    const total = totalAbsences[cycle]
    const taux = total === 0 ? 100 : Math.round(((total - uncovered[cycle]) / total) * 100)
    return { cycle, value: taux, seuil: rules[cycle].seuilTauxRemplacement, alert: taux < rules[cycle].seuilTauxRemplacement }
  })
}

// ---------- Agrégateur global ----------

export interface AlertsSummary {
  moyenne: StudentAlert[]
  presence: StudentAlert[]
  retards: StudentAlert[]
  climat: CycleMetric[]
  pai: CycleMetric[]
  helpdesk: CycleMetric[]
  remplacement: CycleMetric[]
  total: number
}

export function computeActiveAlertsSummary(rules: AlertRules): AlertsSummary {
  const moyenne = computeStudentsBelowMoyenne(rules)
  const presence = computeStudentsBelowPresence(rules)
  const retards = computeStudentsAboveRetards(rules)
  const climat = computeDisciplinePointsByCycle(rules)
  const pai = computePAIAlertsByCycle(rules)
  const helpdesk = computeOpenIncidentsByCycle(rules)
  const remplacement = computeTauxRemplacementByCycle(rules)
  const total =
    moyenne.length +
    presence.length +
    retards.length +
    climat.filter((c) => c.alert).length +
    pai.filter((c) => c.alert).length +
    helpdesk.filter((c) => c.alert).length +
    remplacement.filter((c) => c.alert).length
  return { moyenne, presence, retards, climat, pai, helpdesk, remplacement, total }
}

export interface CycleMoyenne {
  cycle: CycleKey
  scale: number
  value: number | null
}

/**
 * Moyenne générale par cycle, jamais mélangée entre /10 (primaire) et /20 (collège/lycée) — un
 * seul chiffre "école entière" n'aurait pas de sens si les échelles diffèrent.
 */
export function computeSchoolMoyenneGeneraleByCycle(): CycleMoyenne[] {
  const values = emptyByCycleArray()
  const studentCounts: Record<CycleKey, number> = { maternelle: 0, primaire: 0, college: 0, lycee: 0 }
  getStudentsSnapshot().forEach((s) => {
    const cycle = cycleOfClasse(s.classe)
    if (!cycle) return
    studentCounts[cycle] += 1
    const moyenne = computeStudentMoyenne(s.id)
    if (moyenne === null) return
    values[cycle].push(moyenne)
  })
  // On affiche une carte par cycle noté dès qu'il a des élèves inscrits, même sans note saisie
  // (valeur '—'), plutôt que de la faire disparaître silencieusement — un cycle réel sans notes
  // encore saisies (ex. primaire) doit rester visible, contrairement à un cycle qui n'existe pas
  // du tout dans l'établissement (ex. lycée, 0 niveau configuré).
  return CYCLE_KEYS.map((cycle) => {
    const scale = moyenneScale(cycle)
    const list = values[cycle]
    return { cycle, scale: scale ?? 20, value: list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null }
  }).filter((cm) => moyenneScale(cm.cycle) !== null && studentCounts[cm.cycle] > 0)
}

function emptyByCycleArray(): Record<CycleKey, number[]> {
  return { maternelle: [], primaire: [], college: [], lycee: [] }
}
