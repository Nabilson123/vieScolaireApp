import type { Club, ClubInscription, JourClub } from '../data/clubs'
import { moisDe } from './clubsFinance'
import { ajouterJours, jourDeDate } from './soutienSeances'

// Logique pure et légère des clubs (période, séances, places, niveaux, occupation). Volontairement sans import de service ni
// de moteur d'alertes : les agrégats d'emploi du temps et de disponibilité des enseignants l'appellent sans créer de cycle.

/** Dernier jour du mois d'un mois AAAA-MM-01 (AAAA-MM-JJ). */
export function dernierJourDuMois(mois: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(mois)
  if (!m) return mois
  const dernier = new Date(Number(m[1]), Number(m[2]), 0).getDate()
  return `${m[1]}-${m[2]}-${String(dernier).padStart(2, '0')}`
}

/** Premier jour de la période du club (AAAA-MM-JJ). */
export function debutDuClub(club: Pick<Club, 'moisDebut'>): string {
  return moisDe(club.moisDebut)
}

/** Dernier jour de la période du club (AAAA-MM-JJ) : fin du dernier mois facturé. */
export function finDuClub(club: Pick<Club, 'moisFin'>): string {
  return dernierJourDuMois(club.moisFin)
}

/** Le club a-t-il lieu ce jour-là ? Non archivé, dans sa période, et le bon jour de semaine. */
export function clubALieuLe(club: Club, dateISO: string): boolean {
  if (club.archive) return false
  if (dateISO < debutDuClub(club) || dateISO > finDuClub(club)) return false
  return jourDeDate(dateISO) === club.jour
}

/** La période du club est entièrement passée. */
export function clubTermine(club: Pick<Club, 'moisFin'>, aujourdhuiISO: string): boolean {
  return aujourdhuiISO > finDuClub(club)
}

const MAX_DATES = 400

/** Dates (une par semaine) où le club a lieu, éventuellement bornées à une fenêtre. */
export function datesDuClub(club: Club, opts: { depuis?: string; jusqua?: string; max?: number } = {}): string[] {
  const debut = debutDuClub(club)
  const fin = finDuClub(club)
  if (!debut || !fin) return []
  const borneDebut = opts.depuis && opts.depuis > debut ? opts.depuis : debut
  const borneFin = opts.jusqua && opts.jusqua < fin ? opts.jusqua : fin
  const max = opts.max ?? MAX_DATES

  let d = borneDebut
  for (let i = 0; i < 7 && jourDeDate(d) !== club.jour; i++) d = ajouterJours(d, 1)
  if (jourDeDate(d) !== club.jour) return []

  const out: string[] = []
  for (; d <= borneFin && out.length < max; d = ajouterJours(d, 7)) out.push(d)
  return out
}

/** Séances du club pendant un mois donné (AAAA-MM-01). */
export function datesDuMois(club: Club, mois: string): string[] {
  const debut = moisDe(mois)
  return datesDuClub(club, { depuis: debut, jusqua: dernierJourDuMois(debut) })
}

// ───────────────────────── Inscrits, places, niveaux ─────────────────────────

export function inscriptionsDuClub(inscriptions: ClubInscription[], clubId: string): ClubInscription[] {
  return inscriptions.filter((i) => i.clubId === clubId)
}

export function inscritsActifs(inscriptions: ClubInscription[], clubId: string): ClubInscription[] {
  return inscriptions.filter((i) => i.clubId === clubId && i.statut === 'actif')
}

/** Liste d'attente dans l'ordre d'arrivée (la plus ancienne demande d'abord). */
export function listeAttente(inscriptions: ClubInscription[], clubId: string): ClubInscription[] {
  return inscriptions
    .filter((i) => i.clubId === clubId && i.statut === 'attente')
    .sort((a, b) => a.dateInscription.localeCompare(b.dateInscription) || a.createdAt.localeCompare(b.createdAt))
}

export function inscritsArretes(inscriptions: ClubInscription[], clubId: string): ClubInscription[] {
  return inscriptions.filter((i) => i.clubId === clubId && i.statut === 'arrete')
}

/** Places libres ; `null` si le club n'a pas de limite. Jamais négatif. */
export function placesRestantes(club: Pick<Club, 'id' | 'placesMax'>, inscriptions: ClubInscription[]): number | null {
  if (club.placesMax === null) return null
  return Math.max(0, club.placesMax - inscritsActifs(inscriptions, club.id).length)
}

export function clubComplet(club: Pick<Club, 'id' | 'placesMax'>, inscriptions: ClubInscription[]): boolean {
  return placesRestantes(club, inscriptions) === 0
}

/** « CE1-A » → « CE1 » (même règle que le reste de l'application). */
export function niveauDeClasse(classe: string): string {
  return classe.replace(/-[A-Z]$/, '')
}

/** Le niveau de la classe est-il admis ? Aucun niveau renseigné = ouvert à tous. */
export function niveauAutorise(club: Pick<Club, 'niveaux'>, classe: string): boolean {
  return club.niveaux.length === 0 || club.niveaux.includes(niveauDeClasse(classe))
}

/** Statut d'un nouvel inscrit : actif s'il reste une place, sinon en liste d'attente. */
export function statutPourNouvelInscrit(club: Pick<Club, 'id' | 'placesMax'>, inscriptions: ClubInscription[]): 'actif' | 'attente' {
  const restantes = placesRestantes(club, inscriptions)
  return restantes === null || restantes > 0 ? 'actif' : 'attente'
}

/** Prochain de la liste d'attente à promouvoir (la promotion reste manuelle) ; `null` si personne n'attend ou si le club est complet. */
export function promouvoirSuivant(club: Pick<Club, 'id' | 'placesMax'>, inscriptions: ClubInscription[]): ClubInscription | null {
  if (placesRestantes(club, inscriptions) === 0) return null
  return listeAttente(inscriptions, club.id)[0] ?? null
}

/** Clubs auxquels un élève est inscrit (actif ou en liste d'attente), avec son inscription. */
export function clubsDeLEleve(clubs: Club[], inscriptions: ClubInscription[], studentId: string): { club: Club; inscription: ClubInscription }[] {
  const parId = new Map(clubs.map((c) => [c.id, c]))
  return inscriptions
    .filter((i) => i.studentId === studentId)
    .map((inscription) => ({ club: parId.get(inscription.clubId), inscription }))
    .filter((x): x is { club: Club; inscription: ClubInscription } => !!x.club)
}

// ───────────────────────── Occupation de l'encadrant et de la salle ─────────────────────────

interface Intervalle {
  start: string
  end: string
}

function intervallesClubs(clubs: Club[], garde: (c: Club) => boolean, jour: string, dateISO?: string): Intervalle[] {
  return clubs
    .filter((c) => !c.archive && garde(c) && (dateISO ? clubALieuLe(c, dateISO) : c.jour === jour))
    .map((c) => ({ start: c.heureDebut, end: c.heureFin }))
}

/**
 * Plages où l'enseignant encadre un club. Avec une date : seulement si le club a lieu ce jour-là (période comprise) ;
 * sans date : tous les clubs de ce jour de semaine. N'entre pas dans le quota d'heures de l'enseignant, seulement dans
 * sa disponibilité.
 */
export function intervallesClubEnseignant(clubs: Club[], teacherId: string, jour: string, dateISO?: string): Intervalle[] {
  if (!teacherId) return []
  return intervallesClubs(clubs, (c) => c.teacherId === teacherId, jour, dateISO)
}

export function intervallesClubSalle(clubs: Club[], salleId: string, jour: string, dateISO?: string): Intervalle[] {
  if (!salleId) return []
  return intervallesClubs(clubs, (c) => c.salleId === salleId, jour, dateISO)
}

// ───────────────────────── Blocs de la grille de l'encadrant ─────────────────────────

export interface BlocClub {
  clubId: string
  label: string
  start: string
  end: string
  nbInscrits: number
}

export function libelleBlocClub(nom: string, nbInscrits: number): string {
  return `Club – ${nom} · ${nbInscrits} inscrit${nbInscrits > 1 ? 's' : ''}`
}

const JOURS_CLUB: JourClub[] = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']

/**
 * Blocs de clubs de la grille hebdomadaire d'un enseignant : ses clubs non archivés dont la période n'est pas passée, rangés
 * par jour et triés par heure. Les clubs d'un intervenant externe n'apparaissent dans aucune grille d'enseignant.
 */
export function blocsClubParJour(clubs: Club[], inscriptions: ClubInscription[], filtre: { teacherId: string; aPartirDe: string }): Record<JourClub, BlocClub[]> {
  const out = Object.fromEntries(JOURS_CLUB.map((j) => [j, [] as BlocClub[]])) as Record<JourClub, BlocClub[]>
  if (!filtre.teacherId) return out
  for (const c of clubs) {
    if (c.archive || c.teacherId !== filtre.teacherId || clubTermine(c, filtre.aPartirDe)) continue
    const nb = inscritsActifs(inscriptions, c.id).length
    out[c.jour].push({ clubId: c.id, label: libelleBlocClub(c.nom, nb), start: c.heureDebut, end: c.heureFin, nbInscrits: nb })
  }
  JOURS_CLUB.forEach((j) => out[j].sort((a, b) => a.start.localeCompare(b.start)))
  return out
}
