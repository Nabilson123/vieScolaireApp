import { describe, expect, it } from 'vitest'
import type { EventRecord, NoteRow, StudentExtra } from '../data/studentDetails'
import type { Student } from '../data/students'
import {
  computeAbsenceRetardStats,
  computeAssiduiteBadge,
  computeClasseAverageForSubject,
  computeMoyenneGenerale,
  computeSubjectBreakdown,
  computeSubjectMoyenne,
  formatDuration,
  parseDuration,
} from './studentAggregation'

describe('parseDuration / formatDuration', () => {
  it('parses combined hour+minute strings', () => {
    expect(parseDuration('2h 30min')).toBe(150)
  })

  it('parses hour-only and minute-only strings', () => {
    expect(parseDuration('3h')).toBe(180)
    expect(parseDuration('45min')).toBe(45)
  })

  it('formats minutes back into a French duration label', () => {
    expect(formatDuration(0)).toBe('0h')
    expect(formatDuration(45)).toBe('45min')
    expect(formatDuration(120)).toBe('2h')
    expect(formatDuration(150)).toBe('2h 30min')
  })
})

describe('computeSubjectMoyenne', () => {
  it('returns null when there are no evaluations', () => {
    const row: NoteRow = { subject: 'Maths', coef: 3, evaluations: [], classeAverage: 12 }
    expect(computeSubjectMoyenne(row)).toBeNull()
  })

  it('computes the coefficient-weighted average', () => {
    const row: NoteRow = {
      subject: 'Maths',
      coef: 3,
      classeAverage: 12,
      evaluations: [
        { type: 'DS', value: 10, coef: 1, date: '2026-01-01', author: 'Prof' },
        { type: 'DS', value: 20, coef: 1, date: '2026-01-08', author: 'Prof' },
      ],
    }
    expect(computeSubjectMoyenne(row)).toBe(15)
  })
})

describe('computeMoyenneGenerale', () => {
  it('returns null when no subject has grades', () => {
    const notes: NoteRow[] = [{ subject: 'Maths', coef: 3, evaluations: [], classeAverage: 12 }]
    expect(computeMoyenneGenerale(notes)).toBeNull()
  })

  it('weights subject averages by subject coefficient', () => {
    const notes: NoteRow[] = [
      {
        subject: 'Maths',
        coef: 2,
        classeAverage: 12,
        evaluations: [{ type: 'DS', value: 10, coef: 1, date: '2026-01-01', author: 'Prof' }],
      },
      {
        subject: 'Français',
        coef: 1,
        classeAverage: 12,
        evaluations: [{ type: 'DS', value: 16, coef: 1, date: '2026-01-01', author: 'Prof' }],
      },
    ]
    // (10*2 + 16*1) / 3 = 12
    expect(computeMoyenneGenerale(notes)).toBe(12)
  })
})

describe('computeAssiduiteBadge', () => {
  it('returns the green badge at and above the 95% threshold', () => {
    expect(computeAssiduiteBadge(95).label).toBe('🎓 Élève régulier')
    expect(computeAssiduiteBadge(100).label).toBe('🎓 Élève régulier')
  })

  it('returns the amber badge between 85% (inclusive) and 95%', () => {
    expect(computeAssiduiteBadge(85).label).toBe('⚠️ Assiduité à surveiller')
    expect(computeAssiduiteBadge(94.9).label).toBe('⚠️ Assiduité à surveiller')
  })

  it('returns the red badge below 85%', () => {
    expect(computeAssiduiteBadge(84.9).label).toBe('🔴 Absences fréquentes')
    expect(computeAssiduiteBadge(0).label).toBe('🔴 Absences fréquentes')
  })
})

describe('computeClasseAverageForSubject', () => {
  function makeStudent(id: string, classe: string): Student {
    return { id, name: id, sexe: 'M', classe } as Student
  }

  function makeExtra(subject: string, values: number[]): StudentExtra {
    const row: NoteRow = {
      subject,
      coef: 1,
      classeAverage: 0,
      evaluations: values.map((value) => ({ type: 'DS', value, coef: 1, date: '2026-01-01', author: 'Prof' })),
    }
    return { notes: [row] } as StudentExtra
  }

  it('averages classmates own subject-moyenne, scoped to the given classe', () => {
    const students = [makeStudent('s1', 'CE2-A'), makeStudent('s2', 'CE2-A'), makeStudent('s3', 'CE1-A')]
    const studentExtras: Record<string, StudentExtra> = {
      s1: makeExtra('Maths', [10]),
      s2: makeExtra('Maths', [14]),
      s3: makeExtra('Maths', [2]), // different classe, must not count
    }
    // (10 + 14) / 2 = 12, s3 excluded because it's in CE1-A not CE2-A
    expect(computeClasseAverageForSubject('Maths', '', '', 'CE2-A', students, studentExtras)).toBe(12)
  })

  it('does not just echo a single student back as the class average', () => {
    const students = [makeStudent('s1', 'CE2-A')]
    const studentExtras: Record<string, StudentExtra> = { s1: makeExtra('Maths', [10]) }
    // Regression: this used to be seeded from the viewed student's own first grade,
    // making "classe" always equal the student's own average.
    expect(computeClasseAverageForSubject('Maths', '', '', 'CE2-A', students, studentExtras)).toBe(10)
    expect(computeClasseAverageForSubject('Français', '', '', 'CE2-A', students, studentExtras)).toBeNull()
  })

  it('respects the period filter when averaging classmates', () => {
    const students = [makeStudent('s1', 'CE2-A'), makeStudent('s2', 'CE2-A')]
    const studentExtras: Record<string, StudentExtra> = {
      s1: makeExtra('Maths', [10]),
      s2: {
        notes: [
          {
            subject: 'Maths',
            coef: 1,
            classeAverage: 0,
            evaluations: [{ type: 'DS', value: 18, coef: 1, date: '2020-01-01', author: 'Prof' }],
          },
        ],
      } as StudentExtra,
    }
    // s2's only evaluation is outside the filtered period, so only s1 counts
    expect(computeClasseAverageForSubject('Maths', '2026-01-01', '2026-12-31', 'CE2-A', students, studentExtras)).toBe(10)
  })

  it('returns null when no classmate has any data for the subject', () => {
    const students = [makeStudent('s1', 'CE2-A')]
    expect(computeClasseAverageForSubject('Maths', '', '', 'CE2-A', students, {})).toBeNull()
  })
})

describe('computeAbsenceRetardStats', () => {
  it('separates absences from retards and sums their durations', () => {
    const events: EventRecord[] = [
      { date: '2026-01-01', type: 'ABSENCE', justified: true, subject: 'Maths', subjectColor: 'blue', duree: '2h', motif: '' },
      { date: '2026-01-02', type: 'RETARD', justified: false, subject: 'Français', subjectColor: 'cyan', duree: '15min', motif: '' },
    ]
    const stats = computeAbsenceRetardStats(events)
    expect(stats.absencesFois).toBe(1)
    expect(stats.absencesHeures).toBe('2h')
    expect(stats.retardsFois).toBe(1)
    expect(stats.retardsMin).toBe('15min')
    expect(stats.totalHeures).toBe('2h 15min')
  })
})

describe('computeSubjectBreakdown', () => {
  it('groups events by subject and computes a relative bar percentage', () => {
    const events: EventRecord[] = [
      { date: '2026-01-01', type: 'ABSENCE', justified: true, subject: 'Maths', subjectColor: 'blue', duree: '2h', motif: '' },
      { date: '2026-01-02', type: 'ABSENCE', justified: true, subject: 'Français', subjectColor: 'cyan', duree: '1h', motif: '' },
    ]
    const rows = computeSubjectBreakdown(events)
    const maths = rows.find((r) => r.subject === 'Maths')
    const francais = rows.find((r) => r.subject === 'Français')
    expect(maths?.barPct).toBe(100)
    expect(francais?.barPct).toBe(50)
  })
})
