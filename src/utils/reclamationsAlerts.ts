import type { ReclamationRecord, StudentExtra } from '../data/studentDetails'
import { getStudentsSnapshot } from '../services/studentsService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { cycleOfClasse, type StudentAlert } from './alertEngine'
import { cleanReclamationText, isHorsDelai, joursOuverts } from './reclamationsLogic'

export interface ReclamationRef {
  studentId: string
  studentName: string
  classe: string
  record: ReclamationRecord
}

/** Toutes les réclamations de l'année consultée, avec leur élève — lues depuis les instantanés. */
export function collectAllReclamations(): ReclamationRef[] {
  const out: ReclamationRef[] = []
  getStudentsSnapshot().forEach((s) => {
    getStudentExtraSnapshot(s.id).reclamations.forEach((record) => out.push({ studentId: s.id, studentName: s.name, classe: s.classe, record }))
  })
  return out
}

/** Élèves ayant au moins une réclamation non résolue au-delà de 72 h, les plus en retard d'abord — même
 * forme que les autres alertes élèves du Centre d'Alertes (`id` = élève, `value` = jours d'attente de
 * leur réclamation la plus ancienne). */
export function computeReclamationsHorsDelai(now: Date = new Date()): StudentAlert[] {
  const byStudent = new Map<string, StudentAlert>()
  collectAllReclamations().forEach(({ studentId, studentName, classe, record }) => {
    if (!isHorsDelai(record, now)) return
    const cycle = cycleOfClasse(classe)
    if (!cycle) return
    const jours = joursOuverts(record.date, now)
    const existing = byStudent.get(studentId)
    if (!existing || jours > existing.value) byStudent.set(studentId, { id: studentId, name: studentName, classe, cycle, value: jours, unit: ' j' })
  })
  return Array.from(byStudent.values()).sort((a, b) => b.value - a.value)
}

export function countReclamationsHorsDelai(now: Date = new Date()): number {
  return collectAllReclamations().filter(({ record }) => isHorsDelai(record, now)).length
}

/** Même compte, calculé depuis les données de la requête (et non des instantanés) : réagit au rendu même
 * quand l'instantané n'est pas encore rempli — pour le badge du menu. */
export function countHorsDelaiIn(students: { id: string }[], extras: Record<string, StudentExtra> | undefined, now: Date = new Date()): number {
  if (!extras) return 0
  return students.reduce((sum, s) => sum + (extras[s.id]?.reclamations ?? []).filter((r) => isHorsDelai(r, now)).length, 0)
}

// --- Signaux de récurrence ---------------------------------------------------------------------------
// Seuils : choix raisonnables, pas des règles validées par la direction (même statut que la fenêtre de
// 30 jours des incidents disciplinaires). Ce sont des constantes pour pouvoir les ajuster à l'usage.
export const SIGNAL_RULES = {
  /** Même classe et même catégorie. */
  classeCategorie: { min: 3, jours: 14 },
  /** Même enseignant ou service cité (« Concernant »). */
  concerne: { min: 3, jours: 30 },
  /** Même élève : un parent qui revient. */
  eleve: { min: 2, jours: 30 },
} as const

export type SignalKind = 'classe_categorie' | 'concerne' | 'eleve'

export interface ReclamationSignal {
  kind: SignalKind
  /** Clé stable du signal (pour React et pour le filtre). */
  key: string
  label: string
  count: number
  /** Identifiants des réclamations concernées (`ReclamationRecord.id`). */
  ids: string[]
}

function pushGroup(map: Map<string, ReclamationRef[]>, key: string, ref: ReclamationRef) {
  const list = map.get(key)
  if (list) list.push(ref)
  else map.set(key, [ref])
}

/** Regroupements de réclamations récentes qui méritent l'attention de la direction — fonction pure. */
export function computeReclamationSignals(refs: ReclamationRef[], now: Date = new Date()): ReclamationSignal[] {
  const parClasseCategorie = new Map<string, ReclamationRef[]>()
  const parConcerne = new Map<string, ReclamationRef[]>()
  const parEleve = new Map<string, ReclamationRef[]>()
  refs.forEach((ref) => {
    const jours = joursOuverts(ref.record.date, now)
    if (jours <= SIGNAL_RULES.classeCategorie.jours) pushGroup(parClasseCategorie, `${ref.classe}|${ref.record.type}`, ref)
    const concerne = ref.record.enseignant.trim()
    if (concerne && jours <= SIGNAL_RULES.concerne.jours) pushGroup(parConcerne, concerne, ref)
    if (jours <= SIGNAL_RULES.eleve.jours) pushGroup(parEleve, ref.studentId, ref)
  })

  const signals: ReclamationSignal[] = []
  const plural = (n: number) => (n > 1 ? 's' : '')
  parClasseCategorie.forEach((list, key) => {
    if (list.length < SIGNAL_RULES.classeCategorie.min) return
    const [classe, type] = key.split('|')
    signals.push({
      kind: 'classe_categorie',
      key: `cc:${key}`,
      label: `${list.length} réclamation${plural(list.length)} « ${type} » en ${classe} sur ${SIGNAL_RULES.classeCategorie.jours} jours`,
      count: list.length,
      ids: list.map((r) => r.record.id),
    })
  })
  parConcerne.forEach((list, nom) => {
    if (list.length < SIGNAL_RULES.concerne.min) return
    signals.push({
      kind: 'concerne',
      key: `co:${nom}`,
      label: `${nom} cité(e) dans ${list.length} réclamation${plural(list.length)} sur ${SIGNAL_RULES.concerne.jours} jours`,
      count: list.length,
      ids: list.map((r) => r.record.id),
    })
  })
  parEleve.forEach((list) => {
    if (list.length < SIGNAL_RULES.eleve.min) return
    signals.push({
      kind: 'eleve',
      key: `el:${list[0].studentId}`,
      label: `${list[0].studentName} (${list[0].classe}) : ${list.length} réclamations sur ${SIGNAL_RULES.eleve.jours} jours`,
      count: list.length,
      ids: list.map((r) => r.record.id),
    })
  })
  return signals.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export interface CockpitReclamations {
  ouvertes: number
  horsDelai: number
  /** Les plus anciennes réclamations non résolues. */
  anciennes: { id: string; studentName: string; classe: string; objet: string; jours: number }[]
  signaux: ReclamationSignal[]
}

/** Résumé pour le Cockpit live (lu depuis les instantanés, comme les autres cartes). */
export function computeCockpitReclamations(now: Date = new Date()): CockpitReclamations {
  const refs = collectAllReclamations()
  const ouvertes = refs.filter((r) => r.record.statut !== 'Résolue')
  return {
    ouvertes: ouvertes.length,
    horsDelai: ouvertes.filter((r) => isHorsDelai(r.record, now)).length,
    anciennes: ouvertes
      .map((r) => ({ id: r.record.id, studentName: r.studentName, classe: r.classe, objet: cleanReclamationText(r.record.objet), jours: joursOuverts(r.record.date, now) }))
      .sort((a, b) => b.jours - a.jours)
      .slice(0, 4),
    signaux: computeReclamationSignals(refs, now),
  }
}
