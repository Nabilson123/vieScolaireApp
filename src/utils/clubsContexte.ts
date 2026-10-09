import { timeToMinutes } from '../data/classSchedules'
import type { Club, ClubInscription, JourClub } from '../data/clubs'
import { fullLabel } from '../data/salles'
import { JOUR_LABELS } from '../data/soutien'
import { teacherName } from '../data/teachers'
import { getClubInscriptionsSnapshot, getClubsSnapshot } from '../services/clubsService'
import { getSallesSnapshot } from '../services/sallesService'
import { getStudentsSnapshot } from '../services/studentsService'
import { getTeachersSnapshot } from '../services/teachersService'
import { debutDuClub, finDuClub, inscritsActifs, listeAttente } from './clubs'
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

export function salleDuClub(club: Pick<Club, 'salleId'>): string {
  if (!club.salleId) return ''
  const salle = getSallesSnapshot().find((s) => s.id === club.salleId)
  return salle ? fullLabel(salle) : ''
}

// ───────────────────────── Avertissements de conflit ─────────────────────────

export interface BrouillonClub {
  /** Absent à la création ; sert à ne pas comparer le club avec lui-même à la modification. */
  id?: string
  nom: string
  jour: JourClub
  heureDebut: string
  heureFin: string
  teacherId: string | null
  salleId: string | null
  moisDebut: string
  moisFin: string
}

function seChevauchent(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd)
}

/**
 * Avertissements (jamais bloquants) quand on crée ou modifie un club : l'enseignant a cours, un rendez-vous, un soutien ou
 * un autre club au même moment ; la salle est prise par un cours, une réservation, un soutien ou un autre club.
 */
export function conflitsClub(b: BrouillonClub): ConflitSeance[] {
  if (!b.heureDebut || !b.heureFin || timeToMinutes(b.heureFin) <= timeToMinutes(b.heureDebut)) return []
  const debut = debutDuClub(b)
  const fin = finDuClub(b)
  if (!debut || !fin || fin < debut) return []

  const out = conflitsSeance(
    { matiere: b.nom, jour: b.jour, heureDebut: b.heureDebut, heureFin: b.heureFin, teacherId: b.teacherId, salleId: b.salleId, dateDebut: debut, dateFin: fin, datesAnnulees: [], studentIds: [] },
    buildConflitsContext(),
  )

  const jourTxt = JOUR_LABELS[b.jour].toLowerCase()
  const autres = getClubsSnapshot().filter((c) => c.id !== b.id && !c.archive && c.jour === b.jour && seChevauchent(b.heureDebut, b.heureFin, c.heureDebut, c.heureFin) && debut <= finDuClub(c) && debutDuClub(c) <= fin)
  for (const c of autres) {
    if (b.teacherId && c.teacherId === b.teacherId) {
      out.push({ type: 'enseignant_autre_seance', message: `L'enseignant encadre déjà le club « ${c.nom} » ${jourTxt} de ${c.heureDebut} à ${c.heureFin}.` })
    }
    if (b.salleId && c.salleId === b.salleId) {
      out.push({ type: 'salle_autre_seance', message: `La salle est déjà utilisée par le club « ${c.nom} » ${jourTxt} de ${c.heureDebut} à ${c.heureFin}.` })
    }
  }
  return out
}

/** Heure de départ du transport du soir de l'élève si le club se termine après (sinon `null`) : simple avertissement. */
export function alerteTransportClub(club: Pick<Club, 'heureFin'>, studentId: string): string | null {
  return alerteCar({ heureFin: club.heureFin }, transportInfoOf(studentId))
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
