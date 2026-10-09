import type { Club, ClubEcheance, ClubInscription } from '../data/clubs'

// Logique financière pure des clubs (mensualités, échéancier). Aucun import de service : testable seule, et importable
// partout sans cycle. Tous les montants sont des centimes entiers ; les mois s'écrivent AAAA-MM-01.

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
