import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'

interface MiniBarChartProps {
  title: string
  data: { label: string; value: number }[]
  color: string
  formatter?: (v: number) => string
  emptyMessage?: string
  heightClass?: string
  /** Barres horizontales, une catégorie par ligne — pour des libellés nombreux/longs qui
   * s'écraseraient les uns sur les autres en axe X vertical (ex. types de réclamation). */
  horizontal?: boolean
}

export default function MiniBarChart({
  title,
  data,
  color,
  formatter = (v) => String(v),
  emptyMessage = 'Aucune donnée.',
  heightClass = 'h-32',
  horizontal = false,
}: MiniBarChartProps) {
  const hasData = data.some((d) => d.value > 0)

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {!hasData ? (
        <p className="py-6 text-center text-xs text-slate-400">{emptyMessage}</p>
      ) : horizontal ? (
        <div className="w-full" style={{ height: Math.max(128, data.length * 28) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 4 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                width={150}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
                      {payload[0].payload.label} : {formatter(payload[0].value as number)}
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={14}>
                <LabelList dataKey="value" position="right" formatter={(v: unknown) => formatter(v as number)} style={{ fontSize: 10, fill: color, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className={`${heightClass} w-full`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
                      {payload[0].payload.label} : {formatter(payload[0].value as number)}
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28}>
                <LabelList dataKey="value" position="top" formatter={(v: unknown) => formatter(v as number)} style={{ fontSize: 10, fill: color, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
