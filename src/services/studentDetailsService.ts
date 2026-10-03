import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import {
  defaultExtra,
  type StudentExtra,
  type EventRecord,
  type NoteRow,
  type Evaluation,
  type DisciplineEvent,
  type CantineInfo,
  type SanteInfo,
  type ReclamationRecord,
  type RendezVousRecord,
  type StoredRendezVousRecord,
  normalizeRendezVous,
  type ProjetPersonnelInfo,
} from '../data/studentDetails'
import { logAudit } from './auditLogService'

interface StudentExtraRow {
  student_id: string
  conduite: number
  moyenne: number
  events: EventRecord[]
  notes: NoteRow[]
  discipline: DisciplineEvent[]
  cantine: CantineInfo
  projet: ProjetPersonnelInfo
  sante: SanteInfo
  reclamations: ReclamationRecord[]
  rendez_vous: StoredRendezVousRecord[]
}

function rowToExtra(row: StudentExtraRow): StudentExtra {
  return {
    conduite: row.conduite,
    moyenne: row.moyenne,
    events: row.events ?? defaultExtra.events,
    notes: row.notes ?? defaultExtra.notes,
    discipline: row.discipline ?? defaultExtra.discipline,
    cantine: { ...defaultExtra.cantine, ...row.cantine },
    projet: { ...defaultExtra.projet, ...row.projet },
    sante: { ...defaultExtra.sante, ...row.sante },
    reclamations: row.reclamations ?? defaultExtra.reclamations,
    rendezVous: row.rendez_vous ? normalizeRendezVous(row.rendez_vous) : defaultExtra.rendezVous,
  }
}

const QUERY_KEY = ['studentExtras']

async function fetchStudentExtras(): Promise<Record<string, StudentExtra>> {
  const { data, error } = await supabase.from('student_extras').select('*')
  if (error) throw error
  const result: Record<string, StudentExtra> = {}
  ;(data as StudentExtraRow[]).forEach((row) => {
    result[row.student_id] = rowToExtra(row)
  })
  return result
}

/** Extras d'un ensemble ciblé de students.id — pour comparer une autre année sans tout rapatrier. */
export async function fetchStudentExtrasForIds(studentIds: string[]): Promise<Record<string, StudentExtra>> {
  if (studentIds.length === 0) return {}
  const { data, error } = await supabase.from('student_extras').select('*').in('student_id', studentIds)
  if (error) throw error
  const result: Record<string, StudentExtra> = {}
  ;(data as StudentExtraRow[]).forEach((row) => {
    result[row.student_id] = rowToExtra(row)
  })
  return result
}

export function useStudentExtras(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchStudentExtras, enabled })
  useEffect(() => {
    if (query.data) cachedExtras = query.data
  }, [query.data])
  return query
}

let cachedExtras: Record<string, StudentExtra> = {}
export function getStudentExtraSnapshot(id: string): StudentExtra {
  return cachedExtras[id] ?? defaultExtra
}

async function patchStudentExtra(id: string, patch: Record<string, unknown>): Promise<void> {
  const previous = getStudentExtraSnapshot(id) as unknown as Record<string, unknown>
  const oldData: Record<string, unknown> = {}
  Object.keys(patch).forEach((key) => {
    oldData[key] = previous[key]
  })
  const { error } = await supabase.from('student_extras').upsert({ student_id: id, ...patch }, { onConflict: 'student_id' })
  if (error) throw error
  void logAudit({ tableName: 'student_extras', recordId: id, action: 'update', oldData, newData: patch })
}

export async function addStudentEvent(id: string, event: EventRecord): Promise<void> {
  const events = [...getStudentExtraSnapshot(id).events, event]
  await patchStudentExtra(id, { events })
}

export async function updateStudentEventJustified(id: string, target: EventRecord, justified: boolean): Promise<void> {
  const events = getStudentExtraSnapshot(id).events.map((e) => (e === target ? { ...e, justified } : e))
  await patchStudentExtra(id, { events })
}

export async function updateStudentEvents(id: string, events: EventRecord[]): Promise<void> {
  await patchStudentExtra(id, { events })
}

export async function addStudentEvaluation(id: string, subject: string, coef: number, evaluation: Evaluation): Promise<void> {
  const extra = getStudentExtraSnapshot(id)
  const notes = applyEvaluation(extra.notes, subject, coef, evaluation)
  await patchStudentExtra(id, { notes })
}

export function applyEvaluation(notes: NoteRow[], subject: string, coef: number, evaluation: Evaluation): NoteRow[] {
  const hasSubject = notes.some((n) => n.subject === subject)
  return hasSubject
    ? notes.map((n) => (n.subject === subject ? { ...n, evaluations: [...n.evaluations, evaluation] } : n))
    : [...notes, { subject, coef, evaluations: [evaluation], classeAverage: evaluation.value }]
}

export async function updateStudentNotes(id: string, notes: NoteRow[]): Promise<void> {
  await patchStudentExtra(id, { notes })
}

export async function updateStudentSante(id: string, sante: SanteInfo): Promise<void> {
  await patchStudentExtra(id, { sante })
}

export async function updateStudentCantine(id: string, cantine: CantineInfo): Promise<void> {
  await patchStudentExtra(id, { cantine })
}

export async function updateStudentReclamations(id: string, reclamations: ReclamationRecord[]): Promise<void> {
  await patchStudentExtra(id, { reclamations })
}

/** Marque une réclamation précise comme traitée — utilisé par le point "Traitement des
 * réclamations" de la réunion de suivi de classe, qui écrit réellement dans le module Réclamations
 * Parents plutôt que de dupliquer un suivi parallèle. `indexInStudent` vient de
 * `computeOpenReclamationsForNiveaux`, seule clé stable puisque `ReclamationRecord` n'a pas d'id
 * propre. */
export async function markReclamationTraitee(studentId: string, indexInStudent: number, resolution: string): Promise<void> {
  const current = getStudentExtraSnapshot(studentId).reclamations
  const updated = current.map((r, i) => (i === indexInStudent ? { ...r, statut: 'Résolue' as const, resolution } : r))
  await updateStudentReclamations(studentId, updated)
}

export interface CreateReclamationsInput {
  studentId: string
  parentNom: string
  date: string
  items: { category: string; objet: string; description: string; concernant: string }[]
}

/** Chemin partagé par l'UI (ReclamationsGlobal.tsx) et l'outil d'écriture de l'Assistant IA — une
 * seule implémentation du mapping items → ReclamationRecord[], pour éviter toute divergence. */
export async function createReclamations(input: CreateReclamationsInput): Promise<ReclamationRecord[]> {
  const newRecords: ReclamationRecord[] = input.items.map((item) => ({
    date: input.date,
    statut: 'En attente',
    type: item.category,
    objet: item.objet,
    description: item.description,
    resolution: '',
    enseignant: item.concernant,
    parentNom: input.parentNom,
  }))
  const updated = [...newRecords, ...getStudentExtraSnapshot(input.studentId).reclamations]
  await updateStudentReclamations(input.studentId, updated)
  return updated
}

export async function updateStudentRendezVous(id: string, rendezVous: RendezVousRecord[]): Promise<void> {
  await patchStudentExtra(id, { rendez_vous: rendezVous })
}

export async function updateStudentDiscipline(id: string, discipline: DisciplineEvent[]): Promise<void> {
  await patchStudentExtra(id, { discipline })
}

export async function updateStudentConduite(id: string, conduite: number): Promise<void> {
  await patchStudentExtra(id, { conduite })
}
