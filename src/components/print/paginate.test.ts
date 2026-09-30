import { describe, expect, it } from 'vitest'
import { packBlocksIntoPages } from './paginate'

describe('packBlocksIntoPages', () => {
  it('keeps everything on one page when it all fits', () => {
    const blocks = [
      { key: 'a', height: 100 },
      { key: 'b', height: 100 },
      { key: 'c', height: 100 },
    ]
    const pages = packBlocksIntoPages(blocks, 500, 10)
    expect(pages).toEqual([['a', 'b', 'c']])
  })

  it('starts a new page once the running total would exceed the available height', () => {
    const blocks = [
      { key: 'a', height: 300 },
      { key: 'b', height: 300 },
      { key: 'c', height: 300 },
    ]
    // available 500: 'a' fits alone (300), adding 'b' (300+10+300=610) overflows -> new page
    const pages = packBlocksIntoPages(blocks, 500, 10)
    expect(pages).toEqual([['a'], ['b'], ['c']])
  })

  it('never splits a single block, even one taller than the available height', () => {
    const blocks = [
      { key: 'a', height: 100 },
      { key: 'huge', height: 5000 },
      { key: 'b', height: 100 },
    ]
    const pages = packBlocksIntoPages(blocks, 500, 10)
    // 'huge' gets its own page rather than looping forever or merging with neighbors
    expect(pages).toEqual([['a'], ['huge'], ['b']])
  })

  it('scales to many small rows (simulates a long absence/discipline table)', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ key: `row-${i}`, height: 20 }))
    const pages = packBlocksIntoPages(rows, 200, 4)
    // every row must appear exactly once, across as many pages as needed
    const flat = pages.flat()
    expect(flat).toHaveLength(50)
    expect(new Set(flat).size).toBe(50)
    expect(pages.length).toBeGreaterThan(1)
    // no page may exceed the budget (mirrors the "never overflow a physical page" requirement)
    for (const page of pages) {
      const total = page.reduce((sum, _key, idx) => sum + 20 + (idx > 0 ? 4 : 0), 0)
      expect(total).toBeLessThanOrEqual(200)
    }
  })

  it('accepts a per-page budget function, e.g. a smaller page-0 header leaving less room', () => {
    const blocks = [
      { key: 'a', height: 150 },
      { key: 'b', height: 150 },
      { key: 'c', height: 150 },
    ]
    // page 0 has only 200 available (tall header), later pages have 400 (short header) -> 'a'
    // alone on page 0, but 'b' and 'c' fit together on page 1.
    const pages = packBlocksIntoPages(blocks, (pageIndex) => (pageIndex === 0 ? 200 : 400), 10)
    expect(pages).toEqual([['a'], ['b', 'c']])
  })

  it('starts a new page before a breakBefore block, unless the page is still empty', () => {
    const blocks = [
      { key: 'a', height: 50, breakBefore: true },
      { key: 'b', height: 50 },
      { key: 'c', height: 50, breakBefore: true },
      { key: 'd', height: 50 },
    ]
    const pages = packBlocksIntoPages(blocks, 1000, 10)
    expect(pages).toEqual([['a', 'b'], ['c', 'd']])
  })
})
