import type { ReclamationRecord } from '../data/studentDetails'
import { parseAnyDate } from './period'

/** Délai de traitement d'une réclamation : « sous 72 heures », compté en jours pleins depuis la date
 * de réception (même règle que le rapport imprimé : hors délai au-delà de 3 jours). */
export const RECLAMATION_DELAI_JOURS = 3

const DAY_MS = 86400000

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Date locale AAAA-MM-JJ — et non `toISOString().slice(0, 10)`, qui est en UTC et donne la veille
 * entre minuit et 1 h du matin au Maroc. */
export function todayLocalISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Ajoute `days` jours à une date AAAA-MM-JJ (date locale, sans décalage de fuseau). */
export function addDaysISO(iso: string, days: number): string {
  const d = parseAnyDate(iso)
  if (!d) return iso
  d.setDate(d.getDate() + days)
  return todayLocalISO(d)
}

/** AAAA-MM-JJ → JJ/MM/AAAA (inchangé si le format n'est pas reconnu). */
export function formatDateFR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/** Retire la mise en forme markdown et les étiquettes parasites d'un texte collé depuis une
 * conversation (« **Objet : … ** », « : Réclamation concernant … ») — l'original reste intact en base,
 * seul l'affichage et les nouvelles écritures sont nettoyés. */
export function cleanReclamationText(raw: string | null | undefined): string {
  let s = (raw ?? '').replace(/\r/g, '')
  // Gras / italique / code markdown.
  s = s.replace(/\*\*|__|`/g, '')
  s = s.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,;:!?])/g, '$1$2')
  // Titres markdown en début de ligne.
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
  s = s.trim()
  // Étiquette de champ en tête (« Objet : », « Description : »…) puis deux-points orphelin.
  s = s.replace(/^(objet|sujet|titre|description|détail|detail|message)[ \t]*:[ \t]*/i, '')
  s = s.replace(/^:[ \t]*/, '')
  // Espaces multiples (hors retours à la ligne).
  s = s.replace(/[ \t]{2,}/g, ' ')
  return s.trim()
}

type DatedRecord = Pick<ReclamationRecord, 'date' | 'statut'>

/** Nombre de jours pleins écoulés depuis la date de réception (0 le jour même). */
export function joursOuverts(date: string, now: Date = new Date()): number {
  const d = parseAnyDate(date)
  if (!d) return 0
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY_MS))
}

/** Une réclamation non résolue est hors délai au-delà de 3 jours pleins. */
export function isHorsDelai(r: DatedRecord, now: Date = new Date()): boolean {
  return r.statut !== 'Résolue' && joursOuverts(r.date, now) > RECLAMATION_DELAI_JOURS
}

/** Durée réelle de traitement en jours pleins ; `null` quand la résolution n'a pas de date (anciennes
 * réclamations résolues avant l'enregistrement de `resoluLe`). */
export function delaiResolutionJours(r: Pick<ReclamationRecord, 'date' | 'statut' | 'resoluLe'>): number | null {
  if (r.statut !== 'Résolue' || !r.resoluLe) return null
  const start = parseAnyDate(r.date)
  const end = Date.parse(r.resoluLe)
  if (!start || Number.isNaN(end)) return null
  return Math.max(0, Math.floor((end - start.getTime()) / DAY_MS))
}

export type EcheanceStatut = 'ok' | 'proche' | 'depassee'

/** État de l'échéance d'une réclamation en cours ; `null` sans échéance ou si elle est résolue.
 * « proche » = aujourd'hui ou demain. */
export function echeanceStatut(r: Pick<ReclamationRecord, 'statut' | 'echeance'>, now: Date = new Date()): EcheanceStatut | null {
  if (r.statut === 'Résolue' || !r.echeance) return null
  const today = todayLocalISO(now)
  if (r.echeance < today) return 'depassee'
  if (r.echeance <= addDaysISO(today, 1)) return 'proche'
  return 'ok'
}
