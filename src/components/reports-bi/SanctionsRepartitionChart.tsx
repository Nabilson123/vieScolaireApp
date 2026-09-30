import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Gavel } from 'lucide-react'
import { SANCTION_LEVELS, type SanctionLevel } from '../../data/disciplineTypes'

interface SanctionsRepartitionChartProps {
  counts: Record<SanctionLevel, number>
}

const SANCTION_SHORT_LABELS: Record<SanctionLevel, string> = {
  'Avertissement verbal': 'Av. oral',
  'Avertissement écrit': 'Av. écrit',
  Blâme: 'Blâme',
  Retenue: 'Reten.',
  "Travaux d'intérêt général": 'TIG',
  'Privation d’activités périscolaires/sportives': 'Priv. activ.',
  'Engagement parental': 'Engag.',
  'Exclusion interne': 'Excl. int.',
  'Exclusion externe': 'Excl. ext.',
  'Conseil de discipline': 'CD',
  'Exclusion définitive': 'Excl. déf.',
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as { label: string; fullLabel: string; value: number }
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="mb-1 font-semibold">{row.fullLabel}</p>
      <p className="text-rose-300">
        {row.value} sanction{row.value > 1 ? 's' : ''}
      </p>
    </div>
  )
}

export default function SanctionsRepartitionChart({ counts }: SanctionsRepartitionChartProps) {
  const data = SANCTION_LEVELS.map((s) => ({ label: SANCTION_SHORT_LABELS[s], fullLabel: s, value: counts[s] }))
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Gavel className="h-4 w-4 text-rose-500" />
        Répartition des Sanctions
      </h3>
      {total === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Aucune sanction enregistrée sur cette période.</p>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }} barCategoryGap={8}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} width={62} tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#fef2f2' }} />
              <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
