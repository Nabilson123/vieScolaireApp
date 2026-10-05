import { useState } from 'react'
import { GraduationCap, Eye, Clock, ShieldAlert, HeartPulse, Wrench, Repeat, ChevronRight, Download, Gavel, Megaphone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cycleLabel, type CycleKey } from '../data/alertRules'
import { useAlertRules } from '../services/alertRulesService'
import { computeActiveAlertsSummary, type StudentAlert, type CycleMetric } from '../utils/alertEngine'
import { computeConseilsDisciplineEnAttente, computeElevesSousAlerteConduite } from '../utils/pedagogieDisciplineAggregation'
import { downloadCSV } from '../utils/csvExport'
import { collectAllReclamations, computeReclamationSignals, computeReclamationsHorsDelai } from '../utils/reclamationsAlerts'

interface AlertesCentreCardProps {
  onNavigateToStudent: (id: string) => void
}

const TABS: { key: CycleKey | 'tous'; label: string }[] = [
  { key: 'tous', label: 'Tous les cycles' },
  { key: 'maternelle', label: 'Maternelle' },
  { key: 'primaire', label: 'Primaire' },
  { key: 'college', label: 'Collège' },
  { key: 'lycee', label: 'Lycée' },
]

const LIST_THEME = {
  indigo: { border: 'border-indigo-100', bg: 'bg-indigo-50/40', badge: 'bg-indigo-100 text-indigo-600', icon: 'text-indigo-500' },
  sky: { border: 'border-sky-100', bg: 'bg-sky-50/40', badge: 'bg-sky-100 text-sky-600', icon: 'text-sky-500' },
  orange: { border: 'border-orange-100', bg: 'bg-orange-50/40', badge: 'bg-orange-100 text-orange-600', icon: 'text-orange-500' },
  rose: { border: 'border-rose-100', bg: 'bg-rose-50/40', badge: 'bg-rose-100 text-rose-600', icon: 'text-rose-500' },
} as const

function formatStudentValue(s: StudentAlert): string {
  if (s.unit === 'min') return `${Math.round(s.value)} min`
  if (s.unit === ' cas') return `${Math.round(s.value)} cas`
  if (s.unit === ' j') return `${Math.round(s.value)} j`
  return `${s.value.toFixed(1)}${s.unit}`
}

function StudentAlertList({
  title,
  icon: Icon,
  color,
  items,
  onNavigateToStudent,
}: {
  title: string
  icon: LucideIcon
  color: keyof typeof LIST_THEME
  items: StudentAlert[]
  onNavigateToStudent: (id: string) => void
}) {
  const theme = LIST_THEME[color]
  return (
    <div className={`rounded-2xl border ${theme.border} ${theme.bg} p-4`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${theme.icon}`} />
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${theme.badge}`}>{items.length} ÉLÈVE(S)</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">Aucun élève concerné pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500">
                  Classe : {s.classe} · {cycleLabel(s.cycle)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${theme.badge}`}>{formatStudentValue(s)}</span>
                <button
                  type="button"
                  onClick={() => onNavigateToStudent(s.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
                >
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface AggMetric {
  value: number
  seuil: number
  alert: boolean
}

function MetricTile({ label, icon: Icon, metric, format }: { label: string; icon: LucideIcon; metric: AggMetric; format: (v: number) => string }) {
  return (
    <div className={`rounded-xl border p-3 ${metric.alert ? 'border-rose-200 bg-rose-50/60' : 'border-slate-100 bg-white'}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <Icon className={`h-4 w-4 ${metric.alert ? 'text-rose-500' : 'text-slate-400'}`} />
      </div>
      <p className={`text-lg font-bold ${metric.alert ? 'text-rose-600' : 'text-slate-900'}`}>{format(metric.value)}</p>
      <p className="text-[11px] text-slate-400">seuil {format(metric.seuil)}</p>
    </div>
  )
}

function aggregateSum(metrics: CycleMetric[], tab: CycleKey | 'tous'): AggMetric {
  if (tab !== 'tous') {
    const m = metrics.find((x) => x.cycle === tab)
    return m ?? { value: 0, seuil: 0, alert: false }
  }
  return {
    value: metrics.reduce((sum, m) => sum + m.value, 0),
    seuil: metrics.reduce((sum, m) => sum + m.seuil, 0),
    alert: metrics.some((m) => m.alert),
  }
}

function aggregateAverage(metrics: CycleMetric[], tab: CycleKey | 'tous'): AggMetric {
  if (tab !== 'tous') {
    const m = metrics.find((x) => x.cycle === tab)
    return m ?? { value: 0, seuil: 0, alert: false }
  }
  return {
    value: Math.round(metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length),
    seuil: Math.round(metrics.reduce((sum, m) => sum + m.seuil, 0) / metrics.length),
    alert: metrics.some((m) => m.alert),
  }
}

export default function AlertesCentreCard({ onNavigateToStudent }: AlertesCentreCardProps) {
  const [tab, setTab] = useState<CycleKey | 'tous'>('tous')
  const { data: rules } = useAlertRules()

  if (!rules) {
    return <div className="rounded-2xl border border-slate-100 bg-white p-5 text-sm text-slate-400 shadow-sm">Chargement...</div>
  }

  const summary = computeActiveAlertsSummary(rules)

  const filterByCycle = <T extends { cycle: CycleKey }>(items: T[]): T[] => (tab === 'tous' ? items : items.filter((i) => i.cycle === tab))

  const moyenne = filterByCycle(summary.moyenne)
  const presence = filterByCycle(summary.presence)
  const retards = filterByCycle(summary.retards)
  const conseilsDiscipline = filterByCycle(computeConseilsDisciplineEnAttente())
  const alertesDisciplinaires = filterByCycle(computeElevesSousAlerteConduite())
  const reclamationsHorsDelai = filterByCycle(computeReclamationsHorsDelai())
  const signauxReclamations = computeReclamationSignals(collectAllReclamations())

  const climat = aggregateSum(summary.climat, tab)
  const pai = aggregateSum(summary.pai, tab)
  const helpdesk = aggregateSum(summary.helpdesk, tab)
  const remplacement = aggregateAverage(summary.remplacement, tab)

  const handleExport = () => {
    const rows: (string | number)[][] = [
      ...moyenne.map((s) => ['Pédagogique', s.name, s.classe, cycleLabel(s.cycle), formatStudentValue(s)]),
      ...presence.map((s) => ['Présence', s.name, s.classe, cycleLabel(s.cycle), formatStudentValue(s)]),
      ...retards.map((s) => ['Retards', s.name, s.classe, cycleLabel(s.cycle), formatStudentValue(s)]),
    ]
    downloadCSV(`alertes-eleves-${tab}-${new Date().toISOString().slice(0, 10)}.csv`, ["Type d'alerte", 'Élève', 'Classe', 'Cycle', 'Valeur'], rows)
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800">Centre d'Alertes</h3>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" /> Exporter (CSV)
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Climat scolaire" icon={ShieldAlert} metric={climat} format={(v) => `${v} pts`} />
        <MetricTile label="Alertes PAI" icon={HeartPulse} metric={pai} format={(v) => `${v}`} />
        <MetricTile label="Helpdesk ouverts" icon={Wrench} metric={helpdesk} format={(v) => `${v}`} />
        <MetricTile label="Taux remplacement" icon={Repeat} metric={remplacement} format={(v) => `${v}%`} />
      </div>

      <div className="space-y-4">
        <StudentAlertList title="Alerte Pédagogique" icon={GraduationCap} color="indigo" items={moyenne} onNavigateToStudent={onNavigateToStudent} />
        <StudentAlertList title="Alerte Présence" icon={Eye} color="sky" items={presence} onNavigateToStudent={onNavigateToStudent} />
        <StudentAlertList title="Alerte Retards" icon={Clock} color="orange" items={retards} onNavigateToStudent={onNavigateToStudent} />
        <StudentAlertList
          title="Alerte Disciplinaire (conduite < 8/20)"
          icon={ShieldAlert}
          color="rose"
          items={alertesDisciplinaires}
          onNavigateToStudent={onNavigateToStudent}
        />
        <StudentAlertList
          title="Réclamations hors délai (> 72 h)"
          icon={Megaphone}
          color="orange"
          items={reclamationsHorsDelai}
          onNavigateToStudent={onNavigateToStudent}
        />
        {signauxReclamations.length > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-800">Réclamations : signaux de récurrence</h3>
            </div>
            <ul className="space-y-2">
              {signauxReclamations.map((s) => (
                <li key={s.key} className="rounded-xl bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        <StudentAlertList
          title="Conseil de Discipline en attente"
          icon={Gavel}
          color="rose"
          items={conseilsDiscipline}
          onNavigateToStudent={onNavigateToStudent}
        />
      </div>
    </div>
  )
}
