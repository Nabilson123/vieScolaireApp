import { describe, expect, it } from 'vitest'
import { computePresetRange, formatPeriodLabel, isWithinPeriod, parseAnyDate, previousPeriodRange } from './period'

describe('parseAnyDate', () => {
  it('parses ISO dates', () => {
    const d = parseAnyDate('2026-03-05')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(2)
    expect(d!.getDate()).toBe(5)
  })

  it('parses French long-form dates', () => {
    const d = parseAnyDate('5 mars 2026')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(2)
    expect(d!.getDate()).toBe(5)
  })

  it('returns null for unrecognized formats', () => {
    expect(parseAnyDate('not a date')).toBeNull()
  })
})

describe('isWithinPeriod', () => {
  it('returns true when both bounds are empty (no filter)', () => {
    expect(isWithinPeriod('2026-03-05', '', '')).toBe(true)
  })

  it('excludes dates before the start bound', () => {
    expect(isWithinPeriod('2026-03-01', '2026-03-05', '')).toBe(false)
  })

  it('excludes dates after the end bound', () => {
    expect(isWithinPeriod('2026-03-10', '', '2026-03-05')).toBe(false)
  })

  it('includes the end date itself (inclusive end-of-day)', () => {
    expect(isWithinPeriod('2026-03-05', '2026-03-01', '2026-03-05')).toBe(true)
  })

  it('includes dates within the range', () => {
    expect(isWithinPeriod('2026-03-03', '2026-03-01', '2026-03-05')).toBe(true)
  })
})

describe('computePresetRange', () => {
  it('computes a 7-day window ending today', () => {
    const { start, end } = computePresetRange('7j', undefined)
    const today = new Date()
    const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(end).toBe(localToday)
    const diffDays = Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / (24 * 3600 * 1000))
    expect(diffDays).toBe(6)
  })

  it('falls back to rentreeDate for the "rentree" preset', () => {
    const { start } = computePresetRange('rentree', '2025-09-01')
    expect(start).toBe('2025-09-01')
  })
})

describe('previousPeriodRange', () => {
  it('shifts an equal-length window immediately before the given range', () => {
    const { start, end } = previousPeriodRange('2026-03-08', '2026-03-14')
    expect(end).toBe('2026-03-07')
    expect(start).toBe('2026-03-01')
  })
})

describe('formatPeriodLabel', () => {
  it('labels an empty range as full history', () => {
    expect(formatPeriodLabel('', '')).toBe('Historique complet')
  })

  it('labels a start-only range', () => {
    expect(formatPeriodLabel('2026-03-01', '')).toContain('Depuis le')
  })

  it('labels an end-only range', () => {
    expect(formatPeriodLabel('', '2026-03-01')).toContain("Jusqu'au")
  })

  it('labels a full range with both dates', () => {
    expect(formatPeriodLabel('2026-03-01', '2026-03-05')).toContain(' au ')
  })
})
