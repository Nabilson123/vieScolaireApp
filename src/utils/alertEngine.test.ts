import { describe, expect, it } from 'vitest'
import { moyenneScaleForClasse } from './alertEngine'

describe('moyenneScaleForClasse', () => {
  it('returns 10 for a primaire classe', () => {
    expect(moyenneScaleForClasse('CE1-A')).toBe(10)
  })

  it('returns 20 for a collège classe', () => {
    expect(moyenneScaleForClasse('3APIC-B')).toBe(20)
  })

  it('returns null for a maternelle classe (pas de notation chiffrée)', () => {
    expect(moyenneScaleForClasse('PS-A')).toBeNull()
  })

  it('returns null for an unresolvable classe name', () => {
    expect(moyenneScaleForClasse('unknown-X')).toBeNull()
  })
})
