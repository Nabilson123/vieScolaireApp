import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { School } from 'lucide-react'
import type { ClasseBreakdownRow } from '../../utils/replacementAggregation'
import { formatHeures } from '../../utils/teacherAggregation'

interface ClasseImpactChartProps {
  data: ClasseBreakdownRow[]
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const row: ClasseBreakdownRow = payload[0].payload
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="mb-1 font-semibold">
        Classe {row.classe} <span className="font-normal text-slate-400">({row.niveau})</span>
      </p>
      <p className="text-rose-300">
        {row.count} absence{row.count > 1 ? 's' : ''} · {formatHeures(row.heures)}
      </p>
    </div>
  )
}

export default function ClasseImpactChart({ data }: ClasseImpactChartProps) {
  const height = Math.max(160, data.length * 34)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <School className="h-4 w-4 text-rose-500" />
        Classes Impactées par les Absences
      </h3>
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Aucune absence enregistrée pour l’instant.</p>
      ) : (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }} barCategoryGap={6}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={(v) => `${v}h`}
              />
              <YAxis
                type="category"
                dataKey="classe"
                axisLine={false}
                tickLine={false}
                width={70}
                tick={{ fontSize: 11, fill: '#475569' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#fef2f2' }} />
              <Bar dataKey="heures" fill="#f43f5e" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
