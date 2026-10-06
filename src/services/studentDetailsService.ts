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
  type ReclamationNote,
  type ReclamationSuiviFamille,
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
import { cleanReclamationText, echeanceParDefaut, todayLocalISO } from '../utils/reclamationsLogic'

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
  // L'instantané suit l'écriture tout de suite : deux écritures rapprochées sur le même élève (deux accusés cochés
  // à la suite…) ne doivent pas repartir d'un état périmé et s'écraser l'une l'autre.
  const { rendez_vous: rendezVous, ...rest } = patch
  cachedExtras = { ...cachedExtras, [id]: { ...getStudentExtraSnapshot(id), ...rest, ...(rendezVous !== undefined ? { rendezVous } : {}) } as StudentExtra }
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

/** Les écritures de réclamations lisent la liste de l'élève puis la réécrivent en entier : on les fait passer
 * l'une après l'autre pour qu'aucune ne parte d'une liste que la précédente vient de modifier. */
let reclamationWrites: Promise<unknown> = Promise.resolve()
function enFile<T>(task: () => Promise<T>): Promise<T> {
  const next = reclamationWrites.then(task, task)
  reclamationWrites = next.catch(() => undefined)
  return next
}

type ReclamationEventInput = { action: ReclamationAction; detail?: string }

/** Modifie plusieurs réclamations d'un même élève en **une seule écriture** : retrouvées par leur id (et non
 * par leur position, qui se décale à chaque ajout/suppression), `patch` et `event` peuvent dépendre de
 * chaque enregistrement. Chaque réclamation modifiée reçoit son événement dans la frise chronologique ;
 * l'audit est déjà branché via `updateStudentReclamations`. */
export async function updateReclamationsBatch(
  studentId: string,
  ids: string[],
  patch: ReclamationPatch | ((r: ReclamationRecord) => ReclamationPatch),
  event?: ReclamationEventInput | ((r: ReclamationRecord) => ReclamationEventInput)
): Promise<ReclamationRecord[]> {
  return enFile(() => appliquerBatch(studentId, ids, patch, event))
}

async function appliquerBatch(
  studentId: string,
  ids: string[],
  patch: ReclamationPatch | ((r: ReclamationRecord) => ReclamationPatch),
  event?: ReclamationEventInput | ((r: ReclamationRecord) => ReclamationEventInput)
): Promise<ReclamationRecord[]> {
  const current = getStudentExtraSnapshot(studentId).reclamations
  const wanted = new Set(ids)
  if (!current.some((r) => wanted.has(r.id))) throw new Error('Réclamation introuvable (elle a peut-être été supprimée).')
  const updated = current.map((r) => {
    if (!wanted.has(r.id)) return r
    const changes = typeof patch === 'function' ? patch(r) : patch
    const ev = typeof event === 'function' ? event(r) : event
    return { ...r, ...changes, historique: ev ? [...r.historique, reclamationEvent(ev.action, ev.detail)] : r.historique }
  })
  await updateStudentReclamations(studentId, updated)
  return updated
}

/** Seul point de modification d'UNE réclamation existante — utilisé par la page Réclamations, la fiche élève,
 * la Réunion de suivi et l'Assistant IA. */
export function updateReclamation(studentId: string, id: string, patch: ReclamationPatch, event?: ReclamationEventInput): Promise<ReclamationRecord[]> {
  return updateReclamationsBatch(studentId, [id], patch, event)
}

function findReclamation(studentId: string, id: string): ReclamationRecord | undefined {
  return getStudentExtraSnapshot(studentId).reclamations.find((r) => r.id === id)
}

/** « Prendre en charge » : le responsable est, par défaut, la personne connectée, et l'échéance est fixée au
 * délai de résolution de la réclamation (3 jours pour une réclamation standard) — l'un et l'autre restent
 * modifiables ensuite. */
export function prendreEnChargeReclamation(studentId: string, id: string, options: { responsable?: string; echeance?: string } = {}) {
  const responsable = options.responsable ?? getCurrentActorName()
  const record = findReclamation(studentId, id)
  return updateReclamation(
    studentId,
    id,
    {
      statut: 'En cours',
      responsable,
      echeance: options.echeance ?? (record ? echeanceParDefaut(record) : undefined),
      priseEnChargeLe: new Date().toISOString(),
    },
    { action: 'prise_en_charge', detail: responsable ? `Responsable : ${responsable}` : undefined }
  )
}

/** Prise en charge de plusieurs réclamations d'un même élève (traitement en lot). */
export function prendreEnChargeBatch(studentId: string, ids: string[], responsable: string = getCurrentActorName()) {
  const now = new Date().toISOString()
  return updateReclamationsBatch(
    studentId,
    ids,
    (r) => ({ statut: 'En cours', responsable, echeance: echeanceParDefaut(r), priseEnChargeLe: now }),
    { action: 'prise_en_charge', detail: responsable ? `Responsable : ${responsable}` : undefined }
  )
}

export function resoudreReclamation(studentId: string, id: string, resolution: string) {
  return updateReclamation(
    studentId,
    id,
    // Une nouvelle résolution relance le cycle : l'ancien suivi de la famille ne vaut plus.
    { statut: 'Résolue', resolution: resolution.trim(), resoluLe: new Date().toISOString(), suiviFamille: undefined },
    { action: 'resolue', detail: resolution.trim() }
  )
}

/** Rouvre une réclamation résolue ; la solution précédente reste lisible dans la frise chronologique. */
export function rouvrirReclamation(studentId: string, id: string) {
  const previous = findReclamation(studentId, id)?.resolution
  return updateReclamation(
    studentId,
    id,
    { statut: 'En cours', resolution: '', resoluLe: undefined, suiviFamille: undefined },
    { action: 'rouverte', detail: previous ? `Solution précédente : ${previous}` : undefined }
  )
}

export function assignerReclamation(studentId: string, id: string, responsable: string, echeance: string | undefined) {
  const detail = [responsable ? `Responsable : ${responsable}` : 'Sans responsable', echeance ? `échéance ${echeance}` : ''].filter(Boolean).join(' · ')
  return updateReclamation(studentId, id, { responsable: responsable || undefined, echeance: echeance || undefined }, { action: 'responsable', detail })
}

/** Assigne plusieurs réclamations d'un même élève ; sans échéance précisée, on garde la leur ou, à défaut, on
 * propose celle de leur niveau. */
export function assignerBatch(studentId: string, ids: string[], responsable: string, echeance?: string) {
  const detail = [`Responsable : ${responsable}`, echeance ? `échéance ${echeance}` : ''].filter(Boolean).join(' · ')
  return updateReclamationsBatch(
    studentId,
    ids,
    (r) => ({ responsable, echeance: echeance ?? r.echeance ?? echeanceParDefaut(r) }),
    { action: 'responsable', detail }
  )
}

/** Accusé de réception envoyé à la famille (message copié ou ouvert dans WhatsApp, ou marquage manuel). */
export function marquerAccuseEnvoye(studentId: string, id: string) {
  return updateReclamation(studentId, id, { accuseLe: new Date().toISOString() }, { action: 'accuse', detail: 'Accusé de réception envoyé' })
}

/** Force (ou retire) le niveau « urgent » d'une réclamation, quelle que soit sa catégorie. */
export function basculerUrgente(studentId: string, id: string) {
  const next = !findReclamation(studentId, id)?.urgente
  return updateReclamation(studentId, id, { urgente: next || undefined }, { action: 'urgente', detail: next ? 'Marquée urgente' : 'Urgence retirée' })
}

export function marquerUrgenteBatch(studentId: string, ids: string[]) {
  return updateReclamationsBatch(studentId, ids, { urgente: true }, { action: 'urgente', detail: 'Marquée urgente' })
}

/** Note réservée à l'équipe (jamais transmise au parent ni imprimée) : note interne ou version de l'enseignant. */
export function ajouterNote(studentId: string, id: string, note: { type: ReclamationNote['type']; texte: string; enseignant?: string }) {
  const entry: ReclamationNote = {
    at: new Date().toISOString(),
    auteur: getCurrentActorName(),
    type: note.type,
    texte: note.texte.trim(),
    ...(note.type === 'enseignant' && note.enseignant ? { enseignant: note.enseignant } : {}),
  }
  const existing = findReclamation(studentId, id)?.notes ?? []
  return updateReclamation(studentId, id, { notes: [...existing, entry] }, { action: 'note', detail: entry.type === 'enseignant' && entry.enseignant ? `Avis de ${entry.enseignant}` : 'Note interne' })
}

/** Issue de la relance de la famille après la résolution. « Pas satisfaite » rouvre la réclamation (la solution
 * précédente reste dans la frise). */
export function enregistrerSuiviFamille(studentId: string, id: string, issue: ReclamationSuiviFamille['issue'], note?: string) {
  const suiviFamille: ReclamationSuiviFamille = { le: new Date().toISOString(), issue, ...(note?.trim() ? { note: note.trim() } : {}) }
  if (issue === 'insatisfaite') {
    const previous = findReclamation(studentId, id)?.resolution
    return updateReclamation(
      studentId,
      id,
      { suiviFamille, statut: 'En cours', resolution: '', resoluLe: undefined },
      { action: 'suivi_famille', detail: `Famille non satisfaite — réclamation rouverte${previous ? ` (solution précédente : ${previous})` : ''}` }
    )
  }
  return updateReclamation(studentId, id, { suiviFamille }, { action: 'suivi_famille', detail: issue === 'satisfaite' ? 'Famille satisfaite' : 'Sans réponse de la famille' })
}

export function supprimerReclamation(studentId: string, id: string): Promise<ReclamationRecord[]> {
  return enFile(async () => {
    const updated = getStudentExtraSnapshot(studentId).reclamations.filter((r) => r.id !== id)
    await updateStudentReclamations(studentId, updated)
    return updated
  })
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
export function createReclamations(input: CreateReclamationsInput): Promise<ReclamationRecord[]> {
  return enFile(() => ajouterReclamations(input))
}

async function ajouterReclamations(input: CreateReclamationsInput): Promise<ReclamationRecord[]> {
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
