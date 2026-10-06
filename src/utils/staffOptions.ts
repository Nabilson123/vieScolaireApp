import { getProfilesSnapshot } from '../services/profilesService'
import { ROLE_LABELS, type Profile } from '../data/profiles'
import type { ReclamationService } from '../data/reclamationServices'
import { membersOf } from './reclamationsServices'

export interface StaffOption {
  value: string
  label: string
  /** Renseigné quand un service est donné : « Service X » pour ses membres, « Autres » pour le reste. */
  group?: string
}

/**
 * Comptes actifs de l'app (Direction, CPE, Surveillant, AED, Secrétariat…), libellés « Nom — Rôle », triés.
 * L'application stocke le **nom** (pas l'identifiant) de la personne choisie ; `current` — une valeur déjà
 * enregistrée — reste proposé même si son compte a été désactivé depuis. Avec `service`, les membres de ce
 * service passent en premier, dans leur propre groupe.
 */
export function staffOptionsFrom(profiles: Profile[], current?: string, service?: ReclamationService): StaffOption[] {
  const memberIds = new Set(service ? membersOf(service, profiles).map((p) => p.id) : [])
  const options = profiles
    .filter((p) => p.actif)
    .map((p) => {
      const nom = p.nomComplet || p.email
      return { value: nom, label: `${nom} — ${ROLE_LABELS[p.role] ?? p.role}`, member: memberIds.has(p.id) }
    })
    .sort((a, b) => (a.member === b.member ? a.label.localeCompare(b.label) : a.member ? -1 : 1))
  const result: StaffOption[] = options.map((o) => ({
    value: o.value,
    label: o.label,
    ...(service ? { group: o.member ? `Service ${service.nom}` : 'Autres' } : {}),
  }))
  if (current && !result.some((o) => o.value === current)) result.push({ value: current, label: current, ...(service ? { group: 'Autres' } : {}) })
  return result
}

export function buildStaffOptions(current?: string, service?: ReclamationService): StaffOption[] {
  return staffOptionsFrom(getProfilesSnapshot(), current, service)
}
