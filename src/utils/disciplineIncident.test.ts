import { describe, expect, it } from 'vitest'
import type { DisciplineEvent } from '../data/studentDetails'
import type { Student } from '../data/students'
import { buildDisciplinePayloads, coAuteurs, faitsSubis, sanctionOf, type DisciplineForm } from './disciplineIncident'

const student = (id: string, name: string, classe = 'CE1-A'): Student => ({ id, name, classe }) as Student

const incidentForm = (over: Partial<DisciplineForm> = {}): DisciplineForm => ({
  nature: 'incident',
  authorIds: ['a', 'b'],
  victimIds: [],
  title: 'Bagarre entre élèves',
  description: 'Dans la cour',
  author: 'M. Durand',
  date: '2026-10-06',
  incident: {
    typeCode: 'PD-01',
    sanction: 'Avertissement écrit',
    sanctionByStudent: {},
    stepsDone: [0, 1],
    stepDetails: {},
    detailsPrintable: false,
    retenueDate: '',
    retenueDuree: '',
    privationActivite: '',
    privationDuree: '',
  },
  ...over,
})

describe('buildDisciplinePayloads', () => {
  it('une fiche par élève, avec la même sanction par défaut et un groupe commun', () => {
    const payloads = buildDisciplinePayloads(incidentForm())
    expect(payloads.map((p) => p.studentId)).toEqual(['a', 'b'])
    expect(payloads.every((p) => p.sanction === 'Avertissement écrit' && p.points === -1)).toBe(true)
    expect(payloads[0].groupeId).toBeTruthy()
    expect(payloads[0].groupeId).toBe(payloads[1].groupeId)
  })

  it('un seul élève : pas de groupe', () => {
    const [p] = buildDisciplinePayloads(incidentForm({ authorIds: ['a'] }))
    expect(p.groupeId).toBeUndefined()
  })

  it('la sanction peut différer selon l’élève : points, convocation et retenue suivent chaque élève', () => {
    const form = incidentForm()
    form.incident!.sanctionByStudent = { b: 'Retenue' }
    form.incident!.retenueDate = '2026-10-14'
    form.incident!.retenueDuree = '2h'
    const [a, b] = buildDisciplinePayloads(form)
    expect(a.sanction).toBe('Avertissement écrit')
    expect(a.retenueDate).toBeUndefined()
    expect(b.sanction).toBe('Retenue')
    expect(b.points).toBe(-2)
    expect(b.retenueDate).toBe('2026-10-14')
    expect(b.retenueDuree).toBe('2h')
  })

  it('le conseil de discipline n’est à convoquer que pour l’élève concerné', () => {
    const form = incidentForm()
    form.incident!.sanctionByStudent = { a: 'Conseil de discipline' }
    const [a, b] = buildDisciplinePayloads(form)
    expect(a.conseilStatut).toBe('a_convoquer')
    expect(b.conseilStatut).toBeUndefined()
  })

  it('les victimes sont citées sur chaque fiche d’auteur, sans fiche à leur nom', () => {
    const payloads = buildDisciplinePayloads(incidentForm({ victimIds: ['v'] }))
    expect(payloads.map((p) => p.studentId)).toEqual(['a', 'b'])
    expect(payloads.every((p) => p.victimeIds?.[0] === 'v')).toBe(true)
  })

  it('« Autre incident » : pas de procédure de référence', () => {
    const form = incidentForm({ authorIds: ['a'] })
    form.incident!.typeCode = undefined
    const [p] = buildDisciplinePayloads(form)
    expect(p.typeCode).toBeUndefined()
    expect(p.procedureStepsDone).toBeUndefined()
  })

  it('les précisions de procédure ne sont gardées que si elles sont renseignées', () => {
    const form = incidentForm({ authorIds: ['a'] })
    form.incident!.stepDetails = { 0: ' témoin : Sami ', 1: '  ' }
    form.incident!.detailsPrintable = true
    const [p] = buildDisciplinePayloads(form)
    expect(p.procedureStepDetails).toEqual({ 0: ' témoin : Sami ' })
    expect(p.procedureDetailsPrintable).toBe(true)
  })

  it('mérite : les mêmes points pour chaque élève, jamais de victime', () => {
    const payloads = buildDisciplinePayloads({
      nature: 'merite',
      authorIds: ['a', 'b'],
      victimIds: ['v'],
      title: 'Entraide / Camaraderie',
      description: '',
      author: 'M. Durand',
      date: '2026-10-06',
      meritePoints: 1,
    })
    expect(payloads.map((p) => p.points)).toEqual([1, 1])
    expect(payloads.every((p) => p.victimeIds === undefined && p.sanction === undefined)).toBe(true)
  })
})

describe('sanctionOf', () => {
  it('sanction propre à l’élève, sinon la sanction commune', () => {
    const form = incidentForm()
    form.incident!.sanctionByStudent = { b: 'Blâme' }
    expect(sanctionOf(form, 'a')).toBe('Avertissement écrit')
    expect(sanctionOf(form, 'b')).toBe('Blâme')
  })
})

describe('coAuteurs et faitsSubis', () => {
  const students = [student('a', 'Amine A'), student('b', 'Bilal B', 'CE1-B'), student('c', 'Chadi C'), student('v', 'Victor V')]
  const fait = (over: Partial<DisciplineEvent>): DisciplineEvent => ({ date: '2026-10-06', title: 'Bagarre entre élèves', description: '', points: -1, author: 'M. Durand', ...over })
  const discipline: Record<string, DisciplineEvent[]> = {
    a: [fait({ groupeId: 'g1', victimeIds: ['v'] })],
    b: [fait({ groupeId: 'g1', victimeIds: ['v'] })],
    c: [fait({ date: '2026-09-20', title: 'Vol', victimeIds: ['v'] }), fait({ title: 'Autre', victimeIds: ['b'] })],
    v: [],
  }
  const of = (id: string) => discipline[id] ?? []

  it('les autres élèves de la même saisie collective', () => {
    expect(coAuteurs(discipline.a[0], 'a', students, of).map((s) => s.name)).toEqual(['Bilal B'])
    expect(coAuteurs(fait({}), 'c', students, of)).toEqual([])
  })

  it('un fait collectif apparaît une seule fois dans le dossier de la victime, avec tous ses auteurs, le plus récent d’abord', () => {
    const faits = faitsSubis('v', students, of)
    expect(faits).toHaveLength(2)
    expect(faits[0].auteurs.map((s) => s.name)).toEqual(['Amine A', 'Bilal B'])
    expect(faits[1].title).toBe('Vol')
    expect(faits[1].auteurs.map((s) => s.name)).toEqual(['Chadi C'])
  })

  it('un élève qui n’est la victime de personne n’a aucun fait subi, et ne se cite pas lui-même', () => {
    expect(faitsSubis('a', students, of)).toEqual([])
    expect(faitsSubis('b', students, of).map((f) => f.auteurs[0].name)).toEqual(['Chadi C'])
  })
})
