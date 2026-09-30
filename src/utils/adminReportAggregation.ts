import type { Student } from '../data/students'
import type { StudentExtra } from '../data/studentDetails'
import { parseDuration, weeklyVolumeMinutes } from '../data/students'
import { isWithinPeriod } from './period'

function classeNames(students: Student[]): string[] {
  return Array.from(new Set(students.map((s) => s.classe))).sort((a, b) => a.localeCompare(b))
}

export interface ClasseAbsencesRow {
  classe: string
  effectif: number
  absencesCount: number
  retardsCount: number
  heuresManquees: number
  tauxPresence: number
}

export function computeClasseAbsencesSummary(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  periodStart: string,
  periodEnd: string
): ClasseAbsencesRow[] {
  return classeNames(students).map((classe) => {
    const classeStudents = students.filter((s) => s.classe === classe)
    let absencesCount = 0
    let retardsCount = 0
    let minutesMissed = 0
    classeStudents.forEach((s) => {
      const events = studentExtras[s.id]?.events ?? []
      events.forEach((e) => {
        if (!isWithinPeriod(e.date, periodStart, periodEnd)) return
        minutesMissed += parseDuration(e.duree)
        if (e.type === 'ABSENCE') absencesCount += 1
        else retardsCount += 1
      })
    })
    const possibleMinutes = weeklyVolumeMinutes(classe) * classeStudents.length
    const tauxPresence =
      possibleMinutes > 0 ? Math.max(0, Math.min(100, Math.round((1 - minutesMissed / possibleMinutes) * 1000) / 10)) : 100
    return {
      classe,
      effectif: classeStudents.length,
      absencesCount,
      retardsCount,
      heuresManquees: Math.round((minutesMissed / 60) * 10) / 10,
      tauxPresence,
    }
  })
}

export interface ClasseDisciplineRow {
  classe: string
  pointsValeur: number
  pointsSanction: number
  incidents: number
  moyenneConduite: number
}

export function computeClasseDisciplineSummary(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  periodStart: string,
  periodEnd: string
): ClasseDisciplineRow[] {
  return classeNames(students).map((classe) => {
    const classeStudents = students.filter((s) => s.classe === classe)
    let pointsValeur = 0
    let pointsSanction = 0
    let incidents = 0
    classeStudents.forEach((s) => {
      const discipline = studentExtras[s.id]?.discipline ?? []
      discipline.forEach((d) => {
        if (!isWithinPeriod(d.date, periodStart, periodEnd)) return
        if (d.points > 0) pointsValeur += d.points
        else {
          pointsSanction += d.points
          incidents += 1
        }
      })
    })
    const conduiteValues = classeStudents.map((s) => studentExtras[s.id]?.conduite ?? 20)
    const moyenneConduite = conduiteValues.length > 0 ? conduiteValues.reduce((a, b) => a + b, 0) / conduiteValues.length : 20
    return {
      classe,
      pointsValeur,
      pointsSanction,
      incidents,
      moyenneConduite: Math.round(moyenneConduite * 10) / 10,
    }
  })
}

export interface InfirmerieSummary {
  passagesPeriode: number
  elevesAvecPai: number
  paiCritique: number
  paiModere: number
}

export function computeInfirmerieSummary(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  periodStart: string,
  periodEnd: string
): InfirmerieSummary {
  let passagesPeriode = 0
  let elevesAvecPai = 0
  let paiCritique = 0
  let paiModere = 0
  students.forEach((s) => {
    const sante = studentExtras[s.id]?.sante
    if (!sante) return
    sante.visits.forEach((v) => {
      if (isWithinPeriod(v.date, periodStart, periodEnd)) passagesPeriode += 1
    })
    if (sante.pai) {
      elevesAvecPai += 1
      if (sante.pai.niveau === 'CRITIQUE') paiCritique += 1
      else paiModere += 1
    }
  })
  return { passagesPeriode, elevesAvecPai, paiCritique, paiModere }
}

export interface ReclamationsSummary {
  total: number
  enCours: number
  resolues: number
  enAttente: number
}

export function computeReclamationsSummary(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  periodStart: string,
  periodEnd: string
): ReclamationsSummary {
  let total = 0
  let enCours = 0
  let resolues = 0
  let enAttente = 0
  students.forEach((s) => {
    const reclamations = studentExtras[s.id]?.reclamations ?? []
    reclamations.forEach((r) => {
      if (!isWithinPeriod(r.date, periodStart, periodEnd)) return
      total += 1
      if (r.statut === 'En cours') enCours += 1
      else if (r.statut === 'Résolue') resolues += 1
      else enAttente += 1
    })
  })
  return { total, enCours, resolues, enAttente }
}

export interface RendezVousSummary {
  total: number
  planifies: number
  realises: number
  annules: number
}

export function computeRendezVousSummary(
  students: Student[],
  studentExtras: Record<string, StudentExtra>,
  periodStart: string,
  periodEnd: string
): RendezVousSummary {
  let total = 0
  let planifies = 0
  let realises = 0
  let annules = 0
  students.forEach((s) => {
    const rendezVous = studentExtras[s.id]?.rendezVous ?? []
    rendezVous.forEach((r) => {
      if (!isWithinPeriod(r.date, periodStart, periodEnd)) return
      total += 1
      if (r.statut === 'Planifié') planifies += 1
      else if (r.statut === 'Réalisé') realises += 1
      else annules += 1
    })
  })
  return { total, planifies, realises, annules }
}
