export interface SortieAnticipee {
  id: string
  studentId: string
  date: string
  heure: string
  recuperePar: string
  motif: string
  source: 'staff' | 'parent'
  createdBy: string | null
  parentId: string | null
  /** Renseignée quand l'élève revient finir sa journée normalement — cf. useReintegrerSortieAnticipee. */
  heureRetour: string | null
}
