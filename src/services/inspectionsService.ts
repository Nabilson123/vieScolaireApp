import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { InspectionRecord, CriteresBase, CriteresPP, CriteresMaternelle, PlanProgresItem } from '../data/inspections'
import { useViewedYearId, getViewedYearIdSnapshot } from './viewedYear'
import { useAnneesLoaded } from './anneesScolairesService'

interface InspectionRow {
  id: string
  teacher_id: string
  date: string
  inspecteur: string
  is_pp: boolean
  is_maternelle: boolean
  criteres_base: CriteresBase
  criteres_pp: CriteresPP | null
  criteres_maternelle: CriteresMaternelle | null
  feedback_parents: number | null
  piece_jointe: string | null
  note_globale: number
  rapport: string
  auto_evaluation: string | null
  formation_recommandee: string | null
  commentaire_enseignant: string | null
  plan_progres: PlanProgresItem[]
}

function rowToInspection(row: InspectionRow): InspectionRecord {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    date: row.date,
    inspecteur: row.inspecteur,
    isPP: row.is_pp,
    isMaternelle: row.is_maternelle,
    criteresBase: row.criteres_base,
    criteresPP: row.criteres_pp ?? undefined,
    criteresMaternelle: row.criteres_maternelle ?? undefined,
    feedbackParents: row.feedback_parents ?? undefined,
    pieceJointe: row.piece_jointe ?? undefined,
    noteGlobale: row.note_globale,
    rapport: row.rapport,
    autoEvaluation: row.auto_evaluation ?? undefined,
    formationRecommandee: row.formation_recommandee ?? undefined,
    commentaireEnseignant: row.commentaire_enseignant ?? undefined,
    planProgres: row.plan_progres,
  }
}

function inspectionToRow(record: InspectionRecord) {
  return {
    id: record.id,
    teacher_id: record.teacherId,
    date: record.date,
    inspecteur: record.inspecteur,
    is_pp: record.isPP,
    is_maternelle: record.isMaternelle,
    criteres_base: record.criteresBase,
    criteres_pp: record.criteresPP ?? null,
    criteres_maternelle: record.criteresMaternelle ?? null,
    feedback_parents: record.feedbackParents ?? null,
    piece_jointe: record.pieceJointe ?? null,
    note_globale: record.noteGlobale,
    rapport: record.rapport,
    auto_evaluation: record.autoEvaluation ?? null,
    formation_recommandee: record.formationRecommandee ?? null,
    commentaire_enseignant: record.commentaireEnseignant ?? null,
    plan_progres: record.planProgres,
  }
}

async function fetchInspections(yearId: string): Promise<InspectionRecord[]> {
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('annee_scolaire_id', yearId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as InspectionRow[]).map(rowToInspection)
}

export function useInspections(enabled = true) {
  const anneesLoaded = useAnneesLoaded()
  const viewedYearId = useViewedYearId()
  const query = useQuery({
    queryKey: ['inspections', viewedYearId],
    queryFn: () => fetchInspections(viewedYearId),
    enabled: enabled && anneesLoaded,
  })
  // Affectation synchrone (pas un useEffect) : voir classSchedulesService.ts (useClassSchedules)
  // pour le détail du décalage d'un rendu qu'un useEffect provoquerait ici.
  if (query.data) cachedInspections = query.data
  return query
}

let cachedInspections: InspectionRecord[] = []
export function getInspectionsSnapshot(): InspectionRecord[] {
  return cachedInspections
}

export function generateInspectionId(): string {
  const year = new Date().getFullYear()
  const prefix = `INSP-${year}-`
  let max = 0
  cachedInspections.forEach((r) => {
    if (r.id.startsWith(prefix)) {
      const n = Number(r.id.slice(prefix.length))
      if (!Number.isNaN(n) && n > max) max = n
    }
  })
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

export async function insertInspection(record: InspectionRecord): Promise<void> {
  const { error } = await supabase.from('inspections').insert({ ...inspectionToRow(record), annee_scolaire_id: getViewedYearIdSnapshot() })
  if (error) throw error
}

export async function updateInspectionRow(id: string, patch: Partial<InspectionRecord>): Promise<void> {
  const current = cachedInspections.find((r) => r.id === id)
  if (!current) return
  const updated = { ...current, ...patch }
  const { error } = await supabase.from('inspections').update(inspectionToRow(updated)).eq('id', id)
  if (error) throw error
}

export async function deleteInspectionRow(id: string): Promise<void> {
  const { error } = await supabase.from('inspections').delete().eq('id', id)
  if (error) throw error
}
