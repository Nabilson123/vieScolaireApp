import type { ReclamationRecord } from '../data/studentDetails'

/**
 * Politique de délais des réclamations. Deux engagements envers la famille : accuser réception, puis
 * résoudre. La date de réception n'a pas d'heure : les délais se comptent en jours pleins.
 *
 * Ces valeurs sont des choix raisonnables, pas des règles validées par la direction — d'où des constantes
 * regroupées ici, faciles à ajuster à l'usage (même statut que les seuils de récurrence des signaux).
 */
export type NiveauReclamation = 'urgent' | 'standard' | 'administratif'

export const DELAIS_PAR_NIVEAU: Record<NiveauReclamation, { accuse: number; resolution: number }> = {
  // Accusé le jour même, résolution sous 24 h.
  urgent: { accuse: 0, resolution: 1 },
  // 72 h : le délai annoncé aux familles jusqu'ici.
  standard: { accuse: 1, resolution: 3 },
  administratif: { accuse: 1, resolution: 5 },
}

export const NIVEAU_LABELS: Record<NiveauReclamation, string> = {
  urgent: 'Urgent',
  standard: 'Standard',
  administratif: 'Administratif',
}

/** Catégories qui ne peuvent pas attendre (sécurité des élèves) ou qui relèvent d'un traitement administratif. */
export const NIVEAU_PAR_CATEGORIE: Record<string, NiveauReclamation> = {
  'Harcèlement / Intimidation': 'urgent',
  Sécurité: 'urgent',
  'Infirmerie / Santé': 'urgent',
  'Frais de scolarité / Facturation': 'administratif',
  'Inscription / Admission': 'administratif',
  'Emploi du temps': 'administratif',
  'Uniforme / Tenue vestimentaire': 'administratif',
}

/** Jours entre la résolution et la relance de la famille (« la réponse vous a-t-elle convenu ? »). */
export const RELANCE_FAMILLE_JOURS = 5

export type PolicyInput = Pick<ReclamationRecord, 'type'> & { urgente?: boolean }

/** Niveau d'une réclamation : « urgent » si forcé à la main, sinon selon sa catégorie (standard par défaut). */
export function niveauOf(r: PolicyInput): NiveauReclamation {
  if (r.urgente) return 'urgent'
  return NIVEAU_PAR_CATEGORIE[r.type] ?? 'standard'
}

/** Jours accordés pour accuser réception. */
export function delaiAccuseJours(r: PolicyInput): number {
  return DELAIS_PAR_NIVEAU[niveauOf(r)].accuse
}

/** Jours accordés pour résoudre. */
export function delaiResolutionAutorise(r: PolicyInput): number {
  return DELAIS_PAR_NIVEAU[niveauOf(r)].resolution
}
