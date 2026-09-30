import { describe, expect, it } from 'vitest'
import type { ExamSession } from '../data/examPlanner'
import type { Salle } from '../data/salles'
import type { Teacher } from '../data/teachers'
import {
  buildSurveillanceDayGroups,
  computeAutoCompletion,
  computeCoverageByCreneau,
  computeExamCountsByClasseMatiere,
  daysBetween,
  hasClasseConflict,
  hasSalleConflict,
  isFullyCovered,
  isFullyFreeSuggestion,
  largestInterval,
  rankSalles,
  shiftDateByDays,
  type PartialSurveillantSuggestion,
} from './examPlannerAggregation'

function makeSession(overrides: Partial<ExamSession>): ExamSession {
  return {
    id: 's1',
    date: '2026-06-15',
    start: '09:00',
    end: '11:00',
    classe: '3APIC-A',
    matiere: 'Mathématiques',
    salleLabel: 'Bâtiment Collège - Salle 1',
    surveillants: [],
    consignes: '',
    type: 'Examen Officiel',
    ...overrides,
  }
}

function makeTeacher(id: string, prenom: string, nom: string): Teacher {
  return { id, prenom, nom } as Teacher
}

describe('hasSalleConflict', () => {
  it('detects an overlapping session in the same room for a different subject', () => {
    const sessions = [
      makeSession({ id: 'a', date: '2026-06-15', start: '09:00', end: '11:00', salleLabel: 'Salle 1', matiere: 'Mathématiques' }),
    ]
    expect(hasSalleConflict(sessions, '2026-06-15', '10:00', '12:00', 'Salle 1', 'Français')).toBe(true)
  })

  it('ignores non-overlapping slots in the same room', () => {
    const sessions = [makeSession({ id: 'a', date: '2026-06-15', start: '09:00', end: '11:00', salleLabel: 'Salle 1' })]
    expect(hasSalleConflict(sessions, '2026-06-15', '11:00', '13:00', 'Salle 1', 'Mathématiques')).toBe(false)
  })

  it('ignores a different room', () => {
    const sessions = [makeSession({ id: 'a', date: '2026-06-15', start: '09:00', end: '11:00', salleLabel: 'Salle 1' })]
    expect(hasSalleConflict(sessions, '2026-06-15', '09:00', '11:00', 'Salle 2', 'Mathématiques')).toBe(false)
  })

  it('excludes the session being edited from its own conflict check', () => {
    const sessions = [makeSession({ id: 'a', date: '2026-06-15', start: '09:00', end: '11:00', salleLabel: 'Salle 1' })]
    expect(hasSalleConflict(sessions, '2026-06-15', '09:00', '11:00', 'Salle 1', 'Mathématiques', 'a')).toBe(false)
  })

  it('allows another class sitting the same exam (same subject, same exact slot) to share the room', () => {
    const sessions = [
      makeSession({ id: 'a', date: '2026-06-15', start: '09:00', end: '11:00', salleLabel: 'Salle 1', matiere: 'Mathématiques', classe: '3APIC-A' }),
    ]
    expect(hasSalleConflict(sessions, '2026-06-15', '09:00', '11:00', 'Salle 1', 'Mathématiques')).toBe(false)
  })

  it('still flags a conflict if the slot only partially overlaps, even for the same subject', () => {
    const sessions = [
      makeSession({ id: 'a', date: '2026-06-15', start: '09:00', end: '11:00', salleLabel: 'Salle 1', matiere: 'Mathématiques' }),
    ]
    expect(hasSalleConflict(sessions, '2026-06-15', '10:00', '12:00', 'Salle 1', 'Mathématiques')).toBe(true)
  })
})

describe('hasClasseConflict', () => {
  it('detects a class already sitting an exam on an overlapping slot', () => {
    const sessions = [makeSession({ id: 'a', date: '2026-06-15', start: '09:00', end: '11:00', classe: '3APIC-A' })]
    expect(hasClasseConflict(sessions, '2026-06-15', '10:30', '12:00', '3APIC-A')).toBe(true)
  })

  it('ignores a different class', () => {
    const sessions = [makeSession({ id: 'a', date: '2026-06-15', start: '09:00', end: '11:00', classe: '3APIC-A' })]
    expect(hasClasseConflict(sessions, '2026-06-15', '09:00', '11:00', '3APIC-B')).toBe(false)
  })
})

describe('rankSalles', () => {
  const salles: Salle[] = [
    { id: '1', nom: 'Salle 1', batiment: 'Bâtiment Collège', capacite: 20 },
    { id: '2', nom: 'Salle 2', batiment: 'Bâtiment Collège', capacite: 35 },
    { id: '3', nom: 'Salle 3', batiment: 'Bâtiment Collège', capacite: 40 },
  ]

  it('puts rooms with sufficient capacity first, smallest sufficient room first', () => {
    const ranked = rankSalles(salles, 30, new Set())
    expect(ranked.map((r) => r.label)).toEqual([
      'Bâtiment Collège - Salle 2',
      'Bâtiment Collège - Salle 3',
      'Bâtiment Collège - Salle 1',
    ])
    expect(ranked[0].suffisante).toBe(true)
    expect(ranked[2].suffisante).toBe(false)
  })

  it('excludes rooms already occupied on that slot', () => {
    const ranked = rankSalles(salles, 10, new Set(['Bâtiment Collège - Salle 1']))
    expect(ranked.map((r) => r.label)).not.toContain('Bâtiment Collège - Salle 1')
  })
})

describe('buildSurveillanceDayGroups', () => {
  const teachers = [makeTeacher('t1', 'Mohcine', 'ELBOUSSIRI'), makeTeacher('t2', 'Amal', 'JBILOU')]

  it('groups by day, then splits morning/afternoon by 12:00', () => {
    const sessions = [
      makeSession({ id: 'a', date: '2026-06-11', start: '08:45', end: '10:45', matiere: 'Arabe' }),
      makeSession({ id: 'b', date: '2026-06-11', start: '13:15', end: '15:15', matiere: 'Français' }),
    ]
    const days = buildSurveillanceDayGroups(sessions, teachers)

    expect(days).toHaveLength(1)
    expect(days[0].date).toBe('2026-06-11')
    expect(days[0].periods.map((p) => p.period)).toEqual(['Matin', 'Après-midi'])
    expect(days[0].periods[0].rows[0].matiere).toBe('Arabe')
    expect(days[0].periods[0].rows[0].dureeHeures).toBe(2)
  })

  it('merges sessions sharing the same slot/subject into one row with combined classes and surveillants (with initials)', () => {
    const sessions = [
      makeSession({ id: 'a', classe: '3APIC-A', surveillants: [{ teacherId: 't1', start: '09:00', end: '11:00' }] }),
      makeSession({ id: 'b', classe: '3APIC-B', surveillants: [{ teacherId: 't2', start: '09:00', end: '11:00' }] }),
    ]
    const days = buildSurveillanceDayGroups(sessions, teachers)

    const row = days[0].periods[0].rows[0]
    expect(row.classes).toEqual(['3APIC-A', '3APIC-B'])
    expect(row.surveillants).toEqual([
      { name: 'Mohcine ELBOUSSIRI', initials: 'ME' },
      { name: 'Amal JBILOU', initials: 'AJ' },
    ])
  })

  it('sorts days chronologically', () => {
    const sessions = [makeSession({ id: 'a', date: '2026-06-12' }), makeSession({ id: 'b', date: '2026-06-11' })]
    const days = buildSurveillanceDayGroups(sessions, teachers)
    expect(days.map((d) => d.date)).toEqual(['2026-06-11', '2026-06-12'])
  })
})

describe('daysBetween', () => {
  it('computes a positive gap forward', () => {
    expect(daysBetween('2026-06-11', '2026-09-15')).toBe(96)
  })

  it('computes a negative gap backward', () => {
    expect(daysBetween('2026-09-15', '2026-06-11')).toBe(-96)
  })

  it('is zero for the same date', () => {
    expect(daysBetween('2026-06-11', '2026-06-11')).toBe(0)
  })
})

describe('shiftDateByDays', () => {
  it('shifts forward across a month boundary', () => {
    expect(shiftDateByDays('2026-06-28', 5)).toBe('2026-07-03')
  })

  it('shifts backward', () => {
    expect(shiftDateByDays('2026-06-11', -10)).toBe('2026-06-01')
  })

  it('round-trips with daysBetween', () => {
    const offset = daysBetween('2026-06-11', '2026-09-15')
    expect(shiftDateByDays('2026-06-11', offset)).toBe('2026-09-15')
  })
})

describe('isFullyCovered', () => {
  it('is false with no surveillants', () => {
    expect(isFullyCovered([], '09:00', '10:00', 1)).toBe(false)
  })

  it('is true when a single surveillant covers the whole range and only 1 is required', () => {
    expect(isFullyCovered([{ teacherId: 't1', start: '09:00', end: '10:00' }], '09:00', '10:00', 1)).toBe(true)
  })

  it('is true when several surveillants together cover the range with no gap (required=1)', () => {
    const surveillants = [
      { teacherId: 't1', start: '09:00', end: '09:30' },
      { teacherId: 't2', start: '09:30', end: '10:00' },
    ]
    expect(isFullyCovered(surveillants, '09:00', '10:00', 1)).toBe(true)
  })

  it('is false when there is a gap in the middle', () => {
    const surveillants = [
      { teacherId: 't1', start: '09:00', end: '09:20' },
      { teacherId: 't2', start: '09:40', end: '10:00' },
    ]
    expect(isFullyCovered(surveillants, '09:00', '10:00', 1)).toBe(false)
  })

  it('is false when only part of the range is covered', () => {
    expect(isFullyCovered([{ teacherId: 't1', start: '09:00', end: '09:30' }], '09:00', '10:00', 1)).toBe(false)
  })

  it('defaults to requiring 3 simultaneous surveillants when required is omitted', () => {
    expect(isFullyCovered([{ teacherId: 't1', start: '09:00', end: '10:00' }], '09:00', '10:00')).toBe(false)
  })

  it('is false when 2 profs cover the whole range but a 3rd only joins partway through (required=3)', () => {
    const surveillants = [
      { teacherId: 't1', start: '08:45', end: '10:15' },
      { teacherId: 't2', start: '08:45', end: '10:15' },
      { teacherId: 't3', start: '09:30', end: '10:15' },
    ]
    expect(isFullyCovered(surveillants, '08:45', '10:15', 3)).toBe(false)
  })

  it('is true when 3 profs overlap simultaneously across the whole range, even on different windows', () => {
    const surveillants = [
      { teacherId: 't1', start: '08:45', end: '10:15' },
      { teacherId: 't2', start: '08:45', end: '09:45' },
      { teacherId: 't3', start: '09:15', end: '10:15' },
      { teacherId: 't4', start: '08:45', end: '09:30' },
    ]
    // 08:45-09:15: t1,t2,t4 (3) · 09:15-09:30: t1,t2,t3,t4 (4) · 09:30-09:45: t1,t2,t3 (3) · 09:45-10:15: t1,t3 (2)
    expect(isFullyCovered(surveillants, '08:45', '10:15', 3)).toBe(false)
  })
})

describe('computeAutoCompletion', () => {
  const makeSuggestion = (
    id: string,
    freeIntervals: { start: string; end: string }[],
    chargeSurPeriode = 0
  ): PartialSurveillantSuggestion => ({
    teacher: { id } as never,
    chargeSurPeriode,
    freeIntervals,
  })

  it('adds nothing when already covered at the required depth', () => {
    const current = [
      { teacherId: 't1', start: '09:00', end: '10:00' },
      { teacherId: 't2', start: '09:00', end: '10:00' },
    ]
    const candidates = [makeSuggestion('t3', [{ start: '09:00', end: '10:00' }])]
    expect(computeAutoCompletion(current, '09:00', '10:00', 2, candidates)).toEqual([])
  })

  it('fills the gap left by a partial surveillant using another free candidate', () => {
    const current = [
      { teacherId: 't1', start: '09:00', end: '10:00' },
      { teacherId: 't2', start: '09:30', end: '10:00' },
    ]
    const candidates = [makeSuggestion('t3', [{ start: '09:00', end: '10:00' }])]
    const additions = computeAutoCompletion(current, '09:00', '10:00', 2, candidates)
    expect(additions).toEqual([{ teacherId: 't3', start: '09:00', end: '10:00' }])
  })

  it('prefers the candidate covering the most of the under-covered time', () => {
    const current: { teacherId: string; start: string; end: string }[] = []
    const candidates = [
      makeSuggestion('small', [{ start: '09:00', end: '09:15' }]),
      makeSuggestion('big', [{ start: '09:00', end: '10:00' }]),
    ]
    const additions = computeAutoCompletion(current, '09:00', '10:00', 1, candidates)
    expect(additions[0]).toEqual({ teacherId: 'big', start: '09:00', end: '10:00' })
  })

  it('stops adding once no remaining candidate overlaps the still-uncovered time', () => {
    const current: { teacherId: string; start: string; end: string }[] = []
    const candidates = [makeSuggestion('t1', [{ start: '09:00', end: '09:30' }])]
    const additions = computeAutoCompletion(current, '09:00', '10:00', 3, candidates)
    expect(additions).toEqual([{ teacherId: 't1', start: '09:00', end: '09:30' }])
  })

  it('combines multiple partial candidates to reach full depth across the whole range', () => {
    const current: { teacherId: string; start: string; end: string }[] = []
    const candidates = [
      makeSuggestion('t1', [{ start: '09:00', end: '09:30' }]),
      makeSuggestion('t2', [{ start: '09:30', end: '10:00' }]),
    ]
    const additions = computeAutoCompletion(current, '09:00', '10:00', 1, candidates)
    expect(new Set(additions.map((a) => a.teacherId))).toEqual(new Set(['t1', 't2']))
    expect(isFullyCovered([...current, ...additions], '09:00', '10:00', 1)).toBe(true)
  })

  it('prefers the least-loaded candidate over one covering more time, to keep surveillance fair', () => {
    const current: { teacherId: string; start: string; end: string }[] = []
    const candidates = [
      makeSuggestion('busy', [{ start: '09:00', end: '10:00' }], 300),
      makeSuggestion('free', [{ start: '09:00', end: '09:15' }], 0),
    ]
    const additions = computeAutoCompletion(current, '09:00', '10:00', 1, candidates)
    expect(additions[0]).toEqual({ teacherId: 'free', start: '09:00', end: '09:15' })
  })

  it('breaks ties between equally-loaded candidates by who covers the most time', () => {
    const current: { teacherId: string; start: string; end: string }[] = []
    const candidates = [
      makeSuggestion('small', [{ start: '09:00', end: '09:15' }], 60),
      makeSuggestion('big', [{ start: '09:00', end: '10:00' }], 60),
    ]
    const additions = computeAutoCompletion(current, '09:00', '10:00', 1, candidates)
    expect(additions[0]).toEqual({ teacherId: 'big', start: '09:00', end: '10:00' })
  })
})

describe('largestInterval', () => {
  it('picks the longest of several free intervals', () => {
    const intervals = [
      { start: '09:00', end: '09:15' },
      { start: '09:30', end: '10:00' },
    ]
    expect(largestInterval(intervals)).toEqual({ start: '09:30', end: '10:00' })
  })

  it('returns the only interval when there is just one', () => {
    const intervals = [{ start: '09:00', end: '10:00' }]
    expect(largestInterval(intervals)).toEqual({ start: '09:00', end: '10:00' })
  })
})

describe('isFullyFreeSuggestion', () => {
  it('is true when the single free interval matches the full window', () => {
    const suggestion = { teacher: {} as never, chargeSurPeriode: 0, freeIntervals: [{ start: '09:00', end: '10:00' }] }
    expect(isFullyFreeSuggestion(suggestion, '09:00', '10:00')).toBe(true)
  })

  it('is false when the free interval is shorter than the full window', () => {
    const suggestion = { teacher: {} as never, chargeSurPeriode: 0, freeIntervals: [{ start: '09:30', end: '10:00' }] }
    expect(isFullyFreeSuggestion(suggestion, '09:00', '10:00')).toBe(false)
  })

  it('is false when there are several disjoint free intervals', () => {
    const suggestion = {
      teacher: {} as never,
      chargeSurPeriode: 0,
      freeIntervals: [
        { start: '09:00', end: '09:15' },
        { start: '09:45', end: '10:00' },
      ],
    }
    expect(isFullyFreeSuggestion(suggestion, '09:00', '10:00')).toBe(false)
  })
})

describe('computeCoverageByCreneau', () => {
  it('counts Couvert / Partiel / Non couvert per exact créneau', () => {
    const sessions = [
      makeSession({ id: 'a', date: '2026-06-11', start: '09:00', end: '10:00', classe: 'CE6-A', surveillants: [
        { teacherId: 't1', start: '09:00', end: '10:00' },
        { teacherId: 't2', start: '09:00', end: '10:00' },
        { teacherId: 't3', start: '09:00', end: '10:00' },
      ] }),
      makeSession({ id: 'b', date: '2026-06-11', start: '09:00', end: '10:00', classe: 'CE6-B', surveillants: [
        { teacherId: 't1', start: '09:00', end: '09:30' },
      ] }),
      makeSession({ id: 'c', date: '2026-06-11', start: '11:00', end: '12:00', classe: '3APIC-A', surveillants: [] }),
    ]
    const stats = computeCoverageByCreneau(sessions)
    expect(stats).toEqual([
      { date: '2026-06-11', start: '09:00', end: '10:00', covered: 1, partial: 1, uncovered: 0, total: 2 },
      { date: '2026-06-11', start: '11:00', end: '12:00', covered: 0, partial: 0, uncovered: 1, total: 1 },
    ])
  })
})

describe('computeExamCountsByClasseMatiere', () => {
  it('counts exams grouped by classe and matière', () => {
    const sessions = [
      makeSession({ id: 'a', classe: 'CE6-A', matiere: 'Mathématiques' }),
      makeSession({ id: 'b', classe: 'CE6-A', matiere: 'Mathématiques' }),
      makeSession({ id: 'c', classe: 'CE6-A', matiere: 'Français' }),
      makeSession({ id: 'd', classe: '3APIC-A', matiere: 'Mathématiques' }),
    ]
    expect(computeExamCountsByClasseMatiere(sessions)).toEqual([
      { classe: '3APIC-A', matiere: 'Mathématiques', count: 1 },
      { classe: 'CE6-A', matiere: 'Français', count: 1 },
      { classe: 'CE6-A', matiere: 'Mathématiques', count: 2 },
    ])
  })
})
