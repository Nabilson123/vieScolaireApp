import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

interface SeriesConfig {
  key: string
  color: string
  label: string
}

interface StackedBarChartProps {
  title: string
  data: Record<string, string | number>[]
  series: SeriesConfig[]
  formatter?: (v: number) => string
  emptyMessage?: string
  heightClass?: string
}

export default function StackedBarChart({
  title,
  data,
  series,
  formatter = (v) => String(v),
  emptyMessage = 'Aucune donnée.',
  heightClass = 'h-40',
}: StackedBarChartProps) {
  const hasData = data.some((row) => series.some((s) => Number(row[s.key]) > 0))

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {!hasData ? (
        <p className="py-6 text-center text-xs text-slate-400">{emptyMessage}</p>
      ) : (
        <div className={`${heightClass} w-full`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
                      <p className="mb-1 font-semibold">{label}</p>
                      {payload.map((p) => (
                        <p key={p.dataKey as string} style={{ color: p.color }}>
                          {series.find((s) => s.key === p.dataKey)?.label} : {formatter(p.value as number)}
                        </p>
                      ))}
                    </div>
                  ) : null
                }
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => series.find((s) => s.key === value)?.label ?? value}
              />
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} radius={[0, 0, 0, 0]} maxBarSize={28} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
