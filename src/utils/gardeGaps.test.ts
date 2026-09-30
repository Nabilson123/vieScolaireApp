import { describe, expect, it } from 'vitest'
import { computeGaps } from './gardeGaps'

describe('computeGaps', () => {
  it('returns the whole day as one gap when no blocks are given', () => {
    expect(computeGaps([], '07:30', '18:00')).toEqual([{ start: '07:30', end: '18:00' }])
  })

  it('returns no gap when a single block covers the whole day', () => {
    expect(computeGaps([{ start: '07:30', end: '18:00' }], '07:30', '18:00')).toEqual([])
  })

  it('finds a gap between two disjoint blocks', () => {
    expect(
      computeGaps(
        [
          { start: '07:30', end: '08:30' },
          { start: '09:00', end: '18:00' },
        ],
        '07:30',
        '18:00'
      )
    ).toEqual([{ start: '08:30', end: '09:00' }])
  })

  it('does not create a gap for overlapping blocks', () => {
    expect(
      computeGaps(
        [
          { start: '07:30', end: '10:00' },
          { start: '09:00', end: '12:00' },
        ],
        '07:30',
        '12:00'
      )
    ).toEqual([])
  })

  it('finds a trailing gap when the last block ends before dayEnd', () => {
    expect(computeGaps([{ start: '07:30', end: '16:00' }], '07:30', '18:00')).toEqual([{ start: '16:00', end: '18:00' }])
  })

  it('sorts unordered blocks before computing gaps', () => {
    expect(
      computeGaps(
        [
          { start: '10:00', end: '11:00' },
          { start: '07:30', end: '08:00' },
        ],
        '07:30',
        '11:00'
      )
    ).toEqual([{ start: '08:00', end: '10:00' }])
  })
})
