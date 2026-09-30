import { getStudentsSnapshot } from '../studentsService'
import { getStudentExtraSnapshot } from '../studentDetailsService'
import { fetchAppelsParentsHistory } from '../appelsParentsService'
import { fetchSortiesAnticipees } from '../sortiesAnticipeesService'
import { getViewedYearIdSnapshot } from '../viewedYear'
import { getStudentIdentitySnapshot } from '../studentIdentityService'
import { getTransportLignesSnapshot } from '../transportLignesService'
import { getChauffeursSnapshot } from '../chauffeursService'
import { getAidesMaitressesSnapshot } from '../aidesMaitressesService'
import { getServicesCapaciteSnapshot } from '../servicesCapaciteService'
import { resolveStudentTransport } from '../../utils/transportStudentResolver'
import { computeMoyenneGenerale } from '../../utils/studentAggregation'
import { getClassScheduleSnapshot } from '../classSchedulesService'
import { SCHEDULE_DAYS } from '../../data/classSchedules'
import { getTeachersSnapshot } from '../teachersService'
import { teacherName } from '../../data/teachers'
import type { GeminiFunctionDeclaration } from './types'

export interface ReadTool {
  schema: GeminiFunctionDeclaration
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

// new RegExp(...) sur une chaîne unicode échappée plutôt qu'un littéral /[...]/ contenant des
// diacritiques combinants réels — ces caractères se corrompent facilement à la frappe/l'édition
// (cf. l'incident déjà rencontré sur GardeEvenementsTab.tsx plus tôt dans cette session).
const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS, '')
}

const rechercherEleve: ReadTool = {
  schema: {
    name: 'rechercher_eleve',
    description:
      "Recherche un ou plusieurs élèves par nom (et éventuellement classe), recherche partielle insensible à la casse/accents. À utiliser en premier pour résoudre un studentId avant tout autre outil — aucun autre moyen ne permet de retrouver un studentId à partir d'un nom.",
    parameters: {
      type: 'object',
      properties: {
        nom: { type: 'string', description: "Nom ou fragment de nom de l'élève" },
        classe: { type: 'string', description: 'Classe ou fragment de classe (optionnel, pour affiner)' },
      },
      required: ['nom'],
    },
  },
  execute: async (input) => {
    const nom = normalize(String(input.nom ?? ''))
    const classe = input.classe ? normalize(String(input.classe)) : ''
    const matches = getStudentsSnapshot().filter((s) => {
      const matchesNom = normalize(s.name).includes(nom)
      const matchesClasse = !classe || normalize(s.classe).includes(classe)
      return matchesNom && matchesClasse
    })
    return matches.slice(0, 20).map((s) => ({ studentId: s.id, name: s.name, classe: s.classe }))
  },
}

const obtenirAbsencesRetardsEleve: ReadTool = {
  schema: {
    name: 'obtenir_absences_retards_eleve',
    description: "Retourne l'historique des absences et retards d'un élève (justifié ou non, matière, date, durée).",
    parameters: {
      type: 'object',
      properties: { studentId: { type: 'string', description: 'Obtenu via rechercher_eleve' } },
      required: ['studentId'],
    },
  },
  execute: async (input) => getStudentExtraSnapshot(String(input.studentId ?? '')).events,
}

const obtenirReclamationsEleve: ReadTool = {
  schema: {
    name: 'obtenir_reclamations_eleve',
    description:
      "Retourne l'historique des réclamations déjà enregistrées pour un élève — utile aussi pour vérifier qu'une réclamation similaire n'existe pas déjà avant d'en créer une nouvelle.",
    parameters: {
      type: 'object',
      properties: { studentId: { type: 'string', description: 'Obtenu via rechercher_eleve' } },
      required: ['studentId'],
    },
  },
  execute: async (input) => getStudentExtraSnapshot(String(input.studentId ?? '')).reclamations,
}

const obtenirAppelsParentsEleve: ReadTool = {
  schema: {
    name: 'obtenir_appels_parents_eleve',
    description: "Retourne l'historique des appels aux parents d'un élève pour l'année scolaire consultée.",
    parameters: {
      type: 'object',
      properties: { studentId: { type: 'string', description: 'Obtenu via rechercher_eleve' } },
      required: ['studentId'],
    },
  },
  execute: async (input) => {
    const studentId = String(input.studentId ?? '')
    const history = await fetchAppelsParentsHistory(getViewedYearIdSnapshot())
    return history.filter((a) => a.studentId === studentId)
  },
}

const obtenirSortiesAnticipeesEleve: ReadTool = {
  schema: {
    name: 'obtenir_sorties_anticipees_eleve',
    description: "Retourne l'historique des sorties anticipées déclarées pour un élève.",
    parameters: {
      type: 'object',
      properties: { studentId: { type: 'string', description: 'Obtenu via rechercher_eleve' } },
      required: ['studentId'],
    },
  },
  execute: async (input) => {
    const studentId = String(input.studentId ?? '')
    const all = await fetchSortiesAnticipees()
    return all.filter((s) => s.studentId === studentId)
  },
}

const obtenirEffectifsParClasse: ReadTool = {
  schema: {
    name: 'obtenir_effectifs_par_classe',
    description:
      "Retourne le nombre d'élèves de chaque classe, trié du plus grand au plus petit effectif — utile pour répondre à des questions comme \"quelle est la classe la plus/moins peuplée\" ou \"combien d'élèves dans telle classe\".",
    parameters: { type: 'object', properties: {} },
  },
  execute: async () => {
    const counts = new Map<string, number>()
    getStudentsSnapshot().forEach((s) => counts.set(s.classe, (counts.get(s.classe) ?? 0) + 1))
    return Array.from(counts.entries())
      .map(([classe, effectif]) => ({ classe, effectif }))
      .sort((a, b) => b.effectif - a.effectif)
  },
}

const obtenirDisciplineEleve: ReadTool = {
  schema: {
    name: 'obtenir_discipline_eleve',
    description: "Retourne l'historique disciplinaire d'un élève (incidents, points, sanctions, auteur, date).",
    parameters: {
      type: 'object',
      properties: { studentId: { type: 'string', description: 'Obtenu via rechercher_eleve' } },
      required: ['studentId'],
    },
  },
  execute: async (input) => getStudentExtraSnapshot(String(input.studentId ?? '')).discipline,
}

const obtenirNotesEleve: ReadTool = {
  schema: {
    name: 'obtenir_notes_eleve',
    description: "Retourne les notes d'un élève par matière (avec coefficient et moyenne de classe) ainsi que sa moyenne générale pondérée.",
    parameters: {
      type: 'object',
      properties: { studentId: { type: 'string', description: 'Obtenu via rechercher_eleve' } },
      required: ['studentId'],
    },
  },
  execute: async (input) => {
    const notes = getStudentExtraSnapshot(String(input.studentId ?? '')).notes
    return { notes, moyenneGenerale: computeMoyenneGenerale(notes) }
  },
}

const obtenirTransportEleve: ReadTool = {
  schema: {
    name: 'obtenir_transport_eleve',
    description: "Retourne les informations de transport scolaire d'un élève (affecté ou non, ligne du matin/soir, chauffeur, horaires).",
    parameters: {
      type: 'object',
      properties: { studentId: { type: 'string', description: 'Obtenu via rechercher_eleve' } },
      required: ['studentId'],
    },
  },
  execute: async (input) => {
    const studentId = String(input.studentId ?? '')
    const student = getStudentsSnapshot().find((s) => s.id === studentId)
    if (!student) return { error: 'Élève introuvable' }
    const identity = getStudentIdentitySnapshot(studentId)
    return resolveStudentTransport(
      student,
      identity,
      getTransportLignesSnapshot(),
      getChauffeursSnapshot(),
      getAidesMaitressesSnapshot(),
      getServicesCapaciteSnapshot() ?? undefined
    )
  },
}

const obtenirEmploiDuTempsEleve: ReadTool = {
  schema: {
    name: 'obtenir_emploi_du_temps_eleve',
    description:
      "Retourne l'emploi du temps hebdomadaire (récurrent, sans dates précises) de la classe d'un élève — matière, enseignant, horaires. L'emploi du temps n'a pas cours le samedi ni le dimanche (semaine scolaire : LUNDI à VENDREDI seulement). Convertir toute date/jour relatif (\"demain\", \"aujourd'hui\") en un jour de cette liste avant d'appeler cet outil, à partir de la date du jour donnée en système.",
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: 'Obtenu via rechercher_eleve' },
        jour: { type: 'string', enum: SCHEDULE_DAYS, description: 'Jour précis à consulter ; si omis, retourne toute la semaine' },
      },
      required: ['studentId'],
    },
  },
  execute: async (input) => {
    const studentId = String(input.studentId ?? '')
    const student = getStudentsSnapshot().find((s) => s.id === studentId)
    if (!student) return { error: 'Élève introuvable' }
    const schedule = getClassScheduleSnapshot(student.classe)
    const teachers = getTeachersSnapshot()
    const days = input.jour ? [String(input.jour)] : SCHEDULE_DAYS
    const result: Record<string, unknown> = { classe: student.classe }
    days.forEach((day) => {
      result[day] = (schedule[day] ?? []).map((slot) => {
        const teacher = teachers.find((t) => t.id === slot.teacherId)
        return { matiere: slot.subject, enseignant: teacher ? teacherName(teacher) : 'Non assigné', debut: slot.start, fin: slot.end }
      })
    })
    return result
  },
}

export const READ_TOOLS: Record<string, ReadTool> = {
  rechercher_eleve: rechercherEleve,
  obtenir_absences_retards_eleve: obtenirAbsencesRetardsEleve,
  obtenir_reclamations_eleve: obtenirReclamationsEleve,
  obtenir_appels_parents_eleve: obtenirAppelsParentsEleve,
  obtenir_sorties_anticipees_eleve: obtenirSortiesAnticipeesEleve,
  obtenir_effectifs_par_classe: obtenirEffectifsParClasse,
  obtenir_discipline_eleve: obtenirDisciplineEleve,
  obtenir_notes_eleve: obtenirNotesEleve,
  obtenir_transport_eleve: obtenirTransportEleve,
  obtenir_emploi_du_temps_eleve: obtenirEmploiDuTempsEleve,
}
