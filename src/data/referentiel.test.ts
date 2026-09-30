import { describe, expect, it } from 'vitest'
import { moyenneScale } from './referentiel'

describe('moyenneScale', () => {
  it('returns null for maternelle (pas de notation chiffrée)', () => {
    expect(moyenneScale('maternelle')).toBeNull()
  })

  it('returns 10 for primaire', () => {
    expect(moyenneScale('primaire')).toBe(10)
  })

  it('returns 20 for collège and lycée', () => {
    expect(moyenneScale('college')).toBe(20)
    expect(moyenneScale('lycee')).toBe(20)
  })

  it('returns null for an unknown cycle key', () => {
    expect(moyenneScale('unknown')).toBeNull()
  })
})
