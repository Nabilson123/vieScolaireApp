export interface TeacherAbsenceRecord {
  date: string
  type: 'ABSENCE' | 'RETARD'
  justified: boolean
  classe: string
  duree: number
  motif: string
  slotId?: string
  /** Créneaux explicitement écartés de "Absences en attente de remplacement" (ex. trop courts pour
   * justifier un remplaçant) — n'affecte que l'affichage, l'absence elle-même reste inchangée. */
  ignoredGaps?: { start: string; end: string }[]
}

export interface RemplacementRecord {
  date: string
  classe: string
  matiere: string
  profRemplace: string
  heures: number
  /** Créneau exact couvert par ce remplacement, quand la séance a été divisée entre plusieurs remplaçants. */
  start?: string
  end?: string
  consignes?: string
}

export interface TeacherExtra {
  absences: TeacherAbsenceRecord[]
  remplacements: RemplacementRecord[]
}
