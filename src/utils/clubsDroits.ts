import type { ModulePermission, Profile } from '../data/profiles'

/** Clé du droit sur l'argent des clubs dans `profiles.permissions` (hors des modules de navigation). */
export const CLUBS_PAIEMENTS_KEY = 'clubsPaiements'

export interface ClubsPaiementsAccess {
  canView: boolean
  canEdit: boolean
}

/** Droit par défaut quand aucune entrée explicite n'existe : seul le type « Direction » a accès (même règle que les fonctions SQL de la migration 079). */
export function droitParDefaut(role: string | undefined): ModulePermission {
  const direction = role === 'Direction'
  return { view: direction, edit: direction }
}

/**
 * Droit de voir et d'enregistrer les paiements des clubs. Contrairement aux autres modules (une clé absente donne l'accès
 * complet), l'argent est refusé par défaut : une entrée explicite décide, sinon seule la Direction y a accès. Sans profil
 * chargé, rien n'est autorisé. Les deux droits suivent exactement les fonctions SQL `clubs_paiements_view/edit`.
 */
export function clubsPaiementsAccess(profile: Pick<Profile, 'role' | 'permissions'> | undefined): ClubsPaiementsAccess {
  if (!profile) return { canView: false, canEdit: false }
  const droit = profile.permissions?.[CLUBS_PAIEMENTS_KEY] ?? droitParDefaut(profile.role)
  return { canView: !!droit.view, canEdit: !!droit.edit }
}
