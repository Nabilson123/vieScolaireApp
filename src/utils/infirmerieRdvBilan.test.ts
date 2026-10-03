import { describe, expect, it } from 'vitest'
import type { Student } from '../data/students'
import { defaultExtra, type RendezVousRecord, type StudentExtra } from '../data/studentDetails'
import { computeInfirmerieBilan, computeRdvBilan } from './infirmerieRdvBilan'

const student = (id: string, name: string, classe: string) => ({ id, name, classe }) as Student

const students = [student('a', 'Ahmed A', 'CE1-A'), student('b', 'Bilal B', 'CE1-A'), student('c', 'Chahd C', 'CE2-B')]

const visit = (date: string, motif: string) => ({ date, heure: '10:00', motif, action: 'Soin', auteur: 'Infirmière' })
const rdv = (over: Partial<RendezVousRecord>): RendezVousRecord => ({
  date: '2026-09-20',
  heure: '10:00',
  duree: 30,
  statut: 'Planifié',
  mode: 'Présentiel',
  lieu: 'DVS',
  motif: 'Assiduité',
  enseignants: [],
  ...over,
})
const extra = (over: Partial<StudentExtra>): StudentExtra => ({ ...defaultExtra, ...over })

describe('computeInfirmerieBilan', () => {
  const extras: Record<string, StudentExtra> = {
    a: extra({ sante: { visits: [visit('2026-09-10', 'Mal de tête'), visit('2026-09-12', 'mal de tête '), visit('2026-08-01', 'Hors période')] } }),
    b: extra({ sante: { visits: [visit('2026-09-15', 'Chute')] } }),
    c: extra({ sante: { visits: [] } }),
  }

  it('compte passages et élèves distincts sur la période seulement', () => {
    const bilan = computeInfirmerieBilan(students, extras, '2026-09-01', '2026-09-30')
    expect(bilan.passages).toBe(3)
    expect(bilan.eleves).toBe(2)
  })

  it('répartit par classe, la plus concernée d\'abord', () => {
    const bilan = computeInfirmerieBilan(students, extras, '2026-09-01', '2026-09-30')
    expect(bilan.parClasse).toEqual([{ label: 'CE1-A', value: 3 }])
  })

  it('regroupe les motifs sans tenir compte de la casse ni des espaces', () => {
    const bilan = computeInfirmerieBilan(students, extras, '2026-09-01', '2026-09-30')
    expect(bilan.parMotif).toEqual([
      { label: 'Mal de tête', value: 2 },
      { label: 'Chute', value: 1 },
    ])
  })

  it('range les motifs au-delà de 8 dans « Autres motifs »', () => {
    const visits = Array.from({ length: 10 }, (_, i) => visit('2026-09-10', `Motif ${i}`))
    const bilan = computeInfirmerieBilan(students, { a: extra({ sante: { visits } }) }, '2026-09-01', '2026-09-30')
    expect(bilan.parMotif).toHaveLength(9)
    expect(bilan.parMotif[8]).toEqual({ label: 'Autres motifs', value: 2 })
  })

  it('renvoie des zéros quand il n\'y a aucun passage', () => {
    const bilan = computeInfirmerieBilan(students, {}, '2026-09-01', '2026-09-30')
    expect(bilan).toEqual({ passages: 0, eleves: 0, parClasse: [], parMotif: [] })
  })
})

describe('computeRdvBilan', () => {
  const extras: Record<string, StudentExtra> = {
    a: extra({
      rendezVous: [
        rdv({ date: '2026-09-20', statut: 'Réalisé', enseignants: ['Prof X'], compteRendu: { administration: '', parents: '', enseignant: '', redacteur: 'N', signeParent: false } }),
        rdv({ date: '2026-09-25', statut: 'Planifié', motif: 'Comportement' }),
        rdv({ date: '2026-07-01', statut: 'Réalisé' }),
      ],
    }),
    c: extra({
      rendezVous: [rdv({ date: '2026-09-22', statut: 'Annulé' }), rdv({ date: '2026-09-23', statut: 'Réalisé', compteRendu: { administration: '', parents: '', enseignant: '', redacteur: 'N', signeParent: true } })],
    }),
  }

  it('compte les rendez-vous par statut sur la période seulement', () => {
    const bilan = computeRdvBilan(students, extras, '2026-09-01', '2026-09-30')
    expect(bilan.total).toBe(4)
    expect(bilan.planifies).toBe(1)
    expect(bilan.realises).toBe(2)
    expect(bilan.annules).toBe(1)
  })

  it('compte les comptes-rendus rédigés et ceux en attente de signature', () => {
    const bilan = computeRdvBilan(students, extras, '2026-09-01', '2026-09-30')
    expect(bilan.comptesRendus).toBe(2)
    expect(bilan.enAttenteSignature).toBe(1)
  })

  it('exclut les rendez-vous annulés des répartitions mais pas de la liste', () => {
    const bilan = computeRdvBilan(students, extras, '2026-09-01', '2026-09-30')
    expect(bilan.parClasse).toEqual([
      { label: 'CE1-A', value: 2 },
      { label: 'CE2-B', value: 1 },
    ])
    expect(bilan.parMotif).toEqual([
      { label: 'Assiduité', value: 2 },
      { label: 'Comportement', value: 1 },
    ])
    expect(bilan.rows).toHaveLength(4)
  })

  it('trie la liste du plus récent au plus ancien', () => {
    const bilan = computeRdvBilan(students, extras, '2026-09-01', '2026-09-30')
    expect(bilan.rows.map((r) => r.date)).toEqual(['2026-09-25', '2026-09-23', '2026-09-22', '2026-09-20'])
  })
})
