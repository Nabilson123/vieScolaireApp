import type { ReclamationRecord } from '../data/studentDetails'
import { parseAnyDate } from './period'
import { cleanReclamationText } from './reclamationsLogic'
import { significantTokens } from './textMatch'

/** Une réclamation résolue depuis moins de ce nombre de jours compte encore comme « récente » : la famille
 * revient peut-être sur le même sujet. */
export const DOUBLON_FENETRE_JOURS = 30

/** Part minimale de mots significatifs en commun (rapportée à l'objet le plus court) pour parler de sujet proche. */
export const DOUBLON_SEUIL_MOTS = 0.5

export interface SimilarReclamation {
  reclamation: ReclamationRecord
  /** Pourquoi elle ressemble : même catégorie, objet proche, ou les deux. */
  raison: 'categorie' | 'objet' | 'categorie_et_objet'
}

function isStillRelevant(r: ReclamationRecord, now: Date): boolean {
  if (r.statut !== 'Résolue') return true
  // Résolue : on regarde la date de résolution, à défaut la date de réception (anciennes réclamations).
  const ref = r.resoluLe ? new Date(r.resoluLe) : parseAnyDate(r.date)
  if (!ref || Number.isNaN(ref.getTime())) return false
  return now.getTime() - ref.getTime() <= DOUBLON_FENETRE_JOURS * 86400000
}

function shareEnoughWords(a: string, b: string): boolean {
  const ta = new Set(significantTokens(a))
  const tb = new Set(significantTokens(b))
  if (ta.size === 0 || tb.size === 0) return false
  let common = 0
  ta.forEach((t) => {
    if (tb.has(t)) common += 1
  })
  return common / Math.min(ta.size, tb.size) >= DOUBLON_SEUIL_MOTS
}

/**
 * Réclamations déjà enregistrées pour l'élève qui ressemblent à celle qu'on s'apprête à saisir : non résolues,
 * ou résolues depuis moins de 30 jours, de même catégorie ou dont l'objet partage au moins la moitié de ses mots
 * significatifs. Sert d'avertissement non bloquant à la saisie.
 */
export function findSimilarReclamations(
  existing: ReclamationRecord[],
  candidate: { category: string; objet: string },
  now: Date = new Date()
): SimilarReclamation[] {
  const objet = cleanReclamationText(candidate.objet)
  const out: SimilarReclamation[] = []
  existing.forEach((r) => {
    if (!isStillRelevant(r, now)) return
    const memeCategorie = r.type === candidate.category
    const objetProche = objet.length > 0 && shareEnoughWords(objet, cleanReclamationText(r.objet))
    if (!memeCategorie && !objetProche) return
    out.push({ reclamation: r, raison: memeCategorie && objetProche ? 'categorie_et_objet' : memeCategorie ? 'categorie' : 'objet' })
  })
  // Les plus parlantes d'abord (catégorie + objet), puis les non résolues.
  const rank = (s: SimilarReclamation) => (s.raison === 'categorie_et_objet' ? 0 : s.raison === 'objet' ? 1 : 2) * 2 + (s.reclamation.statut === 'Résolue' ? 1 : 0)
  return out.sort((a, b) => rank(a) - rank(b))
}
