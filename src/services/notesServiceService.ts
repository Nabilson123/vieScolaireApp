import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { CouponType, NoteAudience, NoteCibleType, NoteHistoryEntry, NoteService, NoteStatut, NoteType } from '../data/notesService'
import { makeNoteHistoryEntry, nextNoteReference } from '../data/notesService'
import { getViewedYearIdSnapshot } from './viewedYear'
import { getCurrentUserIdSnapshot } from './currentUser'
import { getStudentsSnapshot } from './studentsService'
import { getTeachersSnapshot } from './teachersService'
import { teacherName } from '../data/teachers'
import { getProfilesSnapshot } from './profilesService'
import { logAudit } from './auditLogService'

interface NoteServiceRow {
  id: string
  reference: string
  type: NoteType
  audience: NoteAudience
  cible_type: NoteCibleType
  cible_niveau: string | null
  cible_classe: string | null
  cible_eleve_ids: string[] | null
  cible_personne_ids: string[] | null
  objet: string
  corps: string
  coupon_actif: boolean
  coupon_type: CouponType | null
  coupon_date_limite: string | null
  signataire_id: string | null
  statut: NoteStatut
  date_diffusion: string | null
  rectificatif_de_id: string | null
  historique: NoteHistoryEntry[]
  created_by: string | null
  created_at: string
}

function rowToNote(row: NoteServiceRow): NoteService {
  return {
    id: row.id,
    reference: row.reference,
    type: row.type,
    audience: row.audience,
    cibleType: row.cible_type,
    cibleNiveau: row.cible_niveau,
    cibleClasse: row.cible_classe,
    cibleEleveIds: row.cible_eleve_ids,
    ciblePersonneIds: row.cible_personne_ids,
    objet: row.objet,
    corps: row.corps,
    couponActif: row.coupon_actif,
    couponType: row.coupon_type,
    couponDateLimite: row.coupon_date_limite,
    signataireId: row.signataire_id,
    statut: row.statut,
    dateDiffusion: row.date_diffusion,
    rectificatifDeId: row.rectificatif_de_id,
    historique: row.historique ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

const NOTES_SERVICE_KEY = ['notesService']

// Même regex que niveauFromClasse() dupliquée dans circulairesService.ts — convention déjà établie
// de petits helpers purs dupliqués plutôt qu'exportés depuis alertEngine.ts.
function niveauFromClasse(classe: string): string {
  return classe.replace(/-[A-Z]$/, '')
}

async function fetchNotesService(): Promise<NoteService[]> {
  const { data, error } = await supabase
    .from('notes_service')
    .select('*')
    .eq('annee_scolaire_id', getViewedYearIdSnapshot())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as NoteServiceRow[]).map(rowToNote)
}

export function useNotesService(enabled = true) {
  const query = useQuery({ queryKey: NOTES_SERVICE_KEY, queryFn: fetchNotesService, enabled })
  useEffect(() => {
    if (query.data) cachedNotes = query.data
  }, [query.data])
  return query
}

let cachedNotes: NoteService[] = []
export function getNotesServiceSnapshot(): NoteService[] {
  return cachedNotes
}

/** Résout les destinataires réels d'une note — élèves/parents pour Audience Parents (même logique
 * que resolveTargetStudentIds dans circulairesService.ts), personnel pour les autres audiences. */
export function resolveDestinataires(note: {
  audience: NoteAudience
  cibleType: NoteCibleType
  cibleNiveau?: string | null
  cibleClasse?: string | null
  cibleEleveIds?: string[] | null
  ciblePersonneIds?: string[] | null
}): { count: number; labels: string[] } {
  if (note.audience === 'PARENTS' || note.audience === 'TOUS') {
    const students = getStudentsSnapshot()
    const parentsMatched =
      note.cibleType === 'niveau'
        ? students.filter((s) => niveauFromClasse(s.classe) === note.cibleNiveau)
        : note.cibleType === 'classe'
          ? students.filter((s) => s.classe === note.cibleClasse)
          : note.cibleType === 'eleves'
            ? students.filter((s) => (note.cibleEleveIds ?? []).includes(s.id))
            : students
    if (note.audience === 'PARENTS') return { count: parentsMatched.length, labels: parentsMatched.map((s) => s.name) }
    const teachers = getTeachersSnapshot()
    const profiles = getProfilesSnapshot()
    return {
      count: parentsMatched.length + teachers.length + profiles.length,
      labels: [...parentsMatched.map((s) => s.name), ...teachers.map(teacherName), ...profiles.map((p) => p.nomComplet)],
    }
  }
  if (note.audience === 'ENSEIGNANTS') {
    const teachers = getTeachersSnapshot()
    const matched = note.cibleType === 'personnes' ? teachers.filter((t) => (note.ciblePersonneIds ?? []).includes(t.id)) : teachers
    return { count: matched.length, labels: matched.map(teacherName) }
  }
  // ADMINISTRATIF
  const profiles = getProfilesSnapshot()
  const matched = note.cibleType === 'personnes' ? profiles.filter((p) => (note.ciblePersonneIds ?? []).includes(p.id)) : profiles
  return { count: matched.length, labels: matched.map((p) => p.nomComplet) }
}

interface NoteServiceInput {
  type: NoteType
  audience: NoteAudience
  cibleType: NoteCibleType
  cibleNiveau?: string | null
  cibleClasse?: string | null
  cibleEleveIds?: string[] | null
  ciblePersonneIds?: string[] | null
  objet: string
  corps: string
  couponActif: boolean
  couponType?: CouponType | null
  couponDateLimite?: string | null
  signataireId?: string | null
}

function useInvalidateNotes() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: NOTES_SERVICE_KEY })
}

export function useAddNoteService() {
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: async (data: NoteServiceInput) => {
      const auteur = getCurrentUserIdSnapshot() ?? ''
      const row = {
        reference: nextNoteReference(cachedNotes),
        type: data.type,
        audience: data.audience,
        cible_type: data.cibleType,
        cible_niveau: data.cibleNiveau ?? null,
        cible_classe: data.cibleClasse ?? null,
        cible_eleve_ids: data.cibleEleveIds ?? null,
        cible_personne_ids: data.ciblePersonneIds ?? null,
        objet: data.objet,
        corps: data.corps,
        coupon_actif: data.couponActif,
        coupon_type: data.couponType ?? null,
        coupon_date_limite: data.couponDateLimite ?? null,
        signataire_id: data.signataireId ?? null,
        statut: 'BROUILLON' as const,
        historique: [makeNoteHistoryEntry('Brouillon créé', auteur)],
        created_by: getCurrentUserIdSnapshot(),
        annee_scolaire_id: getViewedYearIdSnapshot(),
      }
      const { data: inserted, error } = await supabase.from('notes_service').insert(row).select('*').single()
      if (error) throw error
      const note = rowToNote(inserted as NoteServiceRow)
      void logAudit({ tableName: 'notes_service', recordId: note.id, action: 'insert', newData: { reference: note.reference, type: note.type } })
      return note
    },
    onSuccess: invalidate,
  })
}

export function useUpdateNoteService() {
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & NoteServiceInput) => {
      const { error } = await supabase
        .from('notes_service')
        .update({
          type: data.type,
          audience: data.audience,
          cible_type: data.cibleType,
          cible_niveau: data.cibleNiveau ?? null,
          cible_classe: data.cibleClasse ?? null,
          cible_eleve_ids: data.cibleEleveIds ?? null,
          cible_personne_ids: data.ciblePersonneIds ?? null,
          objet: data.objet,
          corps: data.corps,
          coupon_actif: data.couponActif,
          coupon_type: data.couponType ?? null,
          coupon_date_limite: data.couponDateLimite ?? null,
          signataire_id: data.signataireId ?? null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

async function transitionStatut(note: NoteService, statut: NoteStatut, action: string, extra?: Record<string, unknown>) {
  const auteur = getCurrentUserIdSnapshot() ?? ''
  const historique = [makeNoteHistoryEntry(action, auteur), ...note.historique]
  const { error } = await supabase
    .from('notes_service')
    .update({ statut, historique, ...extra })
    .eq('id', note.id)
  if (error) throw error
  void logAudit({ tableName: 'notes_service', recordId: note.id, action: 'update', oldData: { statut: note.statut }, newData: { statut, action } })
}

export function useSubmitForValidation() {
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: (note: NoteService) => transitionStatut(note, 'EN_ATTENTE_VALIDATION', 'Soumise pour validation'),
    onSuccess: invalidate,
  })
}

export function useValidateNote() {
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: (note: NoteService) => transitionStatut(note, 'VALIDEE', 'Validée'),
    onSuccess: invalidate,
  })
}

export function useReturnToBrouillon() {
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: (note: NoteService) => transitionStatut(note, 'BROUILLON', 'Renvoyée en brouillon'),
    onSuccess: invalidate,
  })
}

/** Rappel (pas de validation requise) part directement de BROUILLON ; les autres types partent de
 * VALIDEE — les deux flux aboutissent ici. */
export function useDiffuserNote() {
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: (note: NoteService) => transitionStatut(note, 'DIFFUSEE', 'Diffusée', { date_diffusion: new Date().toISOString() }),
    onSuccess: invalidate,
  })
}

export function useDeleteNoteService() {
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes_service').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
