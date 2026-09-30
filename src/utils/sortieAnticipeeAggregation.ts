import { getWeekdayName } from './replacementAggregation'
import { getClassScheduleSnapshot } from '../services/classSchedulesService'
import { SCHEDULE_DAYS, timeToMinutes } from '../data/classSchedules'
import { colorForSubject, type EventRecord } from '../data/studentDetails'
import { formatHeures } from './teacherAggregation'

/**
 * Construit les absences pour les cours restants de la journée à partir d'une sortie anticipée,
 * en s'appuyant sur le vrai emploi du temps de la classe — même principe que le calcul de retard
 * (retardHoursForSlot dans SignalerAbsenceModal.tsx), mais inversé côté sortie :
 * - un créneau entièrement après l'heure de sortie est manqué en entier ;
 * - un créneau en cours au moment de la sortie n'est manqué que pour sa portion restante ;
 * - un créneau déjà terminé avant la sortie n'est pas affecté.
 * Retourne une liste vide hors jour scolaire (weekend) ou si la sortie a lieu après tous les cours.
 */
export function computeAbsencesForSortieAnticipee(
  classe: string,
  date: string,
  heureSortie: string,
  motif: string,
  sortieAnticipeeId: string
): EventRecord[] {
  const day = getWeekdayName(date)
  if (!day || !SCHEDULE_DAYS.includes(day)) return []

  const slots = getClassScheduleSnapshot(classe)[day] ?? []
  const sortieMin = timeToMinutes(heureSortie)

  const events: EventRecord[] = []
  slots.forEach((slot) => {
    const startMin = timeToMinutes(slot.start)
    const endMin = timeToMinutes(slot.end)
    if (sortieMin >= endMin) return // cours déjà terminé avant la sortie
    const missedStart = Math.max(sortieMin, startMin)
    const minutes = Math.max(0, endMin - missedStart)
    if (minutes <= 0) return
    events.push({
      date,
      type: 'ABSENCE',
      justified: true,
      subject: slot.subject,
      subjectColor: colorForSubject(slot.subject),
      duree: formatHeures(minutes / 60),
      motif,
      start: slot.start,
      sortieAnticipeeId,
    })
  })
  return events
}
