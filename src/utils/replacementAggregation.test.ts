import { describe, expect, it } from 'vitest'
import { subtractCoveredIntervals, intervalHours } from './replacementAggregation'

describe('subtractCoveredIntervals', () => {
  it('returns the full slot when nothing is covered', () => {
    expect(subtractCoveredIntervals('08:30', '10:00', [])).toEqual([{ start: '08:30', end: '10:00' }])
  })

  it('returns nothing left when the full slot is covered by one record', () => {
    expect(subtractCoveredIntervals('08:30', '10:00', [{ start: '08:30', end: '10:00' }])).toEqual([])
  })

  it('splits a session in two when the first half is covered', () => {
    expect(subtractCoveredIntervals('08:30', '10:00', [{ start: '08:30', end: '09:15' }])).toEqual([{ start: '09:15', end: '10:00' }])
  })

  it('leaves a gap in the middle when both ends are covered by two different remplaçants', () => {
    const covered = [
      { start: '08:30', end: '09:00' },
      { start: '09:30', end: '10:00' },
    ]
    expect(subtractCoveredIntervals('08:30', '10:00', covered)).toEqual([{ start: '09:00', end: '09:30' }])
  })

  it('merges overlapping covered intervals instead of producing negative gaps', () => {
    const covered = [
      { start: '08:30', end: '09:20' },
      { start: '09:00', end: '10:00' },
    ]
    expect(subtractCoveredIntervals('08:30', '10:00', covered)).toEqual([])
  })
})

describe('intervalHours', () => {
  it('computes decimal hours for a partial slot', () => {
    expect(intervalHours({ start: '08:30', end: '09:15' })).toBe(0.75)
  })

  it('computes a full hour correctly', () => {
    expect(intervalHours({ start: '10:00', end: '11:00' })).toBe(1)
  })
})
