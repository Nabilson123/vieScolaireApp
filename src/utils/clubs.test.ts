import { describe, expect, it } from 'vitest'
import { libelleClub, type Club, type ClubInscription, type ClubSeance } from '../data/clubs'
import {
  clubALieuLe,
  blocsClubParJour,
  clubComplet,
  clubTermine,
  clubsDeLEleve,
  datesDuClub,
  datesDuMois,
  dernierJourDuMois,
  finDuClub,
  intervallesClubEnseignant,
  intervallesClubSalle,
  libelleBlocClub,
  libelleSeances,
  listeAttente,
  niveauAutorise,
  niveauDeClasse,
  occurrencesDuClub,
  placesRestantes,
  promouvoirSuivant,
  seancesClubEnSalleLe,
  seancesDuJour,
  seancesTriees,
  statutPourNouvelInscrit,
} from './clubs'

const seance = (over: Partial<ClubSeance> = {}): ClubSeance => ({ jour: 'MERCREDI', heureDebut: '14:00', heureFin: '15:30', salleId: 'r1', ...over })

// 2026-10-07 est un mercredi.
const club = (over: Partial<Club> = {}): Club => ({
  id: 'c1',
  nom: 'Robotique',
  categorie: '',
  description: '',
  teacherId: 't1',
  intervenantNom: '',
  seances: [seance()],
  placesMax: 2,
  niveaux: [],
  mensualiteCentimes: 15000,
  moisDebut: '2026-10-01',
  moisFin: '2026-11-01',
  jourEcheance: 5,
  delaiGraceJours: 5,
  archive: false,
  createdAt: '2026-09-20T10:00:00Z',
  ...over,
})

const insc = (over: Partial<ClubInscription> = {}): ClubInscription => ({
  id: 'i1',
  clubId: 'c1',
  studentId: 'e1',
  statut: 'actif',
  dateInscription: '2026-10-01',
  dateArret: null,
  exonere: false,
  motifExoneration: '',
  derogationNiveau: false,
  createdAt: '2026-10-01T08:00:00Z',
  ...over,
})

describe('période et séances', () => {
  it('dernierJourDuMois : mois de 30, 31 jours et février bissextile', () => {
    expect(dernierJourDuMois('2026-11-01')).toBe('2026-11-30')
    expect(dernierJourDuMois('2026-12-01')).toBe('2026-12-31')
    expect(dernierJourDuMois('2028-02-01')).toBe('2028-02-29')
    expect(dernierJourDuMois('2027-02-01')).toBe('2027-02-28')
  })

  it('finDuClub : dernier jour du dernier mois facturé', () => {
    expect(finDuClub(club())).toBe('2026-11-30')
  })

  it('clubALieuLe : bon jour, dans la période, non archivé', () => {
    expect(clubALieuLe(club(), '2026-10-07')).toBe(true)
    expect(clubALieuLe(club(), '2026-11-25')).toBe(true)
    expect(clubALieuLe(club(), '2026-10-08')).toBe(false)
    expect(clubALieuLe(club(), '2026-09-30')).toBe(false)
    expect(clubALieuLe(club(), '2026-12-02')).toBe(false)
    expect(clubALieuLe(club({ archive: true }), '2026-10-07')).toBe(false)
  })

  it('clubTermine : seulement après le dernier jour du dernier mois', () => {
    expect(clubTermine(club(), '2026-11-30')).toBe(false)
    expect(clubTermine(club(), '2026-12-01')).toBe(true)
  })

  it('datesDuClub : un mercredi par semaine sur toute la période', () => {
    expect(datesDuClub(club())).toEqual(['2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28', '2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25'])
  })

  it('datesDuClub : fenêtre et maximum', () => {
    expect(datesDuClub(club(), { depuis: '2026-10-20', jusqua: '2026-11-05' })).toEqual(['2026-10-21', '2026-10-28', '2026-11-04'])
    expect(datesDuClub(club(), { max: 2 })).toEqual(['2026-10-07', '2026-10-14'])
  })

  it('datesDuMois : séances d’un seul mois', () => {
    expect(datesDuMois(club(), '2026-10-01')).toEqual(['2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28'])
    expect(datesDuMois(club(), '2026-12-01')).toEqual([])
  })
})

describe('places et liste d’attente', () => {
  const pleins = [insc(), insc({ id: 'i2', studentId: 'e2' })]

  it('placesRestantes : compte les inscrits actifs seulement', () => {
    expect(placesRestantes(club(), [])).toBe(2)
    expect(placesRestantes(club(), [insc()])).toBe(1)
    expect(placesRestantes(club(), [insc(), insc({ id: 'i2', studentId: 'e2', statut: 'attente' }), insc({ id: 'i3', studentId: 'e3', statut: 'arrete' })])).toBe(1)
    expect(placesRestantes(club(), pleins)).toBe(0)
  })

  it('placesRestantes : illimité = null, jamais de nombre négatif', () => {
    expect(placesRestantes(club({ placesMax: null }), pleins)).toBeNull()
    expect(placesRestantes(club({ placesMax: 1 }), pleins)).toBe(0)
  })

  it('clubComplet', () => {
    expect(clubComplet(club(), pleins)).toBe(true)
    expect(clubComplet(club(), [insc()])).toBe(false)
    expect(clubComplet(club({ placesMax: null }), pleins)).toBe(false)
  })

  it('un inscrit d’un autre club ne prend pas de place', () => {
    expect(placesRestantes(club(), [insc({ clubId: 'autre' }), insc({ id: 'i2', studentId: 'e2', clubId: 'autre' })])).toBe(2)
  })

  it('statutPourNouvelInscrit : actif tant qu’il reste une place, sinon liste d’attente', () => {
    expect(statutPourNouvelInscrit(club(), [insc()])).toBe('actif')
    expect(statutPourNouvelInscrit(club(), pleins)).toBe('attente')
    expect(statutPourNouvelInscrit(club({ placesMax: null }), pleins)).toBe('actif')
  })

  it('listeAttente : par ordre d’arrivée', () => {
    const l = [
      insc({ id: 'b', studentId: 'e2', statut: 'attente', dateInscription: '2026-10-05' }),
      insc({ id: 'a', studentId: 'e3', statut: 'attente', dateInscription: '2026-10-02' }),
      insc({ id: 'c', studentId: 'e4', statut: 'attente', dateInscription: '2026-10-05', createdAt: '2026-10-05T09:00:00Z' }),
    ]
    expect(listeAttente(l, 'c1').map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('promouvoirSuivant : le plus ancien en attente, seulement s’il reste une place', () => {
    const attente = insc({ id: 'w', studentId: 'e9', statut: 'attente' })
    expect(promouvoirSuivant(club(), [insc(), attente])?.id).toBe('w')
    expect(promouvoirSuivant(club(), [...pleins, attente])).toBeNull()
    expect(promouvoirSuivant(club(), [insc()])).toBeNull()
  })

  it('clubsDeLEleve : ses clubs avec son inscription, ignore les clubs inconnus', () => {
    const r = clubsDeLEleve([club()], [insc(), insc({ id: 'x', clubId: 'inconnu' }), insc({ id: 'y', studentId: 'e2' })], 'e1')
    expect(r).toHaveLength(1)
    expect(r[0].club.id).toBe('c1')
    expect(r[0].inscription.id).toBe('i1')
  })
})

describe('niveaux', () => {
  it('niveauDeClasse', () => {
    expect(niveauDeClasse('CE1-A')).toBe('CE1')
    expect(niveauDeClasse('3APIC-B')).toBe('3APIC')
  })

  it('aucun niveau renseigné : ouvert à tous', () => {
    expect(niveauAutorise(club(), 'PS-A')).toBe(true)
  })

  it('niveaux renseignés : seulement ceux-là', () => {
    const c = club({ niveaux: ['CE1', 'CE2'] })
    expect(niveauAutorise(c, 'CE2-B')).toBe(true)
    expect(niveauAutorise(c, 'CE3-A')).toBe(false)
  })
})

describe('occupation de l’encadrant et de la salle', () => {
  it('sans date : tous les clubs de ce jour de semaine', () => {
    expect(intervallesClubEnseignant([club()], 't1', 'MERCREDI')).toEqual([{ start: '14:00', end: '15:30' }])
    expect(intervallesClubEnseignant([club()], 't1', 'MARDI')).toEqual([])
    expect(intervallesClubEnseignant([club()], 't2', 'MERCREDI')).toEqual([])
    expect(intervallesClubEnseignant([club()], '', 'MERCREDI')).toEqual([])
  })

  it('un intervenant externe (sans teacherId) ne rend aucun enseignant occupé', () => {
    expect(intervallesClubEnseignant([club({ teacherId: null, intervenantNom: 'M. Alami' })], 't1', 'MERCREDI')).toEqual([])
  })

  it('avec une date : respecte la période', () => {
    expect(intervallesClubEnseignant([club()], 't1', 'MERCREDI', '2026-10-14')).toHaveLength(1)
    expect(intervallesClubEnseignant([club()], 't1', 'MERCREDI', '2026-12-02')).toEqual([])
    expect(intervallesClubEnseignant([club()], 't1', 'MERCREDI', '2026-09-30')).toEqual([])
  })

  it('un club archivé n’occupe personne', () => {
    expect(intervallesClubEnseignant([club({ archive: true })], 't1', 'MERCREDI')).toEqual([])
    expect(intervallesClubSalle([club({ archive: true })], 'r1', 'MERCREDI')).toEqual([])
  })

  it('salle', () => {
    expect(intervallesClubSalle([club()], 'r1', 'MERCREDI', '2026-10-14')).toEqual([{ start: '14:00', end: '15:30' }])
    expect(intervallesClubSalle([club()], 'r2', 'MERCREDI', '2026-10-14')).toEqual([])
  })
})

describe('blocsClubParJour', () => {
  const inscrits = [insc(), insc({ id: 'i2', studentId: 'e2' }), insc({ id: 'i3', studentId: 'e3', statut: 'attente' })]

  it('les clubs de l’enseignant rangés par jour, avec le nombre d’inscrits actifs', () => {
    const b = blocsClubParJour([club()], inscrits, { teacherId: 't1', aPartirDe: '2026-10-09' })
    expect(b.MERCREDI).toEqual([{ clubId: 'c1', label: 'Club – Robotique · 2 inscrits', start: '14:00', end: '15:30', nbInscrits: 2, salleId: 'r1' }])
    expect(b.LUNDI).toEqual([])
  })

  it('un autre enseignant, un intervenant externe, un club archivé ou terminé : aucun bloc', () => {
    expect(blocsClubParJour([club()], inscrits, { teacherId: 't2', aPartirDe: '2026-10-09' }).MERCREDI).toEqual([])
    expect(blocsClubParJour([club({ teacherId: null, intervenantNom: 'M. Alami' })], inscrits, { teacherId: 't1', aPartirDe: '2026-10-09' }).MERCREDI).toEqual([])
    expect(blocsClubParJour([club({ archive: true })], inscrits, { teacherId: 't1', aPartirDe: '2026-10-09' }).MERCREDI).toEqual([])
    expect(blocsClubParJour([club()], inscrits, { teacherId: 't1', aPartirDe: '2026-12-01' }).MERCREDI).toEqual([])
    expect(blocsClubParJour([club()], inscrits, { teacherId: '', aPartirDe: '2026-10-09' }).MERCREDI).toEqual([])
  })

  it('tri par heure dans la journée', () => {
    const tot = club({ id: 'c0', nom: 'Échecs', seances: [seance({ heureDebut: '12:30', heureFin: '13:30' })] })
    expect(blocsClubParJour([club(), tot], [], { teacherId: 't1', aPartirDe: '2026-10-09' }).MERCREDI.map((x) => x.start)).toEqual(['12:30', '14:00'])
  })

  it('libelleBlocClub : singulier et pluriel', () => {
    expect(libelleBlocClub('Robotique', 1)).toBe('Club – Robotique · 1 inscrit')
    expect(libelleBlocClub('Robotique', 0)).toBe('Club – Robotique · 0 inscrit')
    expect(libelleBlocClub('Robotique', 12)).toBe('Club – Robotique · 12 inscrits')
  })
})

describe('plusieurs séances par semaine et catégories', () => {
  // Football U9 : lundi et mercredi, chacune dans sa salle (2026-10-05 est un lundi).
  const foot = club({
    id: 'f9',
    nom: 'Football',
    categorie: 'U9',
    seances: [seance({ jour: 'MERCREDI', heureDebut: '14:00', heureFin: '15:30', salleId: 'terrain' }), seance({ jour: 'LUNDI', heureDebut: '16:00', heureFin: '17:30', salleId: 'gymnase' })],
  })

  it('libelleClub : activité et catégorie, ou le nom seul', () => {
    expect(libelleClub(foot)).toBe('Football U9')
    expect(libelleClub(club())).toBe('Robotique')
    expect(libelleClub({ nom: 'Football', categorie: '  U12 ' })).toBe('Football U12')
  })

  it('seancesTriees et libelleSeances : par jour de semaine puis par heure', () => {
    expect(seancesTriees(foot).map((s) => s.jour)).toEqual(['LUNDI', 'MERCREDI'])
    expect(libelleSeances(foot)).toBe('Lundi 16:00 – 17:30 · Mercredi 14:00 – 15:30')
  })

  it('seancesDuJour : celles de ce jour de semaine, par heure', () => {
    const deuxLeLundi = club({ seances: [seance({ jour: 'LUNDI', heureDebut: '17:00', heureFin: '18:00' }), seance({ jour: 'LUNDI', heureDebut: '12:00', heureFin: '13:00' })] })
    expect(seancesDuJour(deuxLeLundi, 'LUNDI').map((s) => s.heureDebut)).toEqual(['12:00', '17:00'])
    expect(seancesDuJour(deuxLeLundi, 'MARDI')).toEqual([])
  })

  it('clubALieuLe : vrai les deux jours de séance, faux ailleurs', () => {
    expect(clubALieuLe(foot, '2026-10-05')).toBe(true)
    expect(clubALieuLe(foot, '2026-10-07')).toBe(true)
    expect(clubALieuLe(foot, '2026-10-06')).toBe(false)
  })

  it('datesDuClub : les dates des deux séances, triées, une fois chacune', () => {
    const dates = datesDuClub(foot, { depuis: '2026-10-05', jusqua: '2026-10-14' })
    expect(dates).toEqual(['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14'])
    expect(datesDuClub(foot, { depuis: '2026-10-05', max: 1 })).toEqual(['2026-10-05'])
  })

  it('datesDuClub : deux séances le même jour ne donnent qu’une date', () => {
    const deuxLeMercredi = club({ seances: [seance({ heureDebut: '12:00', heureFin: '13:00' }), seance({ heureDebut: '16:00', heureFin: '17:00' })] })
    expect(datesDuClub(deuxLeMercredi, { depuis: '2026-10-07', jusqua: '2026-10-13' })).toEqual(['2026-10-07'])
    expect(occurrencesDuClub(deuxLeMercredi, { depuis: '2026-10-07', jusqua: '2026-10-13' }).map((o) => o.seance.heureDebut)).toEqual(['12:00', '16:00'])
  })

  it('l’enseignant est occupé pendant chaque séance, chacune à son jour', () => {
    expect(intervallesClubEnseignant([foot], 't1', 'LUNDI')).toEqual([{ start: '16:00', end: '17:30' }])
    expect(intervallesClubEnseignant([foot], 't1', 'MERCREDI')).toEqual([{ start: '14:00', end: '15:30' }])
    expect(intervallesClubEnseignant([foot], 't1', 'VENDREDI')).toEqual([])
    expect(intervallesClubEnseignant([foot], 't1', 'MERCREDI', '2026-10-05')).toEqual([{ start: '16:00', end: '17:30' }])
  })

  it('chaque séance a sa salle : une salle n’est occupée que par la séance qui l’utilise', () => {
    expect(intervallesClubSalle([foot], 'terrain', 'MERCREDI')).toEqual([{ start: '14:00', end: '15:30' }])
    expect(intervallesClubSalle([foot], 'terrain', 'LUNDI')).toEqual([])
    expect(intervallesClubSalle([foot], 'gymnase', 'LUNDI')).toEqual([{ start: '16:00', end: '17:30' }])
  })

  it('seancesClubEnSalleLe : la séance du jour dans cette salle, période comprise', () => {
    expect(seancesClubEnSalleLe([foot], 'gymnase', '2026-10-05').map((x) => x.seance.heureDebut)).toEqual(['16:00'])
    expect(seancesClubEnSalleLe([foot], 'gymnase', '2026-10-07')).toEqual([])
    expect(seancesClubEnSalleLe([foot], 'gymnase', '2026-12-07')).toEqual([])
    expect(seancesClubEnSalleLe([foot], '', '2026-10-05')).toEqual([])
  })

  it('blocsClubParJour : un bloc par séance, avec le nom de la catégorie et la salle de la séance', () => {
    const b = blocsClubParJour([foot], [], { teacherId: 't1', aPartirDe: '2026-10-01' })
    expect(b.LUNDI).toEqual([{ clubId: 'f9', label: 'Club – Football U9 · 0 inscrit', start: '16:00', end: '17:30', nbInscrits: 0, salleId: 'gymnase' }])
    expect(b.MERCREDI.map((x) => x.salleId)).toEqual(['terrain'])
  })

  it('deux catégories d’un même club sont deux fiches distinctes, chacune avec ses inscrits et ses places', () => {
    const u12 = club({ id: 'f12', nom: 'Football', categorie: 'U12', placesMax: 1 })
    const inscrits = [insc({ clubId: 'f9' }), insc({ id: 'i2', clubId: 'f12', studentId: 'e2' })]
    expect(placesRestantes(u12, inscrits)).toBe(0)
    expect(placesRestantes(foot, inscrits)).toBe(1)
  })
})
