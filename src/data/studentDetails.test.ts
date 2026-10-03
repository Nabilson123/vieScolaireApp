import { describe, expect, it } from 'vitest'
import { demandeurLabel, normalizeRendezVous, type StoredRendezVousRecord } from './studentDetails'

const base = { date: '2026-09-18', heure: '11:30', duree: 30, statut: 'Réalisé', mode: 'Présentiel', lieu: 'DVS', motif: 'Test' } as const

describe('normalizeRendezVous', () => {
  it("convertit l'ancien champ texte enseignant en liste d'un élément", () => {
    const legacy: StoredRendezVousRecord[] = [{ ...base, enseignant: 'Saida AMGHAR' }]
    const [rdv] = normalizeRendezVous(legacy)
    expect(rdv.enseignants).toEqual(['Saida AMGHAR'])
    expect('enseignant' in rdv).toBe(false)
  })

  it("traite un ancien enseignant vide comme « administration seulement » (liste vide)", () => {
    const [rdv] = normalizeRendezVous([{ ...base, enseignant: '' }])
    expect(rdv.enseignants).toEqual([])
  })

  it('garde la liste telle quelle pour les enregistrements récents', () => {
    const [rdv] = normalizeRendezVous([{ ...base, enseignants: ['A', 'B'], animateur: 'Nabil' }])
    expect(rdv.enseignants).toEqual(['A', 'B'])
    expect(rdv.animateur).toBe('Nabil')
  })

  it('renvoie une liste vide quand rien n\'est stocké', () => {
    expect(normalizeRendezVous(null)).toEqual([])
    expect(normalizeRendezVous(undefined)).toEqual([])
  })
})

describe('demandeurLabel', () => {
  it('formate chaque type de demandeur', () => {
    expect(demandeurLabel({ type: 'parent1', nom: 'Said H.' })).toBe('Parent 1 — Said H.')
    expect(demandeurLabel({ type: 'parent2', nom: '' })).toBe('Parent 2')
    expect(demandeurLabel({ type: 'administration', nom: '' })).toBe('Administration')
    expect(demandeurLabel({ type: 'enseignant', nom: 'Sara E.' })).toBe('Enseignant — Sara E.')
    expect(demandeurLabel({ type: 'autre', nom: 'Grand-mère' })).toBe('Grand-mère')
    expect(demandeurLabel(undefined)).toBe('')
  })
})
