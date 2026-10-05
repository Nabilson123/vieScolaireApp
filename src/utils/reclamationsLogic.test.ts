import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  cleanReclamationText,
  delaiResolutionJours,
  echeanceStatut,
  formatDateFR,
  isHorsDelai,
  joursOuverts,
  todayLocalISO,
} from './reclamationsLogic'

describe('cleanReclamationText', () => {
  it("retire le gras et l'étiquette « Objet : » d'un texte collé", () => {
    expect(cleanReclamationText('**Objet : Réclamation concernant un incident pendant la séance d’anglais**')).toBe(
      'Réclamation concernant un incident pendant la séance d’anglais'
    )
  })

  it('retire les deux-points orphelins et le gras restant', () => {
    expect(cleanReclamationText(': Réclamation concernant le niveau scolaire de l’élève**')).toBe('Réclamation concernant le niveau scolaire de l’élève')
  })

  it("retire l'étiquette sans markdown", () => {
    expect(cleanReclamationText('Objet : Classe surchargée – nombre élevé d’élèves')).toBe('Classe surchargée – nombre élevé d’élèves')
  })

  it('garde un texte normal et les astérisques utiles', () => {
    expect(cleanReclamationText('Texte normal')).toBe('Texte normal')
    expect(cleanReclamationText('Calcul 5*3 = 15')).toBe('Calcul 5*3 = 15')
  })

  it('retire les titres markdown et replie les espaces multiples', () => {
    expect(cleanReclamationText('## Détail   du   problème')).toBe('Détail du problème')
  })

  it('gère les valeurs vides', () => {
    expect(cleanReclamationText('')).toBe('')
    expect(cleanReclamationText(undefined)).toBe('')
  })
})

describe('dates locales', () => {
  it('todayLocalISO suit la date locale', () => {
    expect(todayLocalISO(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-05')
  })

  it('addDaysISO traverse les fins de mois', () => {
    expect(addDaysISO('2026-09-29', 3)).toBe('2026-10-02')
    expect(addDaysISO('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('formatDateFR', () => {
    expect(formatDateFR('2026-09-30')).toBe('30/09/2026')
    expect(formatDateFR('n/a')).toBe('n/a')
  })
})

describe('délais', () => {
  const now = new Date(2026, 9, 5, 10, 0) // 05/10/2026 10:00

  it('compte les jours pleins depuis la réception', () => {
    expect(joursOuverts('2026-10-05', now)).toBe(0)
    expect(joursOuverts('2026-10-02', now)).toBe(3)
    expect(joursOuverts('2026-09-30', now)).toBe(5)
    expect(joursOuverts('date illisible', now)).toBe(0)
  })

  it('hors délai au-delà de 3 jours pleins, jamais pour une résolue', () => {
    expect(isHorsDelai({ date: '2026-10-02', statut: 'En attente' }, now)).toBe(false)
    expect(isHorsDelai({ date: '2026-10-01', statut: 'En attente' }, now)).toBe(true)
    expect(isHorsDelai({ date: '2026-10-01', statut: 'En cours' }, now)).toBe(true)
    expect(isHorsDelai({ date: '2026-09-01', statut: 'Résolue' }, now)).toBe(false)
  })

  it('durée de résolution : seulement avec une date de résolution', () => {
    expect(delaiResolutionJours({ date: '2026-09-30', statut: 'Résolue', resoluLe: new Date(2026, 9, 2, 9, 0).toISOString() })).toBe(2)
    expect(delaiResolutionJours({ date: '2026-09-30', statut: 'Résolue' })).toBeNull()
    expect(delaiResolutionJours({ date: '2026-09-30', statut: 'En cours', resoluLe: new Date(2026, 9, 2).toISOString() })).toBeNull()
  })

  it("état de l'échéance", () => {
    expect(echeanceStatut({ statut: 'En cours', echeance: '2026-10-04' }, now)).toBe('depassee')
    expect(echeanceStatut({ statut: 'En cours', echeance: '2026-10-05' }, now)).toBe('proche')
    expect(echeanceStatut({ statut: 'En cours', echeance: '2026-10-06' }, now)).toBe('proche')
    expect(echeanceStatut({ statut: 'En cours', echeance: '2026-10-08' }, now)).toBe('ok')
    expect(echeanceStatut({ statut: 'Résolue', echeance: '2026-10-01' }, now)).toBeNull()
    expect(echeanceStatut({ statut: 'En cours' }, now)).toBeNull()
  })
})
