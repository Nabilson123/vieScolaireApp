import type { Student } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import type { CantineInfo, FluxRow } from '../data/studentDetails'
import { getStudentExtraSnapshot, updateStudentCantine } from '../services/studentDetailsService'
import { getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { isWithinPeriod } from './period'
import { niveauFromClasse } from './alertEngine'

/** L'école a deux réfectoires physiques distincts avec des publics différents (pas alignés sur les
 * cycles de `data/referentiel.ts` — le primaire y est un seul cycle CE1-CE6). */
export type Refectoire = 'sousSol' | 'terrasse'

const NIVEAUX_SOUS_SOL = new Set(['PS', 'MS', 'GS', 'CE1', 'CE2'])

export function refectoireForNiveau(niveau: string): Refectoire {
  return NIVEAUX_SOUS_SOL.has(niveau) ? 'sousSol' : 'terrasse'
}

export function refectoireForClasse(classe: string): Refectoire {
  return refectoireForNiveau(niveauFromClasse(classe))
}

export const REFECTOIRE_LABELS: Record<Refectoire, string> = {
  sousSol: 'Sous-Sol',
  terrasse: 'Terrasse',
}

/** Formule affichée pour un élève inscrit via « Garde Midi » (import Excel) sans formule Lunchbox choisie manuellement. */
export const FORMULE_NON_RENSEIGNEE = 'Formule non renseignée'

export function isEnrolled(cantine: CantineInfo, hasCantine: boolean): boolean {
  return hasCantine || (!!cantine.formuleLunchbox && cantine.formuleLunchbox !== 'Aucune inscription')
}

export function getEnrolledStudents(): Student[] {
  return getStudentsSnapshot().filter((s) => {
    const identity = getStudentIdentitySnapshot(s.id)
    return isEnrolled(getStudentExtraSnapshot(s.id).cantine, identity.cantine || identity.gardeMidi)
  })
}

/** Formule Lunchbox à afficher pour un élève inscrit : la formule choisie manuellement, ou un libellé par défaut si absente. */
export function displayFormule(cantine: CantineInfo): string {
  return cantine.formuleLunchbox && cantine.formuleLunchbox !== 'Aucune inscription' ? cantine.formuleLunchbox : FORMULE_NON_RENSEIGNEE
}

export interface CantineStats {
  inscrits: number
  autorisesSortie: number
  maintienObligatoire: number
  besoinMicroOndes: number
  alertesPAI: number
  sansDecharge: number
}

export function computeCantineStats(list: Student[]): CantineStats {
  let autorisesSortie = 0
  let maintienObligatoire = 0
  let besoinMicroOndes = 0
  let alertesPAI = 0
  let sansDecharge = 0
  list.forEach((s) => {
    const c = getStudentExtraSnapshot(s.id).cantine
    if (c.interdictionSortie) maintienObligatoire += 1
    else autorisesSortie += 1
    if (c.rechauffage || c.conservation) besoinMicroOndes += 1
    if (c.alertePAI) alertesPAI += 1
    if (!c.dechargeSignee) sansDecharge += 1
  })
  return { inscrits: list.length, autorisesSortie, maintienObligatoire, besoinMicroOndes, alertesPAI, sansDecharge }
}

export interface RegimeBreakdown {
  seul: number
  accompagne: number
  maintien: number
}

export function computeRegimeBreakdown(list: Student[]): RegimeBreakdown {
  let seul = 0
  let accompagne = 0
  let maintien = 0
  list.forEach((s) => {
    const c = getStudentExtraSnapshot(s.id).cantine
    if (c.interdictionSortie) maintien += 1
    else if (c.modaliteSortie.toLowerCase().includes('accompagn')) accompagne += 1
    else seul += 1
  })
  return { seul, accompagne, maintien }
}

export interface ClasseNeedRow {
  classe: string
  microOndes: number
  frigo: number
}

export function computeBesoinsParClasse(list: Student[]): ClasseNeedRow[] {
  const map: Record<string, ClasseNeedRow> = {}
  list.forEach((s) => {
    const c = getStudentExtraSnapshot(s.id).cantine
    if (!map[s.classe]) map[s.classe] = { classe: s.classe, microOndes: 0, frigo: 0 }
    if (c.rechauffage) map[s.classe].microOndes += 1
    if (c.conservation) map[s.classe].frigo += 1
  })
  return Object.values(map).sort((a, b) => a.classe.localeCompare(b.classe))
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function todayDDMMYYYY(): string {
  const d = new Date()
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

function parseDDMMYYYY(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
}

function ddmmyyyyToISO(s: string): string {
  const d = parseDDMMYYYY(s)
  if (!d) return s
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function isPointedToday(cantine: CantineInfo): boolean {
  const today = todayDDMMYYYY()
  return cantine.historiqueFlux.some((r) => r.date === today)
}

export function isPastThreshold(thresholdHHMM: string): boolean {
  const now = new Date()
  const [h, m] = thresholdHHMM.split(':').map(Number)
  const threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
  return now >= threshold
}

export async function addPointage(studentId: string, arrivee: string, sortie: string, surveillant: string): Promise<void> {
  const extra = getStudentExtraSnapshot(studentId)
  const today = todayDDMMYYYY()
  const existingIdx = extra.cantine.historiqueFlux.findIndex((r) => r.date === today)
  const newRow: FluxRow = { date: today, arrivee, sortie, surveillant }
  const flux =
    existingIdx >= 0
      ? extra.cantine.historiqueFlux.map((r, i) => (i === existingIdx ? newRow : r))
      : [newRow, ...extra.cantine.historiqueFlux]
  await updateStudentCantine(studentId, { ...extra.cantine, historiqueFlux: flux })
}

export interface FluxExportRow extends FluxRow {
  studentName: string
  classe: string
}

export function flattenFluxRows(list: Student[], periodStart: string, periodEnd: string): FluxExportRow[] {
  const rows: FluxExportRow[] = []
  list.forEach((s) => {
    const c = getStudentExtraSnapshot(s.id).cantine
    c.historiqueFlux.forEach((r) => {
      if (isWithinPeriod(ddmmyyyyToISO(r.date), periodStart, periodEnd)) {
        rows.push({ ...r, studentName: s.name, classe: s.classe })
      }
    })
  })
  return rows.sort((a, b) => (parseDDMMYYYY(a.date)?.getTime() ?? 0) - (parseDDMMYYYY(b.date)?.getTime() ?? 0))
}
