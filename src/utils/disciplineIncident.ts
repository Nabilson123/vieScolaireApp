import type { DisciplineEvent } from '../data/studentDetails'
import type { Student } from '../data/students'
import { SANCTION_POINTS, type SanctionLevel } from '../data/disciplineTypes'

/** Une fiche disciplinaire à écrire dans le dossier d'UN élève. */
export interface DisciplinePayload {
  studentId: string
  title: string
  description: string
  points: number
  author: string
  date: string
  typeCode?: string
  sanction?: string
  conseilStatut?: string
  procedureStepsDone?: number[]
  retenueDate?: string
  retenueDuree?: string
  procedureStepDetails?: Record<number, string>
  procedureDetailsPrintable?: boolean
  privationActivite?: string
  privationDuree?: string
  groupeId?: string
  victimeIds?: string[]
}

/** Ce que le formulaire de saisie sait, une fois rempli. */
export interface DisciplineForm {
  nature: 'merite' | 'incident'
  /** Élèves à qui le fait est imputé : une fiche chacun. */
  authorIds: string[]
  /** Élèves victimes (incident seulement) : mentionnés sur les fiches des auteurs, rien dans leur propre dossier. */
  victimIds: string[]
  title: string
  description: string
  /** Enseignant qui signale. */
  author: string
  date: string
  groupeId?: string
  /** Mérite : points accordés à chaque élève. */
  meritePoints?: number
  incident?: {
    /** Absent pour « Autre incident (hors cahier) ». */
    typeCode?: string
    /** Sanction proposée à tous… */
    sanction: SanctionLevel
    /** …sauf à ceux dont la sanction a été modifiée à part. */
    sanctionByStudent: Record<string, SanctionLevel>
    stepsDone: number[]
    stepDetails: Record<number, string>
    detailsPrintable: boolean
    retenueDate: string
    retenueDuree: string
    privationActivite: string
    privationDuree: string
  }
}

const PRIVATION = 'Privation d’activités périscolaires/sportives'

export function nouveauGroupeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Sanction effectivement retenue pour un élève : celle choisie pour lui, sinon la sanction commune. */
export function sanctionOf(form: Pick<DisciplineForm, 'incident'>, studentId: string): SanctionLevel | undefined {
  return form.incident ? (form.incident.sanctionByStudent[studentId] ?? form.incident.sanction) : undefined
}

/**
 * Une fiche par élève imputé. Un fait saisi pour plusieurs élèves partage un `groupeId` ; chaque élève garde sa sanction
 * (donc ses points, sa note de conduite et sa convocation éventuelle). Les victimes ne reçoivent aucune fiche.
 */
export function buildDisciplinePayloads(form: DisciplineForm): DisciplinePayload[] {
  const groupeId = form.authorIds.length > 1 ? (form.groupeId ?? nouveauGroupeId()) : undefined
  const base = { title: form.title, description: form.description, author: form.author, date: form.date, groupeId }

  if (form.nature === 'merite' || !form.incident) {
    return form.authorIds.map((studentId) => ({ studentId, ...base, points: form.meritePoints ?? 0 }))
  }

  const inc = form.incident
  const hasDetails = Object.values(inc.stepDetails).some((v) => v.trim())
  return form.authorIds.map((studentId) => {
    const sanction = inc.sanctionByStudent[studentId] ?? inc.sanction
    return {
      studentId,
      ...base,
      points: SANCTION_POINTS[sanction],
      typeCode: inc.typeCode,
      sanction,
      conseilStatut: sanction === 'Conseil de discipline' ? 'a_convoquer' : undefined,
      procedureStepsDone: inc.typeCode ? inc.stepsDone : undefined,
      retenueDate: sanction === 'Retenue' ? inc.retenueDate.trim() || undefined : undefined,
      retenueDuree: sanction === 'Retenue' ? inc.retenueDuree.trim() || undefined : undefined,
      procedureStepDetails: hasDetails ? Object.fromEntries(Object.entries(inc.stepDetails).filter(([, v]) => v.trim())) : undefined,
      procedureDetailsPrintable: hasDetails ? inc.detailsPrintable : undefined,
      privationActivite: sanction === PRIVATION ? inc.privationActivite.trim() || undefined : undefined,
      privationDuree: sanction === PRIVATION ? inc.privationDuree.trim() || undefined : undefined,
      victimeIds: form.victimIds.length > 0 ? form.victimIds : undefined,
    }
  })
}

type DisciplineOf = (studentId: string) => DisciplineEvent[]

/** Les autres élèves qui figurent dans la même saisie collective (même `groupeId`), pour afficher « avec … ». */
export function coAuteurs(entry: Pick<DisciplineEvent, 'groupeId'>, studentId: string, students: Student[], disciplineOf: DisciplineOf): Student[] {
  const groupeId = entry.groupeId
  if (!groupeId) return []
  return students.filter((s) => s.id !== studentId && disciplineOf(s.id).some((d) => d.groupeId === groupeId))
}

export interface FaitSubi {
  /** Un fait collectif apparaît une seule fois dans le dossier de la victime, avec tous ses auteurs. */
  key: string
  date: string
  title: string
  description: string
  typeCode?: string
  signalePar: string
  auteurs: Student[]
}

/** Faits dont l'élève est victime : on lit les fiches des autres élèves qui le citent (rien n'est copié dans son dossier). */
export function faitsSubis(studentId: string, students: Student[], disciplineOf: DisciplineOf): FaitSubi[] {
  const byKey = new Map<string, FaitSubi>()
  students.forEach((s) => {
    if (s.id === studentId) return
    disciplineOf(s.id).forEach((d, i) => {
      if (!d.victimeIds?.includes(studentId)) return
      const key = d.groupeId ?? `${s.id}-${i}`
      const existing = byKey.get(key)
      if (existing) {
        if (!existing.auteurs.some((a) => a.id === s.id)) existing.auteurs.push(s)
        return
      }
      byKey.set(key, { key, date: d.date, title: d.title, description: d.description, typeCode: d.typeCode, signalePar: d.author, auteurs: [s] })
    })
  })
  return [...byKey.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
