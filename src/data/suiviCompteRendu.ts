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
  /** Points 2 et 4 : remarques communes à toutes les classes du niveau (mêmes enseignants, mêmes élèves), en plus de
   * celles propres à chaque classe (`point2`, `point4`). Les deux se remplissent indépendamment. */
  point2Commun?: string
  point3?: Record<string, SuiviCompteRenduRisqueEntry>
  point3Extra?: string
  point4?: Record<string, string>
  point4Commun?: string
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
  const textFields = [cr.point1Commentaire, cr.point3Extra, cr.point6, cr.point7, cr.point2Commun, cr.point4Commun]
  if (textFields.some((t) => t && t.trim())) return true
  const recordFields = [cr.point2, cr.point4]
  if (recordFields.some((r) => r && Object.values(r).some((v) => v && v.trim()))) return true
  if (cr.point3 && Object.values(cr.point3).some((e) => e.constat.trim() || e.mesure.trim())) return true
  if (cr.point5 && Object.values(cr.point5).some((e) => e.faits.trim() || e.reponse.trim())) return true
  return false
}

/** Les deux points du compte-rendu qui se remplissent classe par classe. */
export type PointParClasse = 'point2' | 'point4'

const communKey = (point: PointParClasse) => (point === 'point2' ? 'point2Commun' : 'point4Commun') as 'point2Commun' | 'point4Commun'

/** « CE1-A », « CE1-A et CE1-B », « 1APIC-A, 2APIC-A et 3APIC-A ». */
export function listeClasses(classes: string[]): string {
  return classes.length <= 1 ? classes.join('') : `${classes.slice(0, -1).join(', ')} et ${classes[classes.length - 1]}`
}

/** Une zone commune n'a de sens qu'avec au moins deux classes. */
export function aUneZoneCommune(classes: string[]): boolean {
  return classes.length > 1
}

export interface RemarqueImprimee {
  label: string
  text: string
  /** Remarque commune à toutes les classes (sinon propre à la classe nommée). */
  commune: boolean
}

/**
 * Ce qui s'imprime pour le point : la remarque commune d'abord (pleine largeur), puis celles propres à chaque classe.
 * Avec une remarque commune, les classes sans remarque propre sont omises ; sans remarque commune, toutes les classes
 * figurent (celles sans texte restent vides), comme avant.
 */
export function remarquesImprimees(cr: SuiviCompteRendu, point: PointParClasse, classes: string[]): RemarqueImprimee[] {
  const commun = aUneZoneCommune(classes) ? (cr[communKey(point)] ?? '').trim() : ''
  const parClasse = classes.map((c) => ({ label: c, text: cr[point]?.[c] ?? '', commune: false }))
  if (!commun) return parClasse
  return [{ label: listeClasses(classes), text: commun, commune: true }, ...parClasse.filter((e) => e.text.trim())]
}

/** Le point porte-t-il du contenu (commun ou propre à une classe) ? */
export function pointParClasseRempli(cr: SuiviCompteRendu, point: PointParClasse, classes: string[]): boolean {
  if (aUneZoneCommune(classes) && (cr[communKey(point)] ?? '').trim()) return true
  return classes.some((c) => (cr[point]?.[c] ?? '').trim())
}

/** Texte identique saisi dans toutes les classes (copié d'une classe à l'autre) : candidat naturel à la zone commune.
 * `null` s'il y a une zone commune déjà remplie, une seule classe, un texte absent ou des textes différents. */
export function texteIdentiqueAToutesLesClasses(cr: SuiviCompteRendu, point: PointParClasse, classes: string[]): string | null {
  if (!aUneZoneCommune(classes) || (cr[communKey(point)] ?? '').trim()) return null
  const textes = classes.map((c) => (cr[point]?.[c] ?? '').trim())
  return textes[0] && textes.every((t) => t === textes[0]) ? textes[0] : null
}

/** Passe le texte identique des classes dans la zone commune et vide les zones par classe. */
export function passerEnCommun(cr: SuiviCompteRendu, point: PointParClasse, classes: string[]): SuiviCompteRendu {
  const texte = texteIdentiqueAToutesLesClasses(cr, point, classes)
  if (texte === null) return cr
  const parClasse: Record<string, string> = { ...(cr[point] ?? {}) }
  classes.forEach((c) => {
    parClasse[c] = ''
  })
  return { ...cr, [communKey(point)]: texte, [point]: parClasse }
}
