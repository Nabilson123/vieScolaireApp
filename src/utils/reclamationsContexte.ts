import type { ReclamationRecord, StudentExtra } from '../data/studentDetails'
import { moyenneScaleForClasse } from './alertEngine'
import { parseAnyDate } from './period'
import { computeMoyenneGenerale } from './studentAggregation'

/** Fenêtre de lecture « récent » pour les absences, retards et incidents. Choix raisonnable (même statut que
 * les seuils des signaux de récurrence), pas une règle validée par la direction. */
export const CONTEXTE_FENETRE_JOURS = 30

export interface StudentContext {
  absences: number
  retards: number
  /** Dont absences non justifiées. */
  absencesNonJustifiees: number
  /** Incidents disciplinaires (points retirés) sur la fenêtre. */
  incidents: number
  conduite: number
  /** Moyenne générale pondérée et son barème (/10 au primaire, /20 au collège) ; `null` sans notes ou en maternelle. */
  moyenne: { value: number; scale: number } | null
  /** Les autres réclamations de l'élève. */
  autresReclamations: { ouvertes: number; total: number }
}

function isRecent(dateStr: string, cutoff: Date, now: Date): boolean {
  const d = parseAnyDate(dateStr)
  return !!d && d >= cutoff && d <= now
}

/**
 * Ce qu'il faut savoir de l'élève avant de répondre à une famille : assiduité, comportement, résultats et
 * autres réclamations. Pure : lit uniquement ce qu'on lui donne. `excludeId` écarte la réclamation en cours
 * de lecture des « autres réclamations ».
 */
export function computeStudentContext(extra: StudentExtra, classe: string, excludeId?: string, now: Date = new Date()): StudentContext {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - CONTEXTE_FENETRE_JOURS)
  const recentEvents = extra.events.filter((e) => isRecent(e.date, cutoff, now))
  const absences = recentEvents.filter((e) => e.type === 'ABSENCE')
  const scale = moyenneScaleForClasse(classe)
  const moyenne = scale === null ? null : computeMoyenneGenerale(extra.notes)
  const autres: ReclamationRecord[] = extra.reclamations.filter((r) => r.id !== excludeId)
  return {
    absences: absences.length,
    retards: recentEvents.filter((e) => e.type === 'RETARD').length,
    absencesNonJustifiees: absences.filter((e) => !e.justified).length,
    incidents: extra.discipline.filter((d) => d.points < 0 && isRecent(d.date, cutoff, now)).length,
    conduite: extra.conduite,
    moyenne: scale !== null && moyenne !== null ? { value: moyenne, scale } : null,
    autresReclamations: { ouvertes: autres.filter((r) => r.statut !== 'Résolue').length, total: autres.length },
  }
}
