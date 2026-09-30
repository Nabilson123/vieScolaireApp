import { useState } from 'react'
import { Calendar, ChevronDown, RotateCcw } from 'lucide-react'
import { PERIOD_PRESETS, type PeriodPresetKey } from '../utils/period'

interface PeriodRangeFilterProps {
  periodStart: string
  periodEnd: string
  onDatesChange: (start: string, end: string) => void
  presetKey?: PeriodPresetKey | null
  onPresetChange?: (key: PeriodPresetKey) => void
  onReset?: () => void
  resetLabel?: string
}

export default function PeriodRangeFilter({
  periodStart,
  periodEnd,
  onDatesChange,
  presetKey,
  onPresetChange,
  onReset,
  resetLabel = 'Réinitialiser',
}: PeriodRangeFilterProps) {
  const [showPresetMenu, setShowPresetMenu] = useState(false)
  const presetLabel = presetKey ? PERIOD_PRESETS.find((p) => p.key === presetKey)?.label ?? 'Personnalisé' : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
        <Calendar className="h-4 w-4" />
        <input
          type="date"
          value={periodStart}
          onChange={(e) => onDatesChange(e.target.value, periodEnd)}
          className="w-[112px] bg-transparent text-slate-700 focus:outline-none"
        />
        <span className="text-slate-300">—</span>
        <Calendar className="h-4 w-4" />
        <input
          type="date"
          value={periodEnd}
          onChange={(e) => onDatesChange(periodStart, e.target.value)}
          className="w-[112px] bg-transparent text-slate-700 focus:outline-none"
        />
      </div>

      {onPresetChange && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresetMenu((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Période : <span className="font-semibold text-slate-900">{presetLabel}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {showPresetMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowPresetMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {PERIOD_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => {
                      onPresetChange(preset.key)
                      setShowPresetMenu(false)
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      preset.key === presetKey ? 'font-semibold text-indigo-600' : 'text-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {resetLabel}
        </button>
      )}
    </div>
  )
}
