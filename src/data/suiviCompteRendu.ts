export interface SuiviCompteRenduRisqueEntry {
  constat: string
  mesure: string
}

export interface SuiviCompteRenduReclamationEntry {
  faits: string
  reponse: string
}

/** Compte-rendu structuré en 8 points de la réunion hebdomadaire de suivi de classe — persisté
 * dans suivi_profs.compte_rendu (jsonb), séparé du champ notes texte libre du flux générique
 * "Suivi Profs". Les clés numérotées suivent l'ordre du jour canonique du Cahier de Procédures. */
export interface SuiviCompteRendu {
  point1Commentaire?: string
  point2?: Record<string, string>
  point3?: Record<string, SuiviCompteRenduRisqueEntry>
  point3Extra?: string
  point4?: Record<string, string>
  point5?: Record<string, SuiviCompteRenduReclamationEntry>
  point6?: string
  point7?: string
  presence?: Record<string, 'present' | 'absent' | 'excuse'>
  redigePar?: string
  diffusionPP?: boolean
  diffusionDirection?: boolean
  diffusionEquipe?: boolean
}

/** Un compte-rendu structuré est considéré "rédigé" dès qu'au moins un point porte du contenu —
 * sert à choisir entre "Rédiger" et "Modifier" sur les boutons d'accès, sans dépendre du statut. */
export function hasCompteRenduContent(cr: SuiviCompteRendu | undefined): boolean {
  if (!cr) return false
  const textFields = [cr.point1Commentaire, cr.point3Extra, cr.point6, cr.point7]
  if (textFields.some((t) => t && t.trim())) return true
  const recordFields = [cr.point2, cr.point4]
  if (recordFields.some((r) => r && Object.values(r).some((v) => v && v.trim()))) return true
  if (cr.point3 && Object.values(cr.point3).some((e) => e.constat.trim() || e.mesure.trim())) return true
  if (cr.point5 && Object.values(cr.point5).some((e) => e.faits.trim() || e.reponse.trim())) return true
  return false
}
