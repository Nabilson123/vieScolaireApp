import type { SuiviProf } from '../data/suiviProfs'
import type { SuiviCompteRendu } from '../data/suiviCompteRendu'
import type { StudentExtra } from '../data/studentDetails'
import type { Student } from '../data/students'
import { isWithinPeriod } from './period'
import type { RiskStudent } from './suiviClasseRisqueAggregation'

/** Réunion précédente du niveau : la plus récente non annulée avant la réunion courante (à défaut, avant aujourd'hui). */
export function reunionPrecedente(suivis: SuiviProf[], niveau: string, courant: { id?: string; date: string } | undefined, today: string): SuiviProf | undefined {
  const limite = courant?.date ?? today
  return suivis
    .filter((s) => s.niveau === niveau && s.statut !== 'Annulé' && s.id !== courant?.id && s.date < limite)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0]
}

export interface SuiviEleve {
  constat: string
  mesure: string
}

/** Ce qui a été écrit pour chaque élève au point 3 de la réunion précédente (les entrées vides sont ignorées). */
export function suiviPrecedent(compteRendu: SuiviCompteRendu | undefined): Map<string, SuiviEleve> {
  const out = new Map<string, SuiviEleve>()
  Object.entries(compteRendu?.point3 ?? {}).forEach(([studentId, e]) => {
    const constat = e.constat?.trim() ?? ''
    const mesure = e.mesure?.trim() ?? ''
    if (constat || mesure) out.set(studentId, { constat, mesure })
  })
  return out
}

/** Élèves suivis à la dernière réunion (constat ou mesure écrits) qui ne sont plus signalés aujourd'hui : bon signe, à confirmer. */
export function elevesPlusSignales(precedent: Map<string, SuiviEleve>, riskStudents: RiskStudent[]): (SuiviEleve & { studentId: string })[] {
  const actuels = new Set(riskStudents.map((r) => r.id))
  return [...precedent.entries()].filter(([id]) => !actuels.has(id)).map(([studentId, e]) => ({ studentId, ...e }))
}

export interface EleveConcerne {
  id: string
  name: string
  absences: number
  retards: number
  incidents: number
}

export interface AssiduiteClasse {
  classe: string
  effectif: number
  /** Séances d'absence et de retard enregistrées sur la période. */
  absences: number
  elevesAbsents: number
  retards: number
  incidents: number
  /** Élèves dont les signalements se répètent (au moins deux sur la période), les plus concernés d'abord — trois au plus. */
  concernes: EleveConcerne[]
}

/** Assiduité et comportement des classes d'un niveau sur une période : de quoi nourrir le point 4 avec des chiffres réels. */
export function computeAssiduiteParClasse(students: Student[], extras: Record<string, StudentExtra>, classeNames: string[], start: string, end: string): AssiduiteClasse[] {
  return classeNames.map((classe) => {
    const eleves = students.filter((s) => s.classe === classe)
    const comptes = eleves.map((s) => {
      const extra = extras[s.id]
      const events = (extra?.events ?? []).filter((e) => isWithinPeriod(e.date, start, end))
      return {
        id: s.id,
        name: s.name,
        absences: events.filter((e) => e.type === 'ABSENCE').length,
        retards: events.filter((e) => e.type === 'RETARD').length,
        incidents: (extra?.discipline ?? []).filter((d) => d.points < 0 && isWithinPeriod(d.date, start, end)).length,
      }
    })
    const total = (c: EleveConcerne) => c.absences + c.retards + c.incidents
    return {
      classe,
      effectif: eleves.length,
      absences: comptes.reduce((n, c) => n + c.absences, 0),
      elevesAbsents: comptes.filter((c) => c.absences > 0).length,
      retards: comptes.reduce((n, c) => n + c.retards, 0),
      incidents: comptes.reduce((n, c) => n + c.incidents, 0),
      concernes: comptes
        .filter((c) => total(c) >= 2)
        .sort((a, b) => b.incidents * 3 + b.absences + b.retards - (a.incidents * 3 + a.absences + a.retards) || a.name.localeCompare(b.name, 'fr'))
        .slice(0, 3),
    }
  })
}
