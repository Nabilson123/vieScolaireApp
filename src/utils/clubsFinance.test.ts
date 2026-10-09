import { describe, expect, it } from 'vitest'
import type { Club, ClubEcheance, ClubImputation, ClubInscription, ClubReglement } from '../data/clubs'
import {
  ajouterMois,
  cleFamille,
  dateEcheance,
  dhVersCentimes,
  echeancesPourInscription,
  formatDH,
  imputerReglement,
  impayesParFamille,
  joursEntre,
  libelleFamille,
  libelleMois,
  lignesMensualites,
  mensualitesOuvertes,
  moisDe,
  moisDuClub,
  montantEnLettres,
  nombreEnLettres,
  numeroReglement,
  paiementsParEcheance,
  prochainNumeroReglement,
  reconcilerEcheances,
  soldeDeLignes,
  statutEcheance,
  type EleveFinance,
} from './clubsFinance'

const club = { moisDebut: '2026-10-01', moisFin: '2027-01-01', mensualiteCentimes: 15000, jourEcheance: 5 }
const insc = (over: Partial<Parameters<typeof echeancesPourInscription>[1]> = {}) => ({
  statut: 'actif' as const,
  dateInscription: '2026-10-14',
  dateArret: null,
  exonere: false,
  ...over,
})

describe('mois', () => {
  it('moisDe : 1er du mois, vide si illisible', () => {
    expect(moisDe('2026-10-14')).toBe('2026-10-01')
    expect(moisDe('2026-10-01')).toBe('2026-10-01')
    expect(moisDe('n’importe quoi')).toBe('')
  })

  it('ajouterMois traverse les années, dans les deux sens', () => {
    expect(ajouterMois('2026-11-01', 2)).toBe('2027-01-01')
    expect(ajouterMois('2027-01-01', -1)).toBe('2026-12-01')
    expect(ajouterMois('2026-12-01', 12)).toBe('2027-12-01')
  })

  it('moisDuClub : de septembre à janvier compris', () => {
    expect(moisDuClub({ moisDebut: '2026-09-01', moisFin: '2027-01-01' })).toEqual(['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'])
    expect(moisDuClub({ moisDebut: '2026-10-01', moisFin: '2026-10-01' })).toEqual(['2026-10-01'])
    expect(moisDuClub({ moisDebut: '2026-10-01', moisFin: '2026-09-01' })).toEqual([])
  })

  it('libelleMois en français', () => {
    expect(libelleMois('2026-10-01')).toBe('octobre 2026')
    expect(libelleMois('2027-02-01')).toBe('février 2027')
    expect(libelleMois('2026-08-01')).toBe('août 2026')
  })
})

describe('dateEcheance', () => {
  it('le jour choisi du mois, février compris', () => {
    expect(dateEcheance('2026-10-01', 5)).toBe('2026-10-05')
    expect(dateEcheance('2027-02-01', 28)).toBe('2027-02-28')
  })

  it('un jour hors 1–28 est ramené dans la plage (aucune date inexistante)', () => {
    expect(dateEcheance('2027-02-01', 31)).toBe('2027-02-28')
    expect(dateEcheance('2026-10-01', 0)).toBe('2026-10-01')
  })
})

describe('formatDH et dhVersCentimes', () => {
  it('formatDH : centimes toujours affichés, milliers séparés', () => {
    expect(formatDH(0)).toBe('0,00 DH')
    expect(formatDH(15000)).toBe('150,00 DH')
    expect(formatDH(120050)).toBe('1 200,50 DH')
    expect(formatDH(5)).toBe('0,05 DH')
    expect(formatDH(-2500)).toBe('-25,00 DH')
  })

  it('dhVersCentimes : virgule ou point, espaces et « DH » tolérés', () => {
    expect(dhVersCentimes('150')).toBe(15000)
    expect(dhVersCentimes('150,5')).toBe(15050)
    expect(dhVersCentimes('1 200.75 DH')).toBe(120075)
    expect(dhVersCentimes('0')).toBe(0)
  })

  it('dhVersCentimes : refuse le texte, le négatif et plus de deux décimales', () => {
    expect(dhVersCentimes('')).toBeNull()
    expect(dhVersCentimes('abc')).toBeNull()
    expect(dhVersCentimes('-10')).toBeNull()
    expect(dhVersCentimes('10,123')).toBeNull()
  })
})

describe('echeancesPourInscription', () => {
  it('inscrit en octobre : le mois d’inscription est dû en entier, puis les mois suivants jusqu’à la fin du club', () => {
    const e = echeancesPourInscription(club, insc())
    expect(e.map((x) => x.mois)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'])
    expect(e.every((x) => x.montantCentimes === 15000)).toBe(true)
    expect(e[0].dateEcheance).toBe('2026-10-05')
  })

  it('inscrit avant le début du club : commence au premier mois du club', () => {
    expect(echeancesPourInscription(club, insc({ dateInscription: '2026-09-02' }))[0].mois).toBe('2026-10-01')
  })

  it('inscrit en milieu de période : seuls les mois restants sont dus', () => {
    expect(echeancesPourInscription(club, insc({ dateInscription: '2026-12-20' })).map((x) => x.mois)).toEqual(['2026-12-01', '2027-01-01'])
  })

  it('inscrit après la fin du club : rien à payer', () => {
    expect(echeancesPourInscription(club, insc({ dateInscription: '2027-03-01' }))).toEqual([])
  })

  it('liste d’attente : rien n’est facturé', () => {
    expect(echeancesPourInscription(club, insc({ statut: 'attente' }))).toEqual([])
  })

  it('arrêté : le mois d’arrêt est dû aussi, pas les suivants', () => {
    const e = echeancesPourInscription(club, insc({ statut: 'arrete', dateArret: '2026-11-18' }))
    expect(e.map((x) => x.mois)).toEqual(['2026-10-01', '2026-11-01'])
  })

  it('arrêté le mois même de l’inscription : ce mois-là est dû', () => {
    expect(echeancesPourInscription(club, insc({ statut: 'arrete', dateArret: '2026-10-20' })).map((x) => x.mois)).toEqual(['2026-10-01'])
  })

  it('arrêté sans date d’arrêt : traité comme arrêté le mois d’inscription', () => {
    expect(echeancesPourInscription(club, insc({ statut: 'arrete', dateArret: null })).map((x) => x.mois)).toEqual(['2026-10-01'])
  })

  it('exonéré : les échéances existent mais à 0', () => {
    const e = echeancesPourInscription(club, insc({ exonere: true }))
    expect(e).toHaveLength(4)
    expect(e.every((x) => x.montantCentimes === 0)).toBe(true)
  })

  it('jour d’échéance en février', () => {
    const fevrier = echeancesPourInscription({ ...club, moisDebut: '2027-02-01', moisFin: '2027-02-01', jourEcheance: 28 }, insc({ dateInscription: '2027-02-03' }))
    expect(fevrier[0].dateEcheance).toBe('2027-02-28')
  })
})

describe('reconcilerEcheances', () => {
  const existante = (mois: string, id: string, montant = 15000, date?: string): ClubEcheance => ({
    id,
    inscriptionId: 'i1',
    mois,
    montantCentimes: montant,
    dateEcheance: date ?? `${mois.slice(0, 8)}05`,
  })
  const voulues = echeancesPourInscription(club, insc())

  it('rien à faire quand tout correspond', () => {
    const existantes = voulues.map((v, i) => existante(v.mois, `e${i}`))
    expect(reconcilerEcheances(existantes, voulues)).toEqual({ aAjouter: [], aMettreAJour: [], aSupprimer: [] })
  })

  it('crée les mois manquants', () => {
    const r = reconcilerEcheances([existante('2026-10-01', 'e0')], voulues)
    expect(r.aAjouter.map((x) => x.mois)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01'])
  })

  it('changement de tarif : met à jour les mois sans paiement', () => {
    const existantes = voulues.map((v, i) => existante(v.mois, `e${i}`))
    const nouvelles = echeancesPourInscription({ ...club, mensualiteCentimes: 20000 }, insc())
    const r = reconcilerEcheances(existantes, nouvelles)
    expect(r.aMettreAJour).toHaveLength(4)
    expect(r.aMettreAJour[0]).toEqual({ id: 'e0', montantCentimes: 20000, dateEcheance: '2026-10-05' })
  })

  it('un mois déjà payé n’est jamais modifié, même si le tarif change', () => {
    const existantes = voulues.map((v, i) => existante(v.mois, `e${i}`))
    const nouvelles = echeancesPourInscription({ ...club, mensualiteCentimes: 20000 }, insc())
    const r = reconcilerEcheances(existantes, nouvelles, new Map([['e0', 15000]]))
    expect(r.aMettreAJour.map((x) => x.id)).toEqual(['e1', 'e2', 'e3'])
  })

  it('un paiement partiel suffit à figer le mois', () => {
    const existantes = [existante('2026-10-01', 'e0')]
    const nouvelles = echeancesPourInscription({ ...club, moisFin: '2026-10-01', mensualiteCentimes: 20000 }, insc())
    expect(reconcilerEcheances(existantes, nouvelles, new Map([['e0', 5000]])).aMettreAJour).toEqual([])
  })

  it('arrêt : supprime les mois suivants sans paiement, garde ceux qui ont été payés d’avance', () => {
    const existantes = voulues.map((v, i) => existante(v.mois, `e${i}`))
    const apresArret = echeancesPourInscription(club, insc({ statut: 'arrete', dateArret: '2026-10-25' }))
    const r = reconcilerEcheances(existantes, apresArret, new Map([['e2', 15000]]))
    expect(r.aSupprimer).toEqual(['e1', 'e3'])
  })

  it('exonération ajoutée : les mois sans paiement passent à 0, le mois payé reste', () => {
    const existantes = voulues.map((v, i) => existante(v.mois, `e${i}`))
    const exoneres = echeancesPourInscription(club, insc({ exonere: true }))
    const r = reconcilerEcheances(existantes, exoneres, new Map([['e0', 15000]]))
    expect(r.aMettreAJour.map((x) => x.id)).toEqual(['e1', 'e2', 'e3'])
    expect(r.aMettreAJour.every((x) => x.montantCentimes === 0)).toBe(true)
  })

  it('élève revenu après un arrêt : les impayés d’avant sa réinscription ne sont jamais supprimés', () => {
    // Octobre et novembre sont restés impayés ; il est réinscrit en janvier (premier mois voulu : janvier).
    const existantes = [existante('2026-10-01', 'e0'), existante('2026-11-01', 'e1')]
    const reinscrit = echeancesPourInscription(club, insc({ dateInscription: '2027-01-12' }))
    const r = reconcilerEcheances(existantes, reinscrit, new Map(), '2027-01-01')
    expect(r.aSupprimer).toEqual([])
    expect(r.aAjouter.map((x) => x.mois)).toEqual(['2027-01-01'])
  })

  it('club décalé : un mois d’avant son nouveau début est supprimé s’il n’est pas payé, la réinscription n’y change rien', () => {
    // Le club commençait en septembre, il commence maintenant en octobre ; l’élève est inscrit depuis le 2 septembre.
    const existantes = [existante('2026-09-01', 'e-sept'), existante('2026-10-01', 'e0')]
    const voulue = echeancesPourInscription(club, insc({ dateInscription: '2026-09-02' }))
    expect(reconcilerEcheances(existantes, voulue, new Map(), '2026-09-01').aSupprimer).toEqual(['e-sept'])
    expect(reconcilerEcheances(existantes, voulue, new Map([['e-sept', 15000]]), '2026-09-01').aSupprimer).toEqual([])
  })

  it('jour d’échéance modifié : la date change pour les mois sans paiement', () => {
    const existantes = voulues.map((v, i) => existante(v.mois, `e${i}`))
    const nouvelles = echeancesPourInscription({ ...club, jourEcheance: 10 }, insc())
    const r = reconcilerEcheances(existantes, nouvelles, new Map([['e0', 15000]]))
    expect(r.aMettreAJour.map((x) => x.dateEcheance)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10'])
  })
})

describe('famille', () => {
  const identite = (p1: [string, string], p2: [string, string]) => ({ parent1Prenom: p1[0], parent1Nom: p1[1], parent2Prenom: p2[0], parent2Nom: p2[1] })

  it('cleFamille : insensible à l’ordre des parents, à la casse et aux accents', () => {
    const a = cleFamille(identite(['Karim', 'ALAMI'], ['Salma', 'BENNANI']), 'e1')
    const b = cleFamille(identite(['salma', 'Bennani'], ['KARIM', 'Alami']), 'e2')
    expect(a).toBe(b)
    expect(cleFamille(identite(['Zoé', 'Élidrissi'], ['', '']), 'e1')).toBe(cleFamille(identite(['zoe', 'elidrissi'], ['', '']), 'e9'))
  })

  it('cleFamille : l’ordre prénom / nom n’a pas d’importance', () => {
    expect(cleFamille(identite(['Karim', 'ALAMI'], ['', '']), 'e1')).toBe(cleFamille(identite(['ALAMI', 'Karim'], ['', '']), 'e1'))
  })

  it('cleFamille : un seul parent renseigné ou deux fois le même parent', () => {
    expect(cleFamille(identite(['Karim', 'ALAMI'], ['', '']), 'e1')).toBe(cleFamille(identite(['', ''], ['Karim', 'ALAMI']), 'e2'))
    expect(cleFamille(identite(['Karim', 'ALAMI'], ['karim', 'alami']), 'e1')).toBe(cleFamille(identite(['Karim', 'ALAMI'], ['', '']), 'e1'))
  })

  it('cleFamille : sans parent, l’élève est sa propre famille ; deux frères aux parents différents restent séparés', () => {
    expect(cleFamille(undefined, 'e7')).toBe('eleve:e7')
    expect(cleFamille(identite(['', ''], ['', '']), 'e8')).toBe('eleve:e8')
    expect(cleFamille(identite(['Karim', 'ALAMI'], ['', '']), 'e1')).not.toBe(cleFamille(identite(['Karim', 'ALAMI'], ['Salma', 'X']), 'e2'))
  })

  it('libelleFamille : noms des parents, sinon dernier mot du nom de l’élève', () => {
    expect(libelleFamille(identite(['Karim', 'Alami'], ['Salma', 'Bennani']), 'Adam ALAMI')).toBe('Famille ALAMI / BENNANI')
    expect(libelleFamille(identite(['Karim', 'Alami'], ['Salma', 'ALAMI']), 'Adam ALAMI')).toBe('Famille ALAMI')
    expect(libelleFamille(undefined, 'Ahmed hatim MAAMOURI')).toBe('Famille MAAMOURI')
    expect(libelleFamille(undefined, '')).toBe('Famille')
  })
})

describe('statut des mensualités', () => {
  const e = { montantCentimes: 15000, dateEcheance: '2026-10-05' }

  it('à venir avant l’échéance, à payer à partir du jour J', () => {
    expect(statutEcheance(e, 0, '2026-10-04', 5)).toBe('a_venir')
    expect(statutEcheance(e, 0, '2026-10-05', 5)).toBe('due')
  })

  it('délai de grâce : en retard seulement après échéance + grâce', () => {
    expect(statutEcheance(e, 0, '2026-10-10', 5)).toBe('due')
    expect(statutEcheance(e, 0, '2026-10-11', 5)).toBe('en_retard')
    expect(statutEcheance(e, 0, '2026-10-06', 0)).toBe('en_retard')
  })

  it('payée dès que le montant est couvert, même en retard', () => {
    expect(statutEcheance(e, 15000, '2026-12-01', 5)).toBe('payee')
    expect(statutEcheance(e, 16000, '2026-12-01', 5)).toBe('payee')
  })

  it('partielle tant que l’échéance n’est pas trop dépassée, ensuite en retard', () => {
    expect(statutEcheance(e, 5000, '2026-10-08', 5)).toBe('partielle')
    expect(statutEcheance(e, 5000, '2026-10-20', 5)).toBe('en_retard')
  })

  it('exonérée quand le montant est 0', () => {
    expect(statutEcheance({ montantCentimes: 0, dateEcheance: '2026-10-05' }, 0, '2027-01-01', 5)).toBe('exoneree')
  })

  it('un paiement payé d’avance rend le mois à venir « payé »', () => {
    expect(statutEcheance({ montantCentimes: 15000, dateEcheance: '2027-03-05' }, 15000, '2026-10-09', 5)).toBe('payee')
  })

  it('joursEntre', () => {
    expect(joursEntre('2026-10-05', '2026-10-09')).toBe(4)
    expect(joursEntre('2026-10-30', '2026-11-02')).toBe(3)
    expect(joursEntre('2026-10-09', '2026-10-05')).toBe(-4)
  })
})

describe('paiements et lignes de mensualités', () => {
  const reglement = (over: Partial<ClubReglement> = {}): ClubReglement => ({
    id: 'r1',
    numero: 'REC-2026-0001',
    familleCle: 'f1',
    familleLibelle: 'Famille A',
    dateReglement: '2026-10-09',
    mode: 'especes',
    reference: '',
    montantCentimes: 15000,
    statut: 'valide',
    motifAnnulation: '',
    annuleLe: null,
    createdAt: '2026-10-09T10:00:00Z',
    ...over,
  })
  const imputation = (over: Partial<ClubImputation> = {}): ClubImputation => ({ id: 'i1', reglementId: 'r1', echeanceId: 'e1', montantCentimes: 15000, ...over })

  it('paiementsParEcheance : additionne les imputations des règlements valides', () => {
    const p = paiementsParEcheance([imputation(), imputation({ id: 'i2', reglementId: 'r2', montantCentimes: 5000 })], [reglement(), reglement({ id: 'r2', numero: 'REC-2026-0002' })])
    expect(p.get('e1')).toBe(20000)
  })

  it('un règlement annulé ne paie rien', () => {
    const p = paiementsParEcheance([imputation()], [reglement({ statut: 'annule' })])
    expect(p.get('e1')).toBeUndefined()
  })

  it('situation au moment d’un reçu : seuls les règlements enregistrés jusque-là comptent', () => {
    const r1 = reglement()
    const r2 = reglement({ id: 'r2', numero: 'REC-2026-0002', createdAt: '2026-10-20T10:00:00Z' })
    const imps = [imputation(), imputation({ id: 'i2', reglementId: 'r2', montantCentimes: 5000 })]
    expect(paiementsParEcheance(imps, [r1, r2], r1).get('e1')).toBe(15000)
    expect(paiementsParEcheance(imps, [r1, r2], r2).get('e1')).toBe(20000)
  })

  const clubA: Club = {
    id: 'c1',
    nom: 'Robotique',
    description: '',
    teacherId: null,
    intervenantNom: '',
    jour: 'MERCREDI',
    heureDebut: '14:00',
    heureFin: '15:30',
    salleId: null,
    placesMax: null,
    niveaux: [],
    mensualiteCentimes: 15000,
    moisDebut: '2026-10-01',
    moisFin: '2026-12-01',
    jourEcheance: 5,
    delaiGraceJours: 5,
    archive: false,
    createdAt: '',
  }
  const inscription = (id: string, studentId: string): ClubInscription => ({ id, clubId: 'c1', studentId, statut: 'actif', dateInscription: '2026-10-01', dateArret: null, exonere: false, motifExoneration: '', derogationNiveau: false, createdAt: '' })
  const echeance = (id: string, inscriptionId: string, mois: string, montant = 15000): ClubEcheance => ({ id, inscriptionId, mois, montantCentimes: montant, dateEcheance: `${mois.slice(0, 8)}05` })
  const eleves = new Map<string, EleveFinance>([
    ['s1', { name: 'Adam ALAMI', classe: 'CE1-A', familleCle: 'f-alami', familleLibelle: 'Famille ALAMI' }],
    ['s2', { name: 'Lina ALAMI', classe: 'CE3-B', familleCle: 'f-alami', familleLibelle: 'Famille ALAMI' }],
    ['s3', { name: 'Yanis BENNANI', classe: 'CE2-A', familleCle: 'f-bennani', familleLibelle: 'Famille BENNANI' }],
  ])
  const lignes = lignesMensualites({
    clubs: [clubA],
    inscriptions: [inscription('i1', 's1'), inscription('i2', 's2'), inscription('i3', 's3')],
    echeances: [
      echeance('a1', 'i1', '2026-10-01'),
      echeance('a2', 'i1', '2026-11-01'),
      echeance('b1', 'i2', '2026-10-01'),
      echeance('c1', 'i3', '2026-10-01', 0),
      echeance('c2', 'i3', '2026-12-01'),
    ],
    paiements: new Map([['a1', 15000], ['b1', 5000]]),
    eleves,
    aujourdhui: '2026-11-20',
  })

  it('lignesMensualites : statut, reste et tri par mois', () => {
    expect(lignes).toHaveLength(5)
    expect(lignes.map((l) => l.mois)).toEqual(['2026-10-01', '2026-10-01', '2026-10-01', '2026-11-01', '2026-12-01'])
    const parId = new Map(lignes.map((l) => [l.echeanceId, l]))
    expect(parId.get('a1')?.statut).toBe('payee')
    expect(parId.get('b1')?.statut).toBe('en_retard')
    expect(parId.get('b1')?.resteCentimes).toBe(10000)
    expect(parId.get('a2')?.statut).toBe('en_retard')
    expect(parId.get('c1')?.statut).toBe('exoneree')
    expect(parId.get('c2')?.statut).toBe('a_venir')
  })

  it('lignesMensualites : ignore une mensualité dont l’inscription est inconnue', () => {
    const l = lignesMensualites({ clubs: [clubA], inscriptions: [], echeances: [echeance('x', 'inconnue', '2026-10-01')], paiements: new Map(), eleves, aujourdhui: '2026-10-09' })
    expect(l).toEqual([])
  })

  it('soldeDeLignes : attendu, payé, reste échu et reste à venir', () => {
    const s = soldeDeLignes(lignes, '2026-11-20')
    expect(s.attenduCentimes).toBe(15000 + 15000 + 15000 + 0 + 15000)
    expect(s.payeCentimes).toBe(20000)
    expect(s.resteEchuCentimes).toBe(10000 + 15000)
    expect(s.resteAVenirCentimes).toBe(15000)
  })

  it('impayesParFamille : seules les mensualités en retard, regroupées par famille, plus grosse créance d’abord', () => {
    const impayes = impayesParFamille(lignes, '2026-11-20')
    expect(impayes).toHaveLength(1)
    expect(impayes[0].familleCle).toBe('f-alami')
    expect(impayes[0].resteCentimes).toBe(25000)
    expect(impayes[0].plusAncienneEcheance).toBe('2026-10-05')
    expect(impayes[0].joursRetardMax).toBe(46)
    expect(impayes[0].lignes).toHaveLength(2)
  })

  it('mensualitesOuvertes : celles de la famille avec un reste, dans l’ordre chronologique', () => {
    const o = mensualitesOuvertes(lignes, 'f-alami')
    expect(o.map((x) => x.echeanceId)).toEqual(['b1', 'a2'])
    expect(mensualitesOuvertes(lignes, 'f-bennani').map((x) => x.echeanceId)).toEqual(['c2'])
  })
})

describe('imputerReglement', () => {
  const ouvertes = [
    { echeanceId: 'e3', mois: '2026-12-01', dateEcheance: '2026-12-05', resteCentimes: 15000 },
    { echeanceId: 'e1', mois: '2026-10-01', dateEcheance: '2026-10-05', resteCentimes: 10000 },
    { echeanceId: 'e2', mois: '2026-11-01', dateEcheance: '2026-11-05', resteCentimes: 15000 },
  ]

  it('paie les mois les plus anciens d’abord', () => {
    const r = imputerReglement(10000, ouvertes)
    expect(r.imputations).toEqual([{ echeanceId: 'e1', montantCentimes: 10000 }])
    expect(r.nonImputeCentimes).toBe(0)
  })

  it('un montant partiel sur le mois suivant : paiement partiel', () => {
    const r = imputerReglement(17000, ouvertes)
    expect(r.imputations).toEqual([
      { echeanceId: 'e1', montantCentimes: 10000 },
      { echeanceId: 'e2', montantCentimes: 7000 },
    ])
  })

  it('paiement d’avance : déborde sur les mois à venir', () => {
    const r = imputerReglement(40000, ouvertes)
    expect(r.imputations.map((i) => i.echeanceId)).toEqual(['e1', 'e2', 'e3'])
    expect(r.imputeCentimes).toBe(40000)
    expect(r.nonImputeCentimes).toBe(0)
  })

  it('refuse le trop-perçu : ce qui dépasse le total dû est signalé', () => {
    const r = imputerReglement(50000, ouvertes)
    expect(r.imputeCentimes).toBe(40000)
    expect(r.nonImputeCentimes).toBe(10000)
  })

  it('montant nul ou aucune mensualité ouverte : rien à imputer', () => {
    expect(imputerReglement(0, ouvertes).imputations).toEqual([])
    expect(imputerReglement(5000, []).nonImputeCentimes).toBe(5000)
  })

  it('ne modifie pas la liste reçue', () => {
    const copie = JSON.parse(JSON.stringify(ouvertes))
    imputerReglement(40000, ouvertes)
    expect(ouvertes).toEqual(copie)
  })
})

describe('numérotation des reçus', () => {
  it('numeroReglement : 4 chiffres', () => {
    expect(numeroReglement(2026, 1)).toBe('REC-2026-0001')
    expect(numeroReglement(2026, 148)).toBe('REC-2026-0148')
    expect(numeroReglement(2026, 12345)).toBe('REC-2026-12345')
  })

  it('prochainNumeroReglement : premier numéro, puis suite de l’année', () => {
    expect(prochainNumeroReglement([], 2026)).toBe('REC-2026-0001')
    expect(prochainNumeroReglement(['REC-2026-0001', 'REC-2026-0002'], 2026)).toBe('REC-2026-0003')
  })

  it('un compteur par année scolaire', () => {
    expect(prochainNumeroReglement(['REC-2025-0042', 'REC-2025-0043'], 2026)).toBe('REC-2026-0001')
  })

  it('un numéro annulé n’est jamais réutilisé : on suit le plus grand, même avec des trous', () => {
    expect(prochainNumeroReglement(['REC-2026-0001', 'REC-2026-0005'], 2026)).toBe('REC-2026-0006')
  })

  it('ignore les numéros mal formés', () => {
    expect(prochainNumeroReglement(['n’importe quoi', 'REC-2026-ABC'], 2026)).toBe('REC-2026-0001')
  })
})

describe('montantEnLettres', () => {
  it('nombres simples', () => {
    expect(nombreEnLettres(0)).toBe('zéro')
    expect(nombreEnLettres(1)).toBe('un')
    expect(nombreEnLettres(16)).toBe('seize')
    expect(nombreEnLettres(21)).toBe('vingt et un')
    expect(nombreEnLettres(22)).toBe('vingt-deux')
    expect(nombreEnLettres(61)).toBe('soixante et un')
  })

  it('soixante-dix, quatre-vingts, quatre-vingt-dix', () => {
    expect(nombreEnLettres(70)).toBe('soixante-dix')
    expect(nombreEnLettres(71)).toBe('soixante et onze')
    expect(nombreEnLettres(77)).toBe('soixante-dix-sept')
    expect(nombreEnLettres(80)).toBe('quatre-vingts')
    expect(nombreEnLettres(81)).toBe('quatre-vingt-un')
    expect(nombreEnLettres(91)).toBe('quatre-vingt-onze')
    expect(nombreEnLettres(99)).toBe('quatre-vingt-dix-neuf')
  })

  it('cent : pluriel seulement quand rien ne suit', () => {
    expect(nombreEnLettres(100)).toBe('cent')
    expect(nombreEnLettres(101)).toBe('cent un')
    expect(nombreEnLettres(180)).toBe('cent quatre-vingts')
    expect(nombreEnLettres(200)).toBe('deux cents')
    expect(nombreEnLettres(201)).toBe('deux cent un')
    expect(nombreEnLettres(999)).toBe('neuf cent quatre-vingt-dix-neuf')
  })

  it('mille est invariable, cent et vingt ne prennent pas de s devant mille', () => {
    expect(nombreEnLettres(1000)).toBe('mille')
    expect(nombreEnLettres(1200)).toBe('mille deux cents')
    expect(nombreEnLettres(2000)).toBe('deux mille')
    expect(nombreEnLettres(80000)).toBe('quatre-vingt mille')
    expect(nombreEnLettres(200000)).toBe('deux cent mille')
    expect(nombreEnLettres(21000)).toBe('vingt et un mille')
  })

  it('millions et milliards', () => {
    expect(nombreEnLettres(1_000_000)).toBe('un million')
    expect(nombreEnLettres(2_500_000)).toBe('deux millions cinq cent mille')
    expect(nombreEnLettres(1_000_000_000)).toBe('un milliard')
  })

  it('montant : dirhams et centimes, accords et « et »', () => {
    expect(montantEnLettres(0)).toBe('zéro dirham')
    expect(montantEnLettres(100)).toBe('un dirham')
    expect(montantEnLettres(12050)).toBe('cent vingt dirhams et cinquante centimes')
    expect(montantEnLettres(15000)).toBe('cent cinquante dirhams')
    expect(montantEnLettres(120000)).toBe('mille deux cents dirhams')
    expect(montantEnLettres(50)).toBe('cinquante centimes')
    expect(montantEnLettres(1)).toBe('un centime')
    expect(montantEnLettres(101)).toBe('un dirham et un centime')
    expect(montantEnLettres(8000)).toBe('quatre-vingts dirhams')
    expect(montantEnLettres(7100)).toBe('soixante et onze dirhams')
  })
})
