import { libelleClub, type Club, type ClubEcheance, type ClubImputation, type ClubInscription, type ClubReglement } from '../data/clubs'
import type { StudentIdentity } from '../data/studentIdentity'
import { ajouterJours } from './soutienSeances'
import { normalizeText } from './textMatch'

// Logique financière pure des clubs (mensualités, échéancier, règlements). Aucun import de service : testable seule, et
// importable partout sans cycle. Tous les montants sont des centimes entiers ; les mois s'écrivent AAAA-MM-01.

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 1er jour du mois d'une date AAAA-MM-JJ (ou d'un mois AAAA-MM-01). Chaîne vide si la date est illisible. */
export function moisDe(dateISO: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(dateISO)
  return m ? `${m[1]}-${m[2]}-01` : ''
}

/** Mois décalé de `n` mois (négatif pour reculer), au format AAAA-MM-01. */
export function ajouterMois(mois: string, n: number): string {
  const m = /^(\d{4})-(\d{2})/.exec(mois)
  if (!m) return mois
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + n
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}-01`
}

/** Tous les mois facturés par un club, du premier au dernier inclus. */
export function moisDuClub(club: Pick<Club, 'moisDebut' | 'moisFin'>): string[] {
  const debut = moisDe(club.moisDebut)
  const fin = moisDe(club.moisFin)
  if (!debut || !fin || fin < debut) return []
  const out: string[] = []
  for (let m = debut; m <= fin && out.length < 120; m = ajouterMois(m, 1)) out.push(m)
  return out
}

/** Date d'échéance d'un mois : le `jour` du mois (borné à 1–28, valable tous les mois, février compris). */
export function dateEcheance(mois: string, jour: number): string {
  const m = /^(\d{4})-(\d{2})/.exec(mois)
  if (!m) return mois
  const j = Math.min(28, Math.max(1, Math.trunc(jour) || 1))
  return `${m[1]}-${m[2]}-${pad2(j)}`
}

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** « octobre 2026 » */
export function libelleMois(mois: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(mois)
  return m ? `${MOIS_FR[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : mois
}

/** « 1 200,50 DH » (espaces insécables) ; les centimes sont toujours affichés. */
export function formatDH(centimes: number): string {
  const negatif = centimes < 0
  const abs = Math.abs(Math.round(centimes))
  const entier = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${negatif ? '-' : ''}${entier},${pad2(abs % 100)} DH`
}

/** Saisie d'un montant en dirhams (« 150 », « 150,5 », « 1 200.75 DH ») → centimes ; `null` si illisible ou négatif. */
export function dhVersCentimes(texte: string): number | null {
  const propre = texte.replace(/dh/gi, '').replace(/[\s  ]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return null
  return Math.round(Number(propre) * 100)
}

// ───────────────────────── Échéancier d'une inscription ─────────────────────────

export interface EcheanceVoulue {
  mois: string
  montantCentimes: number
  dateEcheance: string
}

type ClubTarif = Pick<Club, 'moisDebut' | 'moisFin' | 'mensualiteCentimes' | 'jourEcheance'>
type InscriptionFacturable = Pick<ClubInscription, 'statut' | 'dateInscription' | 'dateArret' | 'exonere'>

/**
 * Mensualités dues pour une inscription : du mois d'inscription (dû en entier) au dernier mois du club, ou au mois
 * d'arrêt (dû aussi) si l'élève a quitté le club. Rien n'est dû en liste d'attente. Un élève exonéré garde ses
 * échéances à 0, ce qui conserve l'historique des mois couverts.
 */
export function echeancesPourInscription(club: ClubTarif, inscription: InscriptionFacturable): EcheanceVoulue[] {
  if (inscription.statut === 'attente') return []
  const debutClub = moisDe(club.moisDebut)
  const finClub = moisDe(club.moisFin)
  const moisInscription = moisDe(inscription.dateInscription)
  if (!debutClub || !finClub || !moisInscription) return []

  const premier = moisInscription > debutClub ? moisInscription : debutClub
  let dernier = finClub
  if (inscription.statut === 'arrete') {
    const moisArret = moisDe(inscription.dateArret ?? inscription.dateInscription)
    if (moisArret && moisArret < dernier) dernier = moisArret
  }
  const montant = inscription.exonere ? 0 : club.mensualiteCentimes
  const out: EcheanceVoulue[] = []
  for (let m = premier; m <= dernier && out.length < 120; m = ajouterMois(m, 1)) {
    out.push({ mois: m, montantCentimes: montant, dateEcheance: dateEcheance(m, club.jourEcheance) })
  }
  return out
}

export interface ReconciliationEcheances {
  aAjouter: EcheanceVoulue[]
  aMettreAJour: { id: string; montantCentimes: number; dateEcheance: string }[]
  aSupprimer: string[]
}

/**
 * Compare les mensualités enregistrées à celles qu'il faudrait. Règle : une mensualité qui a reçu un règlement n'est
 * jamais modifiée ni supprimée (tarif, exonération et arrêt ne touchent que les mois sans paiement). `payees` donne,
 * par identifiant d'échéance, ce qui a déjà été payé en centimes. `moisPlancher` protège les mois antérieurs : les
 * impayés d'une inscription précédente (élève revenu après un arrêt) ne disparaissent jamais en silence.
 */
export function reconcilerEcheances(
  existantes: ClubEcheance[],
  voulues: EcheanceVoulue[],
  payees: ReadonlyMap<string, number> = new Map(),
  moisPlancher = '',
): ReconciliationEcheances {
  const parMois = new Map(existantes.map((e) => [e.mois, e]))
  const voulueParMois = new Map(voulues.map((v) => [v.mois, v]))
  const resultat: ReconciliationEcheances = { aAjouter: [], aMettreAJour: [], aSupprimer: [] }

  for (const v of voulues) {
    const e = parMois.get(v.mois)
    if (!e) {
      resultat.aAjouter.push(v)
      continue
    }
    const payee = (payees.get(e.id) ?? 0) > 0
    if (!payee && (e.montantCentimes !== v.montantCentimes || e.dateEcheance !== v.dateEcheance)) {
      resultat.aMettreAJour.push({ id: e.id, montantCentimes: v.montantCentimes, dateEcheance: v.dateEcheance })
    }
  }
  for (const e of existantes) {
    if (voulueParMois.has(e.mois)) continue
    if ((payees.get(e.id) ?? 0) > 0) continue
    if (moisPlancher && e.mois < moisPlancher) continue
    resultat.aSupprimer.push(e.id)
  }
  return resultat
}

// ───────────────────────── Famille ─────────────────────────

type IdentiteParents = Pick<StudentIdentity, 'parent1Nom' | 'parent1Prenom' | 'parent2Nom' | 'parent2Prenom'>

/** Mots d'un nom normalisés (sans accent ni casse) et triés : « Karim ALAMI » et « Alami karim » donnent la même chose. */
function motsNormalises(texte: string): string {
  return normalizeText(texte).split(' ').filter(Boolean).sort().join(' ')
}

/**
 * Clé de famille : les noms des deux parents, normalisés et triés (l'ordre des parents et la casse n'ont pas d'importance).
 * Sans parent renseigné, l'élève est sa propre famille.
 */
export function cleFamille(identity: IdentiteParents | undefined, studentId: string): string {
  const noms = [
    motsNormalises(`${identity?.parent1Prenom ?? ''} ${identity?.parent1Nom ?? ''}`),
    motsNormalises(`${identity?.parent2Prenom ?? ''} ${identity?.parent2Nom ?? ''}`),
  ].filter(Boolean)
  if (noms.length === 0) return `eleve:${studentId}`
  return [...new Set(noms)].sort().join('|')
}

/** « Famille ALAMI » : le nom des parents, sinon le dernier mot du nom de l'élève. */
export function libelleFamille(identity: IdentiteParents | undefined, nomEleve: string): string {
  const vus = new Set<string>()
  const noms: string[] = []
  for (const n of [identity?.parent1Nom, identity?.parent2Nom]) {
    const propre = (n ?? '').trim()
    const cle = normalizeText(propre)
    if (propre && !vus.has(cle)) {
      vus.add(cle)
      noms.push(propre.toUpperCase())
    }
  }
  if (noms.length > 0) return `Famille ${noms.join(' / ')}`
  const dernier = nomEleve.trim().split(/\s+/).pop() ?? ''
  return dernier ? `Famille ${dernier.toUpperCase()}` : 'Famille'
}

// ───────────────────────── Mensualités et paiements ─────────────────────────

/** `en_retard` l'emporte sur `partielle` : une mensualité en partie payée mais échue depuis trop longtemps reste « en retard ». */
export type StatutEcheance = 'a_venir' | 'due' | 'en_retard' | 'partielle' | 'payee' | 'exoneree'

export const STATUT_ECHEANCE_LABELS: Record<StatutEcheance, string> = {
  a_venir: 'À venir',
  due: 'À payer',
  en_retard: 'En retard',
  partielle: 'Partielle',
  payee: 'Payée',
  exoneree: 'Exonérée',
}

/**
 * Ce qui a été payé, en centimes, par mensualité : seuls les règlements valides comptent (un règlement annulé ne paie
 * rien). Avec `jusquAuReglement`, on ne garde que les règlements enregistrés jusqu'à celui-là (inclus), pour reconstituer
 * la situation au moment d'un reçu.
 */
export function paiementsParEcheance(imputations: ClubImputation[], reglements: ClubReglement[], jusquAuReglement?: Pick<ClubReglement, 'createdAt'>): Map<string, number> {
  const retenus = new Set(reglements.filter((r) => r.statut === 'valide' && (!jusquAuReglement || r.createdAt <= jusquAuReglement.createdAt)).map((r) => r.id))
  const paye = new Map<string, number>()
  for (const i of imputations) {
    if (retenus.has(i.reglementId)) paye.set(i.echeanceId, (paye.get(i.echeanceId) ?? 0) + i.montantCentimes)
  }
  return paye
}

/** Nombre de jours entiers entre deux dates AAAA-MM-JJ (négatif si `fin` précède `debut`). */
export function joursEntre(debut: string, fin: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(debut)
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(fin)
  if (!a || !b) return 0
  return Math.round((Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3])) - Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]))) / 86400000)
}

/**
 * Statut d'une mensualité : exonérée (montant 0), payée, en retard (échéance + délai de grâce dépassés), partielle, à
 * payer (échéance atteinte) ou à venir.
 */
export function statutEcheance(echeance: Pick<ClubEcheance, 'montantCentimes' | 'dateEcheance'>, payeCentimes: number, aujourdhui: string, delaiGraceJours: number): StatutEcheance {
  if (echeance.montantCentimes === 0) return 'exoneree'
  if (payeCentimes >= echeance.montantCentimes) return 'payee'
  if (aujourdhui > ajouterJours(echeance.dateEcheance, Math.max(0, delaiGraceJours))) return 'en_retard'
  if (payeCentimes > 0) return 'partielle'
  return aujourdhui >= echeance.dateEcheance ? 'due' : 'a_venir'
}

export interface EleveFinance {
  name: string
  classe: string
  familleCle: string
  familleLibelle: string
}

/** Une mensualité avec tout ce qu'il faut pour l'afficher, la regrouper par famille et la relancer. */
export interface LigneMensualite {
  echeanceId: string
  inscriptionId: string
  clubId: string
  clubNom: string
  studentId: string
  studentNom: string
  classe: string
  familleCle: string
  familleLibelle: string
  mois: string
  dateEcheance: string
  montantCentimes: number
  payeCentimes: number
  resteCentimes: number
  statut: StatutEcheance
}

/** Assemble les mensualités de tous les inscrits (hors liste d'attente) avec leur élève, leur club, ce qui est payé et leur statut. */
export function lignesMensualites(args: {
  clubs: Club[]
  inscriptions: ClubInscription[]
  echeances: ClubEcheance[]
  paiements: ReadonlyMap<string, number>
  eleves: ReadonlyMap<string, EleveFinance>
  aujourdhui: string
}): LigneMensualite[] {
  const clubs = new Map(args.clubs.map((c) => [c.id, c]))
  const inscriptions = new Map(args.inscriptions.map((i) => [i.id, i]))
  const lignes: LigneMensualite[] = []
  for (const e of args.echeances) {
    const inscription = inscriptions.get(e.inscriptionId)
    const club = inscription ? clubs.get(inscription.clubId) : undefined
    if (!inscription || !club) continue
    const eleve = args.eleves.get(inscription.studentId)
    const paye = args.paiements.get(e.id) ?? 0
    lignes.push({
      echeanceId: e.id,
      inscriptionId: inscription.id,
      clubId: club.id,
      clubNom: libelleClub(club),
      studentId: inscription.studentId,
      studentNom: eleve?.name ?? 'Élève introuvable',
      classe: eleve?.classe ?? '',
      familleCle: eleve?.familleCle ?? `eleve:${inscription.studentId}`,
      familleLibelle: eleve?.familleLibelle ?? 'Famille',
      mois: e.mois,
      dateEcheance: e.dateEcheance,
      montantCentimes: e.montantCentimes,
      payeCentimes: paye,
      resteCentimes: Math.max(0, e.montantCentimes - paye),
      statut: statutEcheance(e, paye, args.aujourdhui, club.delaiGraceJours),
    })
  }
  return lignes.sort((a, b) => a.mois.localeCompare(b.mois) || a.clubNom.localeCompare(b.clubNom, 'fr') || a.studentNom.localeCompare(b.studentNom, 'fr'))
}

export interface SoldeFamille {
  attenduCentimes: number
  payeCentimes: number
  /** Reste sur les mensualités dont l'échéance est atteinte. */
  resteEchuCentimes: number
  /** Reste sur les mensualités à venir (déjà créées). */
  resteAVenirCentimes: number
}

export function soldeDeLignes(lignes: LigneMensualite[], aujourdhui: string): SoldeFamille {
  const solde: SoldeFamille = { attenduCentimes: 0, payeCentimes: 0, resteEchuCentimes: 0, resteAVenirCentimes: 0 }
  for (const l of lignes) {
    solde.attenduCentimes += l.montantCentimes
    solde.payeCentimes += Math.min(l.payeCentimes, l.montantCentimes)
    if (l.dateEcheance <= aujourdhui) solde.resteEchuCentimes += l.resteCentimes
    else solde.resteAVenirCentimes += l.resteCentimes
  }
  return solde
}

export interface ImpayeFamille {
  familleCle: string
  familleLibelle: string
  /** Reste à payer sur les mensualités en retard. */
  resteCentimes: number
  /** Échéance la plus ancienne non réglée. */
  plusAncienneEcheance: string
  joursRetardMax: number
  lignes: LigneMensualite[]
}

/** Familles qui ont au moins une mensualité en retard, les plus grosses créances d'abord. */
export function impayesParFamille(lignes: LigneMensualite[], aujourdhui: string): ImpayeFamille[] {
  const parFamille = new Map<string, ImpayeFamille>()
  for (const l of lignes) {
    if (l.statut !== 'en_retard') continue
    const f = parFamille.get(l.familleCle) ?? { familleCle: l.familleCle, familleLibelle: l.familleLibelle, resteCentimes: 0, plusAncienneEcheance: l.dateEcheance, joursRetardMax: 0, lignes: [] }
    f.resteCentimes += l.resteCentimes
    if (l.dateEcheance < f.plusAncienneEcheance) f.plusAncienneEcheance = l.dateEcheance
    f.joursRetardMax = Math.max(f.joursRetardMax, joursEntre(l.dateEcheance, aujourdhui))
    f.lignes.push(l)
    parFamille.set(l.familleCle, f)
  }
  return [...parFamille.values()].sort((a, b) => b.resteCentimes - a.resteCentimes || a.familleLibelle.localeCompare(b.familleLibelle, 'fr'))
}

export interface MensualiteOuverte {
  echeanceId: string
  mois: string
  dateEcheance: string
  resteCentimes: number
}

export interface ImputationPrevue {
  echeanceId: string
  montantCentimes: number
}

export interface ResultatImputation {
  imputations: ImputationPrevue[]
  imputeCentimes: number
  /** Ce qui dépasse le total des mensualités ouvertes : doit être 0 pour valider le règlement (pas de trop-perçu). */
  nonImputeCentimes: number
}

/** Mensualités encore à payer d'une famille (reste > 0), dans l'ordre où un règlement les paie. */
export function mensualitesOuvertes(lignes: LigneMensualite[], familleCle: string): (MensualiteOuverte & { ligne: LigneMensualite })[] {
  return lignes
    .filter((l) => l.familleCle === familleCle && l.resteCentimes > 0)
    .map((l) => ({ echeanceId: l.echeanceId, mois: l.mois, dateEcheance: l.dateEcheance, resteCentimes: l.resteCentimes, ligne: l }))
    .sort((a, b) => a.mois.localeCompare(b.mois) || a.dateEcheance.localeCompare(b.dateEcheance))
}

/**
 * Répartit un règlement sur les mensualités ouvertes : les plus anciennes impayées d'abord, puis les mois à venir (un
 * paiement d'avance est accepté). Ne dépasse jamais ce qu'il reste à payer sur chaque mensualité.
 */
export function imputerReglement(montantCentimes: number, ouvertes: MensualiteOuverte[]): ResultatImputation {
  const triees = [...ouvertes].sort((a, b) => a.mois.localeCompare(b.mois) || a.dateEcheance.localeCompare(b.dateEcheance))
  const imputations: ImputationPrevue[] = []
  let restant = Math.max(0, Math.round(montantCentimes))
  for (const o of triees) {
    if (restant <= 0) break
    const part = Math.min(restant, o.resteCentimes)
    if (part > 0) {
      imputations.push({ echeanceId: o.echeanceId, montantCentimes: part })
      restant -= part
    }
  }
  const total = imputations.reduce((n, i) => n + i.montantCentimes, 0)
  return { imputations, imputeCentimes: total, nonImputeCentimes: restant }
}

// ───────────────────────── Numérotation des reçus ─────────────────────────

/** REC-2026-0001 : un compteur par année scolaire (l'année de début). */
export function numeroReglement(anneeDebut: number, n: number): string {
  return `REC-${anneeDebut}-${String(n).padStart(4, '0')}`
}

/** Prochain numéro libre de l'année : un reçu annulé garde son numéro, qui n'est donc jamais réutilisé. */
export function prochainNumeroReglement(numeros: string[], anneeDebut: number): string {
  let max = 0
  for (const numero of numeros) {
    const m = /^REC-(\d{4})-(\d+)$/.exec(numero)
    if (m && Number(m[1]) === anneeDebut) max = Math.max(max, Number(m[2]))
  }
  return numeroReglement(anneeDebut, max + 1)
}

// ───────────────────────── Montant en toutes lettres ─────────────────────────

const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

/** De 0 à 99. `final` : rien ne suit, donc « quatre-vingts » prend son s. */
function moinsDeCent(n: number, final: boolean): string {
  if (n < 20) return UNITES[n]
  const d = Math.floor(n / 10)
  const u = n % 10
  if (d === 7) return u === 1 ? 'soixante et onze' : `soixante-${UNITES[10 + u]}`
  if (d === 9) return `quatre-vingt-${UNITES[10 + u]}`
  if (d === 8) return u === 0 ? (final ? 'quatre-vingts' : 'quatre-vingt') : `quatre-vingt-${UNITES[u]}`
  const dizaine = DIZAINES[d]
  if (u === 0) return dizaine
  return u === 1 ? `${dizaine} et un` : `${dizaine}-${UNITES[u]}`
}

/** De 0 à 999. `final` : rien ne suit, donc « deux cents » prend son s. */
function moinsDeMille(n: number, final: boolean): string {
  const c = Math.floor(n / 100)
  const r = n % 100
  let out = ''
  if (c === 1) out = 'cent'
  else if (c > 1) out = `${UNITES[c]} cent${r === 0 && final ? 's' : ''}`
  if (r > 0) out += `${out ? ' ' : ''}${moinsDeCent(r, final)}`
  return out
}

/** Entier de 0 à 999 999 999 999 en toutes lettres (français de France : soixante-dix, quatre-vingts). */
export function nombreEnLettres(n: number): string {
  const entier = Math.max(0, Math.min(Math.trunc(n), 999_999_999_999))
  if (entier === 0) return 'zéro'
  const milliards = Math.floor(entier / 1_000_000_000)
  const millions = Math.floor((entier % 1_000_000_000) / 1_000_000)
  const milliers = Math.floor((entier % 1_000_000) / 1000)
  const reste = entier % 1000
  const segments: string[] = []
  if (milliards) segments.push(`${moinsDeMille(milliards, true)} milliard${milliards > 1 ? 's' : ''}`)
  if (millions) segments.push(`${moinsDeMille(millions, true)} million${millions > 1 ? 's' : ''}`)
  if (milliers) segments.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers, false)} mille`)
  if (reste) segments.push(moinsDeMille(reste, true))
  return segments.join(' ')
}

/** « cent vingt dirhams et cinquante centimes » (sans majuscule : à l'appelant de capitaliser). */
export function montantEnLettres(centimes: number): string {
  const abs = Math.abs(Math.round(centimes))
  const dirhams = Math.floor(abs / 100)
  const cts = abs % 100
  const parts: string[] = []
  if (dirhams > 0 || cts === 0) parts.push(`${nombreEnLettres(dirhams)} dirham${dirhams > 1 ? 's' : ''}`)
  if (cts > 0) parts.push(`${nombreEnLettres(cts)} centime${cts > 1 ? 's' : ''}`)
  return parts.join(' et ')
}

// ───────────────────────── Bilans ─────────────────────────

export interface BilanMois {
  mois: string
  attenduCentimes: number
  encaisseCentimes: number
  resteCentimes: number
  /** Part encaissée de ce qui était attendu, en %, arrondie ; `null` quand rien n'est attendu (mois d'exonérés). */
  tauxPct: number | null
}

function bilanDeLignes(mois: string, lignes: LigneMensualite[]): BilanMois {
  const attendu = lignes.reduce((n, l) => n + l.montantCentimes, 0)
  const encaisse = lignes.reduce((n, l) => n + Math.min(l.payeCentimes, l.montantCentimes), 0)
  return { mois, attenduCentimes: attendu, encaisseCentimes: encaisse, resteCentimes: attendu - encaisse, tauxPct: attendu > 0 ? Math.round((encaisse / attendu) * 100) : null }
}

/** Ce qui était attendu et ce qui a été encaissé pour chaque mois de facturation (les paiements comptent dans le mois qu'ils paient). */
export function bilanParMois(lignes: LigneMensualite[]): BilanMois[] {
  const parMois = new Map<string, LigneMensualite[]>()
  for (const l of lignes) parMois.set(l.mois, [...(parMois.get(l.mois) ?? []), l])
  return [...parMois.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mois, ls]) => bilanDeLignes(mois, ls))
}

export interface BilanClub {
  clubId: string
  clubNom: string
  mois: BilanMois[]
  total: BilanMois
}

/** Bilan mensuel de chaque club, avec une ligne de total ; les clubs sont triés par nom. */
export function bilanParClub(lignes: LigneMensualite[]): BilanClub[] {
  const parClub = new Map<string, { clubNom: string; lignes: LigneMensualite[] }>()
  for (const l of lignes) {
    const c = parClub.get(l.clubId) ?? { clubNom: l.clubNom, lignes: [] }
    c.lignes.push(l)
    parClub.set(l.clubId, c)
  }
  return [...parClub.entries()]
    .map(([clubId, c]) => ({ clubId, clubNom: c.clubNom, mois: bilanParMois(c.lignes), total: bilanDeLignes('', c.lignes) }))
    .sort((a, b) => a.clubNom.localeCompare(b.clubNom, 'fr'))
}
