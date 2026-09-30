import { CYCLES } from './referentiel'

export type CycleKey = 'maternelle' | 'primaire' | 'college' | 'lycee'

export const CYCLE_KEYS: CycleKey[] = ['maternelle', 'primaire', 'college', 'lycee']

export function cycleLabel(cycle: CycleKey): string {
  return CYCLES.find((c) => c.key === cycle)?.label ?? cycle
}

export interface CycleThresholds {
  seuilMoyennePedagogique: number
  seuilPointsClimatScolaire: number
  seuilTauxPresence: number
  seuilRetardsCumulesMin: number
  seuilAlertesPAI: number
  seuilIncidentsHelpdesk: number
  seuilTauxRemplacement: number
}

export type AlertRules = Record<CycleKey, CycleThresholds>

export interface RuleChangeEntry {
  id: string
  date: string
  cycle: CycleKey
  summary: string
}
