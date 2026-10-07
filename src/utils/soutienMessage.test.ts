import { describe, expect, it } from 'vitest'
import { nomArabeMatiere } from './soutienMessage'

describe('nomArabeMatiere', () => {
  it('reprend le nom usuel des matières de l’école, accents et tirets compris', () => {
    expect(nomArabeMatiere('Mathématiques')).toBe('الرياضيات')
    expect(nomArabeMatiere('Physique-Chimie')).toBe('الفيزياء والكيمياء')
    expect(nomArabeMatiere('Histoire-Géographie')).toBe('التاريخ والجغرافيا')
    expect(nomArabeMatiere('SVT')).toBe('علوم الحياة والأرض')
  })

  it('le nom saisi dans le référentiel passe avant', () => {
    expect(nomArabeMatiere('Mathématiques', 'الحساب')).toBe('الحساب')
    expect(nomArabeMatiere('Mathématiques', '  ')).toBe('الرياضيات')
  })

  it('matière inconnue : pas de nom arabe (le message garde le français)', () => {
    expect(nomArabeMatiere('Théâtre')).toBeUndefined()
  })
})
