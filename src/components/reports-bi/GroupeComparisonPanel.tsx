import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'
import { Scale } from 'lucide-react'
import type { NiveauGroupComparison } from '../../utils/reportsBIAggregation'

interface GroupeComparisonPanelProps {
  niveauGroups: NiveauGroupComparison[]
}

interface MetricConfig {
  key: 'tauxPresence' | 'moyenneGenerale' | 'absencesCount' | 'incidents'
  label: string
  color: string
  formatter: (v: number) => string
}

const METRICS: MetricConfig[] = [
  { key: 'tauxPresence', label: 'Taux de présence', color: '#6366f1', formatter: (v) => `${v}%` },
  { key: 'moyenneGenerale', label: 'Moyenne générale', color: '#f59e0b', formatter: (v) => v.toFixed(1) },
  { key: 'absencesCount', label: 'Absences', color: '#0ea5e9', formatter: (v) => String(v) },
  { key: 'incidents', label: 'Sanctions', color: '#f43f5e', formatter: (v) => String(v) },
]

function MiniMetricChart({ metric, groupes }: { metric: MetricConfig; groupes: NiveauGroupComparison['groupes'] }) {
  const hasData = groupes.some((g) => g[metric.key] !== null)
  const data = groupes.map((g) => ({ classe: g.classe, value: g[metric.key] ?? 0 }))

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{metric.label}</p>
      {!hasData ? (
        <p className="py-6 text-center text-xs text-slate-400">Aucune donnée.</p>
      ) : (
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="classe" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
                      {payload[0].payload.classe} : {metric.formatter(payload[0].value as number)}
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="value" fill={metric.color} radius={[4, 4, 0, 0]} maxBarSize={36}>
                <LabelList dataKey="value" position="top" formatter={(v: unknown) => metric.formatter(v as number)} style={{ fontSize: 11, fill: metric.color, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default function GroupeComparisonPanel({ niveauGroups }: GroupeComparisonPanelProps) {
  const [selectedNiveau, setSelectedNiveau] = useState(niveauGroups[0]?.niveau ?? '')
  const current = niveauGroups.find((g) => g.niveau === selectedNiveau) ?? niveauGroups[0]

  return (
    <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Scale className="h-4 w-4 text-violet-500" />
          Comparaison des Groupes (mêmes niveau)
        </h3>
        {niveauGroups.length > 0 && (
          <select
            value={selectedNiveau}
            onChange={(e) => setSelectedNiveau(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            {niveauGroups.map((g) => (
              <option key={g.niveau} value={g.niveau}>
                {g.niveau} ({g.groupes.length} groupes)
              </option>
            ))}
          </select>
        )}
      </div>

      {!current ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Aucun niveau ne compte plusieurs groupes actuellement — rien à comparer.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((metric) => (
            <MiniMetricChart key={metric.key} metric={metric} groupes={current.groupes} />
          ))}
        </div>
      )}
    </div>
  )
}
