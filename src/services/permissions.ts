import { useCurrentUserId, getCurrentUserIdSnapshot } from './currentUser'
import { useProfiles, getProfilesSnapshot } from './profilesService'
import type { Profile } from '../data/profiles'
import { clubsPaiementsAccess, type ClubsPaiementsAccess } from '../utils/clubsDroits'

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

/** Nom de la personne connectée, hors React (même convention que l'écran Cockpit : nom complet, sinon
 * e-mail) — pour signer un événement d'historique. Chaîne vide si la session n'est pas prête. */
export function getCurrentActorName(): string {
  const userId = getCurrentUserIdSnapshot()
  const profile = getProfilesSnapshot().find((p) => p.id === userId)
  return profile?.nomComplet || profile?.email || ''
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

/**
 * Droit sur les paiements des clubs (règlements, reçus, impayés). À l'inverse de `getModuleAccess`, l'absence d'entrée
 * REFUSE l'accès : seule la Direction l'a par défaut. Le même droit est imposé en base par les politiques RLS.
 */
export function getClubsPaiementsAccess(profile: Profile | undefined): ClubsPaiementsAccess {
  return clubsPaiementsAccess(profile)
}

export function useClubsPaiementsAccess(): ClubsPaiementsAccess {
  return clubsPaiementsAccess(useCurrentProfile())
}
