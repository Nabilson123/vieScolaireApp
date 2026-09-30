import type { PrintScheduleSlot } from './PrintableScheduleLudique'
import { SCHEDULE_DAYS } from '../../data/classSchedules'

export function toPrintSchedule<T extends { id: string; subject: string; start: string; end: string; hours: number }>(
  schedule: Record<string, T[]>,
  secondaryLabel: (slot: T) => string
): Record<string, PrintScheduleSlot[]> {
  const result: Record<string, PrintScheduleSlot[]> = {}
  SCHEDULE_DAYS.forEach((day) => {
    result[day] = (schedule[day] ?? []).map((s) => ({
      id: s.id,
      subject: s.subject,
      start: s.start,
      end: s.end,
      hours: s.hours,
      secondaryLabel: secondaryLabel(s),
    }))
  })
  return result
}
