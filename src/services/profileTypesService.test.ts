import { describe, expect, it } from 'vitest'
import { roleLabel } from './profileTypesService'

describe('roleLabel', () => {
  // Sans types chargés (cache vide), on retombe sur les libellés d'origine.
  it('libellé d’origine d’un type connu', () => {
    expect(roleLabel('Direction')).toBe('Direction de la vie scolaire')
    expect(roleLabel('CPE')).toBe('CPE')
    expect(roleLabel('Secrétariat')).toBe('Secrétariat')
  })

  it('« Autre » quand le profil n’a pas de type', () => {
    expect(roleLabel(undefined)).toBe('Autre')
    expect(roleLabel(null)).toBe('Autre')
  })

  it('la clé elle-même pour un type inconnu', () => {
    expect(roleLabel('type-ab12cd34')).toBe('type-ab12cd34')
  })
})
