import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { Profile, ProfileRole } from '../data/profiles'
import { logAudit } from './auditLogService'

interface ProfileRow {
  id: string
  email: string
  nom_complet: string
  role: string
  actif: boolean
  permissions: Profile['permissions']
  signature_image: string | null
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    nomComplet: row.nom_complet,
    role: row.role as Profile['role'],
    actif: row.actif,
    permissions: row.permissions ?? {},
    signatureImage: row.signature_image ?? undefined,
  }
}

const QUERY_KEY = ['profiles']

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('nom_complet', { ascending: true })
  if (error) throw error
  return (data as ProfileRow[]).map(rowToProfile)
}

export function useProfiles(enabled = true) {
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchProfiles, enabled })
  // Affectation synchrone (pas un useEffect) : la Sidebar lit getProfilesSnapshot() pour retrouver
  // le profil de la personne connectée dès le premier rendu — même raison que classesService.ts.
  if (query.data) cachedProfiles = query.data
  return query
}

let cachedProfiles: Profile[] = []

/** Instantané synchrone pour les utilitaires hors-React. */
export function getProfilesSnapshot(): Profile[] {
  return cachedProfiles
}

/** Une personne modifie son propre nom affiché (résout le fallback "email" du backfill de la migration). */
export function useUpdateOwnProfileName() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, nomComplet }: { id: string; nomComplet: string }) => {
      const { error } = await supabase.from('profiles').update({ nom_complet: nomComplet }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** Crée un vrai compte Supabase Auth + envoie l'email d'invitation, via la fonction manage-user. */
export function useInviteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; nomComplet: string; role: ProfileRole }) => {
      const { data, error } = await supabase.functions.invoke('manage-user', { body: { action: 'invite', ...input } })
      if (error) throw error
      const result = data as { id: string }
      void logAudit({ tableName: 'profiles', recordId: result.id, action: 'insert', newData: input })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** Désactive/réactive réellement la connexion d'un compte (pas seulement un flag visuel). */
export function useSetUserActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, actif }: { userId: string; actif: boolean }) => {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: actif ? 'enable' : 'disable', userId },
      })
      if (error) throw error
      void logAudit({ tableName: 'profiles', recordId: userId, action: 'update', newData: { actif } })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/**
 * Modifie le nom affiché ET le profil (CPE/Surveillant/Direction/Autre) d'un compte — le sien
 * (`EditOwnProfileModal.tsx`) ou celui d'un autre (`EditUserModal.tsx`, réservé à un administrateur
 * `canEdit`) : la policy RLS "Staff can manage profiles" (migration 043) autorise déjà tout membre
 * du personnel à mettre à jour n'importe quelle ligne `profiles`, un seul point d'écriture suffit
 * pour les deux cas. Jamais la grille de permissions ni le statut actif/désactivé, gérés séparément
 * (`useUpdateProfilePermissions`, `useSetUserActive`). `role` n'est qu'une étiquette d'affichage/
 * filtre (`UsersGlobal.tsx`), elle ne pilote aucune logique d'accès — sans rapport avec `permissions`.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, nomComplet, role }: { id: string; nomComplet: string; role: ProfileRole }) => {
      const { error } = await supabase.from('profiles').update({ nom_complet: nomComplet, role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/**
 * Un administrateur change l'email de connexion d'un AUTRE compte — contrairement à `useUpdateProfile`,
 * ça ne peut pas passer par une simple écriture RLS : l'email vit dans `auth.users`, hors de portée du
 * client, d'où le passage par manage-user (clé service-role). La fonction met aussi à jour
 * `profiles.email` (copie d'affichage) et déclenche un email de réinitialisation de mot de passe vers
 * la nouvelle adresse, pour que la personne puisse s'authentifier de nouveau — même mécanisme
 * d'envoi que l'invitation initiale (déjà en production), juste le gabarit "mot de passe oublié".
 */
export function useUpdateUserEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, newEmail }: { userId: string; newEmail: string }) => {
      const { error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'updateEmail', userId, newEmail },
      })
      if (error) throw error
      void logAudit({ tableName: 'profiles', recordId: userId, action: 'update', newData: { email: newEmail } })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** Un administrateur modifie la grille Aperçu/Éditer d'une autre personne (jamais la sienne). */
export function useUpdateProfilePermissions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, permissions }: { id: string; permissions: Profile['permissions'] }) => {
      const previous = cachedProfiles.find((p) => p.id === id)
      const { error } = await supabase.from('profiles').update({ permissions }).eq('id', id)
      if (error) throw error
      void logAudit({
        tableName: 'profiles',
        recordId: id,
        action: 'update',
        oldData: previous ? { permissions: previous.permissions } : undefined,
        newData: { permissions },
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

/** Suppression définitive du compte (auth.users + profiles en cascade). Action irréversible. */
export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke('manage-user', { body: { action: 'delete', userId } })
      if (error) throw error
      void logAudit({ tableName: 'profiles', recordId: userId, action: 'delete' })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
