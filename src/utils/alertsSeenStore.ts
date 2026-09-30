import type { AlertsSummary } from './alertEngine'

const SEEN_KEY = 'vieScolaire.seenAlerts'

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

let seen: Set<string> = loadSeen()

function persist(): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)))
  } catch {}
}

export function computeAlertIds(summary: AlertsSummary): string[] {
  return [
    ...summary.moyenne.map((a) => `moyenne:${a.id}`),
    ...summary.presence.map((a) => `presence:${a.id}`),
    ...summary.retards.map((a) => `retards:${a.id}`),
    ...summary.climat.filter((c) => c.alert).map((c) => `climat:${c.cycle}`),
    ...summary.pai.filter((c) => c.alert).map((c) => `pai:${c.cycle}`),
    ...summary.helpdesk.filter((c) => c.alert).map((c) => `helpdesk:${c.cycle}`),
    ...summary.remplacement.filter((c) => c.alert).map((c) => `remplacement:${c.cycle}`),
  ]
}

export function countUnseenAlerts(summary: AlertsSummary): number {
  return computeAlertIds(summary).filter((id) => !seen.has(id)).length
}

export function markAlertsSeen(summary: AlertsSummary): boolean {
  const ids = computeAlertIds(summary)
  let changed = false
  ids.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id)
      changed = true
    }
  })
  if (changed) persist()
  return changed
}
