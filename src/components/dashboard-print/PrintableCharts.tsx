import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, LabelList } from 'recharts'
import type { WeeklyTrendPoint } from '../../utils/dashboardTrend'
import { INDIGO, TEAL } from '../print/reportTheme'

const AXIS_TICK = { fontSize: 8, fill: '#94a3b8' }
const CATEGORY_TICK = { fontSize: 8, fill: '#475569' }

function nonZero(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v)
  return n > 0 ? String(n) : ''
}

function negativeOnly(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v)
  return n < 0 ? String(n) : ''
}

export function TendanceBarsChart({ data }: { data: WeeklyTrendPoint[] }) {
  const maxVal = 8
  const axisTicks = [8, 6, 4, 2, 0]
  return (
    <div>
      <div className="mt-2 flex items-end gap-1.5">
        <div className="flex h-[90px] flex-col justify-between pr-1 text-right text-[9px]" style={{ color: '#94969B' }}>
          {axisTicks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="flex h-[90px] flex-1 items-end border-b border-l" style={{ borderColor: '#E0DFDE' }}>
          {data.map((w) => {
            const eleveH = Math.round((w.elevesAbsentsCount / maxVal) * 80)
            const profH = Math.round((w.profsAbsentsCount / maxVal) * 80)
            return (
              <div key={w.week} className="flex h-full flex-1 items-end justify-center gap-[3px]">
                <div className="relative w-[13px]" style={{ height: eleveH, background: INDIGO }}>
                  {w.elevesAbsentsCount > 0 && (
                    <div className="absolute -top-[13px] left-0 right-0 text-center text-[9px] font-bold" style={{ color: INDIGO }}>
                      {w.elevesAbsentsCount}
                    </div>
                  )}
                </div>
                <div className="relative w-[13px]" style={{ height: profH, background: TEAL }}>
                  {w.profsAbsentsCount > 0 && (
                    <div className="absolute -top-[13px] left-0 right-0 text-center text-[9px] font-bold" style={{ color: TEAL }}>
                      {w.profsAbsentsCount}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="ml-5 flex gap-1.5">
        {data.map((w) => (
          <div key={w.week} className="flex-1 text-center text-[9px]" style={{ color: '#94969B' }}>
            {w.week}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-center gap-4 text-[10px]" style={{ color: '#6E7075' }}>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: INDIGO }} /> Élèves absents
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: TEAL }} /> Profs absents
        </span>
      </div>
    </div>
  )
}

export interface HorizontalBarRow {
  label: string
  value: number
  displayValue: string
}

export function ClasseHorizontalBars({
  rows,
  color,
  trackColor,
  valueColWidth,
  labelColWidth = '66px',
}: {
  rows: HorizontalBarRow[]
  color: string
  trackColor: string
  valueColWidth: string
  labelColWidth?: string
}) {
  const maxValue = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className="items-center gap-2"
          style={{ display: 'grid', gridTemplateColumns: `${labelColWidth} 1fr ${valueColWidth}` }}
        >
          <div className="text-[10px] font-semibold" style={{ color: '#2E3138' }}>
            {row.label}
          </div>
          <div className="relative h-3" style={{ background: trackColor }}>
            <div className="h-full" style={{ width: `${Math.round((row.value / maxValue) * 100)}%`, background: color }} />
          </div>
          <div className="text-[10px] font-bold" style={{ color }}>
            {row.displayValue}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ClasseDivergingChart({
  data,
}: {
  data: { classe: string; pointsValeur: number; pointsSanction: number }[]
}) {
  const height = Math.max(90, data.length * 18)
  return (
    <div className="mb-2">
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 2, right: 28, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" axisLine={false} tickLine={false} tick={AXIS_TICK} />
            <YAxis type="category" dataKey="classe" axisLine={false} tickLine={false} tick={CATEGORY_TICK} width={46} interval={0} />
            <ReferenceLine x={0} stroke="#cbd5e1" />
            <Bar dataKey="pointsValeur" stackId="a" fill="#10b981" radius={[0, 3, 3, 0]} maxBarSize={9}>
              <LabelList dataKey="pointsValeur" position="right" formatter={nonZero} style={{ fontSize: 8, fill: '#10b981' }} />
            </Bar>
            <Bar dataKey="pointsSanction" stackId="a" fill="#f43f5e" radius={[3, 0, 0, 3]} maxBarSize={9}>
              <LabelList dataKey="pointsSanction" position="left" formatter={negativeOnly} style={{ fontSize: 8, fill: '#f43f5e' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 text-[8px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Points Valeur
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Points Sanction
        </span>
      </div>
    </div>
  )
}
