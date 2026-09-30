import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from 'recharts'
import { ArrowUp, ArrowDown } from 'lucide-react'
import type { WeeklyTrendPoint } from '../utils/dashboardTrend'

interface TrendChartProps {
  data: WeeklyTrendPoint[]
}

function nonZero(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v)
  return n > 0 ? String(n) : ''
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as WeeklyTrendPoint
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="mb-1 font-semibold">{point.label}</p>
      <p className="text-indigo-300">{point.elevesAbsentsCount} élève(s) absent(s)</p>
      <p className="text-teal-300">{point.profsAbsentsCount} prof(s) absent(s)</p>
      <p className="mt-1 text-slate-300">
        {point.heuresManqueesEleves}h manquées élèves · {point.heuresManqueesProfs}h manquées profs
      </p>
    </div>
  )
}

export default function TrendChart({ data }: TrendChartProps) {
  const last = data[data.length - 1]
  const prev = data[data.length - 2]
  const delta = last && prev ? last.elevesAbsentsCount - prev.elevesAbsentsCount : 0
  const DeltaIcon = delta <= 0 ? ArrowDown : ArrowUp

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tendance d'assiduité établissement
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-900">{last ? last.elevesAbsentsCount : '—'}</span>
            <span className="text-sm text-slate-400">élève(s) absent(s) cette semaine</span>
            {last && prev && (
              <span
                className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  delta <= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}
              >
                <DeltaIcon className="h-3 w-3" />
                {delta >= 0 ? '+' : ''}
                {delta} vs semaine précédente
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500" /> Élèves absents
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-500" /> Profs absents
          </span>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 10, left: -20, bottom: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} width={28} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="elevesAbsentsCount" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={22}>
              <LabelList dataKey="elevesAbsentsCount" position="top" formatter={nonZero} style={{ fontSize: 11, fill: '#6366f1', fontWeight: 600 }} />
            </Bar>
            <Bar dataKey="profsAbsentsCount" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={22}>
              <LabelList dataKey="profsAbsentsCount" position="top" formatter={nonZero} style={{ fontSize: 11, fill: '#14b8a6', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        {last ? (
          <>
            <span>
              <span className="font-semibold text-slate-700">{last.heuresManqueesEleves}h</span> manquées élèves cette semaine
            </span>
            <span>
              <span className="font-semibold text-slate-700">{last.heuresManqueesProfs}h</span> manquées profs cette semaine
            </span>
          </>
        ) : (
          <span>Aucune donnée sur la période affichée.</span>
        )}
      </div>
    </div>
  )
}
