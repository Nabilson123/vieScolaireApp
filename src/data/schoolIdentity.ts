export interface SchoolCycles {
  maternelle: boolean
  primaire: boolean
  college: boolean
  lycee: boolean
}

export interface SchoolIdentity {
  nom: string
  nomAr: string
  tel1: string
  tel2: string
  fax: string
  cycles: SchoolCycles
  adresse: string
  siteWeb: string
  email: string
  facebook: string
  instagram: string
  linkedin: string
  logo?: string
  /** Image du cachet officiel de l'établissement (data URI base64), même mécanisme que le logo —
   * utilisée sur les documents imprimés à côté d'une signature (Notes de Service, rapports à Visa
   * de la direction). */
  cachet?: string
  /** Nom de l'association sportive : il remplace celui de l'école sur les documents des clubs (reçus, listes, états). */
  associationNom: string
  /** Logo de l'association sportive (data URI base64), même mécanisme que le logo de l'école ; absent = aucun logo sur les documents des clubs. */
  associationLogo?: string
}
