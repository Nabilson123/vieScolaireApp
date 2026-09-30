export type ProfileRole = 'CPE' | 'Surveillant' | 'Direction' | 'AED' | 'Secrétariat' | 'Autre'

// Libellé affiché pour chaque rôle — distinct de la valeur stockée (`ProfileRole`), qui reste
// inchangée partout où elle sert à de la logique (canDraftType/canValidateType, filtres,
// comparaisons) pour ne pas toucher aux données déjà en base ni casser ces comparaisons.
export const ROLE_LABELS: Record<ProfileRole, string> = {
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
  /** Image de signature manuscrite scannée (data URI base64), pour les documents officiels signés
   * comme les Notes de Service — même mécanisme d'upload que le logo de l'établissement. */
  signatureImage?: string
}

// Même petit utilitaire déjà dupliqué indépendamment dans data/teachers.ts et data/students.ts —
// convention déjà établie dans ce projet plutôt que de forcer un import cross-domaine.
export function initials(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}
