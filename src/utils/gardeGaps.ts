function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export interface TimeRange {
  start: string
  end: string
}

/** Trous non couverts entre dayStart et dayEnd, étant donné une liste de blocs (triés ou non, non
 * nécessairement disjoints). Un bloc qui chevauche/prolonge le curseur ne crée pas de trou. */
export function computeGaps(blocks: TimeRange[], dayStart = '07:30', dayEnd = '18:00'): TimeRange[] {
  const dayStartMin = timeToMinutes(dayStart)
  const dayEndMin = timeToMinutes(dayEnd)
  const sorted = [...blocks].map((b) => ({ start: timeToMinutes(b.start), end: timeToMinutes(b.end) })).sort((a, b) => a.start - b.start)

  const gaps: TimeRange[] = []
  let cursor = dayStartMin
  for (const b of sorted) {
    if (b.start > cursor) gaps.push({ start: minutesToTime(cursor), end: minutesToTime(b.start) })
    cursor = Math.max(cursor, b.end)
  }
  if (cursor < dayEndMin) gaps.push({ start: minutesToTime(cursor), end: minutesToTime(dayEndMin) })
  return gaps
}
