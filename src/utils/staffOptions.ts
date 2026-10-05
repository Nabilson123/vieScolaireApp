import { getProfilesSnapshot } from '../services/profilesService'
import { ROLE_LABELS } from '../data/profiles'

export interface StaffOption {
  value: string
  label: string
}

/**
 * Comptes actifs de l'app (Direction, CPE, Surveillant, AED, Secrétariat…), libellés « Nom — Rôle », triés.
 * L'application stocke le **nom** (pas l'identifiant) de la personne choisie ; `current` — une valeur déjà
 * enregistrée — reste proposé même si son compte a été désactivé depuis.
 */
export function buildStaffOptions(current?: string): StaffOption[] {
  const options = getProfilesSnapshot()
    .filter((p) => p.actif)
    .map((p) => {
      const nom = p.nomComplet || p.email
      return { value: nom, label: `${nom} — ${ROLE_LABELS[p.role] ?? p.role}` }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
  if (current && !options.some((o) => o.value === current)) options.push({ value: current, label: current })
  return options
}
