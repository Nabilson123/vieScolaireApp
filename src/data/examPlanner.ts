export const EXAM_TYPES = ['Examen Officiel', 'Examen Blanc'] as const
export type ExamType = (typeof EXAM_TYPES)[number]

/** Un surveillant peut couvrir une plage plus courte que la durée complète de l'examen (surveillance partagée). */
export interface SurveillantAssignment {
  teacherId: string
  start: string
  end: string
}

export interface ExamSession {
  id: string
  date: string
  start: string
  end: string
  classe: string
  matiere: string
  salleLabel: string
  surveillants: SurveillantAssignment[]
  consignes: string
  type: ExamType
  periodId?: string
}
