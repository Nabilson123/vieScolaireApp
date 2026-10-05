import { describe, expect, it } from 'vitest'
import { defaultExtra, type StudentExtra } from '../data/studentDetails'
import { computeStudentContext } from './reclamationsContexte'

const now = new Date(2026, 9, 6, 10, 0) // 06/10/2026

const event = (date: string, type: 'ABSENCE' | 'RETARD', justified = false) => ({
  date,
  type,
  justified,
  subject: 'Maths',
  subjectColor: 'blue' as const,
  duree: '1h',
  motif: '',
})

const extra = (over: Partial<StudentExtra>): StudentExtra => ({ ...defaultExtra, ...over })

describe('computeStudentContext', () => {
  it('compte les absences, retards et incidents des 30 derniers jours seulement', () => {
    const ctx = computeStudentContext(
      extra({
        events: [
          event('2026-10-01', 'ABSENCE'),
          event('2026-09-20', 'ABSENCE', true),
          event('2026-09-30', 'RETARD'),
          event('2026-08-01', 'ABSENCE'), // trop ancien
          event('2026-10-20', 'ABSENCE'), // futur
        ],
        discipline: [
          { date: '2026-10-02', title: 'Bavardage', description: '', points: -2, author: 'X' },
          { date: '2026-10-03', title: 'Félicitations', description: '', points: 2, author: 'X' }, // points ajoutés : pas un incident
          { date: '2026-07-01', title: 'Ancien', description: '', points: -3, author: 'X' },
        ],
      }),
      'CE2-A',
      undefined,
      now
    )
    expect(ctx.absences).toBe(2)
    expect(ctx.absencesNonJustifiees).toBe(1)
    expect(ctx.retards).toBe(1)
    expect(ctx.incidents).toBe(1)
  })

  it('lit des dates au format français ("12 sept. 2026")', () => {
    const ctx = computeStudentContext(extra({ events: [event('3 octobre 2026', 'ABSENCE')] }), 'CE2-A', undefined, now)
    expect(ctx.absences).toBe(1)
  })

  it('moyenne avec le barème du cycle, absente en maternelle ou sans notes', () => {
    const notes: StudentExtra['notes'] = [
      { subject: 'Maths', coef: 2, classeAverage: 12, evaluations: [{ type: 'DS', value: 8, coef: 1, date: '2026-09-20', author: 'X' }] },
    ]
    const primaire = computeStudentContext(extra({ notes }), 'CE2-A', undefined, now)
    expect(primaire.moyenne?.scale).toBe(10)
    const college = computeStudentContext(extra({ notes }), '2APIC-A', undefined, now)
    expect(college.moyenne?.scale).toBe(20)
    expect(computeStudentContext(extra({ notes }), 'PS-A', undefined, now).moyenne).toBeNull()
    expect(computeStudentContext(extra({}), 'CE2-A', undefined, now).moyenne).toBeNull()
  })

  it('autres réclamations : sans celle qu\'on lit, ouvertes et total', () => {
    const base = { date: '2026-10-01', type: 'Notes', objet: 'o', description: 'd', resolution: '', enseignant: '', parentNom: '', historique: [] }
    const ctx = computeStudentContext(
      extra({
        reclamations: [
          { ...base, id: 'a', statut: 'En attente' },
          { ...base, id: 'b', statut: 'Résolue' },
          { ...base, id: 'c', statut: 'En cours' },
        ],
      }),
      'CE2-A',
      'a',
      now
    )
    expect(ctx.autresReclamations).toEqual({ ouvertes: 1, total: 2 })
  })
})
