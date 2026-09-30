import { parseDuration } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { getActiveClassNamesSnapshot } from '../services/classesService'
import { computeStudentMoyenne, cycleOfClasse, type StudentAlert } from './alertEngine'
import { SANCTION_LEVELS, type SanctionLevel } from '../data/disciplineTypes'
import { isWithinPeriod } from './period'

function currentMonthKey(referenceDate: Date): string {
  return referenceDate.toISOString().slice(0, 7)
}

export interface DisciplineBilanMois {
  pointsValeur: number
  pointsSanction: number
}

export function computeDisciplineBilanMois(referenceDate: Date = new Date()): DisciplineBilanMois {
  const ym = currentMonthKey(referenceDate)
  let pointsValeur = 0
  let pointsSanction = 0
  getStudentsSnapshot().forEach((s) => {
    getStudentExtraSnapshot(s.id).discipline.forEach((d) => {
      if (!d.date.startsWith(ym)) return
      if (d.points > 0) pointsValeur += d.points
      else pointsSanction += d.points
    })
  })
  return { pointsValeur, pointsSanction }
}

export interface ClasseMoyenneRow {
  classe: string
  moyenne: number
}

export function computeClassesMoyenne(): ClasseMoyenneRow[] {
  return getActiveClassNamesSnapshot()
    .map((classe) => {
      const values = getStudentsSnapshot()
        .filter((s) => s.classe === classe)
        .map((s) => computeStudentMoyenne(s.id))
        .filter((v): v is number => v !== null)
      if (values.length === 0) return null
      return { classe, moyenne: values.reduce((a, b) => a + b, 0) / values.length }
    })
    .filter((r): r is ClasseMoyenneRow => r !== null)
    .sort((a, b) => b.moyenne - a.moyenne)
}

export interface MatiereAbsenceStudent {
  studentId: string
  studentName: string
  classe: string
  minutes: number
}

export interface MatiereAbsenceRow {
  subject: string
  totalMinutes: number
  students: MatiereAbsenceStudent[]
}

export function computeHeuresManqueesParMatiere(referenceDate: Date = new Date(), classe?: string): MatiereAbsenceRow[] {
  const ym = currentMonthKey(referenceDate)
  const bySubject = new Map<string, MatiereAbsenceRow>()
  getStudentsSnapshot()
    .filter((s) => !classe || classe === 'Toutes les classes' || s.classe === classe)
    .forEach((s) => {
      getStudentExtraSnapshot(s.id).events.forEach((e) => {
        if (e.type !== 'ABSENCE' || !e.date.startsWith(ym)) return
        const minutes = parseDuration(e.duree)
        const row = bySubject.get(e.subject) ?? { subject: e.subject, totalMinutes: 0, students: [] }
        row.totalMinutes += minutes
        const existingStudent = row.students.find((st) => st.studentId === s.id)
        if (existingStudent) existingStudent.minutes += minutes
        else row.students.push({ studentId: s.id, studentName: s.name, classe: s.classe, minutes })
        bySubject.set(e.subject, row)
      })
    })
  return Array.from(bySubject.values()).sort((a, b) => b.totalMinutes - a.totalMinutes)
}

export interface IncidentMotifStudent {
  studentId: string
  studentName: string
  classe: string
  date: string
  points: number
}

export interface IncidentMotifRow {
  motif: string
  count: number
  students: IncidentMotifStudent[]
}

/** Nombre de sanctions par niveau (Avertissement, Retenue, etc.) enregistrées ce mois-ci. */
export function computeSanctionCountsMois(referenceDate: Date = new Date()): Record<SanctionLevel, number> {
  const ym = currentMonthKey(referenceDate)
  const counts = Object.fromEntries(SANCTION_LEVELS.map((s) => [s, 0])) as Record<SanctionLevel, number>
  getStudentsSnapshot().forEach((s) => {
    getStudentExtraSnapshot(s.id).discipline.forEach((d) => {
      if (!d.date.startsWith(ym) || !d.sanction) return
      if (d.sanction in counts) counts[d.sanction as SanctionLevel] += 1
    })
  })
  return counts
}

/** Variante de computeSanctionCountsMois pilotée par une période libre plutôt que le mois courant. */
export function computeSanctionCountsForPeriod(periodStart: string, periodEnd: string): Record<SanctionLevel, number> {
  const counts = Object.fromEntries(SANCTION_LEVELS.map((s) => [s, 0])) as Record<SanctionLevel, number>
  getStudentsSnapshot().forEach((s) => {
    getStudentExtraSnapshot(s.id).discipline.forEach((d) => {
      if (!isWithinPeriod(d.date, periodStart, periodEnd) || !d.sanction) return
      if (d.sanction in counts) counts[d.sanction as SanctionLevel] += 1
    })
  })
  return counts
}

/**
 * Élèves dont la note de conduite est passée sous le seuil d'alerte (<8/20) — signal précoce
 * d'accumulation de sanctions, bien avant qu'un dossier n'atteigne le Conseil de discipline.
 */
export function computeElevesSousAlerteConduite(): StudentAlert[] {
  return getStudentsSnapshot()
    .map((s) => {
      const cycle = cycleOfClasse(s.classe)
      if (!cycle) return null
      const conduite = getStudentExtraSnapshot(s.id).conduite
      if (conduite >= 8) return null
      return { id: s.id, name: s.name, classe: s.classe, cycle, value: conduite, unit: '/20' }
    })
    .filter((x): x is StudentAlert => x !== null)
    .sort((a, b) => a.value - b.value)
}

/**
 * Élèves ayant au moins un dossier "Conseil de discipline" pas encore clos (FICHE CADRE 7),
 * pour remonter l'escalade au Tableau de bord sans attendre que le CPE ouvre Suivi Disciplinaire.
 */
export function computeConseilsDisciplineEnAttente(): StudentAlert[] {
  const rows: StudentAlert[] = []
  getStudentsSnapshot().forEach((s) => {
    const cycle = cycleOfClasse(s.classe)
    if (!cycle) return
    const pending = getStudentExtraSnapshot(s.id).discipline.filter(
      (d) => d.sanction === 'Conseil de discipline' && d.conseilStatut !== 'instance_tenue',
    )
    if (pending.length === 0) return
    rows.push({ id: s.id, name: s.name, classe: s.classe, cycle, value: pending.length, unit: ' cas' })
  })
  return rows.sort((a, b) => b.value - a.value)
}

export function computeRepartitionIncidents(referenceDate: Date = new Date(), classe?: string): IncidentMotifRow[] {
  const ym = currentMonthKey(referenceDate)
  const byMotif = new Map<string, IncidentMotifRow>()
  getStudentsSnapshot()
    .filter((s) => !classe || classe === 'Toutes les classes' || s.classe === classe)
    .forEach((s) => {
      getStudentExtraSnapshot(s.id).discipline.forEach((d) => {
        if (d.points >= 0 || !d.date.startsWith(ym)) return
        const row = byMotif.get(d.title) ?? { motif: d.title, count: 0, students: [] }
        row.count += 1
        row.students.push({ studentId: s.id, studentName: s.name, classe: s.classe, date: d.date, points: d.points })
        byMotif.set(d.title, row)
      })
    })
  return Array.from(byMotif.values()).sort((a, b) => b.count - a.count)
}
