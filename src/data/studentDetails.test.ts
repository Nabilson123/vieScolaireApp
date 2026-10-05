import { describe, expect, it } from 'vitest'
import { demandeurLabel, newReclamationId, normalizeReclamations, normalizeRendezVous, type StoredRendezVousRecord } from './studentDetails'

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

describe('normalizeReclamations', () => {
  const stored = { date: '2026-09-30', statut: 'En attente', type: 'Notes', objet: 'Objet A', description: 'Desc', resolution: '', enseignant: '', parentNom: '' } as const

  it('ajoute un id déterministe et une frise vide aux anciennes réclamations', () => {
    const [a] = normalizeReclamations([{ ...stored }], 'eleve-1')
    const [b] = normalizeReclamations([{ ...stored }], 'eleve-1')
    expect(a.id).toMatch(/^rc-[0-9a-f]{8}$/)
    expect(a.id).toBe(b.id)
    expect(a.historique).toEqual([])
  })

  it("donne des ids différents selon l'élève et selon le contenu", () => {
    const [x] = normalizeReclamations([{ ...stored }], 'eleve-1')
    const [y] = normalizeReclamations([{ ...stored }], 'eleve-2')
    const [z] = normalizeReclamations([{ ...stored, objet: 'Objet B' }], 'eleve-1')
    expect(new Set([x.id, y.id, z.id]).size).toBe(3)
  })

  it('distingue deux réclamations strictement identiques par un suffixe', () => {
    const [first, second] = normalizeReclamations([{ ...stored }, { ...stored }], 'eleve-1')
    expect(first.id).not.toBe(second.id)
    expect(second.id.startsWith(first.id)).toBe(true)
  })

  it('garde un id déjà enregistré et la frise existante', () => {
    const event = { at: '2026-10-01T09:00:00.000Z', action: 'creee', auteur: 'Nabil' } as const
    const [r] = normalizeReclamations([{ ...stored, id: 'fixe', historique: [event] }], 'eleve-1')
    expect(r.id).toBe('fixe')
    expect(r.historique).toEqual([event])
  })

  it('est idempotent et accepte une liste absente', () => {
    const once = normalizeReclamations([{ ...stored }], 'eleve-1')
    expect(normalizeReclamations(once, 'eleve-1')).toEqual(once)
    expect(normalizeReclamations(null, 'eleve-1')).toEqual([])
  })

  it('newReclamationId produit des ids uniques', () => {
    expect(newReclamationId()).not.toBe(newReclamationId())
  })
})
