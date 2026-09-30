import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Parent, ParentStudentLink } from '../data/parents'
import { logAudit } from './auditLogService'

interface ParentRow {
  id: string
  email: string
  nom_complet: string
  telephone: string
  actif: boolean
}

function rowToParent(row: ParentRow): Parent {
  return { id: row.id, email: row.email, nomComplet: row.nom_complet, telephone: row.telephone, actif: row.actif }
}

const QUERY_KEY = ['parents']

export async function fetchParents(): Promise<Parent[]> {
  const { data, error } = await supabase.from('parents').select('*').order('nom_complet', { ascending: true })
  if (error) throw error
  return (data as ParentRow[]).map(rowToParent)
}

export function useParents(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchParents, enabled })
  // Affectation synchrone (pas un useEffect) : même raison que profilesService.ts/classesService.ts.
  if (query.data) cachedParents = query.data
  return query
}

let cachedParents: Parent[] = []

/** Instantané synchrone pour les utilitaires hors-React. */
export function getParentsSnapshot(): Parent[] {
  return cachedParents
}

/** Recherche insensible à la casse — utilisé pour éviter de ré-inviter un parent déjà connu (import Excel, formulaire élève). */
export function findParentByEmailSnapshot(email: string): Parent | undefined {
  const needle = email.trim().toLowerCase()
  if (!needle) return undefined
  return cachedParents.find((p) => p.email.toLowerCase() === needle)
}

/**
 * Crée un vrai compte Supabase Auth (type parent) + envoie l'email d'invitation, via manage-user.
 * Fonction hors-React réutilisée à la fois par useInviteParent() (modale) et par le commit de
 * l'import Excel (pas un composant React, ne peut pas appeler un hook de mutation).
 */
export async function inviteParentAccount(input: { email: string; nomComplet: string; telephone: string }): Promise<{ id: string }> {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action: 'invite', email: input.email, nomComplet: input.nomComplet, telephone: input.telephone, accountType: 'parent' },
  })
  if (error) throw error
  const result = data as { id: string }
  void logAudit({ tableName: 'parents', recordId: result.id, action: 'insert', newData: input })
  return result
}

export function useInviteParent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: inviteParentAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** Désactive/réactive réellement la connexion d'un compte parent (pas seulement un flag visuel). */
export function useSetParentActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ parentId, actif }: { parentId: string; actif: boolean }) => {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: actif ? 'enable' : 'disable', userId: parentId, accountType: 'parent' },
      })
      if (error) throw error
      void logAudit({ tableName: 'parents', recordId: parentId, action: 'update', newData: { actif } })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** Suppression définitive du compte (auth.users + parents en cascade). Action irréversible. */
export function useDeleteParent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (parentId: string) => {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'delete', userId: parentId, accountType: 'parent' },
      })
      if (error) throw error
      void logAudit({ tableName: 'parents', recordId: parentId, action: 'delete' })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

// --- Liens parent <-> élève(s) ---

interface ParentStudentRow {
  id: string
  parent_id: string
  student_id: string
  relation: string
}

function rowToLink(row: ParentStudentRow): ParentStudentLink {
  return { id: row.id, parentId: row.parent_id, studentId: row.student_id, relation: row.relation }
}

const LINKS_QUERY_KEY = ['parentStudents']

async function fetchParentStudentLinks(): Promise<ParentStudentLink[]> {
  const { data, error } = await supabase.from('parent_students').select('*')
  if (error) throw error
  return (data as ParentStudentRow[]).map(rowToLink)
}

export function useParentStudentLinks(enabled = true) {
  const query = useQuery({ queryKey: LINKS_QUERY_KEY, queryFn: fetchParentStudentLinks, enabled })
  if (query.data) cachedLinks = query.data
  return query
}

let cachedLinks: ParentStudentLink[] = []

export function getParentStudentLinksSnapshot(): ParentStudentLink[] {
  return cachedLinks
}

/**
 * Fonction hors-React réutilisée par useLinkParentToStudent() et par le commit de l'import Excel.
 * upsert sur la contrainte unique (parent_id, student_id) : idempotent en cas de ré-import.
 */
export async function linkParentToStudent(input: { parentId: string; studentId: string; relation: string }): Promise<void> {
  const { error } = await supabase
    .from('parent_students')
    .upsert({ parent_id: input.parentId, student_id: input.studentId, relation: input.relation }, { onConflict: 'parent_id,student_id', ignoreDuplicates: true })
  if (error) throw error
  void logAudit({ tableName: 'parent_students', recordId: `${input.parentId}:${input.studentId}`, action: 'insert', newData: input })
}

export function useLinkParentToStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: linkParentToStudent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LINKS_QUERY_KEY }),
  })
}

export function useUnlinkParentFromStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from('parent_students').delete().eq('id', linkId)
      if (error) throw error
      void logAudit({ tableName: 'parent_students', recordId: linkId, action: 'delete' })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LINKS_QUERY_KEY }),
  })
}
