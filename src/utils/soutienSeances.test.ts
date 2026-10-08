import { describe, expect, it } from 'vitest'
import type { SoutienInscription, SoutienSeance } from '../data/soutien'
import { statutSoutienLabel } from '../data/soutien'
import {
  ajouterJours,
  blocsSoutienParJour,
  compterStatuts,
  creneauModifie,
  intervallesSoutienEnseignant,
  intervallesSoutienSalle,
  jourDeDate,
  libelleBloc,
  libelleCreneau,
  occurrencesAnnulees,
  occurrencesSeance,
  prochaineOccurrence,
  seanceActiveLe,
  seanceTerminee,
} from './soutienSeances'

// 2026-10-05 est un lundi.
const seance = (over: Partial<SoutienSeance> = {}): SoutienSeance => ({
  id: 's1',
  matiere: 'Mathématiques',
  jour: 'LUNDI',
  heureDebut: '16:30',
  heureFin: '17:30',
  teacherId: 't1',
  salleId: 'r1',
  classes: ['CE1-A'],
  dateDebut: '2026-10-05',
  dateFin: '2026-11-02',
  datesAnnulees: [],
  note: '',
  createdAt: '2026-10-01T10:00:00Z',
  ...over,
})

const insc = (over: Partial<SoutienInscription> = {}): SoutienInscription => ({
  id: 'i1',
  seanceId: 's1',
  studentId: 'e1',
  statut: 'a_confirmer',
  messageEnvoyeLe: null,
  reponduLe: null,
  createdAt: '2026-10-01T10:00:00Z',
  ...over,
})

describe('dates', () => {
  it('jourDeDate : jour de semaine, null le week-end', () => {
    expect(jourDeDate('2026-10-05')).toBe('LUNDI')
    expect(jourDeDate('2026-10-09')).toBe('VENDREDI')
    expect(jourDeDate('2026-10-10')).toBeNull()
    expect(jourDeDate('n’importe quoi')).toBeNull()
  })

  it('ajouterJours : traverse les fins de mois', () => {
    expect(ajouterJours('2026-10-30', 3)).toBe('2026-11-02')
  })
})

describe('seanceActiveLe', () => {
  it('bon jour, dans la période', () => {
    expect(seanceActiveLe(seance(), '2026-10-12')).toBe(true)
    expect(seanceActiveLe(seance(), '2026-10-05')).toBe(true)
    expect(seanceActiveLe(seance(), '2026-11-02')).toBe(true)
  })

  it('mauvais jour, avant ou après la période : non', () => {
    expect(seanceActiveLe(seance(), '2026-10-13')).toBe(false)
    expect(seanceActiveLe(seance(), '2026-09-28')).toBe(false)
    expect(seanceActiveLe(seance(), '2026-11-09')).toBe(false)
  })

  it('une date annulée n’a pas lieu', () => {
    expect(seanceActiveLe(seance({ datesAnnulees: ['2026-10-12'] }), '2026-10-12')).toBe(false)
    expect(seanceActiveLe(seance({ datesAnnulees: ['2026-10-12'] }), '2026-10-19')).toBe(true)
  })

  it('sans date de fin, la période reste ouverte', () => {
    expect(seanceActiveLe(seance({ dateFin: null }), '2027-03-01')).toBe(true)
  })
})

describe('seanceTerminee', () => {
  it('close une fois la date de fin passée, jamais sans date de fin', () => {
    expect(seanceTerminee(seance(), '2026-11-03')).toBe(true)
    expect(seanceTerminee(seance(), '2026-11-02')).toBe(false)
    expect(seanceTerminee(seance({ dateFin: null }), '2030-01-01')).toBe(false)
  })
})

describe('occurrencesSeance', () => {
  it('une date par semaine, de la première à la dernière', () => {
    expect(occurrencesSeance(seance())).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'])
  })

  it('la période commence un autre jour : avance jusqu’au premier bon jour', () => {
    expect(occurrencesSeance(seance({ dateDebut: '2026-10-07' }))[0]).toBe('2026-10-12')
  })

  it('écarte les dates annulées sauf demande contraire', () => {
    const s = seance({ datesAnnulees: ['2026-10-19'] })
    expect(occurrencesSeance(s)).not.toContain('2026-10-19')
    expect(occurrencesSeance(s, { avecAnnulees: true })).toContain('2026-10-19')
  })

  it('période ouverte : s’arrête au maximum demandé', () => {
    expect(occurrencesSeance(seance({ dateFin: null }), { max: 3 })).toEqual(['2026-10-05', '2026-10-12', '2026-10-19'])
  })

  it('depuis : ne remonte pas avant', () => {
    expect(occurrencesSeance(seance(), { depuis: '2026-10-14' })[0]).toBe('2026-10-19')
  })

  it('prochaineOccurrence : saute une date annulée', () => {
    expect(prochaineOccurrence(seance({ datesAnnulees: ['2026-10-12'] }), '2026-10-12')).toBe('2026-10-19')
    expect(prochaineOccurrence(seance(), '2026-11-03')).toBeNull()
  })

  it('occurrencesAnnulees : ordre chronologique', () => {
    expect(occurrencesAnnulees(seance({ datesAnnulees: ['2026-10-19', '2026-10-12'] }))).toEqual(['2026-10-12', '2026-10-19'])
  })
})

describe('libellés et créneau', () => {
  it('libelleCreneau', () => {
    expect(libelleCreneau(seance())).toBe('Lundi 16:30–17:30')
  })

  it('libelleBloc : pluriel', () => {
    expect(libelleBloc('Maths', 1)).toBe('Soutien – Maths · 1 élève')
    expect(libelleBloc('Maths', 4)).toBe('Soutien – Maths · 4 élèves')
  })

  it('creneauModifie : jour, début ou fin seulement', () => {
    const a = seance()
    expect(creneauModifie(a, { ...a })).toBe(false)
    expect(creneauModifie(a, { ...a, jour: 'MARDI' })).toBe(true)
    expect(creneauModifie(a, { ...a, heureDebut: '16:00' })).toBe(true)
    expect(creneauModifie(a, { ...a, heureFin: '18:00' })).toBe(true)
  })

  it('statutSoutienLabel : « part en transport » seulement pour un élève au transport', () => {
    expect(statutSoutienLabel('ne_reste_pas', true)).toBe('Part en transport')
    expect(statutSoutienLabel('ne_reste_pas', false)).toBe('Ne reste pas')
    expect(statutSoutienLabel('reste', true)).toBe('Reste au soutien')
    expect(statutSoutienLabel('a_confirmer', false)).toBe('À confirmer')
  })

  it('compterStatuts', () => {
    expect(compterStatuts([insc({ statut: 'reste' }), insc({ id: 'i2', statut: 'reste' }), insc({ id: 'i3' })])).toEqual({ a_confirmer: 1, reste: 2, ne_reste_pas: 0 })
  })
})

describe('blocsSoutienParJour', () => {
  const classeDe = (id: string) => ({ e1: 'CE1-A', e2: 'CE1-A', e3: 'CE1-B' })[id]
  const inscriptions = [insc(), insc({ id: 'i2', studentId: 'e2' }), insc({ id: 'i3', studentId: 'e3' })]

  it('sans filtre : tous les inscrits', () => {
    const b = blocsSoutienParJour([seance()], inscriptions, { classeDe, aPartirDe: '2026-10-07' })
    expect(b.LUNDI).toHaveLength(1)
    expect(b.LUNDI[0]).toMatchObject({ start: '16:30', end: '17:30', nbEleves: 3 })
    expect(b.MARDI).toEqual([])
  })

  it('grille d’une classe : seulement ses élèves, et la séance apparaît si la classe est visée ou compte un inscrit', () => {
    const ceA = blocsSoutienParJour([seance()], inscriptions, { classe: 'CE1-A', classeDe, aPartirDe: '2026-10-07' })
    expect(ceA.LUNDI[0].nbEleves).toBe(2)
    const ceB = blocsSoutienParJour([seance()], inscriptions, { classe: 'CE1-B', classeDe, aPartirDe: '2026-10-07' })
    expect(ceB.LUNDI[0].nbEleves).toBe(1)
    const ceC = blocsSoutienParJour([seance()], inscriptions, { classe: 'CE2-A', classeDe, aPartirDe: '2026-10-07' })
    expect(ceC.LUNDI).toEqual([])
    const visee = blocsSoutienParJour([seance({ classes: ['CE2-A'] })], [], { classe: 'CE2-A', classeDe, aPartirDe: '2026-10-07' })
    expect(visee.LUNDI[0].nbEleves).toBe(0)
  })

  it('grille d’un enseignant', () => {
    expect(blocsSoutienParJour([seance()], inscriptions, { teacherId: 't1', classeDe, aPartirDe: '2026-10-07' }).LUNDI).toHaveLength(1)
    expect(blocsSoutienParJour([seance()], inscriptions, { teacherId: 't2', classeDe, aPartirDe: '2026-10-07' }).LUNDI).toHaveLength(0)
  })

  it('une séance terminée n’est plus affichée ; tri par heure', () => {
    expect(blocsSoutienParJour([seance()], inscriptions, { classeDe, aPartirDe: '2026-12-01' }).LUNDI).toEqual([])
    const tot = seance({ id: 's0', heureDebut: '15:00', heureFin: '16:00' })
    expect(blocsSoutienParJour([seance(), tot], [], { classeDe, aPartirDe: '2026-10-07' }).LUNDI.map((x) => x.start)).toEqual(['15:00', '16:30'])
  })
})

describe('occupation de l’enseignant et de la salle', () => {
  it('sans date : toutes les séances de ce jour de semaine', () => {
    expect(intervallesSoutienEnseignant([seance()], 't1', 'LUNDI')).toEqual([{ start: '16:30', end: '17:30' }])
    expect(intervallesSoutienEnseignant([seance()], 't1', 'MARDI')).toEqual([])
    expect(intervallesSoutienEnseignant([seance()], 't2', 'LUNDI')).toEqual([])
    expect(intervallesSoutienEnseignant([seance()], '', 'LUNDI')).toEqual([])
  })

  it('avec une date : respecte la période et les dates annulées', () => {
    const s = seance({ datesAnnulees: ['2026-10-12'] })
    expect(intervallesSoutienEnseignant([s], 't1', 'LUNDI', '2026-10-19')).toHaveLength(1)
    expect(intervallesSoutienEnseignant([s], 't1', 'LUNDI', '2026-10-12')).toEqual([])
    expect(intervallesSoutienEnseignant([s], 't1', 'LUNDI', '2026-11-09')).toEqual([])
  })

  it('salle', () => {
    expect(intervallesSoutienSalle([seance()], 'r1', 'LUNDI', '2026-10-12')).toEqual([{ start: '16:30', end: '17:30' }])
    expect(intervallesSoutienSalle([seance()], 'r2', 'LUNDI', '2026-10-12')).toEqual([])
  })
})
