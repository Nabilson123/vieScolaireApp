export interface CriteresBase {
  clarte: number
  tenue: number
  innovation: number
}

export interface CriteresPP {
  suivi: number
  relation: number
  conseil: number
}

export interface CriteresMaternelle {
  eveil: number
  autonomie: number
  relationBienveillante: number
}

export interface PlanProgresItem {
  objectif: string
  echeance: string
  statut: 'Atteint' | 'En cours' | 'Non atteint'
}

export interface InspectionRecord {
  id: string
  teacherId: string
  date: string
  inspecteur: string
  isPP: boolean
  isMaternelle: boolean
  criteresBase: CriteresBase
  criteresPP?: CriteresPP
  criteresMaternelle?: CriteresMaternelle
  feedbackParents?: number
  pieceJointe?: string
  noteGlobale: number
  rapport: string
  autoEvaluation?: string
  formationRecommandee?: string
  commentaireEnseignant?: string
  planProgres: PlanProgresItem[]
}

export const INSPECTEUR_OPTIONS = ['Nabil LAHRACHE (Directeur)', 'Direction Pédagogique', 'Inspecteur Académique Régional']

interface Palier {
  min: number
  label: string
  color: 'rose' | 'amber' | 'sky' | 'emerald'
}

const PALIERS: Palier[] = [
  { min: 17, label: 'EXCELLENCE', color: 'emerald' },
  { min: 14, label: 'MAÎTRISE', color: 'sky' },
  { min: 10, label: 'SATISFAISANT', color: 'amber' },
  { min: 0, label: 'INSUFFISANT', color: 'rose' },
]

export function getMention(note: number): { label: string; color: Palier['color'] } {
  const palier = PALIERS.find((p) => note >= p.min) ?? PALIERS[PALIERS.length - 1]
  return { label: palier.label, color: palier.color }
}

export function computeNote(values: number[]): number {
  if (values.length === 0) return 0
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length
  return Math.round(avg * 4)
}

function collectCriteriaValues(record: Pick<InspectionRecord, 'criteresBase' | 'criteresPP' | 'criteresMaternelle' | 'feedbackParents'>): number[] {
  const values = [record.criteresBase.clarte, record.criteresBase.tenue, record.criteresBase.innovation]
  if (record.criteresPP) values.push(record.criteresPP.suivi, record.criteresPP.relation, record.criteresPP.conseil)
  if (record.criteresMaternelle)
    values.push(record.criteresMaternelle.eveil, record.criteresMaternelle.autonomie, record.criteresMaternelle.relationBienveillante)
  if (record.feedbackParents !== undefined) values.push(record.feedbackParents)
  return values
}

export function computeNoteForRecord(record: Pick<InspectionRecord, 'criteresBase' | 'criteresPP' | 'criteresMaternelle' | 'feedbackParents'>): number {
  return computeNote(collectCriteriaValues(record))
}

