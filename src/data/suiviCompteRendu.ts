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
  /** Points 2 et 4 : quand les mêmes remarques valent pour toutes les classes du niveau (mêmes enseignants, mêmes élèves),
   * on les écrit une seule fois (`pointNCommun`) au lieu d'une zone par classe. Les textes par classe sont conservés :
   * décocher la fusion les retrouve. */
  point2Fusion?: boolean
  point2Commun?: string
  point4Fusion?: boolean
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
  const textFields = [cr.point1Commentaire, cr.point3Extra, cr.point6, cr.point7]
  if (textFields.some((t) => t && t.trim())) return true
  if ((cr.point2Fusion && cr.point2Commun?.trim()) || (cr.point4Fusion && cr.point4Commun?.trim())) return true
  const recordFields = [cr.point2, cr.point4]
  if (recordFields.some((r) => r && Object.values(r).some((v) => v && v.trim()))) return true
  if (cr.point3 && Object.values(cr.point3).some((e) => e.constat.trim() || e.mesure.trim())) return true
  if (cr.point5 && Object.values(cr.point5).some((e) => e.faits.trim() || e.reponse.trim())) return true
  return false
}

/** Les deux points du compte-rendu qui se remplissent classe par classe. */
export type PointParClasse = 'point2' | 'point4'

const communKey = (point: PointParClasse) => (point === 'point2' ? 'point2Commun' : 'point4Commun') as 'point2Commun' | 'point4Commun'
const fusionKey = (point: PointParClasse) => (point === 'point2' ? 'point2Fusion' : 'point4Fusion') as 'point2Fusion' | 'point4Fusion'

/** « CE1-A », « CE1-A et CE1-B », « 1APIC-A, 2APIC-A et 3APIC-A ». */
export function listeClasses(classes: string[]): string {
  return classes.length <= 1 ? classes.join('') : `${classes.slice(0, -1).join(', ')} et ${classes[classes.length - 1]}`
}

/** La fusion n'a de sens qu'avec au moins deux classes. */
export function estFusionne(cr: SuiviCompteRendu, point: PointParClasse, classes: string[]): boolean {
  return !!cr[fusionKey(point)] && classes.length > 1
}

/** Ce qui s'affiche (et s'imprime) pour le point : un seul texte commun si les classes sont fusionnées, sinon un
 * texte par classe. */
export function remarquesParClasse(cr: SuiviCompteRendu, point: PointParClasse, classes: string[]): { label: string; text: string }[] {
  if (estFusionne(cr, point, classes)) return [{ label: listeClasses(classes), text: cr[communKey(point)] ?? '' }]
  return classes.map((c) => ({ label: c, text: cr[point]?.[c] ?? '' }))
}

/** Le point porte-t-il du contenu (fusionné ou non) ? */
export function pointParClasseRempli(cr: SuiviCompteRendu, point: PointParClasse, classes: string[]): boolean {
  return remarquesParClasse(cr, point, classes).some((r) => r.text.trim())
}

/** Fusionne les classes. Le texte commun existant est gardé ; sinon on le prépare à partir des textes par classe :
 * identiques, on n'en garde qu'un ; différents, chacun reprend le nom de sa classe pour ne rien perdre. */
export function fusionner(cr: SuiviCompteRendu, point: PointParClasse, classes: string[]): SuiviCompteRendu {
  const key = communKey(point)
  let commun = cr[key] ?? ''
  if (!commun.trim()) {
    const parClasse = classes.map((c) => ({ classe: c, text: (cr[point]?.[c] ?? '').trim() })).filter((e) => e.text)
    const distincts = [...new Set(parClasse.map((e) => e.text))]
    commun = distincts.length <= 1 ? (distincts[0] ?? '') : parClasse.map((e) => `${e.classe} : ${e.text}`).join('\n')
  }
  return { ...cr, [fusionKey(point)]: true, [key]: commun }
}

/** Sépare de nouveau les classes : les textes par classe réapparaissent ; une classe sans texte reprend le texte
 * commun, pour qu'on ne reparte pas d'une zone vide. */
export function separer(cr: SuiviCompteRendu, point: PointParClasse, classes: string[]): SuiviCompteRendu {
  const commun = cr[communKey(point)] ?? ''
  const parClasse: Record<string, string> = { ...(cr[point] ?? {}) }
  if (commun.trim()) classes.forEach((c) => {
    if (!(parClasse[c] ?? '').trim()) parClasse[c] = commun
  })
  return { ...cr, [fusionKey(point)]: false, [point]: parClasse }
}
