import { describe, expect, it } from 'vitest'
import type { DisciplineEvent, EventRecord, StudentExtra } from '../data/studentDetails'
import { defaultExtra } from '../data/studentDetails'
import type { Student } from '../data/students'
import type { SuiviProf } from '../data/suiviProfs'
import { computeAssiduiteParClasse, elevesPlusSignales, reunionPrecedente, suiviPrecedent } from './suiviClasseReunion'

const suivi = (over: Partial<SuiviProf>): SuiviProf => ({
  id: 's',
  teacherIds: [],
  date: '2026-09-29',
  heure: '09:10',
  duree: 30,
  lieu: '',
  motif: '',
  statut: 'Réalisé',
  notes: '',
  createdAt: '',
  niveau: 'CE1',
  ...over,
})

describe('reunionPrecedente', () => {
  const suivis = [
    suivi({ id: '1', date: '2026-09-15' }),
    suivi({ id: '2', date: '2026-09-29' }),
    suivi({ id: '3', date: '2026-09-22', statut: 'Annulé' }),
    suivi({ id: '4', date: '2026-10-06' }),
    suivi({ id: '5', date: '2026-09-30', niveau: 'CE2' }),
  ]

  it('la plus récente réunion non annulée du même niveau avant la réunion courante', () => {
    expect(reunionPrecedente(suivis, 'CE1', { id: '4', date: '2026-10-06' }, '2026-10-06')?.id).toBe('2')
  })

  it('aucune réunion avant : rien', () => {
    expect(reunionPrecedente(suivis, 'CE1', { id: '1', date: '2026-09-15' }, '2026-10-06')).toBeUndefined()
    expect(reunionPrecedente([], 'CE1', undefined, '2026-10-06')).toBeUndefined()
  })

  it('sans réunion courante : la dernière avant aujourd’hui', () => {
    expect(reunionPrecedente(suivis, 'CE1', undefined, '2026-10-06')?.id).toBe('2')
  })
})

describe('suiviPrecedent et elevesPlusSignales', () => {
  const cr = { point3: { a: { constat: 'Retards', mesure: ' Entretien ' }, b: { constat: '', mesure: '' }, c: { constat: 'Bavardages', mesure: '' } } }

  it('ne garde que les élèves pour lesquels quelque chose a été écrit', () => {
    const m = suiviPrecedent(cr)
    expect([...m.keys()]).toEqual(['a', 'c'])
    expect(m.get('a')).toEqual({ constat: 'Retards', mesure: 'Entretien' })
    expect(suiviPrecedent(undefined).size).toBe(0)
  })

  it('les élèves suivis la dernière fois et qui ne sont plus signalés', () => {
    const risk = [{ id: 'a', name: 'A', classe: 'CE1-A', reasons: [] }]
    expect(elevesPlusSignales(suiviPrecedent(cr), risk).map((e) => e.studentId)).toEqual(['c'])
  })
})

describe('computeAssiduiteParClasse', () => {
  const students = [
    { id: 'a', name: 'Amine A', classe: 'CE1-A' },
    { id: 'b', name: 'Bilal B', classe: 'CE1-A' },
    { id: 'c', name: 'Chadi C', classe: 'CE1-B' },
  ] as Student[]
  const ev = (type: EventRecord['type'], date: string) => ({ type, date, justified: false, subject: 'Maths', subjectColor: 'blue', duree: '1h', motif: '' }) as EventRecord
  const inc = (date: string, points = -1) => ({ date, title: 'Bavardage', description: '', points, author: 'M. D' }) as DisciplineEvent
  const extras: Record<string, StudentExtra> = {
    a: { ...defaultExtra, events: [ev('ABSENCE', '2026-10-01'), ev('ABSENCE', '2026-10-02'), ev('RETARD', '2026-10-02'), ev('ABSENCE', '2026-08-01')], discipline: [inc('2026-10-03')] },
    b: { ...defaultExtra, events: [ev('RETARD', '2026-10-01')] },
    c: { ...defaultExtra, events: [ev('ABSENCE', '2026-10-01'), ev('ABSENCE', '2026-10-02')], discipline: [inc('2026-10-04', 2)] },
  }

  it('compte, par classe, les absences, retards et incidents de la période (ni le passé ancien ni les mérites)', () => {
    const [ce1a, ce1b] = computeAssiduiteParClasse(students, extras, ['CE1-A', 'CE1-B'], '2026-09-29', '2026-10-06')
    expect(ce1a).toMatchObject({ classe: 'CE1-A', effectif: 2, absences: 2, elevesAbsents: 1, retards: 2, incidents: 1 })
    expect(ce1b).toMatchObject({ classe: 'CE1-B', effectif: 1, absences: 2, elevesAbsents: 1, retards: 0, incidents: 0 })
  })

  it('élèves concernés : au moins deux signalements, les plus concernés d’abord', () => {
    const [ce1a, ce1b] = computeAssiduiteParClasse(students, extras, ['CE1-A', 'CE1-B'], '2026-09-29', '2026-10-06')
    expect(ce1a.concernes.map((c) => c.name)).toEqual(['Amine A'])
    expect(ce1a.concernes[0]).toMatchObject({ absences: 2, retards: 1, incidents: 1 })
    expect(ce1b.concernes.map((c) => c.name)).toEqual(['Chadi C'])
  })

  it('une classe sans élève ni signalement donne des zéros', () => {
    expect(computeAssiduiteParClasse(students, extras, ['CE9-Z'], '', '')[0]).toMatchObject({ effectif: 0, absences: 0, retards: 0, incidents: 0, concernes: [] })
  })
})
