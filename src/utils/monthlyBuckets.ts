import { parseAnyDate } from './period'

export interface MonthBucket {
  ymKey: string
  label: string
}

const SCHOOL_MONTH_OFFSETS = [
  { offset: 0, label: 'Sep' },
  { offset: 1, label: 'Oct' },
  { offset: 2, label: 'Nov' },
  { offset: 3, label: 'Déc' },
  { offset: 4, label: 'Jan' },
  { offset: 5, label: 'Fév' },
  { offset: 6, label: 'Mar' },
  { offset: 7, label: 'Avr' },
  { offset: 8, label: 'Mai' },
  { offset: 9, label: 'Juin' },
] as const

/** Sep(anneeDebut) → Juin(anneeDebut+1) — année scolaire marocaine, hors vacances d'été. */
export function computeSchoolYearMonthBuckets(anneeDebut: number): MonthBucket[] {
  return SCHOOL_MONTH_OFFSETS.map(({ offset, label }) => {
    const monthIndex0 = (8 + offset) % 12
    const year = offset <= 3 ? anneeDebut : anneeDebut + 1
    return { ymKey: `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`, label }
  })
}

/** Réutilise parseAnyDate (déjà tolérant ISO / "d mois yyyy" / "d/m/yyyy") plutôt qu'un slice naïf. */
export function countByMonth(dates: string[], buckets: MonthBucket[]): { label: string; value: number }[] {
  const counts = new Map(buckets.map((b) => [b.ymKey, 0]))
  dates.forEach((dateStr) => {
    const d = parseAnyDate(dateStr)
    if (!d) return
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (counts.has(ym)) counts.set(ym, (counts.get(ym) ?? 0) + 1)
  })
  return buckets.map((b) => ({ label: b.label, value: counts.get(b.ymKey) ?? 0 }))
}
