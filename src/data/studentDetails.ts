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

export type ReclamationAction =
  | 'creee'
  | 'prise_en_charge'
  | 'resolue'
  | 'rouverte'
  | 'modifiee'
  | 'responsable'
  | 'message_parent'
  | 'action_creee'
  | 'accuse'
  | 'note'
  | 'suivi_famille'
  | 'urgente'

/** Une ligne de la frise chronologique d'une réclamation (qui a fait quoi, et quand). */
export interface ReclamationEvent {
  /** Date et heure ISO (UTC) de l'événement. */
  at: string
  action: ReclamationAction
  detail?: string
  auteur: string
}

/** Note sur une réclamation : réservée à l'équipe, jamais transmise au parent ni imprimée. */
export interface ReclamationNote {
  at: string
  auteur: string
  type: 'interne' | 'enseignant'
  texte: string
  /** Pour `type: 'enseignant'` : l'enseignant dont c'est la version des faits. */
  enseignant?: string
}

/** Suivi de la famille après la résolution : la solution a-t-elle convenu ? */
export interface ReclamationSuiviFamille {
  le: string
  issue: 'satisfaite' | 'insatisfaite' | 'sans_reponse'
  note?: string
}

export interface ReclamationRecord {
  /** Identifiant stable : une réclamation n'est plus repérée par sa position dans le tableau de
   * l'élève (qui se décale à chaque ajout/suppression). Voir `normalizeReclamations`. */
  id: string
  date: string
  statut: 'En cours' | 'Résolue' | 'En attente'
  type: string
  objet: string
  description: string
  resolution: string
  /** « Concernant » : enseignant ou service visé par la réclamation. */
  enseignant: string
  parentNom: string
  /** Nom de la personne (compte de l'app) qui suit la réclamation. */
  responsable?: string
  /** Date limite de traitement (AAAA-MM-JJ). */
  echeance?: string
  priseEnChargeLe?: string
  resoluLe?: string
  /** Force le niveau « urgent » ; sinon il se déduit de la catégorie (voir reclamationsPolicy.ts). */
  urgente?: boolean
  /** Moment (ISO) où l'accusé de réception a été envoyé à la famille. */
  accuseLe?: string
  notes?: ReclamationNote[]
  suiviFamille?: ReclamationSuiviFamille
  /** Service chargé du traitement, désigné à la main ; sinon il se déduit de la catégorie (voir
   * `serviceFor` dans utils/reclamationsServices.ts). */
  serviceId?: string
  historique: ReclamationEvent[]
}

/** Forme stockée en base : les réclamations créées avant l'ajout de l'identifiant et de la frise
 * chronologique n'ont ni `id` ni `historique`. */
export type StoredReclamationRecord = Omit<ReclamationRecord, 'id' | 'historique'> & { id?: string; historique?: ReclamationEvent[] }

/** Hachage FNV-1a 32 bits, en hexadécimal — déterministe, sans dépendance. */
function hashString(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** Identifiant d'une nouvelle réclamation. */
export function newReclamationId(): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null
  return uuid ?? `rc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Complète les anciennes réclamations : un `id` déterministe (calculé depuis le contenu, donc identique
 * à chaque lecture tant qu'il n'est pas encore enregistré ; deux réclamations strictement identiques
 * reçoivent un suffixe) et une frise vide. Appelé une seule fois à la lecture, comme
 * `normalizeRendezVous` ; l'identifiant est enregistré à la prochaine écriture du tableau. */
export function normalizeReclamations(list: StoredReclamationRecord[] | null | undefined, studentId: string): ReclamationRecord[] {
  const seen = new Map<string, number>()
  return (list ?? []).map((r) => {
    let id = r.id
    if (!id) {
      const base = `rc-${hashString([studentId, r.date, r.type, r.objet, r.description].join('|'))}`
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      id = n === 1 ? base : `${base}-${n}`
    }
    return { ...r, id, historique: r.historique ?? [] }
  })
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

export type RdvDemandeurType = 'parent1' | 'parent2' | 'administration' | 'enseignant' | 'autre'

/** Qui a demandé le rendez-vous. `nom` est le nom résolu au moment de l'enregistrement (parent de la
 * fiche élève, enseignant choisi, texte libre) — vide pour « administration ». */
export interface RdvDemandeur {
  type: RdvDemandeurType
  nom: string
}

export function demandeurLabel(d: RdvDemandeur | undefined): string {
  if (!d) return ''
  switch (d.type) {
    case 'parent1':
      return d.nom ? `Parent 1 — ${d.nom}` : 'Parent 1'
    case 'parent2':
      return d.nom ? `Parent 2 — ${d.nom}` : 'Parent 2'
    case 'administration':
      return 'Administration'
    case 'enseignant':
      return d.nom ? `Enseignant — ${d.nom}` : 'Enseignant'
    case 'autre':
      return d.nom
  }
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
  /** Enseignants concernés (liste vide = rencontre avec l'administration seulement). */
  enseignants: string[]
  demandeur?: RdvDemandeur
  /** Personne de l'administration (compte de l'app) qui anime le rendez-vous. */
  animateur?: string
  compteRendu?: CompteRenduRDV
}

/** Forme stockée en base : les rendez-vous créés avant le passage à plusieurs enseignants n'ont
 * qu'un champ texte `enseignant`. */
export type StoredRendezVousRecord = Omit<RendezVousRecord, 'enseignants'> & { enseignant?: string; enseignants?: string[] }

/** Ramène les anciens enregistrements (un seul `enseignant`) à la forme actuelle — appelé une seule
 * fois à la lecture, pour que tout le reste du code ne connaisse que `enseignants`. */
export function normalizeRendezVous(list: StoredRendezVousRecord[] | null | undefined): RendezVousRecord[] {
  return (list ?? []).map(({ enseignant, enseignants, ...rest }) => ({
    ...rest,
    enseignants: enseignants ?? (enseignant ? [enseignant] : []),
  }))
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
  /** Même fait saisi d'un coup pour plusieurs élèves : identifiant commun à leurs fiches (chacune garde sa
   * propre sanction, ses points et sa notification). Absent pour une saisie individuelle. */
  groupeId?: string
  /** Élèves victimes du fait (ex. l'élève frappé). Rien n'est écrit dans leur dossier : il affiche « victime de … »
   * en lisant ce champ, donc aucun point ni effet sur leur conduite, et supprimer cette fiche retire la mention. */
  victimeIds?: string[]
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
