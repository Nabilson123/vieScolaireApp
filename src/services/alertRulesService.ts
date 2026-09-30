import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { AlertRules, CycleKey, CycleThresholds, RuleChangeEntry } from '../data/alertRules'

const CYCLE_KEYS: CycleKey[] = ['maternelle', 'primaire', 'college', 'lycee']

interface AlertRuleRow {
  id: string
  cycle: CycleKey
  seuil_moyenne_pedagogique: number
  seuil_points_climat_scolaire: number
  seuil_taux_presence: number
  seuil_retards_cumules_min: number
  seuil_alertes_pai: number
  seuil_incidents_helpdesk: number
  seuil_taux_remplacement: number
}

interface HistoryRow {
  id: string
  cycle: CycleKey
  summary: string
  changed_at: string
}

function rowToThresholds(row: AlertRuleRow): CycleThresholds {
  return {
    seuilMoyennePedagogique: row.seuil_moyenne_pedagogique,
    seuilPointsClimatScolaire: row.seuil_points_climat_scolaire,
    seuilTauxPresence: row.seuil_taux_presence,
    seuilRetardsCumulesMin: row.seuil_retards_cumules_min,
    seuilAlertesPAI: row.seuil_alertes_pai,
    seuilIncidentsHelpdesk: row.seuil_incidents_helpdesk,
    seuilTauxRemplacement: row.seuil_taux_remplacement,
  }
}

function thresholdsToRow(t: CycleThresholds) {
  return {
    seuil_moyenne_pedagogique: t.seuilMoyennePedagogique,
    seuil_points_climat_scolaire: t.seuilPointsClimatScolaire,
    seuil_taux_presence: t.seuilTauxPresence,
    seuil_retards_cumules_min: t.seuilRetardsCumulesMin,
    seuil_alertes_pai: t.seuilAlertesPAI,
    seuil_incidents_helpdesk: t.seuilIncidentsHelpdesk,
    seuil_taux_remplacement: t.seuilTauxRemplacement,
  }
}

const FIELD_LABELS: Record<keyof CycleThresholds, string> = {
  seuilMoyennePedagogique: 'Moyenne pédagogique',
  seuilPointsClimatScolaire: 'Climat scolaire',
  seuilTauxPresence: 'Taux de présence',
  seuilRetardsCumulesMin: 'Retards cumulés',
  seuilAlertesPAI: 'Alertes PAI',
  seuilIncidentsHelpdesk: 'Incidents Helpdesk',
  seuilTauxRemplacement: 'Taux de remplacement',
}

export const RULES_QUERY_KEY = ['alertRules']
export const HISTORY_QUERY_KEY = ['alertRulesHistory']

export type AlertRulesWithIds = AlertRules & { rowIds: Record<CycleKey, string> }

async function fetchAlertRules(): Promise<AlertRulesWithIds> {
  const { data, error } = await supabase.from('alert_rules').select('*')
  if (error) throw error
  const rows = data as AlertRuleRow[]
  const rules = {} as AlertRules
  const rowIds = {} as Record<CycleKey, string>
  CYCLE_KEYS.forEach((cycle) => {
    const row = rows.find((r) => r.cycle === cycle)
    if (row) {
      rules[cycle] = rowToThresholds(row)
      rowIds[cycle] = row.id
    }
  })
  return { ...rules, rowIds }
}

export function useAlertRules() {
  return useQuery({ queryKey: RULES_QUERY_KEY, queryFn: fetchAlertRules })
}

async function fetchHistory(): Promise<RuleChangeEntry[]> {
  const { data, error } = await supabase.from('alert_rules_history').select('*').order('changed_at', { ascending: false })
  if (error) throw error
  return (data as HistoryRow[]).map((r) => ({ id: r.id, date: r.changed_at, cycle: r.cycle, summary: r.summary }))
}

export function useAlertRulesHistory() {
  return useQuery({ queryKey: HISTORY_QUERY_KEY, queryFn: fetchHistory })
}

interface UpdateCycleThresholdsInput {
  cycle: CycleKey
  rowId: string
  prev: CycleThresholds
  next: CycleThresholds
}

export function useUpdateCycleThresholds() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ cycle, rowId, prev, next }: UpdateCycleThresholdsInput) => {
      const diffs: string[] = []
      ;(Object.keys(next) as (keyof CycleThresholds)[]).forEach((key) => {
        if (prev[key] !== next[key]) diffs.push(`${FIELD_LABELS[key]} : ${prev[key]} → ${next[key]}`)
      })
      const { error: updateError } = await supabase.from('alert_rules').update(thresholdsToRow(next)).eq('id', rowId)
      if (updateError) throw updateError
      if (diffs.length > 0) {
        const { error: historyError } = await supabase.from('alert_rules_history').insert({ cycle, summary: diffs.join(' · ') })
        if (historyError) throw historyError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RULES_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY })
    },
  })
}
