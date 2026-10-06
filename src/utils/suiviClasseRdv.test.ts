import { describe, expect, it } from 'vitest'
import type { RendezVousRecord, StudentExtra } from '../data/studentDetails'
import { defaultExtra } from '../data/studentDetails'
import type { Student } from '../data/students'
import type { SuiviProf } from '../data/suiviProfs'
import { collectRendezVous, compterParStatut, famillesAContacter, filtrerRendezVous, periodeDepuis, statutRdv, type RdvLigne } from './suiviClasseRdv'

const today = '2026-10-06'

const rdv = (over: Partial<RendezVousRecord>): RendezVousRecord => ({
  date: '2026-10-10',
  heure: '10:00',
  duree: 30,
  statut: 'Planifié',
  mode: 'Présentiel',
  lieu: '',
  motif: 'Suivi',
  enseignants: [],
  ...over,
})

const ligne = (studentId: string, record: RendezVousRecord): RdvLigne => ({ studentId, studentName: studentId.toUpperCase(), classe: 'CE1-A', record })

const student = (id: string, classe: string): Student => ({ id, name: id.toUpperCase(), classe }) as Student

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

describe('collectRendezVous', () => {
  it('ne garde que les élèves des classes du niveau', () => {
    const students = [student('a', 'CE1-A'), student('b', 'CE1-B'), student('c', 'CE2-A')]
    const extras: Record<string, StudentExtra> = {
      a: { ...defaultExtra, rendezVous: [rdv({})] },
      b: { ...defaultExtra, rendezVous: [rdv({}), rdv({ date: '2026-09-01', statut: 'Réalisé' })] },
      c: { ...defaultExtra, rendezVous: [rdv({})] },
    }
    const lignes = collectRendezVous(students, extras, ['CE1-A', 'CE1-B'])
    expect(lignes.map((l) => l.studentId)).toEqual(['a', 'b', 'b'])
  })
})

describe('periodeDepuis', () => {
  it('la réunion précédente non annulée du même niveau', () => {
    const suivis = [
      suivi({ id: '1', date: '2026-09-15' }),
      suivi({ id: '2', date: '2026-09-29' }),
      suivi({ id: '3', date: '2026-09-22', statut: 'Annulé' }),
      suivi({ id: '4', date: '2026-10-06' }),
      suivi({ id: '5', date: '2026-09-30', niveau: 'CE2' }),
    ]
    expect(periodeDepuis(suivis, 'CE1', { id: '4', date: '2026-10-06' }, today)).toBe('2026-09-29')
  })

  it('à défaut, 30 jours avant aujourd’hui', () => {
    expect(periodeDepuis([], 'CE1', { id: 'x', date: '2026-10-06' }, today)).toBe('2026-09-06')
  })
})

describe('statutRdv', () => {
  it('à venir, à clôturer, tenu, annulé', () => {
    expect(statutRdv({ statut: 'Planifié', date: '2026-10-06' }, today)).toBe('a_venir')
    expect(statutRdv({ statut: 'Planifié', date: '2026-10-05' }, today)).toBe('a_cloturer')
    expect(statutRdv({ statut: 'Réalisé', date: '2026-09-01' }, today)).toBe('tenu')
    expect(statutRdv({ statut: 'Annulé', date: '2026-10-20' }, today)).toBe('annule')
  })
})

describe('filtrerRendezVous', () => {
  const lignes = [
    ligne('a', rdv({ date: '2026-10-20' })),
    ligne('b', rdv({ date: '2026-10-08' })),
    ligne('c', rdv({ date: '2026-09-30', statut: 'Réalisé' })),
    ligne('d', rdv({ date: '2026-08-15', statut: 'Réalisé' })),
    ligne('e', rdv({ date: '2026-10-01' })), // planifié, passé : à clôturer
    ligne('f', rdv({ date: '2026-10-03', statut: 'Annulé' })),
  ]

  it('depuis la dernière réunion : le passé ancien disparaît, l’à venir et l’à clôturer restent', () => {
    const r = filtrerRendezVous(lignes, { depuis: '2026-09-29', statut: 'tous' }, today)
    expect(r.map((l) => l.studentId)).toEqual(['b', 'a', 'f', 'e', 'c'])
  })

  it('les à venir d’abord, le plus proche en tête', () => {
    const r = filtrerRendezVous(lignes, { depuis: null, statut: 'tous' }, today)
    expect(r.slice(0, 2).map((l) => l.studentId)).toEqual(['b', 'a'])
  })

  it('toute l’année : le passé ancien revient', () => {
    expect(filtrerRendezVous(lignes, { depuis: null, statut: 'tous' }, today).map((l) => l.studentId)).toContain('d')
  })

  it('filtre de statut', () => {
    expect(filtrerRendezVous(lignes, { depuis: null, statut: 'tenu' }, today).map((l) => l.studentId)).toEqual(['c', 'd'])
    expect(filtrerRendezVous(lignes, { depuis: null, statut: 'annule' }, today).map((l) => l.studentId)).toEqual(['f'])
  })

  it('compteurs par statut', () => {
    expect(compterParStatut(lignes, today)).toEqual({ a_venir: 2, a_cloturer: 1, tenu: 2, annule: 1 })
  })
})

describe('famillesAContacter', () => {
  const risk = [
    { id: 'a', name: 'A', classe: 'CE1-A', reasons: ['Retards cumulés : 65 min'] },
    { id: 'b', name: 'B', classe: 'CE1-B', reasons: ['Moyenne basse : 4/10', 'Discipline récente : 2 incident(s)'] },
  ]
  const reclamations = [
    { studentId: 'b', studentName: 'B', classe: 'CE1-B', objet: '**Objet : Dispute**', type: 'Comportement', date: '2026-10-01', statut: 'En attente' as const, id: 'r1', indexInStudent: 0 },
    { studentId: 'c', studentName: 'C', classe: 'CE1-A', objet: 'Cantine', type: 'Cantine', date: '2026-10-01', statut: 'En cours' as const, id: 'r2', indexInStudent: 0 },
    { studentId: 'd', studentName: 'D', classe: 'CE1-A', objet: 'Résolue', type: 'Notes', date: '2026-10-01', statut: 'Résolue' as const, id: 'r3', indexInStudent: 0 },
  ]

  it('fusionne élèves à suivre et réclamations ouvertes (jamais les résolues)', () => {
    const r = famillesAContacter(risk, reclamations, [], today)
    expect(r.map((f) => f.studentId).sort()).toEqual(['a', 'b', 'c'])
    expect(r.find((f) => f.studentId === 'b')?.raisons).toEqual(['Moyenne basse : 4/10', 'Discipline récente : 2 incident(s)', 'Réclamation ouverte : Dispute'])
  })

  it('état du contact : prochain, dernier, jamais reçu', () => {
    const lignes = [
      ligne('a', rdv({ date: '2026-10-12', heure: '09:00' })),
      ligne('b', rdv({ date: '2026-09-21', statut: 'Réalisé' })),
      ligne('b', rdv({ date: '2026-09-10', statut: 'Réalisé' })),
    ]
    const r = famillesAContacter(risk, reclamations, lignes, today)
    const a = r.find((f) => f.studentId === 'a')!
    const b = r.find((f) => f.studentId === 'b')!
    const c = r.find((f) => f.studentId === 'c')!
    expect(a.prochain?.record.date).toBe('2026-10-12')
    expect(a.jamaisRecu).toBe(false)
    expect(b.dernier?.record.date).toBe('2026-09-21')
    expect(b.prochain).toBeUndefined()
    expect(c.jamaisRecu).toBe(true)
  })

  it('classement : sans rendez-vous programmé d’abord, jamais reçu en tête, puis le plus de raisons', () => {
    const lignes = [ligne('a', rdv({ date: '2026-10-12' })), ligne('b', rdv({ date: '2026-09-21', statut: 'Réalisé' }))]
    expect(famillesAContacter(risk, reclamations, lignes, today).map((f) => f.studentId)).toEqual(['c', 'b', 'a'])
  })

  it('parmi ceux jamais reçus, les familles qui ont une réclamation ouverte passent avant les autres', () => {
    const r = famillesAContacter(risk, reclamations, [], today)
    expect(r.map((f) => f.studentId).slice(0, 3)).toEqual(['b', 'c', 'a'])
    expect(r.find((f) => f.studentId === 'c')?.reclamationOuverte).toBe(true)
    expect(r.find((f) => f.studentId === 'a')?.reclamationOuverte).toBe(false)
  })
})
