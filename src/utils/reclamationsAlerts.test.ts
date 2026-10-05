import { describe, expect, it } from 'vitest'
import type { ReclamationRecord } from '../data/studentDetails'
import { computeReclamationSignals, type ReclamationRef } from './reclamationsAlerts'

const now = new Date(2026, 9, 5, 10, 0) // 05/10/2026

let seq = 0
const ref = (over: { studentId?: string; classe?: string; date: string; type?: string; enseignant?: string }): ReclamationRef => {
  seq += 1
  const studentId = over.studentId ?? `s${seq}`
  const record: ReclamationRecord = {
    id: `r${seq}`,
    date: over.date,
    statut: 'En attente',
    type: over.type ?? 'Notes',
    objet: 'Objet',
    description: 'Desc',
    resolution: '',
    enseignant: over.enseignant ?? '',
    parentNom: '',
    historique: [],
  }
  return { studentId, studentName: `Élève ${studentId}`, classe: over.classe ?? 'CE1-A', record }
}

describe('computeReclamationSignals', () => {
  it('signale 3 réclamations de même catégorie dans une classe sur 14 jours', () => {
    const refs = [
      ref({ classe: 'CE2-B', type: 'Transport', date: '2026-10-01' }),
      ref({ classe: 'CE2-B', type: 'Transport', date: '2026-09-28' }),
      ref({ classe: 'CE2-B', type: 'Transport', date: '2026-09-25' }),
      ref({ classe: 'CE2-B', type: 'Cantine', date: '2026-09-25' }),
    ]
    const signals = computeReclamationSignals(refs, now)
    expect(signals).toHaveLength(1)
    expect(signals[0].kind).toBe('classe_categorie')
    expect(signals[0].count).toBe(3)
    expect(signals[0].label).toContain('« Transport » en CE2-B')
  })

  it('ignore les réclamations trop anciennes pour la fenêtre', () => {
    const refs = [
      ref({ classe: 'CE2-B', type: 'Transport', date: '2026-10-01' }),
      ref({ classe: 'CE2-B', type: 'Transport', date: '2026-09-28' }),
      ref({ classe: 'CE2-B', type: 'Transport', date: '2026-09-10' }), // 25 jours
    ]
    expect(computeReclamationSignals(refs, now)).toEqual([])
  })

  it('signale un enseignant cité 3 fois sur 30 jours', () => {
    const refs = [
      ref({ enseignant: 'Doha KARMOUCHI', date: '2026-10-02', classe: 'CE1-A', type: 'Notes' }),
      ref({ enseignant: 'Doha KARMOUCHI', date: '2026-09-20', classe: 'CE2-A', type: 'Comportement' }),
      ref({ enseignant: 'Doha KARMOUCHI', date: '2026-09-10', classe: 'CE3-A', type: 'Autre' }),
    ]
    const signals = computeReclamationSignals(refs, now)
    expect(signals.map((s) => s.kind)).toEqual(['concerne'])
    expect(signals[0].label).toContain('Doha KARMOUCHI')
  })

  it('signale un élève avec 2 réclamations sur 30 jours (parent qui revient)', () => {
    const refs = [ref({ studentId: 'x', date: '2026-10-02' }), ref({ studentId: 'x', date: '2026-09-15', type: 'Cantine' })]
    const signals = computeReclamationSignals(refs, now)
    expect(signals).toHaveLength(1)
    expect(signals[0].kind).toBe('eleve')
    expect(signals[0].ids).toHaveLength(2)
  })

  it('ne signale rien sous les seuils, et trie par nombre décroissant', () => {
    expect(computeReclamationSignals([ref({ date: '2026-10-02' }), ref({ date: '2026-10-01' })], now)).toEqual([])
    const refs = [
      ref({ studentId: 'a', date: '2026-10-02', enseignant: 'X Y', classe: 'CE1-A', type: 'Notes' }),
      ref({ studentId: 'a', date: '2026-10-01', enseignant: 'X Y', classe: 'CE1-A', type: 'Cantine' }),
      ref({ studentId: 'b', date: '2026-10-01', enseignant: 'X Y', classe: 'CE2-A', type: 'Transport' }),
    ]
    const signals = computeReclamationSignals(refs, now)
    expect(signals.map((s) => s.count)).toEqual([3, 2])
  })
})
