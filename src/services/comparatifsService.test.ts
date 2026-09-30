import { describe, expect, it } from 'vitest'
import type { Student } from '../data/students'
import type { NoteRow, StudentExtra } from '../data/studentDetails'
import { computeMoyenneGeneraleForDatasetByCycle } from './comparatifsService'

function makeStudent(id: string, classe: string): Student {
  return { id, name: id, sexe: 'M', classe } as Student
}

function makeExtra(value: number): StudentExtra {
  const row: NoteRow = {
    subject: 'Maths',
    coef: 1,
    classeAverage: 0,
    evaluations: [{ type: 'DS', value, coef: 1, date: '2026-01-01', author: 'Prof' }],
  }
  return { notes: [row] } as StudentExtra
}

describe('computeMoyenneGeneraleForDatasetByCycle', () => {
  it('never averages primaire and collège students together', () => {
    const students = [makeStudent('s1', 'CE1-A'), makeStudent('s2', 'CE1-B'), makeStudent('s3', '3APIC-A')]
    const extras: Record<string, StudentExtra> = { s1: makeExtra(8), s2: makeExtra(6), s3: makeExtra(15) }

    const result = computeMoyenneGeneraleForDatasetByCycle(students, extras)

    const primaire = result.find((r) => r.cycle === 'primaire')
    const college = result.find((r) => r.cycle === 'college')
    expect(primaire?.scale).toBe(10)
    expect(primaire?.value).toBe(7) // (8 + 6) / 2
    expect(college?.scale).toBe(20)
    expect(college?.value).toBe(15)
  })

  it('omits a cycle entirely when it has no students with grades', () => {
    const students = [makeStudent('s1', 'CE1-A')]
    const extras: Record<string, StudentExtra> = { s1: makeExtra(8) }

    const result = computeMoyenneGeneraleForDatasetByCycle(students, extras)

    expect(result.map((r) => r.cycle)).toEqual(['primaire'])
  })

  it('never includes maternelle (pas de notation chiffrée)', () => {
    const students = [makeStudent('s1', 'PS-A')]
    const extras: Record<string, StudentExtra> = { s1: makeExtra(8) }

    const result = computeMoyenneGeneraleForDatasetByCycle(students, extras)

    expect(result).toEqual([])
  })
})
