import { describe, expect, it } from 'vitest'
import type { EventRecord, StudentExtra } from '../data/studentDetails'
import type { Student } from '../data/students'
import type { Teacher } from '../data/teachers'
import type { TeacherAbsenceRecord, TeacherExtra } from '../data/teacherExtras'
import { computeHeuresManqueesParJour } from './dashboardTrend'

function makeStudent(id: string): Student {
  return {
    id,
    name: `Élève ${id}`,
    sexe: 'M',
    classe: 'CE1-A',
    absencesHeures: '0h',
    absencesFois: 0,
    retardsMin: '0h',
    retardsFois: 0,
  } as Student
}

function makeEvent(date: string, duree: string): EventRecord {
  return { date, type: 'ABSENCE', justified: true, subject: 'Maths', subjectColor: 'blue', duree, motif: '' }
}

function makeTeacher(id: string): Teacher {
  return { id, prenom: 'Jean', nom: 'Dupont' } as Teacher
}

function makeTeacherAbsence(date: string, duree: number): TeacherAbsenceRecord {
  return { date, type: 'ABSENCE', duree } as TeacherAbsenceRecord
}

describe('computeHeuresManqueesParJour', () => {
  it('buckets student and teacher missed hours by weekday, Sunday excluded', () => {
    // 2026-03-09 is a Monday, 2026-03-10 a Tuesday
    const students = [makeStudent('s1')]
    const studentExtras: Record<string, StudentExtra> = {
      s1: { events: [makeEvent('2026-03-09', '2h')] } as StudentExtra,
    }
    const teachers = [makeTeacher('t1')]
    const teacherExtras: Record<string, TeacherExtra> = {
      t1: { absences: [makeTeacherAbsence('2026-03-09', 1)] } as TeacherExtra,
    }

    const rows = computeHeuresManqueesParJour(students, studentExtras, teachers, teacherExtras)

    expect(rows).toHaveLength(6)
    expect(rows.map((r) => r.label)).toEqual(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'])
    const monday = rows.find((r) => r.label === 'Lun')!
    expect(monday.heures).toBe(3) // 2h (student) + 1h (teacher)
    expect(monday.heuresEleves).toBe(2)
    expect(monday.heuresProfs).toBe(1)
    expect(monday.topEleves).toEqual([{ name: 'Élève s1', heures: 2, dates: ['09/03/2026'] }])
    expect(monday.topProfs).toEqual([{ name: 'Jean Dupont', heures: 1, dates: ['09/03/2026'] }])
    const tuesday = rows.find((r) => r.label === 'Mar')!
    expect(tuesday.heures).toBe(0)
    expect(tuesday.topEleves).toEqual([])
    expect(tuesday.topProfs).toEqual([])
  })

  it('ranks top contributors per day and caps the list at 3', () => {
    // 2026-03-09 is a Monday
    const students = [makeStudent('s1'), makeStudent('s2'), makeStudent('s3'), makeStudent('s4')]
    const studentExtras: Record<string, StudentExtra> = {
      s1: { events: [makeEvent('2026-03-09', '4h')] } as StudentExtra,
      s2: { events: [makeEvent('2026-03-09', '3h')] } as StudentExtra,
      s3: { events: [makeEvent('2026-03-09', '2h')] } as StudentExtra,
      s4: { events: [makeEvent('2026-03-09', '1h')] } as StudentExtra,
    }

    const rows = computeHeuresManqueesParJour(students, studentExtras, [], {})
    const monday = rows.find((r) => r.label === 'Lun')!

    expect(monday.topEleves).toEqual([
      { name: 'Élève s1', heures: 4, dates: ['09/03/2026'] },
      { name: 'Élève s2', heures: 3, dates: ['09/03/2026'] },
      { name: 'Élève s3', heures: 2, dates: ['09/03/2026'] },
    ])
  })

  it('collects every distinct date contributing to a person\'s total for that weekday', () => {
    // 2026-03-09 and 2026-03-16 are both Mondays
    const students = [makeStudent('s1')]
    const studentExtras: Record<string, StudentExtra> = {
      s1: { events: [makeEvent('2026-03-09', '2h'), makeEvent('2026-03-16', '1h')] } as StudentExtra,
    }

    const rows = computeHeuresManqueesParJour(students, studentExtras, [], {})
    const monday = rows.find((r) => r.label === 'Lun')!

    expect(monday.topEleves).toEqual([{ name: 'Élève s1', heures: 3, dates: ['09/03/2026', '16/03/2026'] }])
  })

  it('returns all-zero buckets when there is no data', () => {
    const rows = computeHeuresManqueesParJour([], {}, [], {})
    expect(rows.every((r) => r.heures === 0 && r.heuresEleves === 0 && r.heuresProfs === 0)).toBe(true)
    expect(rows.every((r) => r.topEleves.length === 0 && r.topProfs.length === 0)).toBe(true)
  })
})
