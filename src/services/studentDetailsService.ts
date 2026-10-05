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
  type ReclamationAction,
  type ReclamationEvent,
  type StoredReclamationRecord,
  normalizeReclamations,
  newReclamationId,
  type RendezVousRecord,
  type StoredRendezVousRecord,
  normalizeRendezVous,
  type ProjetPersonnelInfo,
} from '../data/studentDetails'
import { logAudit } from './auditLogService'
import { getCurrentActorName } from './permissions'
import { RECLAMATION_DELAI_JOURS, addDaysISO, cleanReclamationText, todayLocalISO } from '../utils/reclamationsLogic'

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
  reclamations: StoredReclamationRecord[]
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
    reclamations: row.reclamations ? normalizeReclamations(row.reclamations, row.student_id) : defaultExtra.reclamations,
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

function reclamationEvent(action: ReclamationAction, detail?: string): ReclamationEvent {
  return { at: new Date().toISOString(), action, ...(detail ? { detail } : {}), auteur: getCurrentActorName() }
}

export type ReclamationPatch = Partial<Omit<ReclamationRecord, 'id' | 'historique'>>

/** Seul point de modification d'une réclamation existante : la retrouve **par son id** (et non par sa
 * position, qui se décale à chaque ajout/suppression), applique `patch`, ajoute l'événement à la frise
 * chronologique puis enregistre via `updateStudentReclamations` (audit déjà branché). Utilisé par la page
 * Réclamations, la fiche élève, la Réunion de suivi et l'Assistant IA. */
export async function updateReclamation(
  studentId: string,
  id: string,
  patch: ReclamationPatch,
  event?: { action: ReclamationAction; detail?: string }
): Promise<ReclamationRecord[]> {
  const current = getStudentExtraSnapshot(studentId).reclamations
  if (!current.some((r) => r.id === id)) throw new Error('Réclamation introuvable (elle a peut-être été supprimée).')
  const updated = current.map((r) =>
    r.id !== id ? r : { ...r, ...patch, historique: event ? [...r.historique, reclamationEvent(event.action, event.detail)] : r.historique }
  )
  await updateStudentReclamations(studentId, updated)
  return updated
}

/** « Prendre en charge » : le responsable est, par défaut, la personne connectée, et l'échéance est
 * fixée à 72 h (3 jours) — l'un et l'autre restent modifiables ensuite. */
export function prendreEnChargeReclamation(studentId: string, id: string, options: { responsable?: string; echeance?: string } = {}) {
  const responsable = options.responsable ?? getCurrentActorName()
  return updateReclamation(
    studentId,
    id,
    {
      statut: 'En cours',
      responsable,
      echeance: options.echeance ?? addDaysISO(todayLocalISO(), RECLAMATION_DELAI_JOURS),
      priseEnChargeLe: new Date().toISOString(),
    },
    { action: 'prise_en_charge', detail: responsable ? `Responsable : ${responsable}` : undefined }
  )
}

export function resoudreReclamation(studentId: string, id: string, resolution: string) {
  return updateReclamation(
    studentId,
    id,
    { statut: 'Résolue', resolution: resolution.trim(), resoluLe: new Date().toISOString() },
    { action: 'resolue', detail: resolution.trim() }
  )
}

/** Rouvre une réclamation résolue ; la solution précédente reste lisible dans la frise chronologique. */
export function rouvrirReclamation(studentId: string, id: string) {
  const previous = getStudentExtraSnapshot(studentId).reclamations.find((r) => r.id === id)?.resolution
  return updateReclamation(
    studentId,
    id,
    { statut: 'En cours', resolution: '', resoluLe: undefined },
    { action: 'rouverte', detail: previous ? `Solution précédente : ${previous}` : undefined }
  )
}

export function assignerReclamation(studentId: string, id: string, responsable: string, echeance: string | undefined) {
  const detail = [responsable ? `Responsable : ${responsable}` : 'Sans responsable', echeance ? `échéance ${echeance}` : ''].filter(Boolean).join(' · ')
  return updateReclamation(studentId, id, { responsable: responsable || undefined, echeance: echeance || undefined }, { action: 'responsable', detail })
}

export async function supprimerReclamation(studentId: string, id: string): Promise<ReclamationRecord[]> {
  const updated = getStudentExtraSnapshot(studentId).reclamations.filter((r) => r.id !== id)
  await updateStudentReclamations(studentId, updated)
  return updated
}

/** Marque une réclamation précise comme traitée — utilisé par le point "Traitement des
 * réclamations" de la réunion de suivi de classe, qui écrit réellement dans le module Réclamations
 * Parents plutôt que de dupliquer un suivi parallèle. */
export async function markReclamationTraitee(studentId: string, id: string, resolution: string): Promise<void> {
  await resoudreReclamation(studentId, id, resolution)
}

export interface CreateReclamationsInput {
  studentId: string
  parentNom: string
  date: string
  items: { category: string; objet: string; description: string; concernant: string }[]
}

/** Chemin partagé par l'UI (ReclamationsGlobal.tsx) et l'outil d'écriture de l'Assistant IA — une
 * seule implémentation du mapping items → ReclamationRecord[], pour éviter toute divergence. Les textes
 * sont nettoyés à l'écriture (le texte du modèle d'IA ou d'un collage arrive souvent en markdown :
 * « **Objet : … ** »). */
export async function createReclamations(input: CreateReclamationsInput): Promise<ReclamationRecord[]> {
  const newRecords: ReclamationRecord[] = input.items.map((item) => ({
    id: newReclamationId(),
    date: input.date || todayLocalISO(),
    statut: 'En attente',
    type: item.category,
    objet: cleanReclamationText(item.objet),
    description: cleanReclamationText(item.description),
    resolution: '',
    enseignant: item.concernant.trim(),
    parentNom: input.parentNom.trim(),
    historique: [reclamationEvent('creee')],
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
