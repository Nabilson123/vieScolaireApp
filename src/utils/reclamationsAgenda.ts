import type { ReclamationRecord } from '../data/studentDetails'
import { isAccuseAEnvoyer, isHorsDelai, isRelanceDue, relanceDueLe, todayLocalISO } from './reclamationsLogic'
import { niveauOf } from './reclamationsPolicy'

export type AgendaSectionKey = 'urgentes' | 'accuses' | 'echeances' | 'sans_responsable' | 'relances' | 'mes'

export interface AgendaSection<T> {
  key: AgendaSectionKey
  title: string
  hint: string
  items: T[]
}

const SECTIONS: { key: AgendaSectionKey; title: string; hint: string }[] = [
  { key: 'urgentes', title: 'Urgentes', hint: 'À traiter en priorité, quel que soit le reste.' },
  { key: 'accuses', title: 'Accusés de réception à envoyer', hint: "La famille n'a pas encore reçu de confirmation." },
  { key: 'echeances', title: 'Échéance atteinte ou dépassée', hint: 'Prises en charge dont la date limite est aujourd’hui ou passée.' },
  { key: 'sans_responsable', title: 'Hors délai, sans responsable', hint: 'Personne ne s’en occupe encore.' },
  { key: 'relances', title: 'Familles à relancer', hint: 'Vérifier que la réponse apportée a convenu.' },
  { key: 'mes', title: 'Mes réclamations en cours', hint: 'Prises en charge par vous.' },
]

type AgendaRecord = Pick<ReclamationRecord, 'date' | 'statut' | 'type' | 'urgente' | 'accuseLe' | 'echeance' | 'responsable' | 'resoluLe' | 'suiviFamille'>

/** Section d'une réclamation : la première qui s'applique, dans l'ordre de priorité ci-dessus — une
 * réclamation ne figure qu'une fois dans l'agenda, à l'endroit où elle demande l'action la plus pressée. */
export function agendaSectionOf(r: AgendaRecord, moi: string, now: Date): AgendaSectionKey | null {
  const open = r.statut !== 'Résolue'
  if (open && niveauOf(r) === 'urgent') return 'urgentes'
  if (isAccuseAEnvoyer(r)) return 'accuses'
  if (open && r.echeance && r.echeance <= todayLocalISO(now)) return 'echeances'
  if (open && !r.responsable && isHorsDelai(r, now)) return 'sans_responsable'
  if (isRelanceDue(r, now)) return 'relances'
  if (open && !!moi && r.responsable === moi) return 'mes'
  return null
}

/**
 * « Que dois-je faire aujourd'hui ? » : répartit les réclamations en sections d'action, du plus pressé au
 * moins pressé. Seules les sections non vides sont renvoyées. À l'intérieur d'une section, la plus ancienne
 * (ou la plus proche de son échéance) d'abord.
 */
export function computeAgenda<T extends AgendaRecord>(items: T[], moi: string, now: Date = new Date()): AgendaSection<T>[] {
  const buckets = new Map<AgendaSectionKey, T[]>()
  items.forEach((r) => {
    const key = agendaSectionOf(r, moi, now)
    if (key) buckets.set(key, [...(buckets.get(key) ?? []), r])
  })
  const sortKey = (key: AgendaSectionKey, r: T): string => {
    if (key === 'echeances') return r.echeance ?? r.date
    if (key === 'relances') return relanceDueLe(r) ?? r.date
    return r.date
  }
  return SECTIONS.filter((s) => buckets.has(s.key)).map((s) => ({
    ...s,
    items: [...(buckets.get(s.key) ?? [])].sort((a, b) => (sortKey(s.key, a) < sortKey(s.key, b) ? -1 : sortKey(s.key, a) > sortKey(s.key, b) ? 1 : 0)),
  }))
}

export function agendaTotal(sections: AgendaSection<unknown>[]): number {
  return sections.reduce((sum, s) => sum + s.items.length, 0)
}
