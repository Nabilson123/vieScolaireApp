/** Les six types de profil d'origine : leur clé reste la valeur stockée dans `profiles.role`, et les droits des
 * notes de service (data/notesService.ts) s'appuient dessus. */
export type BuiltInRole = 'CPE' | 'Surveillant' | 'Direction' | 'AED' | 'Secrétariat' | 'Autre'

export const BUILT_IN_ROLES: BuiltInRole[] = ['CPE', 'Surveillant', 'Direction', 'AED', 'Secrétariat', 'Autre']

/** Un type d'origine, ou un type ajouté dans Référentiel (clé `type-xxxxxxxx`, sans droit particulier). */
export type ProfileRole = BuiltInRole | (string & {})

// Libellés d'origine : repli quand le Référentiel n'est pas encore chargé. Le libellé affiché vient de la table
// `profile_types` (voir `roleLabel` dans services/profileTypesService.ts), distinct de la valeur stockée.
export const DEFAULT_ROLE_LABELS: Record<BuiltInRole, string> = {
  CPE: 'CPE',
  Surveillant: 'Surveillant',
  Direction: 'Direction de la vie scolaire',
  AED: 'AED',
  Secrétariat: 'Secrétariat',
  Autre: 'Autre',
}

export interface ModulePermission {
  view: boolean
  edit: boolean
}

export interface Profile {
  id: string
  email: string
  nomComplet: string
  role: ProfileRole
  actif: boolean
  permissions: Record<string, ModulePermission>
  /** Services de traitement des réclamations auxquels la personne appartient (identifiants de
   * `reclamation_services`) ; vide si aucun. N'a aucun effet sur les droits d'accès. */
  serviceIds: string[]
  /** Image de signature manuscrite scannée (data URI base64), pour les documents officiels signés
   * comme les Notes de Service — même mécanisme d'upload que le logo de l'établissement. */
  signatureImage?: string
}

// Même petit utilitaire déjà dupliqué indépendamment dans data/teachers.ts et data/students.ts —
// convention déjà établie dans ce projet plutôt que de forcer un import cross-domaine.
export function initials(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}
