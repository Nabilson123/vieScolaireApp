export type TempsStatut = 'ok' | 'proche' | 'depasse'

/** « 3:05 » : minutes et secondes (les minutes ne sont pas ramenées en heures — une réunion dure 30 minutes). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Où en est-on par rapport au temps prévu : à plus de 80 % c'est « proche », au-delà du prévu c'est « dépassé ». */
export function statutTemps(elapsedSeconds: number, plannedMinutes: number): TempsStatut {
  const planned = plannedMinutes * 60
  if (elapsedSeconds > planned) return 'depasse'
  return elapsedSeconds >= planned * 0.8 ? 'proche' : 'ok'
}

export function addElapsed(perPoint: Record<number, number>, point: number, seconds: number): Record<number, number> {
  return { ...perPoint, [point]: (perPoint[point] ?? 0) + seconds }
}

export function totalElapsed(perPoint: Record<number, number>): number {
  return Object.values(perPoint).reduce((sum, s) => sum + s, 0)
}
