import { describe, expect, it } from 'vitest'
import { subtractCoveredIntervals, intervalHours, buildClasseBreakdownAllClasses, type FlatRemplacement } from './replacementAggregation'

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

describe('buildClasseBreakdownAllClasses', () => {
  const classes = [
    { nom: '3APIC-A', niveau: '3APIC', statut: 'Active' },
    { nom: 'CE1-B', niveau: 'CE1', statut: 'Active' },
    { nom: 'PS-A', niveau: 'PS', statut: 'Active' },
    { nom: 'CE1-A', niveau: 'CE1', statut: 'Active' },
    { nom: 'GS-A', niveau: 'GS', statut: 'Active' },
    { nom: 'CE9-A', niveau: 'CE9', statut: 'Archivée' },
  ]
  const remplacement = (classe: string, heures: number) => ({ classe, heures }) as FlatRemplacement

  it("liste toutes les classes actives dans l'ordre PS-A → 3APIC, sans tenir compte des heures", () => {
    const result = buildClasseBreakdownAllClasses(classes, [remplacement('3APIC-A', 5), remplacement('CE1-B', 2)])
    expect(result.map((r) => r.classe)).toEqual(['PS-A', 'GS-A', 'CE1-A', 'CE1-B', '3APIC-A'])
  })

  it('garde les heures cumulées par classe et met 0 pour les classes sans remplacement', () => {
    const result = buildClasseBreakdownAllClasses(classes, [remplacement('CE1-B', 2), remplacement('CE1-B', 1.5)])
    expect(result.find((r) => r.classe === 'CE1-B')).toMatchObject({ count: 2, heures: 3.5 })
    expect(result.find((r) => r.classe === 'PS-A')).toMatchObject({ count: 0, heures: 0 })
  })

  it("range à sa place une classe qui n'existe plus mais figure dans l'historique", () => {
    const result = buildClasseBreakdownAllClasses(classes, [remplacement('CE2-A', 1)])
    expect(result.map((r) => r.classe)).toEqual(['PS-A', 'GS-A', 'CE1-A', 'CE1-B', 'CE2-A', '3APIC-A'])
  })

  it("exclut les classes non actives qui n'ont aucun remplacement", () => {
    const result = buildClasseBreakdownAllClasses(classes, [])
    expect(result.some((r) => r.classe === 'CE9-A')).toBe(false)
  })
})
