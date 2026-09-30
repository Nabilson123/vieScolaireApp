import { describe, expect, it } from 'vitest'
import { toWhatsAppPhone, buildWhatsAppLink, buildRemplacementMessage } from './whatsapp'

describe('toWhatsAppPhone', () => {
  it('converts a local Moroccan number (leading 0) to international format', () => {
    expect(toWhatsAppPhone('0655-456041')).toBe('212655456041')
  })

  it('strips spaces and other separators', () => {
    expect(toWhatsAppPhone('06 55 45 60 41')).toBe('212655456041')
  })

  it('leaves an already-international number untouched', () => {
    expect(toWhatsAppPhone('212655456041')).toBe('212655456041')
  })

  it('returns null for an empty number', () => {
    expect(toWhatsAppPhone('')).toBeNull()
    expect(toWhatsAppPhone('   ')).toBeNull()
  })
})

describe('buildWhatsAppLink', () => {
  it('builds a wa.me link with the phone and URL-encoded message', () => {
    const link = buildWhatsAppLink('0655456041', 'Bonjour & bienvenue')
    expect(link).toBe('https://wa.me/212655456041?text=Bonjour%20%26%20bienvenue')
  })

  it('returns null when the phone number is invalid', () => {
    expect(buildWhatsAppLink('', 'test')).toBeNull()
  })
})

describe('buildRemplacementMessage', () => {
  it('includes all key info: date, créneau, classe, matière', () => {
    const message = buildRemplacementMessage({
      teacherName: 'Youssef Tazi',
      date: '2026-08-10',
      creneau: '08:30 - 10:00',
      classe: '3APIC-A',
      matiere: 'Mathématiques',
    })
    expect(message).toContain('Youssef Tazi')
    expect(message).toContain('08:30 - 10:00')
    expect(message).toContain('3APIC-A')
    expect(message).toContain('Mathématiques')
  })

  it('includes consignes only when provided', () => {
    const withConsignes = buildRemplacementMessage({
      teacherName: 'A',
      date: '2026-08-10',
      creneau: '2h',
      classe: 'CE1-A',
      matiere: 'Français',
      consignes: 'Faire les exercices p.12',
    })
    expect(withConsignes).toContain('Faire les exercices p.12')

    const withoutConsignes = buildRemplacementMessage({
      teacherName: 'A',
      date: '2026-08-10',
      creneau: '2h',
      classe: 'CE1-A',
      matiere: 'Français',
    })
    expect(withoutConsignes).not.toContain('Consignes')
  })
})
