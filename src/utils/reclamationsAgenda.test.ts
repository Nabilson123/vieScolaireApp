import { describe, expect, it } from 'vitest'
import { agendaSectionOf, agendaTotal, computeAgenda } from './reclamationsAgenda'

const now = new Date(2026, 9, 5, 10, 0) // 05/10/2026

const rec = (over: Record<string, unknown>) => ({
  date: '2026-10-05',
  statut: 'En attente' as const,
  type: 'Notes',
  ...over,
})

describe('agendaSectionOf', () => {
  it("range une réclamation urgente dans « Urgentes » avant tout le reste", () => {
    expect(agendaSectionOf(rec({ type: 'Sécurité' }), 'Moi', now)).toBe('urgentes')
    expect(agendaSectionOf(rec({ urgente: true, accuseLe: '2026-10-05T08:00:00.000Z', responsable: 'Moi' }), 'Moi', now)).toBe('urgentes')
  })

  it('accuse de réception à envoyer pour une réclamation standard', () => {
    expect(agendaSectionOf(rec({}), 'Moi', now)).toBe('accuses')
  })

  it('échéance atteinte ou dépassée une fois l’accusé envoyé', () => {
    const accused = { accuseLe: '2026-10-02T08:00:00.000Z', statut: 'En cours' as const, responsable: 'Autre' }
    expect(agendaSectionOf(rec({ ...accused, echeance: '2026-10-05' }), 'Moi', now)).toBe('echeances')
    expect(agendaSectionOf(rec({ ...accused, echeance: '2026-10-03' }), 'Moi', now)).toBe('echeances')
    expect(agendaSectionOf(rec({ ...accused, echeance: '2026-10-08' }), 'Moi', now)).toBeNull()
  })

  it('hors délai sans responsable', () => {
    expect(agendaSectionOf(rec({ date: '2026-09-25', accuseLe: '2026-09-26T08:00:00.000Z' }), 'Moi', now)).toBe('sans_responsable')
  })

  it('relance de la famille pour une résolution datée de plus de 5 jours', () => {
    const resolue = { statut: 'Résolue' as const, resoluLe: new Date(2026, 9, 1, 12, 0).toISOString() }
    expect(agendaSectionOf(rec(resolue), 'Moi', new Date(2026, 9, 5, 10, 0))).toBeNull()
    expect(agendaSectionOf(rec(resolue), 'Moi', new Date(2026, 9, 6, 10, 0))).toBe('relances')
    expect(agendaSectionOf(rec({ statut: 'Résolue' }), 'Moi', new Date(2026, 9, 30))).toBeNull()
  })

  it('mes réclamations en cours, quand rien de plus pressé ne s’applique', () => {
    expect(agendaSectionOf(rec({ statut: 'En cours', accuseLe: '2026-10-05T08:00:00.000Z', responsable: 'Moi', echeance: '2026-10-09' }), 'Moi', now)).toBe('mes')
    expect(agendaSectionOf(rec({ statut: 'En cours', accuseLe: '2026-10-05T08:00:00.000Z', responsable: 'Autre', echeance: '2026-10-09' }), 'Moi', now)).toBeNull()
  })
})

describe('computeAgenda', () => {
  const items = [
    { id: 'a', ...rec({ type: 'Sécurité', date: '2026-10-04' }) },
    { id: 'b', ...rec({ date: '2026-10-03' }) },
    { id: 'c', ...rec({ date: '2026-10-01' }) },
    { id: 'd', ...rec({ statut: 'En cours', accuseLe: '2026-10-02T08:00:00.000Z', echeance: '2026-10-09', responsable: 'Moi' }) },
    { id: 'e', ...rec({ statut: 'En cours', accuseLe: '2026-10-02T08:00:00.000Z', echeance: '2026-10-09', responsable: 'Autre' }) },
  ]

  it('une seule section par réclamation, dans l’ordre de priorité, les vides écartées', () => {
    const sections = computeAgenda(items, 'Moi', now)
    expect(sections.map((s) => s.key)).toEqual(['urgentes', 'accuses', 'mes'])
    expect(sections[0].items.map((i) => i.id)).toEqual(['a'])
    expect(sections[1].items.map((i) => i.id)).toEqual(['c', 'b']) // la plus ancienne d'abord
    expect(sections[2].items.map((i) => i.id)).toEqual(['d'])
    expect(agendaTotal(sections)).toBe(4)
  })

  it('renvoie une liste vide quand rien ne demande d’action', () => {
    expect(computeAgenda([{ id: 'x', ...rec({ statut: 'En cours', accuseLe: '2026-10-05T08:00:00.000Z', echeance: '2026-10-09', responsable: 'Autre' }) }], 'Moi', now)).toEqual([])
  })
})
