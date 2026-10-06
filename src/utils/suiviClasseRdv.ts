import type { RendezVousRecord, StudentExtra } from '../data/studentDetails'
import type { Student } from '../data/students'
import type { SuiviProf } from '../data/suiviProfs'
import type { OpenReclamation, RiskStudent } from './suiviClasseRisqueAggregation'
import { addDaysISO, cleanReclamationText } from './reclamationsLogic'
import { reunionPrecedente } from './suiviClasseReunion'

/** Un rendez-vous avec les parents, rattaché à son élève. */
export interface RdvLigne {
  studentId: string
  studentName: string
  classe: string
  record: RendezVousRecord
}

export type StatutRdv = 'a_venir' | 'a_cloturer' | 'tenu' | 'annule'

export const STATUT_RDV_LABELS: Record<StatutRdv, string> = {
  a_venir: 'À venir',
  a_cloturer: 'À clôturer',
  tenu: 'Tenu',
  annule: 'Annulé',
}

/** Délai de repli quand le niveau n'a pas eu de réunion précédente. Choix raisonnable, pas une règle validée. */
export const PERIODE_PAR_DEFAUT_JOURS = 30

/** Rendez-vous des élèves des classes données (le niveau d'une réunion de suivi). */
export function collectRendezVous(students: Student[], extras: Record<string, StudentExtra>, classeNames: string[]): RdvLigne[] {
  const classes = new Set(classeNames)
  return students
    .filter((s) => classes.has(s.classe))
    .flatMap((s) => (extras[s.id]?.rendezVous ?? []).map((record) => ({ studentId: s.id, studentName: s.name, classe: s.classe, record })))
}

/** Date (AAAA-MM-JJ) de la réunion précédente du niveau — la plus récente non annulée avant la réunion courante —,
 * à défaut aujourd'hui moins 30 jours. */
export function periodeDepuis(suivis: SuiviProf[], niveau: string, courant: { id?: string; date: string } | undefined, today: string): string {
  return reunionPrecedente(suivis, niveau, courant, today)?.date ?? addDaysISO(today, -PERIODE_PAR_DEFAUT_JOURS)
}

/** État d'un rendez-vous : à venir, planifié mais dont la date est passée (à clôturer : tenu ou annulé ?), tenu, annulé. */
export function statutRdv(r: Pick<RendezVousRecord, 'statut' | 'date'>, today: string): StatutRdv {
  if (r.statut === 'Annulé') return 'annule'
  if (r.statut === 'Réalisé') return 'tenu'
  return r.date >= today ? 'a_venir' : 'a_cloturer'
}

/** Rendez-vous à afficher : les rendez-vous à venir (et à clôturer) passent toujours — ils demandent une action —,
 * le passé seulement à partir de `depuis` (`null` = toute l'année). Les à venir d'abord (le plus proche en tête),
 * puis le reste du plus récent au plus ancien. */
export function filtrerRendezVous(lignes: RdvLigne[], filtre: { depuis: string | null; statut: StatutRdv | 'tous' }, today: string): RdvLigne[] {
  const cle = (l: RdvLigne) => `${l.record.date} ${l.record.heure}`
  return lignes
    .filter((l) => {
      const st = statutRdv(l.record, today)
      if (filtre.statut !== 'tous' && st !== filtre.statut) return false
      return st === 'a_venir' || st === 'a_cloturer' || filtre.depuis === null || l.record.date >= filtre.depuis
    })
    .sort((a, b) => {
      const av = statutRdv(a.record, today) === 'a_venir'
      const bv = statutRdv(b.record, today) === 'a_venir'
      if (av !== bv) return av ? -1 : 1
      return av ? cle(a).localeCompare(cle(b)) : cle(b).localeCompare(cle(a))
    })
}

/** Nombre de rendez-vous par statut, pour les compteurs des filtres. */
export function compterParStatut(lignes: RdvLigne[], today: string): Record<StatutRdv, number> {
  const counts: Record<StatutRdv, number> = { a_venir: 0, a_cloturer: 0, tenu: 0, annule: 0 }
  lignes.forEach((l) => {
    counts[statutRdv(l.record, today)] += 1
  })
  return counts
}

export interface FamilleAContacter {
  studentId: string
  studentName: string
  classe: string
  raisons: string[]
  /** Prochain rendez-vous programmé. */
  prochain?: RdvLigne
  /** Dernier rendez-vous tenu. */
  dernier?: RdvLigne
  /** Aucun rendez-vous tenu ni à venir pour cet élève. */
  jamaisRecu: boolean
  /** La famille a une réclamation non résolue : c'est elle qui a écrit, le contact est plus pressant. */
  reclamationOuverte: boolean
}

/**
 * Élèves du niveau dont il faut peut-être recevoir les parents : ceux « à suivre » (point 3) et ceux qui ont une
 * réclamation ouverte, fusionnés par élève, avec leur état de contact. Ceux qui n'ont pas de rendez-vous programmé
 * passent d'abord (jamais reçus en tête, puis ceux dont la famille a une réclamation ouverte), puis ceux qui cumulent
 * le plus de raisons.
 */
export function famillesAContacter(riskStudents: RiskStudent[], reclamations: OpenReclamation[], rendezVous: RdvLigne[], today: string): FamilleAContacter[] {
  const byId = new Map<string, { studentId: string; studentName: string; classe: string; raisons: string[]; reclamationOuverte: boolean }>()
  const entry = (id: string, name: string, classe: string) => {
    let e = byId.get(id)
    if (!e) {
      e = { studentId: id, studentName: name, classe, raisons: [], reclamationOuverte: false }
      byId.set(id, e)
    }
    return e
  }
  riskStudents.forEach((r) => entry(r.id, r.name, r.classe).raisons.push(...r.reasons))
  reclamations
    .filter((r) => r.statut !== 'Résolue')
    .forEach((r) => {
      const e = entry(r.studentId, r.studentName, r.classe)
      e.raisons.push(`Réclamation ouverte : ${cleanReclamationText(r.objet)}`)
      e.reclamationOuverte = true
    })

  return [...byId.values()]
    .map((e) => {
      const siens = rendezVous.filter((l) => l.studentId === e.studentId)
      const prochain = siens.filter((l) => statutRdv(l.record, today) === 'a_venir').sort((a, b) => `${a.record.date} ${a.record.heure}`.localeCompare(`${b.record.date} ${b.record.heure}`))[0]
      const dernier = siens.filter((l) => statutRdv(l.record, today) === 'tenu').sort((a, b) => `${b.record.date} ${b.record.heure}`.localeCompare(`${a.record.date} ${a.record.heure}`))[0]
      return { ...e, prochain, dernier, jamaisRecu: !prochain && !dernier }
    })
    .sort((a, b) => {
      if (!!a.prochain !== !!b.prochain) return a.prochain ? 1 : -1
      if (a.jamaisRecu !== b.jamaisRecu) return a.jamaisRecu ? -1 : 1
      if (a.reclamationOuverte !== b.reclamationOuverte) return a.reclamationOuverte ? -1 : 1
      return b.raisons.length - a.raisons.length || a.studentName.localeCompare(b.studentName)
    })
}
