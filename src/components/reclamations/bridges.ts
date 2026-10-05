import type { Teacher } from '../../data/teachers'
import { matchesTeacher } from '../../utils/teacherAggregation'
import { niveauFromClasse } from '../../utils/alertEngine'
import type { LogicalGroup } from '../../utils/suiviClasseGroups'

/** Ce qu'on peut faire d'une réclamation dans un autre module, sans ressaisir les informations. */
export type BridgeKind = 'action_classe' | 'suivi_prof' | 'incident' | 'rdv'

export const BRIDGE_LABELS: Record<BridgeKind, string> = {
  action_classe: 'Action de suivi de classe',
  suivi_prof: 'Suivi avec l’enseignant',
  incident: 'Incident Helpdesk',
  rdv: 'Rendez-vous parent',
}

/** Catégories qui relèvent d'un problème de locaux ou de sécurité, donc d'un incident de maintenance. */
export const INCIDENT_CATEGORIES = ['Hygiène / Locaux', 'Sécurité']

/** Groupe de suivi de classe (niveau primaire, ou « 1-3APIC » pour tout le collège) d'une classe ; la
 * maternelle n'en a pas. */
export function findGroupForClasse(groups: LogicalGroup[], classe: string): LogicalGroup | undefined {
  const niveau = niveauFromClasse(classe)
  return groups.find((g) => g.niveauxBruts.includes(niveau))
}

/** Enseignant désigné par le champ « Concernant » — nom exact (après retrait de « Prof. ») ; une saisie
 * libre (« Administration », « Personnel cantine »…) ne correspond à personne. */
export function findTeacherFor(enseignant: string, teachers: Teacher[]): Teacher | undefined {
  return enseignant.trim() ? teachers.find((t) => matchesTeacher(enseignant, t)) : undefined
}

export function availableBridges(
  reclamation: { type: string; enseignant: string },
  classe: string,
  groups: LogicalGroup[],
  teachers: Teacher[]
): BridgeKind[] {
  const bridges: BridgeKind[] = []
  if (findGroupForClasse(groups, classe)) bridges.push('action_classe')
  if (findTeacherFor(reclamation.enseignant, teachers)) bridges.push('suivi_prof')
  if (INCIDENT_CATEGORIES.includes(reclamation.type)) bridges.push('incident')
  bridges.push('rdv')
  return bridges
}
