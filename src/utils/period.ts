const FR_MONTHS: Record<string, number> = {
  janvier: 0,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
}

export function parseAnyDate(dateStr: string): Date | null {
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
  }
  const frMatch = dateStr.trim().match(/^(\d{1,2})\s+([a-zéûôA-ZÉÛÔ]+)\s+(\d{4})$/)
  if (frMatch) {
    const day = Number(frMatch[1])
    const month = FR_MONTHS[frMatch[2].toLowerCase()]
    const year = Number(frMatch[3])
    if (month !== undefined) return new Date(year, month, day)
  }
  const dmyMatch = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmyMatch) {
    return new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]))
  }
  return null
}

export function isWithinPeriod(dateStr: string, start: string, end: string): boolean {
  if (!start && !end) return true
  const d = parseAnyDate(dateStr)
  if (!d) return true
  if (start) {
    const s = parseAnyDate(start)
    if (s && d < s) return false
  }
  if (end) {
    const e = parseAnyDate(end)
    if (e) {
      e.setHours(23, 59, 59, 999)
      if (d > e) return false
    }
  }
  return true
}

export type PeriodPresetKey = '7j' | '30j' | 'mois' | 'rentree'

export const PERIOD_PRESETS: { key: PeriodPresetKey; label: string }[] = [
  { key: '7j', label: '7 derniers jours' },
  { key: '30j', label: '30 derniers jours' },
  { key: 'mois', label: 'Ce mois-ci' },
  { key: 'rentree', label: 'Depuis la rentrée' },
]

function toISO(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function computePresetRange(key: PeriodPresetKey, rentreeDate?: string): { start: string; end: string } {
  const today = new Date()
  const end = toISO(today)
  if (key === '7j') {
    const start = new Date(today)
    start.setDate(start.getDate() - 6)
    return { start: toISO(start), end }
  }
  if (key === '30j') {
    const start = new Date(today)
    start.setDate(start.getDate() - 29)
    return { start: toISO(start), end }
  }
  if (key === 'mois') {
    return { start: toISO(new Date(today.getFullYear(), today.getMonth(), 1)), end }
  }
  return { start: rentreeDate ?? end, end }
}

export function previousPeriodRange(start: string, end: string): { start: string; end: string } {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  const spanMs = e.getTime() - s.getTime()
  const prevEnd = new Date(s.getTime() - 24 * 3600 * 1000)
  const prevStart = new Date(prevEnd.getTime() - spanMs)
  return { start: toISO(prevStart), end: toISO(prevEnd) }
}

export function formatPeriodLabel(start: string, end: string): string {
  if (!start && !end) return 'Historique complet'
  const fmt = (s: string) => {
    const d = new Date(s)
    return d.toLocaleDateString('fr-FR')
  }
  if (start && end) return `${fmt(start)} au ${fmt(end)}`
  if (start) return `Depuis le ${fmt(start)}`
  return `Jusqu'au ${fmt(end)}`
}
