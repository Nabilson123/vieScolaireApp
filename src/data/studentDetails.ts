export interface SubjectBreakdown {
  subject: string
  color: 'blue' | 'cyan' | 'amber' | 'purple'
  absences: string
  retards: string
  total: string
  barPct: number
}

export interface EventRecord {
  date: string
  type: 'ABSENCE' | 'RETARD'
  justified: boolean
  subject: string
  subjectColor: 'blue' | 'cyan' | 'amber' | 'purple'
  duree: string
  motif: string
  start?: string
  /** Posé uniquement sur les absences auto-générées par une sortie anticipée (cours restants de la
   * journée) — permet de les retrouver et de les retirer proprement si la sortie est supprimée par
   * erreur, sans toucher aux absences saisies indépendamment. */
  sortieAnticipeeId?: string
}

export interface Evaluation {
  type: string
  value: number
  coef: number
  date: string
  author: string
  appreciation?: string
}

export interface NoteRow {
  subject: string
  coef: number
  evaluations: Evaluation[]
  classeAverage: number
}

export interface ReclamationRecord {
  date: string
  statut: 'En cours' | 'Résolue' | 'En attente'
  type: string
  objet: string
  description: string
  resolution: string
  enseignant: string
  parentNom: string
}

export interface CompteRenduRdvDecision {
  texte: string
  echeance: string
}

export interface CompteRenduRDV {
  administration: string
  parents: string
  enseignant: string
  redacteur: string
  signeParent: boolean
  /** Pas encore saisissable depuis RedigerCompteRenduModal.tsx — champ prévu pour le PDF individuel
   * (Phase 14), toujours absent en pratique pour l'instant ; le rendu gère ce cas proprement. */
  decisions?: CompteRenduRdvDecision[]
}

export interface RendezVousRecord {
  date: string
  heure: string
  duree: number
  statut: 'Planifié' | 'Réalisé' | 'Annulé'
  mode: 'Présentiel' | 'Virtuel'
  lieu: string
  motif: string
  notesParents?: string
  enseignant: string
  compteRendu?: CompteRenduRDV
}

export interface DisciplineEvent {
  date: string
  title: string
  description: string
  points: number
  author: string
  /** Code de la fiche du Cahier de Procédures (ex. "PD-01"), absent pour les entrées libres/historiques. */
  typeCode?: string
  /** Sanction retenue, tirée de l'échelle officielle du cahier (voir disciplineTypes.ts). */
  sanction?: string
  /** Suivi du processus (FICHE CADRE 7), uniquement quand sanction === "Conseil de discipline". */
  conseilStatut?: string
  /** Index (dans DisciplineType.procedure) des étapes réellement suivies pour ce fait précis — la
   * procédure de référence n'est pas toujours appliquée intégralement. Absent pour les entrées
   * antérieures à cette fonctionnalité ou sans procédure associée (mérites, "Autre incident"). */
  procedureStepsDone?: number[]
  /** Renseignés uniquement quand sanction === "Retenue" : date et durée de la retenue programmée. */
  retenueDate?: string
  retenueDuree?: string
  /** Précisions écrites par étape de procédure (ex. identité des témoins, ce qu'ils ont dit),
   * indexées comme procedureStepsDone. Toujours conservées dans le dossier interne de l'élève,
   * qu'elles soient imprimées ou non (voir procedureDetailsPrintable). */
  procedureStepDetails?: Record<number, string>
  /** Si vrai, procedureStepDetails est repris sur la notification imprimée remise à la famille ;
   * sinon les détails restent internes à l'application (choix fait à la saisie, cf. sensibilité
   * possible des témoignages nommant d'autres élèves). */
  procedureDetailsPrintable?: boolean
  /** Renseignés uniquement quand sanction === "Privation d'activités périscolaires/sportives" :
   * l'activité concernée (ex. "Club de football") et la durée de la privation (ex. "2 semaines"). */
  privationActivite?: string
  privationDuree?: string
}

export interface Responsable {
  name: string
  relation: string
  phone: string
}

export interface FluxRow {
  date: string
  arrivee: string
  sortie: string
  surveillant: string
}

export interface CantineInfo {
  interdictionSortie: boolean
  interdictionMessage: string
  interdictionHoraire: string
  dechargeSignee: boolean
  dechargeDate: string
  modaliteSortie: string
  responsables: Responsable[]
  formuleLunchbox: string
  rechauffage: boolean
  conservation: boolean
  alertePAI?: string
  emplacementTrousse?: string
  historiqueFlux: FluxRow[]
}

export interface OrientationMessage {
  author: string
  date: string
  message: string
}

export interface Competence {
  label: string
  active: boolean
}

export interface TimelineStep {
  date: string
  label: string
  status: 'VALIDÉ' | 'PLANIFIÉ'
}

export interface ObjectifChecklistItem {
  title: string
  subtitle: string
  status: 'atteint' | 'encours' | 'planifie'
}

export interface ProjetPersonnelInfo {
  rang: string
  filiereVisee: string
  progressionPct: number
  objectifLabel: string
  objectifSousLabel: string
  stageValide: string
  stageDetail: string
  pointFaible: string
  pointFaibleDetail: string
  evaluationPsy: string
  messages: OrientationMessage[]
  competences: Competence[]
  timeline: TimelineStep[]
  objectifsChecklist: ObjectifChecklistItem[]
}

export interface InfirmerieVisit {
  date: string
  heure: string
  motif: string
  action: string
  auteur: string
}

export interface PAIInfo {
  condition: string
  niveau: 'CRITIQUE' | 'MODÉRÉ'
  protocole: string
}

export interface SanteInfo {
  pai?: PAIInfo
  visits: InfirmerieVisit[]
}

export interface StudentExtra {
  conduite: number
  moyenne: number
  events: EventRecord[]
  notes: NoteRow[]
  discipline: DisciplineEvent[]
  cantine: CantineInfo
  projet: ProjetPersonnelInfo
  sante: SanteInfo
  reclamations: ReclamationRecord[]
  rendezVous: RendezVousRecord[]
}

export const defaultExtra: StudentExtra = {
  conduite: 20,
  moyenne: 15,
  events: [],
  notes: [],
  discipline: [],
  cantine: {
    interdictionSortie: true,
    interdictionMessage: '',
    interdictionHoraire: '',
    dechargeSignee: false,
    dechargeDate: '',
    modaliteSortie: 'Maintien sur place (Interdiction)',
    responsables: [],
    formuleLunchbox: 'Aucune inscription',
    rechauffage: false,
    conservation: false,
    historiqueFlux: [],
  },
  projet: {
    rang: '',
    filiereVisee: '',
    progressionPct: 0,
    objectifLabel: '',
    objectifSousLabel: '',
    stageValide: '',
    stageDetail: '',
    pointFaible: '',
    pointFaibleDetail: '',
    evaluationPsy: '',
    messages: [],
    competences: [],
    timeline: [],
    objectifsChecklist: [],
  },
  sante: {
    visits: [],
  },
  reclamations: [],
  rendezVous: [],
}

export const RECLAMATION_CATEGORIES = [
  'Notes',
  'Examens / Évaluations',
  'Absence / Assiduité',
  'Comportement',
  'Harcèlement / Intimidation',
  'Cantine',
  'Transport',
  'Infirmerie / Santé',
  'Pédagogie / Enseignement',
  'Emploi du temps',
  'Communication / Administration',
  'Sécurité',
  'Frais de scolarité / Facturation',
  'Inscription / Admission',
  'Activités périscolaires / Sorties',
  'Uniforme / Tenue vestimentaire',
  'Hygiène / Locaux',
  'Accueil / Réception',
  'Autre',
]

export const EVALUATION_TYPES = [
  'Contrôle Continu 1',
  'Contrôle Continu 2',
  'Contrôle Continu 3',
  'Devoir Surveillé',
  'Examen Trimestriel',
  'Autre',
]

export const subjectColorClasses: Record<SubjectBreakdown['color'], string> = {
  blue: 'bg-blue-50 text-blue-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
}

const SUBJECT_COLOR_CYCLE: SubjectBreakdown['color'][] = ['blue', 'cyan', 'amber', 'purple']

export function colorForSubject(subject: string): SubjectBreakdown['color'] {
  let hash = 0
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0
  return SUBJECT_COLOR_CYCLE[hash % SUBJECT_COLOR_CYCLE.length]
}
