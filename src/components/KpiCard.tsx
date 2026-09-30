import type { LucideIcon } from 'lucide-react'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string
  unit?: string
  trend?: 'up' | 'down'
  trendValue?: string
  trendLabel?: string
  trendPositive?: boolean
  statusText?: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  alert?: boolean
}

export default function KpiCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  trendLabel,
  trendPositive = true,
  statusText,
  icon: Icon,
  iconBg,
  iconColor,
  alert = false,
}: KpiCardProps) {
  const TrendIcon = trend === 'up' ? ArrowUp : ArrowDown

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${alert ? 'border-rose-200 bg-rose-50/40' : 'border-slate-100 bg-white'}`}>
      <div className="mb-3 flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <div className="mb-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-xs">
          <span
            className={`flex items-center gap-0.5 font-semibold ${
              trendPositive ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            <TrendIcon className="h-3 w-3" />
            {trendValue}
          </span>
          <span className="text-slate-400">{trendLabel}</span>
        </div>
      )}
      {statusText && (
        <div className={trend ? 'mt-1 text-xs text-slate-400' : `text-xs font-semibold ${alert ? 'text-rose-500' : 'text-emerald-500'}`}>
          {statusText}
        </div>
      )}
    </div>
  )
}
