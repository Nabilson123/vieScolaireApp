import { timeToMinutes } from '../data/classSchedules'
import { MODE_REGLEMENT_LABELS, libelleClub, type Club, type ClubInscription, type ClubReglement, type ClubSeance } from '../data/clubs'
import { fullLabel } from '../data/salles'
import { JOUR_LABELS } from '../data/soutien'
import { teacherName } from '../data/teachers'
import { getClubEcheancesSnapshot, getClubInscriptionsSnapshot, getClubsSnapshot } from '../services/clubsService'
import { getClubImputationsSnapshot, getClubReglementsSnapshot } from '../services/clubsPaiementsService'
import { getSallesSnapshot } from '../services/sallesService'
import { getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { getStudentsSnapshot } from '../services/studentsService'
import { getTeachersSnapshot } from '../services/teachersService'
import { debutDuClub, finDuClub, inscritsActifs, listeAttente } from './clubs'
import { cleFamille, formatDH, libelleFamille, libelleMois, lignesMensualites, montantEnLettres, paiementsParEcheance, type EleveFinance } from './clubsFinance'
import { alerteCar, conflitsSeance, parClasseNom, type ConflitSeance } from './soutien'
import { buildConflitsContext, transportInfoOf } from './soutienContexte'

// Colle entre la logique pure des clubs et les données réelles de l'application (élèves, enseignants, salles, emplois du temps).

/** Encadrant d'un club : l'enseignant de l'école, sinon l'intervenant externe, sinon vide. */
export function encadrantDuClub(club: Pick<Club, 'teacherId' | 'intervenantNom'>): string {
  if (club.teacherId) {
    const prof = getTeachersSnapshot().find((t) => t.id === club.teacherId)
    if (prof) return teacherName(prof)
  }
  return club.intervenantNom.trim()
}

/** Nom d'une salle (« Bâtiment Primaire - Salle 5 »), vide si elle n'est pas renseignée ou n'existe plus. */
export function nomSalle(salleId: string | null): string {
  if (!salleId) return ''
  const salle = getSallesSnapshot().find((s) => s.id === salleId)
  return salle ? fullLabel(salle) : ''
}

/** Salles du club : celles de ses séances, sans doublon (« Terrain, Salle 3 »), vide si aucune n'est renseignée. */
export function salleDuClub(club: Pick<Club, 'seances'>): string {
  return [...new Set(club.seances.map((s) => nomSalle(s.salleId)).filter(Boolean))].join(', ')
}

// ───────────────────────── Avertissements de conflit ─────────────────────────

export interface BrouillonClub {
  /** Absent à la création ; sert à ne pas comparer le club avec lui-même à la modification. */
  id?: string
  nom: string
  categorie: string
  seances: ClubSeance[]
  teacherId: string | null
  moisDebut: string
  moisFin: string
}

function seChevauchent(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd)
}

const seanceValide = (s: ClubSeance) => !!s.heureDebut && !!s.heureFin && timeToMinutes(s.heureFin) > timeToMinutes(s.heureDebut)

/**
 * Avertissements (jamais bloquants) quand on crée ou modifie un club, séance par séance : l'enseignant a cours, un
 * rendez-vous, un soutien ou un autre club au même moment ; la salle est prise par un cours, une réservation, un soutien ou
 * un autre club ; deux séances du club se chevauchent.
 */
export function conflitsClub(b: BrouillonClub): ConflitSeance[] {
  const debut = debutDuClub(b)
  const fin = finDuClub(b)
  if (!debut || !fin || fin < debut) return []
  const seances = b.seances.filter(seanceValide)
  const contexte = buildConflitsContext()
  const nom = libelleClub(b)

  const out: ConflitSeance[] = []
  for (const s of seances) {
    out.push(
      ...conflitsSeance(
        { matiere: nom, jour: s.jour, heureDebut: s.heureDebut, heureFin: s.heureFin, teacherId: b.teacherId, salleId: s.salleId, dateDebut: debut, dateFin: fin, datesAnnulees: [], studentIds: [] },
        contexte,
      ),
    )
  }

  // Deux séances du même club ne peuvent pas se chevaucher (même encadrant, même groupe).
  seances.forEach((s, i) => {
    seances.slice(i + 1).forEach((t) => {
      if (s.jour === t.jour && seChevauchent(s.heureDebut, s.heureFin, t.heureDebut, t.heureFin)) {
        out.push({ type: 'enseignant_autre_seance', message: `Deux séances du club se chevauchent le ${JOUR_LABELS[s.jour].toLowerCase()} (${s.heureDebut}–${s.heureFin} et ${t.heureDebut}–${t.heureFin}).` })
      }
    })
  })

  const autres = getClubsSnapshot().filter((c) => c.id !== b.id && !c.archive && debut <= finDuClub(c) && debutDuClub(c) <= fin)
  for (const s of seances) {
    const jourTxt = JOUR_LABELS[s.jour].toLowerCase()
    for (const c of autres) {
      for (const cs of c.seances) {
        if (cs.jour !== s.jour || !seChevauchent(s.heureDebut, s.heureFin, cs.heureDebut, cs.heureFin)) continue
        if (b.teacherId && c.teacherId === b.teacherId) {
          out.push({ type: 'enseignant_autre_seance', message: `L'enseignant encadre déjà le club « ${libelleClub(c)} » ${jourTxt} de ${cs.heureDebut} à ${cs.heureFin}.` })
        }
        if (s.salleId && cs.salleId === s.salleId) {
          out.push({ type: 'salle_autre_seance', message: `La salle est déjà utilisée par le club « ${libelleClub(c)} » ${jourTxt} de ${cs.heureDebut} à ${cs.heureFin}.` })
        }
      }
    }
  }
  return out
}

/** Heure de départ du transport du soir de l'élève si une séance du club se termine après (sinon `null`) : simple avertissement. */
export function alerteTransportClub(club: Pick<Club, 'seances'>, studentId: string): string | null {
  const transport = transportInfoOf(studentId)
  for (const s of club.seances) {
    const depart = alerteCar({ heureFin: s.heureFin }, transport)
    if (depart) return depart
  }
  return null
}

// ───────────────────────── Listes imprimables ─────────────────────────

export interface LigneEleveClub {
  studentId: string
  name: string
  classe: string
  dateInscription: string
}

export interface FeuilleClub {
  club: Club
  encadrant: string
  salle: string
  /** Inscrits actifs, par niveau puis classe puis nom. */
  inscrits: LigneEleveClub[]
  /** Liste d'attente, par ordre d'arrivée. */
  attente: LigneEleveClub[]
}

function ligneEleve(inscription: ClubInscription, eleves: Map<string, { name: string; classe: string }>): LigneEleveClub | null {
  const s = eleves.get(inscription.studentId)
  return s ? { studentId: inscription.studentId, name: s.name, classe: s.classe, dateInscription: inscription.dateInscription } : null
}

/** Données de la liste d'inscrits (et de la feuille de présence) d'un club. */
export function feuilleDuClub(club: Club): FeuilleClub {
  const eleves = new Map(getStudentsSnapshot().map((s) => [s.id, { name: s.name, classe: s.classe }]))
  const inscriptions = getClubInscriptionsSnapshot()
  const enLignes = (liste: ClubInscription[]) => liste.map((i) => ligneEleve(i, eleves)).filter((l): l is LigneEleveClub => l !== null)
  return {
    club,
    encadrant: encadrantDuClub(club),
    salle: salleDuClub(club),
    inscrits: enLignes(inscritsActifs(inscriptions, club.id)).sort(parClasseNom),
    attente: enLignes(listeAttente(inscriptions, club.id)),
  }
}

// ───────────────────────── Reçu de paiement ─────────────────────────

/** Les élèves inscrits aux clubs, avec leur famille (clé et libellé), d'après les données chargées. */
function elevesFinanceDeLEcole(): Map<string, EleveFinance> {
  const concernes = new Set(getClubInscriptionsSnapshot().map((i) => i.studentId))
  const parId = new Map<string, EleveFinance>()
  for (const s of getStudentsSnapshot()) {
    if (!concernes.has(s.id)) continue
    const identity = getStudentIdentitySnapshot(s.id)
    parId.set(s.id, { name: s.name, classe: s.classe, familleCle: cleFamille(identity, s.id), familleLibelle: libelleFamille(identity, s.name) })
  }
  return parId
}

export interface LigneRecu {
  studentNom: string
  classe: string
  clubNom: string
  mois: string
  montantCentimes: number
}

export interface SoldeClubRecu {
  clubNom: string
  /** Reste dû, à la date du règlement, sur les mensualités déjà échues. */
  resteEchuCentimes: number
  /** Reste sur les mensualités à venir déjà créées. */
  resteAVenirCentimes: number
}

export interface DonneesRecu {
  reglement: ClubReglement
  lignes: LigneRecu[]
  /** « cent cinquante dirhams », sans majuscule. */
  enLettres: string
  /** Situation de la famille juste après ce règlement (les règlements enregistrés plus tard ne comptent pas). */
  soldeParClub: SoldeClubRecu[]
  resteEchuTotalCentimes: number
  resteAVenirTotalCentimes: number
}

/** Données du reçu d'un règlement : ce qu'il paie (élève, club, mois), le montant en lettres et le solde restant de la famille après lui. */
export function recuDuReglement(reglement: ClubReglement): DonneesRecu {
  const eleves = elevesFinanceDeLEcole()
  const clubs = getClubsSnapshot()
  const inscriptions = getClubInscriptionsSnapshot()
  const echeances = getClubEcheancesSnapshot()
  const imputations = getClubImputationsSnapshot()

  const echeanceParId = new Map(echeances.map((e) => [e.id, e]))
  const inscriptionParId = new Map(inscriptions.map((i) => [i.id, i]))
  const clubParId = new Map(clubs.map((c) => [c.id, c]))

  const lignes: LigneRecu[] = []
  for (const imp of imputations.filter((i) => i.reglementId === reglement.id)) {
    const echeance = echeanceParId.get(imp.echeanceId)
    const inscription = echeance ? inscriptionParId.get(echeance.inscriptionId) : undefined
    const club = inscription ? clubParId.get(inscription.clubId) : undefined
    if (!echeance || !inscription || !club) continue
    const eleve = eleves.get(inscription.studentId)
    lignes.push({ studentNom: eleve?.name ?? 'Élève introuvable', classe: eleve?.classe ?? '', clubNom: libelleClub(club), mois: echeance.mois, montantCentimes: imp.montantCentimes })
  }
  lignes.sort((a, b) => a.mois.localeCompare(b.mois) || a.clubNom.localeCompare(b.clubNom, 'fr') || a.studentNom.localeCompare(b.studentNom, 'fr'))

  // Situation juste après ce règlement : seuls les règlements enregistrés jusque-là comptent.
  const paiements = paiementsParEcheance(imputations, getClubReglementsSnapshot(), reglement)
  const siennes = lignesMensualites({ clubs, inscriptions, echeances, paiements, eleves, aujourdhui: reglement.dateReglement }).filter((l) => l.familleCle === reglement.familleCle)
  const parClub = new Map<string, SoldeClubRecu>()
  for (const l of siennes) {
    const s = parClub.get(l.clubId) ?? { clubNom: l.clubNom, resteEchuCentimes: 0, resteAVenirCentimes: 0 }
    if (l.dateEcheance <= reglement.dateReglement) s.resteEchuCentimes += l.resteCentimes
    else s.resteAVenirCentimes += l.resteCentimes
    parClub.set(l.clubId, s)
  }
  const soldeParClub = [...parClub.values()].sort((a, b) => a.clubNom.localeCompare(b.clubNom, 'fr'))
  return {
    reglement,
    lignes,
    enLettres: montantEnLettres(reglement.montantCentimes),
    soldeParClub,
    resteEchuTotalCentimes: soldeParClub.reduce((n, s) => n + s.resteEchuCentimes, 0),
    resteAVenirTotalCentimes: soldeParClub.reduce((n, s) => n + s.resteAVenirCentimes, 0),
  }
}

// ───────────────────────── Journal des encaissements ─────────────────────────

export interface LigneJournal {
  numero: string
  dateReglement: string
  famille: string
  mode: string
  reference: string
  /** Montant en dirhams (pas en centimes) pour le tableur. */
  montantDh: number
  statut: 'Valide' | 'Annulé'
  motifAnnulation: string
  /** « Adam ALAMI (Robotique, octobre 2026 : 150,00 DH) ; … » */
  detail: string
}

/** Tous les règlements de l'année, du plus ancien au plus récent, avec ce qu'ils paient : de quoi tenir la caisse et la comptabilité. */
export function journalEncaissements(): LigneJournal[] {
  return [...getClubReglementsSnapshot()]
    .sort((a, b) => a.numero.localeCompare(b.numero))
    .map((r) => ({
      numero: r.numero,
      dateReglement: r.dateReglement,
      famille: r.familleLibelle,
      mode: MODE_REGLEMENT_LABELS[r.mode],
      reference: r.reference,
      montantDh: r.montantCentimes / 100,
      statut: r.statut === 'annule' ? 'Annulé' : 'Valide',
      motifAnnulation: r.motifAnnulation,
      detail: recuDuReglement(r)
        .lignes.map((l) => `${l.studentNom} (${l.clubNom}, ${libelleMois(l.mois)} : ${formatDH(l.montantCentimes)})`)
        .join(' ; '),
    }))
}
