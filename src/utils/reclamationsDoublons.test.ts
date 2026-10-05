import { describe, expect, it } from 'vitest'
import type { ReclamationRecord } from '../data/studentDetails'
import { findSimilarReclamations } from './reclamationsDoublons'

const now = new Date(2026, 9, 6, 10, 0) // 06/10/2026

const rec = (over: Partial<ReclamationRecord>): ReclamationRecord => ({
  id: 'r1',
  date: '2026-10-01',
  statut: 'En attente',
  type: 'Cantine',
  objet: 'Repas froid à la cantine',
  description: '',
  resolution: '',
  enseignant: '',
  parentNom: '',
  historique: [],
  ...over,
})

describe('findSimilarReclamations', () => {
  it('même catégorie : détectée même avec un objet différent', () => {
    const r = findSimilarReclamations([rec({ objet: 'Portion trop petite' })], { category: 'Cantine', objet: 'Sans rapport' }, now)
    expect(r).toHaveLength(1)
    expect(r[0].raison).toBe('categorie')
  })

  it('objet proche dans une autre catégorie : au moins la moitié des mots significatifs', () => {
    const r = findSimilarReclamations([rec({ type: 'Hygiène / Locaux', objet: 'Repas froid à la cantine' })], { category: 'Transport', objet: 'Le repas est froid' }, now)
    expect(r).toHaveLength(1)
    expect(r[0].raison).toBe('objet')
  })

  it('catégorie et objet : classée avant les autres', () => {
    const r = findSimilarReclamations(
      [rec({ id: 'a', objet: 'Autre sujet' }), rec({ id: 'b', objet: 'Repas froid à la cantine' })],
      { category: 'Cantine', objet: 'Repas froid' },
      now
    )
    expect(r.map((x) => x.reclamation.id)).toEqual(['b', 'a'])
    expect(r[0].raison).toBe('categorie_et_objet')
  })

  it('rien de proche : liste vide', () => {
    expect(findSimilarReclamations([rec({ type: 'Transport', objet: 'Bus en retard' })], { category: 'Notes', objet: 'Contestation du contrôle' }, now)).toEqual([])
  })

  it('résolue depuis moins de 30 jours : comptée ; au-delà : ignorée', () => {
    const recente = rec({ statut: 'Résolue', resoluLe: new Date(2026, 9, 1).toISOString() })
    const ancienne = rec({ statut: 'Résolue', resoluLe: new Date(2026, 7, 1).toISOString() })
    expect(findSimilarReclamations([recente], { category: 'Cantine', objet: '' }, now)).toHaveLength(1)
    expect(findSimilarReclamations([ancienne], { category: 'Cantine', objet: '' }, now)).toHaveLength(0)
  })

  it("résolue sans date de résolution : on se fie à la date de réception", () => {
    expect(findSimilarReclamations([rec({ statut: 'Résolue', date: '2026-09-25' })], { category: 'Cantine', objet: '' }, now)).toHaveLength(1)
    expect(findSimilarReclamations([rec({ statut: 'Résolue', date: '2026-06-01' })], { category: 'Cantine', objet: '' }, now)).toHaveLength(0)
  })

  it("un objet vide ou fait de mots courts ne déclenche pas de rapprochement d'objet", () => {
    expect(findSimilarReclamations([rec({ type: 'Transport', objet: 'Il a eu un pb' })], { category: 'Notes', objet: '' }, now)).toEqual([])
  })
})
