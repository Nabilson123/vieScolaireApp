import type { SoutienSeance } from '../data/soutien'
import { teacherName } from '../data/teachers'
import { fullLabel } from '../data/salles'
import { getMatieresConfigSnapshot } from '../services/matieresConfigService'
import { getSallesSnapshot } from '../services/sallesService'
import { getStudentIdentitySnapshot } from '../services/studentIdentityService'
import { getStudentsSnapshot } from '../services/studentsService'
import { getTeachersSnapshot } from '../services/teachersService'
import { normalizeText } from './textMatch'
import { aujourdhuiLocalISO, prochaineOccurrence } from './soutienSeances'
import { transportInfoOf } from './soutienContexte'
import { buildSoutienMessage, type ReclamationMessageLang, type SoutienMessageKind } from './whatsapp'

/** Noms arabes usuels des matières, repris quand le référentiel n'en renseigne pas (clés sans accent ni majuscule). Le nom saisi
 * dans Référentiel > Matières, s'il existe, passe avant. Textes à faire relire par la direction. */
const MATIERES_AR: Record<string, string> = {
  'education islamique': 'التربية الإسلامية',
  'langue arabe': 'اللغة العربية',
  francais: 'اللغة الفرنسية',
  mathematiques: 'الرياضيات',
  anglais: 'اللغة الإنجليزية',
  'physique chimie': 'الفيزياء والكيمياء',
  svt: 'علوم الحياة والأرض',
  'histoire geographie': 'التاريخ والجغرافيا',
  informatique: 'المعلوميات',
  'arts plastiques': 'التربية التشكيلية',
  sport: 'التربية البدنية',
  communication: 'التواصل',
  'eveil scientifique': 'النشاط العلمي',
}

/** Nom arabe d'une matière : celui du référentiel s'il existe, sinon le nom usuel ; rien pour une matière inconnue. */
export function nomArabeMatiere(matiere: string, nomAr?: string): string | undefined {
  return nomAr?.trim() || MATIERES_AR[normalizeText(matiere)]
}

export interface ParentEleve {
  key: 'p1' | 'p2'
  nom: string
  fallback: string
  phone: string
}

/** Parents de la fiche élève qui ont un nom ou un numéro (le parent 1 en premier). */
export function parentsDeLEleve(studentId: string): ParentEleve[] {
  const id = getStudentIdentitySnapshot(studentId)
  const parents: ParentEleve[] = [
    { key: 'p1', nom: `${id.parent1Prenom} ${id.parent1Nom}`.trim(), fallback: 'Parent 1', phone: id.parent1Tel?.trim() ?? '' },
    { key: 'p2', nom: `${id.parent2Prenom} ${id.parent2Nom}`.trim(), fallback: 'Parent 2', phone: id.parent2Tel?.trim() ?? '' },
  ]
  return parents.filter((p) => p.nom || p.phone)
}

export interface SoutienOutbound {
  message: string
  /** Parents proposés comme destinataires. */
  parents: ParentEleve[]
  /** Parent choisi : son nom ouvre le message, son numéro sert au lien WhatsApp. */
  parent: ParentEleve | null
  recipients: { label: string; phone: string }[]
}

/**
 * Message de soutien prêt pour un élève, adressé au parent choisi (le parent 1 par défaut). Le nom arabe de l'élève et de
 * la matière sont pris dans les fiches quand ils existent ; la date annoncée est la prochaine séance qui a lieu.
 */
export function buildSoutienOutbound(seance: SoutienSeance, studentId: string, kind: SoutienMessageKind, lang: ReclamationMessageLang, parentKey?: ParentEleve['key']): SoutienOutbound {
  const student = getStudentsSnapshot().find((s) => s.id === studentId)
  const identity = getStudentIdentitySnapshot(studentId)
  const parents = parentsDeLEleve(studentId)
  const parent = parents.find((p) => p.key === parentKey) ?? parents[0] ?? null
  const transport = transportInfoOf(studentId)
  const prof = seance.teacherId ? getTeachersSnapshot().find((t) => t.id === seance.teacherId) : undefined
  const salle = seance.salleId ? getSallesSnapshot().find((s) => s.id === seance.salleId) : undefined
  const matiereAr = nomArabeMatiere(seance.matiere, getMatieresConfigSnapshot().find((m) => normalizeText(m.nom) === normalizeText(seance.matiere))?.nomAr)

  const message = buildSoutienMessage(
    kind,
    {
      parentNom: parent?.nom ?? '',
      studentName: student?.name ?? '',
      studentNameAr: `${identity.prenomAr} ${identity.nomAr}`.trim(),
      classe: student?.classe ?? '',
      matiere: seance.matiere,
      matiereAr,
      jour: seance.jour,
      heureDebut: seance.heureDebut,
      heureFin: seance.heureFin,
      aPartirDu: prochaineOccurrence(seance, aujourdhuiLocalISO()) ?? seance.dateDebut,
      jusquAu: seance.dateFin,
      enseignant: prof ? teacherName(prof) : undefined,
      salle: salle ? fullLabel(salle) : undefined,
      aTransportSoir: transport.aTransportSoir,
      ligneSoir: transport.ligneSoir,
      heureDepart: transport.heureDepart || undefined,
    },
    lang,
  )
  return { message, parents, parent, recipients: parent?.phone ? [{ label: parent.nom || parent.fallback, phone: parent.phone }] : [] }
}
