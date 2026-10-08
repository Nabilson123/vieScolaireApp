import { NIVEAUX } from '../data/referentiel'
import { timeToMinutes } from '../data/classSchedules'
import { CLASSE_DOSSIER_INCOMPLET, type Student } from '../data/students'
import type { StudentIdentity } from '../data/studentIdentity'
import type { CantineInfo, NoteRow } from '../data/studentDetails'
import type { AlertRules } from '../data/alertRules'
import {
  JOURS_SOUTIEN,
  JOUR_LABELS,
  type JourSoutien,
  type SoutienInscription,
  type SoutienSeance,
  type StatutSoutien,
} from '../data/soutien'
import type { ServicesCapacite } from '../services/servicesCapaciteService'
import { cycleOfClasse, moyenneScaleForClasse, niveauFromClasse } from './alertEngine'
import { computeSubjectMoyenne } from './studentAggregation'
import { FIN_DES_TEMPS, inscritsDeLaSeance, occurrencesSeance, seanceActiveLe, seanceTerminee } from './soutienSeances'
import { normalizeText } from './textMatch'
import { resolveStudentTransport } from './transportStudentResolver'

// ───────────────────────── Avertissements de conflit ─────────────────────────

export interface PlageOccupee {
  start: string
  end: string
  libelle: string
}

export interface BrouillonSeance {
  /** Absent à la création ; sert à ne pas comparer la séance avec elle-même à la modification. */
  id?: string
  matiere: string
  jour: JourSoutien
  heureDebut: string
  heureFin: string
  teacherId: string | null
  salleId: string | null
  dateDebut: string
  dateFin: string | null
  datesAnnulees: string[]
  studentIds: string[]
}

export interface ConflitsContext {
  seances: SoutienSeance[]
  inscriptions: SoutienInscription[]
  coursEnseignant: (teacherId: string, jour: JourSoutien) => PlageOccupee[]
  /** Rendez-vous, suivis… de l'enseignant à une date précise. */
  occupationEnseignant?: (teacherId: string, dateISO: string) => PlageOccupee[]
  coursSalle: (salleId: string, jour: JourSoutien) => PlageOccupee[]
  reservationsSalle?: (salleId: string, dateISO: string) => PlageOccupee[]
  coursClasse: (classe: string, jour: JourSoutien) => PlageOccupee[]
  classeDe: (studentId: string) => string | undefined
}

export type TypeConflit =
  | 'enseignant_cours'
  | 'enseignant_autre_seance'
  | 'enseignant_occupe'
  | 'salle_cours'
  | 'salle_reservation'
  | 'salle_autre_seance'
  | 'eleve_cours'
  | 'eleve_autre_seance'

export interface ConflitSeance {
  type: TypeConflit
  message: string
}

function seChevauchent(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd)
}

function periodesSeChevauchent(a: { dateDebut: string; dateFin: string | null }, b: { dateDebut: string; dateFin: string | null }): boolean {
  return a.dateDebut <= (b.dateFin ?? FIN_DES_TEMPS) && b.dateDebut <= (a.dateFin ?? FIN_DES_TEMPS)
}

function dateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}` : iso
}

function seanceDepuisBrouillon(b: BrouillonSeance): SoutienSeance {
  return {
    id: b.id ?? '',
    matiere: b.matiere,
    jour: b.jour,
    heureDebut: b.heureDebut,
    heureFin: b.heureFin,
    teacherId: b.teacherId,
    salleId: b.salleId,
    classes: [],
    dateDebut: b.dateDebut,
    dateFin: b.dateFin,
    datesAnnulees: b.datesAnnulees,
    note: '',
    createdAt: '',
  }
}

const NB_DATES_VERIFIEES = 24
const NB_MESSAGES_PAR_TYPE = 3

/**
 * Avertissements (jamais bloquants) quand on crée ou modifie une séance : l'enseignant a cours, un rendez-vous ou une autre
 * séance au même moment ; la salle est prise ; des élèves inscrits ont cours dans leur classe.
 */
export function conflitsSeance(brouillon: BrouillonSeance, ctx: ConflitsContext): ConflitSeance[] {
  const out: ConflitSeance[] = []
  const { jour, heureDebut, heureFin } = brouillon
  if (!heureDebut || !heureFin || timeToMinutes(heureFin) <= timeToMinutes(heureDebut)) return out
  const jourTxt = JOUR_LABELS[jour].toLowerCase()
  const seanceCourante = seanceDepuisBrouillon(brouillon)
  const autres = ctx.seances.filter((s) => s.id !== brouillon.id && s.jour === jour && seChevauchent(heureDebut, heureFin, s.heureDebut, s.heureFin) && periodesSeChevauchent(brouillon, s))

  if (brouillon.teacherId) {
    ctx.coursEnseignant(brouillon.teacherId, jour)
      .filter((p) => seChevauchent(heureDebut, heureFin, p.start, p.end))
      .slice(0, NB_MESSAGES_PAR_TYPE)
      .forEach((p) => out.push({ type: 'enseignant_cours', message: `L'enseignant a cours ${jourTxt} de ${p.start} à ${p.end} (${p.libelle}).` }))
    autres
      .filter((s) => s.teacherId === brouillon.teacherId)
      .forEach((s) => out.push({ type: 'enseignant_autre_seance', message: `L'enseignant anime déjà le soutien « ${s.matiere} » ${jourTxt} de ${s.heureDebut} à ${s.heureFin}.` }))
    if (ctx.occupationEnseignant) {
      const vues = new Set<string>()
      for (const date of occurrencesSeance(seanceCourante, { max: NB_DATES_VERIFIEES })) {
        for (const p of ctx.occupationEnseignant(brouillon.teacherId, date)) {
          if (!seChevauchent(heureDebut, heureFin, p.start, p.end)) continue
          const cle = `${date}|${p.start}|${p.end}|${p.libelle}`
          if (vues.has(cle)) continue
          vues.add(cle)
          if (vues.size <= NB_MESSAGES_PAR_TYPE) {
            out.push({ type: 'enseignant_occupe', message: `L'enseignant est pris le ${dateCourte(date)} de ${p.start} à ${p.end} (${p.libelle}).` })
          }
        }
      }
      if (vues.size > NB_MESSAGES_PAR_TYPE) {
        out.push({ type: 'enseignant_occupe', message: `…et ${vues.size - NB_MESSAGES_PAR_TYPE} autre(s) indisponibilité(s) de l'enseignant sur la période.` })
      }
    }
  }

  if (brouillon.salleId) {
    ctx.coursSalle(brouillon.salleId, jour)
      .filter((p) => seChevauchent(heureDebut, heureFin, p.start, p.end))
      .slice(0, NB_MESSAGES_PAR_TYPE)
      .forEach((p) => out.push({ type: 'salle_cours', message: `La salle est utilisée ${jourTxt} de ${p.start} à ${p.end} (${p.libelle}).` }))
    autres
      .filter((s) => s.salleId === brouillon.salleId)
      .forEach((s) => out.push({ type: 'salle_autre_seance', message: `La salle accueille déjà le soutien « ${s.matiere} » ${jourTxt} de ${s.heureDebut} à ${s.heureFin}.` }))
    if (ctx.reservationsSalle) {
      const vues = new Set<string>()
      for (const date of occurrencesSeance(seanceCourante, { max: NB_DATES_VERIFIEES })) {
        for (const p of ctx.reservationsSalle(brouillon.salleId, date)) {
          if (!seChevauchent(heureDebut, heureFin, p.start, p.end)) continue
          const cle = `${date}|${p.start}|${p.end}`
          if (vues.has(cle)) continue
          vues.add(cle)
          if (vues.size <= NB_MESSAGES_PAR_TYPE) {
            out.push({ type: 'salle_reservation', message: `La salle est réservée le ${dateCourte(date)} de ${p.start} à ${p.end} (${p.libelle || 'réservation'}).` })
          }
        }
      }
    }
  }

  // Élèves : cours de leur classe au même moment (regroupés par classe) et autre séance de soutien en même temps.
  const parClasse = new Map<string, number>()
  brouillon.studentIds.forEach((id) => {
    const classe = ctx.classeDe(id)
    if (classe) parClasse.set(classe, (parClasse.get(classe) ?? 0) + 1)
  })
  parClasse.forEach((nb, classe) => {
    const cours = ctx.coursClasse(classe, jour).find((p) => seChevauchent(heureDebut, heureFin, p.start, p.end))
    if (cours) {
      out.push({
        type: 'eleve_cours',
        message: `${nb} élève${nb > 1 ? 's' : ''} de ${classe} ${nb > 1 ? 'ont' : 'a'} cours ${jourTxt} de ${cours.start} à ${cours.end} (${cours.libelle}).`,
      })
    }
  })
  const ids = new Set(brouillon.studentIds)
  const dejaInscrits = new Set<string>()
  autres.forEach((s) => inscritsDeLaSeance(ctx.inscriptions, s.id).forEach((i) => ids.has(i.studentId) && dejaInscrits.add(i.studentId)))
  if (dejaInscrits.size > 0) {
    out.push({
      type: 'eleve_autre_seance',
      message: `${dejaInscrits.size} élève${dejaInscrits.size > 1 ? 's sont déjà inscrits' : ' est déjà inscrit'} à une autre séance de soutien au même moment.`,
    })
  }
  return out
}

// ───────────────────────── Transport et sortie seul(e) ─────────────────────────

export interface InfoTransportSoutien {
  /** L'élève prend normalement le car du soir (transport affecté, ligne du soir, pas « amené(e) par les parents »). */
  aTransportSoir: boolean
  ligneSoir: string | null
  depart: '16h' | '17h' | null
  /** HH:MM, d'après la configuration des services (16:00 ou 17:00 à défaut). */
  heureDepart: string
}

export function infoTransportEleve(student: Student, identity: StudentIdentity | undefined, capacite: ServicesCapacite | undefined): InfoTransportSoutien {
  const info = resolveStudentTransport(student, identity, [], [], [], capacite)
  const aTransportSoir = !!identity?.transport && !!info.ligneSoirNom && !info.soirParents
  const defaut = info.soirDepart === '17h' ? '17:00' : '16:00'
  return {
    aTransportSoir,
    ligneSoir: aTransportSoir ? info.ligneSoirNom : null,
    depart: aTransportSoir ? info.soirDepart : null,
    heureDepart: aTransportSoir ? normaliserHeure(info.heureSoir) || defaut : '',
  }
}

/** « 16h00 », « 16:00:00 », « 9:5 » → « 16:00 » ; chaîne vide si illisible. */
export function normaliserHeure(raw: string): string {
  const m = /^\s*(\d{1,2})\s*[:hH]\s*(\d{1,2})?/.exec(raw ?? '')
  if (!m) return ''
  return `${m[1].padStart(2, '0')}:${(m[2] ?? '00').padStart(2, '0')}`
}

/**
 * La séance se termine-t-elle après le départ du car du soir de l'élève ? Renvoie l'heure du car (HH:MM) dans ce cas,
 * `null` sinon : s'il reste, il manque le car.
 */
export function alerteCar(seance: Pick<SoutienSeance, 'heureFin'>, transport: InfoTransportSoutien): string | null {
  if (!transport.aTransportSoir || !transport.heureDepart) return null
  return timeToMinutes(seance.heureFin) > timeToMinutes(transport.heureDepart) ? transport.heureDepart : null
}

export interface SortieSeule {
  seul: boolean
  accordSigne: boolean
  /** Date de signature de l'accord (telle qu'enregistrée), vide si inconnue. */
  dateAccord: string
  /** Sort seul(e) alors que l'accord n'est pas signé. */
  anomalie: boolean
}

const MODALITE_SEUL = 'Sortie seul(e) (Accord signé)'
const MODALITE_SEUL_ANCIENNE = 'Sortie libre'

/** Règle de la fiche cantine : l'interdiction de sortie l'emporte ; sinon « Sortie seul(e) » (ou l'ancienne « Sortie libre »). */
export function sortieSeule(cantine: CantineInfo | undefined): SortieSeule {
  if (!cantine) return { seul: false, accordSigne: false, dateAccord: '', anomalie: false }
  const seul = !cantine.interdictionSortie && (cantine.modaliteSortie === MODALITE_SEUL || cantine.modaliteSortie === MODALITE_SEUL_ANCIENNE)
  return { seul, accordSigne: cantine.dechargeSignee, dateAccord: cantine.dechargeSignee ? cantine.dechargeDate : '', anomalie: seul && !cantine.dechargeSignee }
}

// ───────────────────────── Rapport par classe ─────────────────────────

export interface EleveRapportSource {
  student: Student
  identity: StudentIdentity | undefined
  cantine: CantineInfo | undefined
}

export interface RapportTransportLigne {
  studentId: string
  name: string
  matin: string
  soir: string
  /** HH:MM du car du soir, vide si l'élève n'en prend pas. */
  depart: string
}

export interface RapportSortieLigne extends SortieSeule {
  studentId: string
  name: string
}

export interface RapportSoutienLigne {
  studentId: string
  name: string
  seanceId: string
  matiere: string
  jour: JourSoutien
  heureDebut: string
  heureFin: string
  statut: StatutSoutien
  aTransportSoir: boolean
  /** Heure du car manqué si l'élève reste, sinon `null`. */
  alerteCar: string | null
}

export interface RapportClasse {
  classe: string
  transport: RapportTransportLigne[]
  sortieSeul: RapportSortieLigne[]
  soutien: RapportSoutienLigne[]
}

function rangClasse(classe: string): number {
  const i = NIVEAUX.indexOf(niveauFromClasse(classe))
  return i < 0 ? NIVEAUX.length : i
}

/** Tri des élèves par niveau (PS… 3APIC), puis classe, puis nom. */
export function parClasseNom(a: { classe: string; name: string }, b: { classe: string; name: string }): number {
  return rangClasse(a.classe) - rangClasse(b.classe) || a.classe.localeCompare(b.classe, 'fr') || a.name.localeCompare(b.name, 'fr')
}

function parNom<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, 'fr')
}

function libelleLigne(nom: string | null, parents: boolean): string {
  if (parents) return 'Parents'
  return nom ?? '—'
}

/**
 * Pour chaque classe qui en compte au moins un : élèves au transport, en sortie seul(e) et inscrits au soutien (séances non
 * closes). « Dossier incomplet » est écarté. `classes` limite le rapport à certaines classes.
 */
export function rapportParClasse(params: {
  eleves: EleveRapportSource[]
  capacite: ServicesCapacite | undefined
  seances: SoutienSeance[]
  inscriptions: SoutienInscription[]
  aPartirDe: string
  classes?: string[]
}): RapportClasse[] {
  const { eleves, capacite, seances, inscriptions, aPartirDe } = params
  const parEleve = new Map(eleves.map((e) => [e.student.id, e]))
  const seanceParId = new Map(seances.map((s) => [s.id, s]))
  const out = new Map<string, RapportClasse>()
  const vide = (classe: string): RapportClasse => {
    let r = out.get(classe)
    if (!r) {
      r = { classe, transport: [], sortieSeul: [], soutien: [] }
      out.set(classe, r)
    }
    return r
  }
  const retenue = (classe: string) => classe !== CLASSE_DOSSIER_INCOMPLET && (!params.classes || params.classes.includes(classe))

  eleves.forEach(({ student, identity, cantine }) => {
    if (!retenue(student.classe)) return
    if (identity?.transport) {
      const t = resolveStudentTransport(student, identity, [], [], [], capacite)
      const transport = infoTransportEleve(student, identity, capacite)
      vide(student.classe).transport.push({
        studentId: student.id,
        name: student.name,
        matin: libelleLigne(t.ligneMatinNom, t.matinParents),
        soir: libelleLigne(t.ligneSoirNom, t.soirParents),
        depart: transport.aTransportSoir ? transport.heureDepart : '',
      })
    }
    const sortie = sortieSeule(cantine)
    if (sortie.seul) vide(student.classe).sortieSeul.push({ studentId: student.id, name: student.name, ...sortie })
  })

  inscriptions.forEach((i) => {
    const seance = seanceParId.get(i.seanceId)
    const eleve = parEleve.get(i.studentId)
    if (!seance || !eleve || seanceTerminee(seance, aPartirDe) || !retenue(eleve.student.classe)) return
    const transport = infoTransportEleve(eleve.student, eleve.identity, capacite)
    vide(eleve.student.classe).soutien.push({
      studentId: eleve.student.id,
      name: eleve.student.name,
      seanceId: seance.id,
      matiere: seance.matiere,
      jour: seance.jour,
      heureDebut: seance.heureDebut,
      heureFin: seance.heureFin,
      statut: i.statut,
      aTransportSoir: transport.aTransportSoir,
      alerteCar: alerteCar(seance, transport),
    })
  })

  const jourRang = (j: JourSoutien) => JOURS_SOUTIEN.indexOf(j)
  return [...out.values()]
    .map((r) => ({
      ...r,
      transport: [...r.transport].sort(parNom),
      sortieSeul: [...r.sortieSeul].sort(parNom),
      soutien: [...r.soutien].sort((a, b) => parNom(a, b) || jourRang(a.jour) - jourRang(b.jour) || timeToMinutes(a.heureDebut) - timeToMinutes(b.heureDebut)),
    }))
    .sort((a, b) => rangClasse(a.classe) - rangClasse(b.classe) || a.classe.localeCompare(b.classe, 'fr'))
}

// ───────────────────────── Suggestions d'inscription ─────────────────────────

export interface SuggestionSoutien {
  studentId: string
  name: string
  classe: string
  moyenne: number
  scale: number
  seuil: number
}

/**
 * Élèves des classes visées dont la moyenne dans la matière est sous le seuil pédagogique de leur cycle (celui de
 * Paramètres), du plus faible au plus fort. La maternelle, sans note chiffrée, n'en propose pas.
 */
export function suggestionsPourMatiere(matiere: string, classes: string[], eleves: { student: Student; notes: NoteRow[] }[], rules: AlertRules): SuggestionSoutien[] {
  const cible = normalizeText(matiere)
  const out: SuggestionSoutien[] = []
  eleves.forEach(({ student, notes }) => {
    if (!classes.includes(student.classe)) return
    const scale = moyenneScaleForClasse(student.classe)
    const cycle = cycleOfClasse(student.classe)
    if (scale === null || !cycle) return
    const row = notes.find((n) => normalizeText(n.subject) === cible)
    const moyenne = row ? computeSubjectMoyenne(row) : null
    const seuil = rules[cycle]?.seuilMoyennePedagogique
    if (moyenne === null || seuil === undefined || moyenne >= seuil) return
    out.push({ studentId: student.id, name: student.name, classe: student.classe, moyenne, scale, seuil })
  })
  return out.sort((a, b) => a.moyenne - b.moyenne || a.name.localeCompare(b.name, 'fr'))
}

// ───────────────────────── Soutien du jour (Cockpit) ─────────────────────────

export type MomentSeance = 'a_venir' | 'en_cours' | 'terminee'

export interface SoutienDuJourLigne {
  seanceId: string
  matiere: string
  heureDebut: string
  heureFin: string
  moment: MomentSeance
  confirmes: number
  aConfirmer: number
  nePasRestent: number
  /** Élèves confirmés qui prennent normalement le car du soir et le manquent (la séance finit après son départ). */
  confirmesAuCar: string[]
}

/**
 * Séances de soutien qui ont lieu ce jour-là (date annulée écartée), dans l'ordre des heures, avec où en sont les
 * réponses des parents et les élèves normalement au car qui restent.
 */
export function soutienDuJour(
  seances: SoutienSeance[],
  inscriptions: SoutienInscription[],
  dateISO: string,
  nowMinutes: number,
  eleve: { nom: (studentId: string) => string; /** L'élève manque son car du soir s'il reste jusqu'à `heureFin`. */ manqueLeCar: (studentId: string, heureFin: string) => boolean },
): SoutienDuJourLigne[] {
  return seances
    .filter((s) => seanceActiveLe(s, dateISO))
    .map((s) => {
      const inscrits = inscritsDeLaSeance(inscriptions, s.id)
      const confirmes = inscrits.filter((i) => i.statut === 'reste')
      const debut = timeToMinutes(s.heureDebut)
      const fin = timeToMinutes(s.heureFin)
      return {
        seanceId: s.id,
        matiere: s.matiere,
        heureDebut: s.heureDebut,
        heureFin: s.heureFin,
        moment: nowMinutes >= fin ? ('terminee' as const) : nowMinutes >= debut ? ('en_cours' as const) : ('a_venir' as const),
        confirmes: confirmes.length,
        aConfirmer: inscrits.filter((i) => i.statut === 'a_confirmer').length,
        nePasRestent: inscrits.filter((i) => i.statut === 'ne_reste_pas').length,
        confirmesAuCar: confirmes.filter((i) => eleve.manqueLeCar(i.studentId, s.heureFin)).map((i) => eleve.nom(i.studentId)),
      }
    })
    .sort((a, b) => timeToMinutes(a.heureDebut) - timeToMinutes(b.heureDebut))
}

// ───────────────────────── Départ après la séance ─────────────────────────

/** Comment un élève confirmé quitte l'école à la fin de la séance. */
export function modeDepartSoutien(seance: Pick<SoutienSeance, 'heureFin'>, seul: boolean, transport: InfoTransportSoutien): string {
  if (seul) return 'Sort seul(e)'
  if (transport.aTransportSoir) return alerteCar(seance, transport) ? 'Habituellement au car : non assuré ce jour' : `Car de ${transport.heureDepart}`
  return 'Récupéré par les parents'
}

// ───────────────────────── Sorties du jour (feuille du portail) ─────────────────────────

export interface CarDuSoir {
  ligne: string
  /** HH:MM */
  depart: string
  habituels: number
  /** Élèves qui restent au soutien et manquent ce car. */
  restent: number
  attendus: number
  restants: { studentId: string; name: string; classe: string; matiere: string; heureFin: string }[]
  /** Élèves du car dont la réponse au soutien est attendue : on ne sait pas encore s'ils le prendront. */
  enAttente: { studentId: string; name: string; classe: string; matiere: string }[]
}

export interface SoutienDuJourSortie {
  seanceId: string
  matiere: string
  heureDebut: string
  heureFin: string
  enseignant: string
  confirmes: { studentId: string; name: string; classe: string; sortie: string }[]
  enAttente: { name: string; classe: string }[]
  nePasRestent: number
}

export interface SortieSeuleDuJour extends SortieSeule {
  studentId: string
  name: string
  classe: string
  /** Heure de fin du soutien auquel l'élève reste ce jour-là : il sort seul(e) à ce moment-là. */
  resteJusqua: string | null
}

export interface SortiesDuJour {
  date: string
  cars: CarDuSoir[]
  soutien: SoutienDuJourSortie[]
  sortieSeul: SortieSeuleDuJour[]
}

/**
 * Qui part comment à la fin de la journée du `dateISO` : les cars du soir (combien d'élèves attendus, qui reste au soutien
 * et manque le car), les séances de soutien (élèves confirmés et leur mode de départ) et les élèves qui sortent seul(e).
 */
export function sortiesDuJour(p: {
  dateISO: string
  eleves: EleveRapportSource[]
  capacite: ServicesCapacite | undefined
  seances: SoutienSeance[]
  inscriptions: SoutienInscription[]
  nomEnseignant: (teacherId: string | null) => string
}): SortiesDuJour {
  const { dateISO, capacite } = p
  const actives = p.seances.filter((s) => seanceActiveLe(s, dateISO))
  const seanceParId = new Map(actives.map((s) => [s.id, s]))
  const inscritsActifs = p.inscriptions.filter((i) => seanceParId.has(i.seanceId))
  const parEleve = new Map(p.eleves.map((e) => [e.student.id, e]))

  const cars = new Map<string, CarDuSoir>()
  const sortieSeul: SortieSeuleDuJour[] = []

  p.eleves.forEach(({ student, identity, cantine }) => {
    if (student.classe === CLASSE_DOSSIER_INCOMPLET) return
    const transport = infoTransportEleve(student, identity, capacite)
    const sortie = sortieSeule(cantine)
    const siens = inscritsActifs.filter((i) => i.studentId === student.id)
    const confirmes = siens.filter((i) => i.statut === 'reste')

    if (transport.aTransportSoir && transport.ligneSoir) {
      const cle = `${transport.heureDepart}|${transport.ligneSoir}`
      let car = cars.get(cle)
      if (!car) {
        car = { ligne: transport.ligneSoir, depart: transport.heureDepart, habituels: 0, restent: 0, attendus: 0, restants: [], enAttente: [] }
        cars.set(cle, car)
      }
      car.habituels += 1
      const manque = confirmes.map((i) => seanceParId.get(i.seanceId)!).find((s) => alerteCar(s, transport))
      if (manque) {
        car.restent += 1
        car.restants.push({ studentId: student.id, name: student.name, classe: student.classe, matiere: manque.matiere, heureFin: manque.heureFin })
      } else {
        const attente = siens.filter((i) => i.statut === 'a_confirmer').map((i) => seanceParId.get(i.seanceId)!).find((s) => alerteCar(s, transport))
        if (attente) car.enAttente.push({ studentId: student.id, name: student.name, classe: student.classe, matiere: attente.matiere })
      }
    }

    if (sortie.seul) {
      const fins = confirmes.map((i) => seanceParId.get(i.seanceId)!.heureFin).sort()
      sortieSeul.push({ studentId: student.id, name: student.name, classe: student.classe, ...sortie, resteJusqua: fins.length > 0 ? fins[fins.length - 1] : null })
    }
  })

  cars.forEach((c) => {
    c.attendus = c.habituels - c.restent
    c.restants.sort(parClasseNom)
    c.enAttente.sort(parClasseNom)
  })

  const soutien: SoutienDuJourSortie[] = actives
    .map((s) => {
      const inscrits = inscritsDeLaSeance(inscritsActifs, s.id)
      const lignes = (statut: StatutSoutien) => inscrits.filter((i) => i.statut === statut).flatMap((i) => (parEleve.get(i.studentId) ? [{ i, e: parEleve.get(i.studentId)! }] : []))
      return {
        seanceId: s.id,
        matiere: s.matiere,
        heureDebut: s.heureDebut,
        heureFin: s.heureFin,
        enseignant: p.nomEnseignant(s.teacherId),
        confirmes: lignes('reste')
          .map(({ e }) => ({
            studentId: e.student.id,
            name: e.student.name,
            classe: e.student.classe,
            sortie: modeDepartSoutien(s, sortieSeule(e.cantine).seul, infoTransportEleve(e.student, e.identity, capacite)),
          }))
          .sort(parClasseNom),
        enAttente: lignes('a_confirmer')
          .map(({ e }) => ({ name: e.student.name, classe: e.student.classe }))
          .sort(parClasseNom),
        nePasRestent: inscrits.filter((i) => i.statut === 'ne_reste_pas').length,
      }
    })
    .sort((a, b) => timeToMinutes(a.heureFin) - timeToMinutes(b.heureFin))

  return {
    date: dateISO,
    cars: [...cars.values()].sort((a, b) => timeToMinutes(a.depart) - timeToMinutes(b.depart) || a.ligne.localeCompare(b.ligne, 'fr')),
    soutien,
    sortieSeul: sortieSeul.sort((a, b) => rangClasse(a.classe) - rangClasse(b.classe) || a.classe.localeCompare(b.classe, 'fr') || a.name.localeCompare(b.name, 'fr')),
  }
}

// ───────────────────────── Contrôle de cohérence des sorties ─────────────────────────

export interface IncoherenceSortie {
  studentId: string
  name: string
  classe: string
  problemes: string[]
}

/**
 * Fiches dont le mode de sortie se contredit : « sortie seul(e) » avec une interdiction de sortie active, sortie seul(e) alors
 * que l'élève est affecté au car du soir, ou sortie seul(e) en maternelle. Seules les fiches qui ont (ou prétendent avoir) le
 * mode « sortie seul(e) » sont examinées.
 */
export function incoherencesSortie(eleves: EleveRapportSource[], capacite: ServicesCapacite | undefined): IncoherenceSortie[] {
  const out: IncoherenceSortie[] = []
  eleves.forEach(({ student, identity, cantine }) => {
    if (!cantine || student.classe === CLASSE_DOSSIER_INCOMPLET) return
    const modeSeul = cantine.modaliteSortie === MODALITE_SEUL || cantine.modaliteSortie === MODALITE_SEUL_ANCIENNE
    if (!modeSeul) return
    const problemes: string[] = []
    if (cantine.interdictionSortie) problemes.push('Le mode est « sortie seul(e) » mais une interdiction de sortie est active : la fiche se contredit.')
    else {
      const transport = infoTransportEleve(student, identity, capacite)
      if (transport.aTransportSoir) problemes.push(`Sort seul(e) mais est affecté(e) au car du soir (ligne ${transport.ligneSoir}).`)
      if (cycleOfClasse(student.classe) === 'maternelle') problemes.push('Élève de maternelle : sortie seul(e) à vérifier.')
    }
    if (problemes.length > 0) out.push({ studentId: student.id, name: student.name, classe: student.classe, problemes })
  })
  return out.sort((a, b) => rangClasse(a.classe) - rangClasse(b.classe) || a.name.localeCompare(b.name, 'fr'))
}
