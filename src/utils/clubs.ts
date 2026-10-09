import { libelleClub, type Club, type ClubInscription, type ClubSeance, type JourClub } from '../data/clubs'
import { JOUR_LABELS } from '../data/soutien'
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

export const JOURS_CLUB: JourClub[] = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']

/** Séances du club rangées par jour de la semaine puis par heure de début. */
export function seancesTriees(club: Pick<Club, 'seances'>): ClubSeance[] {
  return [...club.seances].sort((a, b) => JOURS_CLUB.indexOf(a.jour) - JOURS_CLUB.indexOf(b.jour) || a.heureDebut.localeCompare(b.heureDebut))
}

/** Séances qui ont lieu ce jour de la semaine (« MERCREDI »), par heure de début. */
export function seancesDuJour(club: Pick<Club, 'seances'>, jour: string): ClubSeance[] {
  return club.seances.filter((s) => s.jour === jour).sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))
}

/** « Lundi 16:00 – 17:30 · Mercredi 14:00 – 15:30 » */
export function libelleSeances(club: Pick<Club, 'seances'>): string {
  return seancesTriees(club)
    .map((s) => `${JOUR_LABELS[s.jour]} ${s.heureDebut} – ${s.heureFin}`)
    .join(' · ')
}

/** Le club a-t-il lieu ce jour-là ? Non archivé, dans sa période, et au moins une séance ce jour de semaine. */
export function clubALieuLe(club: Club, dateISO: string): boolean {
  if (club.archive) return false
  if (dateISO < debutDuClub(club) || dateISO > finDuClub(club)) return false
  const jour = jourDeDate(dateISO)
  return jour !== null && seancesDuJour(club, jour).length > 0
}

/** La période du club est entièrement passée. */
export function clubTermine(club: Pick<Club, 'moisFin'>, aujourdhuiISO: string): boolean {
  return aujourdhuiISO > finDuClub(club)
}

const MAX_DATES = 400

/** Une séance à une date précise. */
export interface OccurrenceClub {
  date: string
  seance: ClubSeance
}

/** Occurrences (une par semaine et par séance) du club, éventuellement bornées à une fenêtre, par date puis par heure. */
export function occurrencesDuClub(club: Club, opts: { depuis?: string; jusqua?: string } = {}): OccurrenceClub[] {
  const debut = debutDuClub(club)
  const fin = finDuClub(club)
  if (!debut || !fin) return []
  const borneDebut = opts.depuis && opts.depuis > debut ? opts.depuis : debut
  const borneFin = opts.jusqua && opts.jusqua < fin ? opts.jusqua : fin

  const out: OccurrenceClub[] = []
  for (const seance of club.seances) {
    let d = borneDebut
    for (let i = 0; i < 7 && jourDeDate(d) !== seance.jour; i++) d = ajouterJours(d, 1)
    if (jourDeDate(d) !== seance.jour) continue
    for (let n = 0; d <= borneFin && n < MAX_DATES; d = ajouterJours(d, 7), n++) out.push({ date: d, seance })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.seance.heureDebut.localeCompare(b.seance.heureDebut))
}

/** Dates où le club a lieu (une même date n'apparaît qu'une fois, même avec deux séances ce jour-là), éventuellement bornées. */
export function datesDuClub(club: Club, opts: { depuis?: string; jusqua?: string; max?: number } = {}): string[] {
  const dates = [...new Set(occurrencesDuClub(club, opts).map((o) => o.date))]
  return dates.slice(0, opts.max ?? MAX_DATES)
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

/** Séances des clubs non archivés qui ont lieu ce jour de semaine (ou à cette date, période du club comprise) et que `garde` retient. */
function seancesRetenues(clubs: Club[], garde: (c: Club, s: ClubSeance) => boolean, jour: string, dateISO?: string): { club: Club; seance: ClubSeance }[] {
  const out: { club: Club; seance: ClubSeance }[] = []
  const jourCible = dateISO ? jourDeDate(dateISO) : jour
  for (const club of clubs) {
    if (club.archive) continue
    if (dateISO && (dateISO < debutDuClub(club) || dateISO > finDuClub(club))) continue
    for (const seance of club.seances) if (seance.jour === jourCible && garde(club, seance)) out.push({ club, seance })
  }
  return out
}

function intervallesClubs(clubs: Club[], garde: (c: Club, s: ClubSeance) => boolean, jour: string, dateISO?: string): Intervalle[] {
  return seancesRetenues(clubs, garde, jour, dateISO).map(({ seance }) => ({ start: seance.heureDebut, end: seance.heureFin }))
}

/**
 * Plages où l'enseignant encadre un club. Avec une date : seulement si le club a lieu ce jour-là (période comprise) ;
 * sans date : toutes les séances de ce jour de semaine. N'entre pas dans le quota d'heures de l'enseignant, seulement dans
 * sa disponibilité.
 */
export function intervallesClubEnseignant(clubs: Club[], teacherId: string, jour: string, dateISO?: string): Intervalle[] {
  if (!teacherId) return []
  return intervallesClubs(clubs, (c) => c.teacherId === teacherId, jour, dateISO)
}

/** Plages où la salle est prise par une séance de club (chaque séance a sa propre salle). */
export function intervallesClubSalle(clubs: Club[], salleId: string, jour: string, dateISO?: string): Intervalle[] {
  if (!salleId) return []
  return intervallesClubs(clubs, (_c, s) => s.salleId === salleId, jour, dateISO)
}

/** Séances de club qui ont lieu dans cette salle à cette date (période du club comprise). */
export function seancesClubEnSalleLe(clubs: Club[], salleId: string, dateISO: string): { club: Club; seance: ClubSeance }[] {
  if (!salleId) return []
  return seancesRetenues(clubs, (_c, s) => s.salleId === salleId, '', dateISO)
}

// ───────────────────────── Blocs de la grille de l'encadrant ─────────────────────────

export interface BlocClub {
  clubId: string
  label: string
  start: string
  end: string
  nbInscrits: number
  /** Salle de cette séance (chaque séance a la sienne). */
  salleId: string | null
}

export function libelleBlocClub(nom: string, nbInscrits: number): string {
  return `Club – ${nom} · ${nbInscrits} inscrit${nbInscrits > 1 ? 's' : ''}`
}

/**
 * Blocs de clubs de la grille hebdomadaire d'un enseignant : les séances de ses clubs non archivés dont la période n'est pas
 * passée, rangées par jour et triées par heure. Les clubs d'un intervenant externe n'apparaissent dans aucune grille d'enseignant.
 */
export function blocsClubParJour(clubs: Club[], inscriptions: ClubInscription[], filtre: { teacherId: string; aPartirDe: string }): Record<JourClub, BlocClub[]> {
  const out = Object.fromEntries(JOURS_CLUB.map((j) => [j, [] as BlocClub[]])) as Record<JourClub, BlocClub[]>
  if (!filtre.teacherId) return out
  for (const c of clubs) {
    if (c.archive || c.teacherId !== filtre.teacherId || clubTermine(c, filtre.aPartirDe)) continue
    const nb = inscritsActifs(inscriptions, c.id).length
    for (const s of c.seances) {
      out[s.jour].push({ clubId: c.id, label: libelleBlocClub(libelleClub(c), nb), start: s.heureDebut, end: s.heureFin, nbInscrits: nb, salleId: s.salleId })
    }
  }
  JOURS_CLUB.forEach((j) => out[j].sort((a, b) => a.start.localeCompare(b.start)))
  return out
}
