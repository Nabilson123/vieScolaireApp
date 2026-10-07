import { minutesToTime, timeToMinutes } from '../data/classSchedules'
import { fullLabel } from '../data/salles'
import type { SoutienSeance } from '../data/soutien'
import { teacherName } from '../data/teachers'
import { getClassScheduleSnapshot, getAllClassSchedulesSnapshot } from '../services/classSchedulesService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { getStudentsSnapshot } from '../services/studentsService'
import { getSuiviProfsSnapshot } from '../services/suiviProfsService'
import { getReservationsSallesSnapshot } from '../services/reservationsSallesService'
import { getSoutienInscriptionsSnapshot, getSoutienSeancesSnapshot } from '../services/soutienService'
import { getSallesSnapshot } from '../services/sallesService'
import { getTeachersSnapshot } from '../services/teachersService'
import { getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { getServicesCapaciteSnapshot } from '../services/servicesCapaciteService'
import { infoTransportEleve, rapportParClasse, soutienDuJour, sortieSeule, type ConflitsContext, type InfoTransportSoutien, type PlageOccupee, type RapportClasse, type SoutienDuJourLigne } from './soutien'
import { aujourdhuiLocalISO } from './soutienSeances'

/**
 * Données réelles de l'application pour `conflitsSeance` : emplois du temps des classes, réservations de salles,
 * rendez-vous parents et suivis où figure l'enseignant, et classe de chaque élève. Lues au moment de l'appel.
 */
export function buildConflitsContext(): ConflitsContext {
  const classeParEleve = new Map(getStudentsSnapshot().map((s) => [s.id, s.classe]))
  const nomParEnseignant = new Map(getTeachersSnapshot().map((t) => [t.id, teacherName(t)]))
  const plannings = getAllClassSchedulesSnapshot()

  return {
    seances: getSoutienSeancesSnapshot(),
    inscriptions: getSoutienInscriptionsSnapshot(),
    coursEnseignant: (teacherId, jour) =>
      Object.entries(plannings).flatMap(([classe, semaine]) =>
        (semaine[jour] ?? []).filter((c) => c.teacherId === teacherId).map((c) => ({ start: c.start, end: c.end, libelle: `${classe} ${c.subject}` })),
      ),
    coursSalle: (salleId, jour) =>
      Object.entries(plannings).flatMap(([classe, semaine]) =>
        (semaine[jour] ?? []).filter((c) => c.salleId === salleId).map((c) => ({ start: c.start, end: c.end, libelle: `${classe} ${c.subject}` })),
      ),
    coursClasse: (classe, jour) => (getClassScheduleSnapshot(classe)[jour] ?? []).map((c) => ({ start: c.start, end: c.end, libelle: c.subject })),
    classeDe: (studentId) => classeParEleve.get(studentId),
    reservationsSalle: (salleId, dateISO) =>
      getReservationsSallesSnapshot()
        .filter((r) => r.salleId === salleId && r.date === dateISO)
        .map((r) => ({ start: r.heureDebut.slice(0, 5), end: r.heureFin.slice(0, 5), libelle: r.titre })),
    occupationEnseignant: (teacherId, dateISO) => {
      const nom = nomParEnseignant.get(teacherId)
      const plages: PlageOccupee[] = []
      if (nom) {
        getStudentsSnapshot().forEach((s) => {
          getStudentExtraSnapshot(s.id).rendezVous.forEach((r) => {
            if (r.date !== dateISO || r.statut === 'Annulé' || !r.enseignants.includes(nom)) return
            plages.push({ start: r.heure, end: minutesToTime(timeToMinutes(r.heure) + r.duree), libelle: 'rendez-vous parent' })
          })
        })
      }
      getSuiviProfsSnapshot().forEach((sp) => {
        if (sp.date !== dateISO || sp.statut === 'Annulé' || !sp.teacherIds.includes(teacherId)) return
        plages.push({ start: sp.heure, end: minutesToTime(timeToMinutes(sp.heure) + sp.duree), libelle: 'suivi pédagogique' })
      })
      return plages
    },
  }
}

/** Car du soir d'un élève, d'après sa fiche (transport, ligne du soir) et les horaires configurés. */
export function transportInfoOf(studentId: string): InfoTransportSoutien {
  const student = getStudentsSnapshot().find((s) => s.id === studentId)
  if (!student) return { aTransportSoir: false, ligneSoir: null, depart: null, heureDepart: '' }
  return infoTransportEleve(student, getStudentIdentitySnapshot(studentId), getServicesCapaciteSnapshot() ?? undefined)
}

/** Rapport par classe (transport, sortie seul(e), soutien) d'après les données de l'application, séances non closes. */
export function rapportDeLEcole(classes?: string[]): RapportClasse[] {
  return rapportParClasse({
    eleves: getStudentsSnapshot().map((student) => ({
      student,
      identity: getStudentIdentitySnapshot(student.id),
      cantine: getStudentExtraSnapshot(student.id).cantine,
    })),
    capacite: getServicesCapaciteSnapshot() ?? undefined,
    seances: getSoutienSeancesSnapshot(),
    inscriptions: getSoutienInscriptionsSnapshot(),
    aPartirDe: aujourdhuiLocalISO(),
    classes,
  })
}

export interface FeuilleSeance {
  seance: SoutienSeance
  enseignant: string
  salle: string
  /** Élèves dont les parents ont confirmé, avec la façon dont ils quittent l'école après la séance. */
  confirmes: { studentId: string; name: string; classe: string; sortie: string }[]
  /** Élèves dont la réponse est attendue. */
  enAttente: { name: string; classe: string }[]
  nePasRestent: number
}

/** Données de la feuille imprimable d'une séance : qui reste, et comment chacun repart. */
export function feuilleDeSeance(seance: SoutienSeance): FeuilleSeance {
  const students = new Map(getStudentsSnapshot().map((s) => [s.id, s]))
  const prof = seance.teacherId ? getTeachersSnapshot().find((t) => t.id === seance.teacherId) : undefined
  const salle = seance.salleId ? getSallesSnapshot().find((s) => s.id === seance.salleId) : undefined
  const inscrits = getSoutienInscriptionsSnapshot().filter((i) => i.seanceId === seance.id)
  const tri = (a: { classe: string; name: string }, b: { classe: string; name: string }) => a.classe.localeCompare(b.classe, 'fr') || a.name.localeCompare(b.name, 'fr')

  const confirmes: FeuilleSeance['confirmes'] = []
  const enAttente: FeuilleSeance['enAttente'] = []
  inscrits.forEach((i) => {
    const s = students.get(i.studentId)
    if (!s) return
    if (i.statut === 'reste') {
      const seul = sortieSeule(getStudentExtraSnapshot(s.id).cantine).seul
      const car = transportInfoOf(s.id).aTransportSoir
      confirmes.push({ studentId: s.id, name: s.name, classe: s.classe, sortie: seul ? 'Sort seul(e)' : car ? 'Habituellement au car : non assuré ce jour' : 'Récupéré par les parents' })
    } else if (i.statut === 'a_confirmer') enAttente.push({ name: s.name, classe: s.classe })
  })
  return {
    seance,
    enseignant: prof ? teacherName(prof) : '',
    salle: salle ? fullLabel(salle) : '',
    confirmes: confirmes.sort(tri),
    enAttente: enAttente.sort(tri),
    nePasRestent: inscrits.filter((i) => i.statut === 'ne_reste_pas').length,
  }
}

/** Séances de soutien du jour pour le Cockpit, avec le nom de l'enseignant. */
export function soutienDuJourDeLEcole(dateISO: string, nowMinutes: number): (SoutienDuJourLigne & { enseignant: string })[] {
  const students = new Map(getStudentsSnapshot().map((s) => [s.id, s]))
  const teachers = new Map(getTeachersSnapshot().map((t) => [t.id, teacherName(t)]))
  const seances = getSoutienSeancesSnapshot()
  return soutienDuJour(seances, getSoutienInscriptionsSnapshot(), dateISO, nowMinutes, {
    nom: (id) => students.get(id)?.name ?? '',
    aTransportSoir: (id) => transportInfoOf(id).aTransportSoir,
  }).map((l) => {
    const teacherId = seances.find((s) => s.id === l.seanceId)?.teacherId
    return { ...l, enseignant: (teacherId && teachers.get(teacherId)) || '' }
  })
}
