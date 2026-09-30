export interface TypeControleNote {
  id: string
  nom: string
  ponderation: number
}

export interface NiveauAcquisition {
  id: string
  nom: string
  couleur: 'emerald' | 'amber' | 'rose' | 'sky'
}

export interface Objectif {
  id: string
  matiere: string
  niveau: string
  texte: string
}

export interface Competence {
  id: string
  matiere: string
  niveau: string
  texte: string
}

export interface Appreciation {
  id: string
  categorie: 'Excellent' | 'Bien' | 'Peut mieux faire' | 'Insuffisant'
  texte: string
}
