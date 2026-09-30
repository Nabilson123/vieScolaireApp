import { useCurrentUserId } from './currentUser'
import { useProfiles, getProfilesSnapshot } from './profilesService'
import type { Profile } from '../data/profiles'

export interface ModuleAccess {
  canView: boolean
  canEdit: boolean
}

/** Profil de la personne connectée (undefined tant que session/cache ne sont pas prêts). */
export function useCurrentProfile(): Profile | undefined {
  const userId = useCurrentUserId()
  const { data: profiles = getProfilesSnapshot() } = useProfiles()
  return profiles.find((p) => p.id === userId)
}

/**
 * Fonction pure, PAS un hook — appelable dans .map()/.filter() sur navGroups (Sidebar) sans violer
 * les règles des hooks ; seul useCurrentProfile() est un hook, appelé une fois par site d'appel.
 * Profil absent ou clé de module absente ⇒ accès complet (même défaut permissif que la migration 033).
 */
export function getModuleAccess(profile: Profile | undefined, moduleKey: string): ModuleAccess {
  const entry = profile?.permissions?.[moduleKey]
  if (!entry) return { canView: true, canEdit: true }
  return { canView: entry.view, canEdit: entry.edit }
}
