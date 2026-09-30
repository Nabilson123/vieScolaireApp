export interface Periode {
  id: string
  type: 'Trimestre' | 'Semestre'
  nom: string
  dateDebut: string
  dateFin: string
}
