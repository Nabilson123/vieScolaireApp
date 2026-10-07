import { minutesToTime, timeToMinutes } from '../data/classSchedules'
import { teacherName } from '../data/teachers'
import { getClassScheduleSnapshot, getAllClassSchedulesSnapshot } from '../services/classSchedulesService'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import { getStudentsSnapshot } from '../services/studentsService'
import { getSuiviProfsSnapshot } from '../services/suiviProfsService'
import { getReservationsSallesSnapshot } from '../services/reservationsSallesService'
import { getSoutienInscriptionsSnapshot, getSoutienSeancesSnapshot } from '../services/soutienService'
import { getTeachersSnapshot } from '../services/teachersService'
import { getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { getServicesCapaciteSnapshot } from '../services/servicesCapaciteService'
import { infoTransportEleve, rapportParClasse, type ConflitsContext, type InfoTransportSoutien, type PlageOccupee, type RapportClasse } from './soutien'
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
