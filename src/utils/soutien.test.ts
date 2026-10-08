import { describe, expect, it } from 'vitest'
import type { AlertRules } from '../data/alertRules'
import type { SoutienInscription, SoutienSeance } from '../data/soutien'
import { TRANSPORT_PARENTS, defaultIdentity, type StudentIdentity } from '../data/studentIdentity'
import { defaultExtra, type NoteRow } from '../data/studentDetails'
import type { Student } from '../data/students'
import type { ServicesCapacite } from '../services/servicesCapaciteService'
import {
  alerteCar,
  conflitsSeance,
  incoherencesSortie,
  infoTransportEleve,
  modeDepartSoutien,
  normaliserHeure,
  rapportParClasse,
  sortieSeule,
  soutienDuJour,
  sortiesDuJour,
  suggestionsPourMatiere,
  type BrouillonSeance,
  type ConflitsContext,
  type EleveRapportSource,
} from './soutien'

const capacite = { transportHeureSoirPrimaire: '16:00', transportHeureSoirCollege: '17:00', transportHeureMatin: '07:30' } as ServicesCapacite

const student = (id: string, classe: string, name = id.toUpperCase()): Student => ({ id, name, classe }) as Student
const identity = (over: Partial<StudentIdentity> = {}): StudentIdentity => ({ ...defaultIdentity, ...over })
const cantine = (over: Partial<typeof defaultExtra.cantine> = {}) => ({ ...defaultExtra.cantine, ...over })

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
  createdAt: '',
  ...over,
})

const insc = (over: Partial<SoutienInscription> = {}): SoutienInscription => ({
  id: 'i1',
  seanceId: 's1',
  studentId: 'e1',
  statut: 'a_confirmer',
  messageEnvoyeLe: null,
  reponduLe: null,
  createdAt: '',
  ...over,
})

describe('normaliserHeure', () => {
  it('formats courants', () => {
    expect(normaliserHeure('16:00')).toBe('16:00')
    expect(normaliserHeure('16:00:00')).toBe('16:00')
    expect(normaliserHeure('16h00')).toBe('16:00')
    expect(normaliserHeure('9:5')).toBe('09:05')
    expect(normaliserHeure('')).toBe('')
    expect(normaliserHeure('bientôt')).toBe('')
  })
})

describe('infoTransportEleve', () => {
  it('élève au transport du soir : ligne, départ 16h pour le primaire', () => {
    const t = infoTransportEleve(student('e1', 'CE1-A'), identity({ transport: true, transportLigne: 'A' }), capacite)
    expect(t).toEqual({ aTransportSoir: true, ligneSoir: 'A', depart: '16h', heureDepart: '16:00' })
  })

  it('collège : départ à 17h', () => {
    const t = infoTransportEleve(student('e1', '2APIC-A'), identity({ transport: true, transportLigne: 'B' }), capacite)
    expect(t).toMatchObject({ aTransportSoir: true, depart: '17h', heureDepart: '17:00' })
  })

  it('primaire avec sortie à 17h cochée : 17h', () => {
    const t = infoTransportEleve(student('e1', 'CE1-A'), identity({ transport: true, transportLigne: 'A', transportSortie17h: true }), capacite)
    expect(t.heureDepart).toBe('17:00')
  })

  it('ligne du soir distincte du matin', () => {
    const t = infoTransportEleve(student('e1', 'CE1-A'), identity({ transport: true, transportLigne: 'A', transportLigneSoir: 'C' }), capacite)
    expect(t.ligneSoir).toBe('C')
  })

  it('soir assuré par les parents, pas de transport ou pas de ligne : pas de transport du soir', () => {
    expect(infoTransportEleve(student('e1', 'CE1-A'), identity({ transport: true, transportLigne: 'A', transportLigneSoir: TRANSPORT_PARENTS }), capacite).aTransportSoir).toBe(false)
    expect(infoTransportEleve(student('e1', 'CE1-A'), identity({ transport: false, transportLigne: 'A' }), capacite).aTransportSoir).toBe(false)
    expect(infoTransportEleve(student('e1', 'CE1-A'), identity({ transport: true }), capacite).aTransportSoir).toBe(false)
    expect(infoTransportEleve(student('e1', 'CE1-A'), undefined, capacite).aTransportSoir).toBe(false)
  })

  it('heure non configurée : repli sur 16:00 / 17:00', () => {
    const t = infoTransportEleve(student('e1', 'CE1-A'), identity({ transport: true, transportLigne: 'A' }), undefined)
    expect(t.heureDepart).toBe('16:00')
  })
})

describe('alerteCar', () => {
  const car = { aTransportSoir: true, ligneSoir: 'A', depart: '16h' as const, heureDepart: '16:00' }

  it('la séance finit après le transport : renvoie l’heure du transport', () => {
    expect(alerteCar({ heureFin: '17:30' }, car)).toBe('16:00')
  })

  it('la séance finit avant ou pile au départ : pas d’alerte', () => {
    expect(alerteCar({ heureFin: '15:30' }, car)).toBeNull()
    expect(alerteCar({ heureFin: '16:00' }, car)).toBeNull()
  })

  it('élève sans car du soir : jamais d’alerte', () => {
    expect(alerteCar({ heureFin: '18:00' }, { aTransportSoir: false, ligneSoir: null, depart: null, heureDepart: '' })).toBeNull()
  })
})

describe('sortieSeule', () => {
  it('accord signé', () => {
    expect(sortieSeule(cantine({ interdictionSortie: false, modaliteSortie: 'Sortie seul(e) (Accord signé)', dechargeSignee: true, dechargeDate: '2026-09-08' }))).toEqual({
      seul: true,
      accordSigne: true,
      dateAccord: '2026-09-08',
      anomalie: false,
    })
  })

  it('sortie seul(e) sans signature : anomalie', () => {
    const s = sortieSeule(cantine({ interdictionSortie: false, modaliteSortie: 'Sortie seul(e) (Accord signé)', dechargeSignee: false }))
    expect(s).toMatchObject({ seul: true, accordSigne: false, anomalie: true })
  })

  it('ancienne valeur « Sortie libre » comptée comme sortie seul(e)', () => {
    expect(sortieSeule(cantine({ interdictionSortie: false, modaliteSortie: 'Sortie libre', dechargeSignee: true })).seul).toBe(true)
  })

  it('l’interdiction l’emporte, la sortie accompagnée n’est pas « seul(e) »', () => {
    expect(sortieSeule(cantine({ interdictionSortie: true, modaliteSortie: 'Sortie seul(e) (Accord signé)' })).seul).toBe(false)
    expect(sortieSeule(cantine({ interdictionSortie: false, modaliteSortie: 'Sortie accompagnée' })).seul).toBe(false)
    expect(sortieSeule(undefined).seul).toBe(false)
  })
})

describe('conflitsSeance', () => {
  const brouillon = (over: Partial<BrouillonSeance> = {}): BrouillonSeance => ({
    matiere: 'Mathématiques',
    jour: 'LUNDI',
    heureDebut: '16:30',
    heureFin: '17:30',
    teacherId: 't1',
    salleId: 'r1',
    dateDebut: '2026-10-05',
    dateFin: '2026-10-26',
    datesAnnulees: [],
    studentIds: ['e1', 'e2'],
    ...over,
  })

  const ctx = (over: Partial<ConflitsContext> = {}): ConflitsContext => ({
    seances: [],
    inscriptions: [],
    coursEnseignant: () => [],
    coursSalle: () => [],
    coursClasse: () => [],
    classeDe: () => undefined,
    ...over,
  })

  it('aucun conflit', () => {
    expect(conflitsSeance(brouillon(), ctx())).toEqual([])
  })

  it('heures invalides : rien à vérifier', () => {
    expect(conflitsSeance(brouillon({ heureDebut: '17:30', heureFin: '16:30' }), ctx({ coursEnseignant: () => [{ start: '08:00', end: '23:00', libelle: 'x' }] }))).toEqual([])
  })

  it('enseignant : cours qui chevauche, pas un cours qui se termine pile au début', () => {
    const c = ctx({
      coursEnseignant: () => [
        { start: '15:30', end: '16:30', libelle: 'CE2-A Français' },
        { start: '17:00', end: '18:00', libelle: 'CE3-A Maths' },
      ],
    })
    const r = conflitsSeance(brouillon(), c)
    expect(r).toHaveLength(1)
    expect(r[0].type).toBe('enseignant_cours')
    expect(r[0].message).toContain('CE3-A Maths')
  })

  it('enseignant : déjà un autre soutien au même moment, sauf la séance modifiée elle-même', () => {
    const autre = seance({ id: 's2', salleId: 'r9', heureDebut: '17:00', heureFin: '18:00' })
    expect(conflitsSeance(brouillon(), ctx({ seances: [autre] })).map((c) => c.type)).toEqual(['enseignant_autre_seance'])
    expect(conflitsSeance(brouillon({ id: 's2' }), ctx({ seances: [autre] }))).toEqual([])
  })

  it('autre soutien du même enseignant mais sur une autre période : pas de conflit', () => {
    const autre = seance({ id: 's2', dateDebut: '2026-12-01', dateFin: null })
    expect(conflitsSeance(brouillon(), ctx({ seances: [autre] }))).toEqual([])
  })

  it('enseignant occupé (rendez-vous, suivi) à une date précise, regroupé et plafonné', () => {
    const c = ctx({ occupationEnseignant: (_t, date) => (date === '2026-10-12' ? [{ start: '16:00', end: '17:00', libelle: 'Suivi de classe' }] : []) })
    const r = conflitsSeance(brouillon(), c)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ type: 'enseignant_occupe' })
    expect(r[0].message).toContain('12/10')
  })

  it('salle : cours, autre soutien et réservation', () => {
    const c = ctx({
      coursSalle: () => [{ start: '16:00', end: '17:00', libelle: 'CM2-A Sciences' }],
      reservationsSalle: (_s, date) => (date === '2026-10-19' ? [{ start: '17:00', end: '18:00', libelle: 'Réunion' }] : []),
      seances: [seance({ id: 's3', teacherId: 't9', heureDebut: '16:00', heureFin: '17:00' })],
    })
    const types = conflitsSeance(brouillon({ teacherId: null }), c).map((x) => x.type)
    expect(types).toEqual(['salle_cours', 'salle_autre_seance', 'salle_reservation'])
  })

  it('élèves : cours de leur classe au même moment, regroupés par classe ; déjà inscrits ailleurs', () => {
    const c = ctx({
      classeDe: (id) => (id === 'e3' ? 'CE1-B' : 'CE1-A'),
      coursClasse: (classe) => (classe === 'CE1-A' ? [{ start: '16:00', end: '17:00', libelle: 'Arabe' }] : []),
      seances: [seance({ id: 's2', teacherId: 't9', salleId: null, heureDebut: '17:00', heureFin: '18:00' })],
      inscriptions: [insc({ id: 'x', seanceId: 's2', studentId: 'e2' })],
    })
    const r = conflitsSeance(brouillon({ teacherId: null, salleId: null, studentIds: ['e1', 'e2', 'e3'] }), c)
    expect(r.map((x) => x.type)).toEqual(['eleve_cours', 'eleve_autre_seance'])
    expect(r[0].message).toContain('2 élèves de CE1-A')
    expect(r[1].message).toContain('1 élève est déjà inscrit')
  })
})

describe('rapportParClasse', () => {
  const eleves: EleveRapportSource[] = [
    { student: student('e1', 'CE2-A', 'Zineb'), identity: identity({ transport: true, transportLigne: 'A' }), cantine: cantine() },
    { student: student('e2', 'CE1-B', 'Adam'), identity: identity({ transport: true, transportLigne: 'B', transportLigneSoir: TRANSPORT_PARENTS }), cantine: cantine({ interdictionSortie: false, modaliteSortie: 'Sortie seul(e) (Accord signé)', dechargeSignee: true, dechargeDate: '2026-09-08' }) },
    { student: student('e3', 'CE1-B', 'Bilal'), identity: identity(), cantine: cantine({ interdictionSortie: false, modaliteSortie: 'Sortie seul(e) (Accord signé)', dechargeSignee: false }) },
    { student: student('e4', 'CE1-B', 'Chaima'), identity: identity({ transport: true, transportLigne: 'A' }), cantine: cantine() },
    { student: student('e5', 'Dossier incomplet', 'Inconnu'), identity: identity({ transport: true, transportLigne: 'A' }), cantine: cantine() },
    { student: student('e6', '1APIC-A', 'Yassine'), identity: identity(), cantine: cantine() },
    { student: student('e7', 'PS-A', 'Lina'), identity: identity({ transport: true, transportLigne: 'C' }), cantine: cantine() },
  ]
  const s1 = seance({ id: 's1', classes: ['CE1-B'] })
  const fini = seance({ id: 's2', dateFin: '2026-09-01' })
  const inscriptions = [
    insc({ id: 'i1', seanceId: 's1', studentId: 'e4', statut: 'reste' }),
    insc({ id: 'i2', seanceId: 's1', studentId: 'e3' }),
    insc({ id: 'i3', seanceId: 's2', studentId: 'e3' }),
    insc({ id: 'i4', seanceId: 's1', studentId: 'e5' }),
  ]
  const rapport = rapportParClasse({ eleves, capacite, seances: [s1, fini], inscriptions, aPartirDe: '2026-10-07' })

  it('classes dans l’ordre pédagogique, sans « Dossier incomplet » ni classe sans élève concerné', () => {
    expect(rapport.map((r) => r.classe)).toEqual(['PS-A', 'CE1-B', 'CE2-A'])
  })

  it('transport : ligne du matin, du soir et départ ; soir assuré par les parents', () => {
    const ce1 = rapport.find((r) => r.classe === 'CE1-B')!
    expect(ce1.transport.map((t) => t.name)).toEqual(['Adam', 'Chaima'])
    expect(ce1.transport[0]).toMatchObject({ matin: 'B', soir: 'Parents', depart: '' })
    expect(ce1.transport[1]).toMatchObject({ matin: 'A', soir: 'A', depart: '16:00' })
  })

  it('sortie seul(e) avec accord ou en anomalie', () => {
    const ce1 = rapport.find((r) => r.classe === 'CE1-B')!
    expect(ce1.sortieSeul.map((s) => [s.name, s.accordSigne, s.anomalie])).toEqual([
      ['Adam', true, false],
      ['Bilal', false, true],
    ])
  })

  it('soutien : toutes les séances non closes, avec l’état et l’alerte du transport', () => {
    const ce1 = rapport.find((r) => r.classe === 'CE1-B')!
    expect(ce1.soutien.map((s) => [s.name, s.statut, s.aTransportSoir, s.alerteCar])).toEqual([
      ['Bilal', 'a_confirmer', false, null],
      ['Chaima', 'reste', true, '16:00'],
    ])
    // la séance close et l’élève « Dossier incomplet » sont absents
    expect(rapport.flatMap((r) => r.soutien).map((s) => s.seanceId)).not.toContain('s2')
  })

  it('limiter à certaines classes', () => {
    expect(rapportParClasse({ eleves, capacite, seances: [s1], inscriptions, aPartirDe: '2026-10-07', classes: ['CE2-A'] }).map((r) => r.classe)).toEqual(['CE2-A'])
  })
})

describe('suggestionsPourMatiere', () => {
  const rules = {
    primaire: { seuilMoyennePedagogique: 5 },
    college: { seuilMoyennePedagogique: 10 },
    maternelle: { seuilMoyennePedagogique: 0 },
  } as unknown as AlertRules
  const notes = (subject: string, ...values: number[]): NoteRow[] => [{ subject, coef: 1, classeAverage: 0, evaluations: values.map((value) => ({ type: 'DS', value, coef: 1, date: '', author: '' })) }]

  const eleves = [
    { student: student('e1', 'CE1-A', 'Faible'), notes: notes('Mathématiques', 3, 4) },
    { student: student('e2', 'CE1-A', 'Moyen'), notes: notes('Mathématiques', 8) },
    { student: student('e3', 'CE1-B', 'Autre classe'), notes: notes('Mathématiques', 1) },
    { student: student('e4', '1APIC-A', 'Collège'), notes: notes('Mathématiques', 7) },
    { student: student('e5', 'CE1-A', 'Autre matière'), notes: notes('Français', 1) },
    { student: student('e6', 'CE1-A', 'Sans note'), notes: [] },
    { student: student('e7', 'PS-A', 'Maternelle'), notes: notes('Mathématiques', 0) },
  ]

  it('élèves des classes visées sous le seuil de leur cycle dans la matière, du plus faible au plus fort', () => {
    const r = suggestionsPourMatiere('mathematiques', ['CE1-A', '1APIC-A', 'PS-A'], eleves, rules)
    expect(r.map((x) => x.name)).toEqual(['Faible', 'Collège'])
    expect(r[0]).toMatchObject({ moyenne: 3.5, scale: 10, seuil: 5 })
    expect(r[1]).toMatchObject({ scale: 20, seuil: 10 })
  })

  it('aucune classe visée : aucune suggestion', () => {
    expect(suggestionsPourMatiere('Mathématiques', [], eleves, rules)).toEqual([])
  })
})

describe('soutienDuJour', () => {
  // 2026-10-13 est un mardi.
  const mardi = seance({ id: 's1', jour: 'MARDI', heureDebut: '16:00', heureFin: '17:30', dateDebut: '2026-10-13', dateFin: '2026-11-03' })
  const lundi = seance({ id: 's2', jour: 'LUNDI' })
  const inscriptions = [
    insc({ id: 'i1', seanceId: 's1', studentId: 'e1', statut: 'reste' }),
    insc({ id: 'i2', seanceId: 's1', studentId: 'e2', statut: 'reste' }),
    insc({ id: 'i3', seanceId: 's1', studentId: 'e3' }),
    insc({ id: 'i4', seanceId: 's1', studentId: 'e4', statut: 'ne_reste_pas' }),
  ]
  const eleve = { nom: (id: string) => id.toUpperCase(), manqueLeCar: (id: string, heureFin: string) => id === 'e1' && heureFin > '16:00' }
  const minutes = (h: number, m = 0) => h * 60 + m

  it('ne garde que les séances qui ont lieu ce jour-là', () => {
    expect(soutienDuJour([mardi, lundi], inscriptions, '2026-10-13', minutes(10), eleve).map((l) => l.seanceId)).toEqual(['s1'])
    expect(soutienDuJour([mardi], inscriptions, '2026-10-14', minutes(10), eleve)).toEqual([])
  })

  it('une date annulée n’y figure pas', () => {
    expect(soutienDuJour([{ ...mardi, datesAnnulees: ['2026-10-13'] }], inscriptions, '2026-10-13', minutes(10), eleve)).toEqual([])
  })

  it('compte les réponses et signale les élèves confirmés qui ont normalement le transport', () => {
    const [l] = soutienDuJour([mardi], inscriptions, '2026-10-13', minutes(10), eleve)
    expect(l).toMatchObject({ confirmes: 2, aConfirmer: 1, nePasRestent: 1, confirmesAuCar: ['E1'] })
  })

  it('moment : à venir, en cours, terminée', () => {
    const moment = (h: number, m = 0) => soutienDuJour([mardi], inscriptions, '2026-10-13', minutes(h, m), eleve)[0].moment
    expect(moment(15, 59)).toBe('a_venir')
    expect(moment(16)).toBe('en_cours')
    expect(moment(17, 29)).toBe('en_cours')
    expect(moment(17, 30)).toBe('terminee')
  })

  it('classées par heure de début', () => {
    const tot = seance({ id: 's3', jour: 'MARDI', heureDebut: '15:00', heureFin: '16:00', dateDebut: '2026-10-13' })
    expect(soutienDuJour([mardi, tot], [], '2026-10-13', minutes(10), eleve).map((l) => l.seanceId)).toEqual(['s3', 's1'])
  })
})

describe('modeDepartSoutien', () => {
  const car = { aTransportSoir: true, ligneSoir: 'A', depart: '16h' as const, heureDepart: '16:00' }
  const sansCar = { aTransportSoir: false, ligneSoir: null, depart: null, heureDepart: '' }

  it('seul(e), car manqué, car encore pris, parents', () => {
    expect(modeDepartSoutien({ heureFin: '17:30' }, true, car)).toBe('Sort seul(e)')
    expect(modeDepartSoutien({ heureFin: '17:30' }, false, car)).toBe('Habituellement au transport : non assuré ce jour')
    expect(modeDepartSoutien({ heureFin: '15:30' }, false, car)).toBe('Transport de 16:00')
    expect(modeDepartSoutien({ heureFin: '17:30' }, false, sansCar)).toBe('Récupéré par les parents')
  })
})

describe('sortiesDuJour', () => {
  // 2026-10-14 est un mercredi.
  const mercredi = (over: Partial<SoutienSeance> = {}) => seance({ id: 's1', jour: 'MERCREDI', heureDebut: '16:30', heureFin: '17:30', dateDebut: '2026-10-07', dateFin: null, teacherId: 't1', ...over })
  const seulSigne = cantine({ interdictionSortie: false, modaliteSortie: 'Sortie seul(e) (Accord signé)', dechargeSignee: true, dechargeDate: '08/09/2026' })
  const eleves: EleveRapportSource[] = [
    { student: student('e1', 'CE1-A', 'Adam'), identity: identity({ transport: true, transportLigne: 'A' }), cantine: cantine() },
    { student: student('e2', 'CE1-A', 'Basma'), identity: identity({ transport: true, transportLigne: 'A' }), cantine: cantine() },
    { student: student('e3', '2APIC-A', 'Chadi'), identity: identity({ transport: true, transportLigne: 'C' }), cantine: cantine() },
    { student: student('e4', 'CE2-A', 'Dina'), identity: identity(), cantine: seulSigne },
    { student: student('e5', 'Dossier incomplet', 'Inconnu'), identity: identity({ transport: true, transportLigne: 'A' }), cantine: cantine() },
  ]
  const inscriptions = [
    insc({ id: 'i1', studentId: 'e1', statut: 'reste' }),
    insc({ id: 'i2', studentId: 'e2', statut: 'a_confirmer' }),
    insc({ id: 'i3', studentId: 'e3', statut: 'reste' }),
    insc({ id: 'i4', studentId: 'e4', statut: 'reste' }),
  ]
  const calcul = (seances: SoutienSeance[], dateISO = '2026-10-14') => sortiesDuJour({ dateISO, eleves, capacite, seances, inscriptions, nomEnseignant: (id) => (id ? `Prof ${id}` : '') })

  it('transports du soir : qui reste au soutien manque son transport, les réponses attendues sont signalées', () => {
    const { cars } = calcul([mercredi()])
    expect(cars.map((c) => `${c.depart}-${c.ligne}`)).toEqual(['16:00-A', '17:00-C'])
    expect(cars[0]).toMatchObject({ habituels: 2, restent: 1, attendus: 1 })
    expect(cars[0].restants.map((r) => r.name)).toEqual(['Adam'])
    expect(cars[0].enAttente.map((r) => r.name)).toEqual(['Basma'])
    expect(cars[1]).toMatchObject({ habituels: 1, restent: 1, attendus: 0 })
  })

  it('« Dossier incomplet » n’entre dans aucun transport', () => {
    expect(calcul([mercredi()]).cars[0].habituels).toBe(2)
  })

  it('séance qui finit avant le transport : l’élève le prend encore', () => {
    const { cars, soutien } = calcul([mercredi({ heureDebut: '14:30', heureFin: '15:30' })])
    expect(cars[0]).toMatchObject({ habituels: 2, restent: 0, attendus: 2, enAttente: [] })
    expect(soutien[0].confirmes.find((c) => c.name === 'Adam')?.sortie).toBe('Transport de 16:00')
  })

  it('séances du jour : élèves confirmés avec leur mode de départ, réponses en attente', () => {
    const { soutien } = calcul([mercredi()])
    expect(soutien).toHaveLength(1)
    expect(soutien[0]).toMatchObject({ matiere: 'Mathématiques', enseignant: 'Prof t1', nePasRestent: 0 })
    expect(soutien[0].confirmes.map((c) => [c.name, c.sortie])).toEqual([
      ['Adam', 'Habituellement au transport : non assuré ce jour'],
      ['Dina', 'Sort seul(e)'],
      ['Chadi', 'Habituellement au transport : non assuré ce jour'],
    ])
    expect(soutien[0].enAttente).toEqual([{ name: 'Basma', classe: 'CE1-A' }])
  })

  it('élèves qui sortent seul(e) : heure de fin du soutien auquel ils restent', () => {
    expect(calcul([mercredi()]).sortieSeul).toMatchObject([{ name: 'Dina', accordSigne: true, resteJusqua: '17:30' }])
    expect(calcul([mercredi()], '2026-10-15').sortieSeul[0].resteJusqua).toBeNull()
  })

  it('un jour sans séance : plus de soutien, les cars gardent leurs élèves habituels', () => {
    const r = calcul([mercredi()], '2026-10-15')
    expect(r.soutien).toEqual([])
    expect(r.cars[0]).toMatchObject({ habituels: 2, restent: 0, attendus: 2 })
  })

  it('une date annulée : la séance n’a pas lieu', () => {
    expect(calcul([mercredi({ datesAnnulees: ['2026-10-14'] })]).soutien).toEqual([])
  })
})

describe('incoherencesSortie', () => {
  const seulMode = { interdictionSortie: false, modaliteSortie: 'Sortie seul(e) (Accord signé)', dechargeSignee: true }
  const source = (s: Student, id: StudentIdentity | undefined, c: ReturnType<typeof cantine>): EleveRapportSource => ({ student: s, identity: id, cantine: c })

  it('mode « sortie seul(e) » avec une interdiction de sortie active', () => {
    const r = incoherencesSortie([source(student('a', 'CE2-A'), identity(), cantine({ ...seulMode, interdictionSortie: true }))], capacite)
    expect(r).toHaveLength(1)
    expect(r[0].problemes[0]).toContain('interdiction de sortie')
  })

  it('sort seul(e) mais affecté(e) au transport du soir', () => {
    const r = incoherencesSortie([source(student('b', 'CE2-A'), identity({ transport: true, transportLigne: 'B' }), cantine(seulMode))], capacite)
    expect(r[0].problemes).toEqual(['Sort seul(e) mais est affecté(e) au transport du soir (ligne B).'])
  })

  it('sortie seul(e) en maternelle', () => {
    const r = incoherencesSortie([source(student('c', 'PS-A'), identity(), cantine(seulMode))], capacite)
    expect(r[0].problemes).toEqual(['Élève de maternelle : sortie seul(e) à vérifier.'])
  })

  it('fiche cohérente, autre mode de sortie ou dossier incomplet : rien', () => {
    expect(
      incoherencesSortie(
        [
          source(student('d', 'CE2-A'), identity(), cantine(seulMode)),
          source(student('e', 'CE2-A'), identity({ transport: true, transportLigne: 'B' }), cantine({ modaliteSortie: 'Sortie accompagnée', interdictionSortie: false })),
          source(student('f', 'Dossier incomplet'), identity(), cantine({ ...seulMode, interdictionSortie: true })),
        ],
        capacite,
      ),
    ).toEqual([])
  })
})
