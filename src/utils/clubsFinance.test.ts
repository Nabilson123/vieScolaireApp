import { describe, expect, it } from 'vitest'
import type { ClubEcheance } from '../data/clubs'
import {
  ajouterMois,
  dateEcheance,
  dhVersCentimes,
  echeancesPourInscription,
  formatDH,
  libelleMois,
  moisDe,
  moisDuClub,
  reconcilerEcheances,
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
