import type { Student } from '../data/students'
import type { StudentIdentity } from '../data/studentIdentity'
import { getClassesSnapshot } from '../services/classesService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { NIVEAUX } from '../data/referentiel'
import { refectoireForNiveau, isEnrolled, type Refectoire } from './cantineAggregation'

/** Même critère que `getEnrolledStudents()` (`cantineAggregation.ts`) : un élève a la cantine s'il
 * porte le drapeau `identity.cantine`, OU s'il est inscrit via Garde Midi, OU s'il a une formule
 * Lunchbox choisie — pas le seul drapeau brut `identity.cantine`, sinon ces élèves disparaissent des
 * statistiques (Rapports BI) tout en apparaissant dans le Registre/la carte Cantine du Dashboard. */
function hasCantine(identity: StudentIdentity, studentId: string): boolean {
  return isEnrolled(getStudentExtraSnapshot(studentId).cantine, identity.cantine || identity.gardeMidi)
}

export interface ServicesGlobalCounts {
  transport: number
  cantine: number
  garde: number
  gardeMatin: number
  gardeApresMidi: number
}

export interface ServiceNiveauPoint {
  niveau: string
  transport: number
  cantine: number
  garde: number
  gardeMatin: number
  gardeApresMidi: number
}

/** « Garde périscolaire » = surveillance hors repas (avant/après la classe) — volontairement sans
 * Garde midi, qui est la surveillance PENDANT le repas de midi et donc déjà comptée dans Cantine
 * (via hasCantine ci-dessus, identity.cantine || identity.gardeMidi). Les inclure toutes les deux
 * ici ferait gonfler ce compte à chaque import Garde Repas (qui active Garde midi en masse) bien
 * au-delà de la vraie capacité de la garderie avant/après l'école (incident réel constaté). */
function hasGarde(identity: StudentIdentity): boolean {
  return identity.gardeMatin || identity.gardeApresMidi
}

export function computeServicesGlobalCounts(students: Student[], identities: Record<string, StudentIdentity>): ServicesGlobalCounts {
  let transport = 0
  let cantine = 0
  let garde = 0
  let gardeMatin = 0
  let gardeApresMidi = 0
  students.forEach((s) => {
    const identity = identities[s.id]
    if (!identity) return
    if (identity.transport) transport += 1
    if (hasCantine(identity, s.id)) cantine += 1
    if (hasGarde(identity)) garde += 1
    if (identity.gardeMatin) gardeMatin += 1
    if (identity.gardeApresMidi) gardeApresMidi += 1
  })
  return { transport, cantine, garde, gardeMatin, gardeApresMidi }
}

export function computeServicesParNiveau(students: Student[], identities: Record<string, StudentIdentity>): ServiceNiveauPoint[] {
  const classeToNiveau = new Map(getClassesSnapshot().map((c) => [c.nom, c.niveau]))
  const byNiveau = new Map<string, ServiceNiveauPoint>()
  students.forEach((s) => {
    const niveau = classeToNiveau.get(s.classe) ?? s.classe
    const identity = identities[s.id]
    const row = byNiveau.get(niveau) ?? { niveau, transport: 0, cantine: 0, garde: 0, gardeMatin: 0, gardeApresMidi: 0 }
    if (identity?.transport) row.transport += 1
    if (identity && hasCantine(identity, s.id)) row.cantine += 1
    if (identity && hasGarde(identity)) row.garde += 1
    if (identity?.gardeMatin) row.gardeMatin += 1
    if (identity?.gardeApresMidi) row.gardeApresMidi += 1
    byNiveau.set(niveau, row)
  })
  return NIVEAUX.filter((n) => byNiveau.has(n)).map((n) => byNiveau.get(n)!)
}

/** Réutilise les comptes déjà groupés par niveau plutôt que de reparcourir students/identities. */
export function computeCantineCountsByRefectoire(parNiveau: ServiceNiveauPoint[]): Record<Refectoire, number> {
  const result: Record<Refectoire, number> = { sousSol: 0, terrasse: 0 }
  parNiveau.forEach((p) => {
    result[refectoireForNiveau(p.niveau)] += p.cantine
  })
  return result
}

const NIVEAUX_PRESCOLAIRE = new Set(['PS', 'MS', 'GS'])

/** Sous-ensemble maternelle (PS/MS/GS) du Réfectoire Sous-Sol — qui sert aussi CE1/CE2 (voir
 * `computeCantineCountsByRefectoire`). Tuile distincte pour isoler la charge sur la partie
 * maternelle du réfectoire, avec sa propre capacité dédiée. */
export function computeCantinePrescolaireSousSol(parNiveau: ServiceNiveauPoint[]): number {
  return parNiveau.filter((p) => NIVEAUX_PRESCOLAIRE.has(p.niveau)).reduce((sum, p) => sum + p.cantine, 0)
}
