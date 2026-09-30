export interface Evenement {
  id: string
  titre: string
  date: string
  heure?: string
  description: string
  /** Classes concernées — vide = toute l'école. */
  classes: string[]
  createdBy?: string
  createdAt: string
}
