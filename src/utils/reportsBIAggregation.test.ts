import { describe, expect, it } from 'vitest'
import { sortClasseStatsRows, type ClasseStatsRow } from './reportsBIAggregation'

function row(classe: string, moyenneGenerale: number | null): ClasseStatsRow {
  return {
    classe,
    effectif: 20,
    tauxPresence: 95,
    absencesCount: 0,
    retardsCount: 0,
    heuresManquees: 0,
    moyenneGenerale,
    incidents: 0,
    pointsSanction: 0,
    moyenneConduite: 20,
  }
}

describe('sortClasseStatsRows — moyenneGenerale', () => {
  // Piège : 8 (collège, /20 = 40%) est numériquement plus petit que 9.5 (primaire, /10 = 95%) mais
  // représente un bien meilleur résultat — un tri numérique brut les entrelacerait à tort.
  const rows = [
    row('3APIC-A', 8),
    row('CE1-B', 9.5),
    row('3APIC-B', 15),
    row('CE1-A', 7),
  ]

  it('groups classes by cycle (never interleaves primaire and collège) regardless of raw value', () => {
    const sorted = sortClasseStatsRows(rows, 'moyenneGenerale', 'asc')
    const cycleSequence = sorted.map((r) => (r.classe.startsWith('CE1') ? 'primaire' : 'college'))
    expect(cycleSequence).toEqual(['primaire', 'primaire', 'college', 'college'])
  })

  it('sorts ascending within each cycle group', () => {
    const sorted = sortClasseStatsRows(rows, 'moyenneGenerale', 'asc')
    expect(sorted.map((r) => r.classe)).toEqual(['CE1-A', 'CE1-B', '3APIC-A', '3APIC-B'])
  })

  it('flips only the within-group order on desc, never the cycle-group order', () => {
    const sorted = sortClasseStatsRows(rows, 'moyenneGenerale', 'desc')
    expect(sorted.map((r) => r.classe)).toEqual(['CE1-B', 'CE1-A', '3APIC-B', '3APIC-A'])
  })

  it('places null moyennes last within their cycle group', () => {
    const withNull = [...rows, row('CE1-C', null)]
    const sorted = sortClasseStatsRows(withNull, 'moyenneGenerale', 'asc')
    expect(sorted.map((r) => r.classe)).toEqual(['CE1-A', 'CE1-B', 'CE1-C', '3APIC-A', '3APIC-B'])
  })

  it('still applies simple numeric sort for scale-independent keys like tauxPresence', () => {
    const mixed = [row('CE1-A', 5), row('3APIC-A', 5)]
    mixed[0].tauxPresence = 80
    mixed[1].tauxPresence = 90
    const sorted = sortClasseStatsRows(mixed, 'tauxPresence', 'asc')
    expect(sorted.map((r) => r.classe)).toEqual(['CE1-A', '3APIC-A'])
  })
})
