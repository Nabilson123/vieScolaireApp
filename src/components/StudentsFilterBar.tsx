import { Search, Calendar, RotateCcw } from 'lucide-react'
import { getClassOptions } from '../data/students'

interface StudentsFilterBarProps {
  total: number
  search: string
  onSearchChange: (value: string) => void
  selectedClass: string
  onClassChange: (value: string) => void
  periodStart: string
  periodEnd: string
  onPeriodStartChange: (value: string) => void
  onPeriodEndChange: (value: string) => void
  onResetPeriod: () => void
}

export default function StudentsFilterBar({
  total,
  search,
  onSearchChange,
  selectedClass,
  onClassChange,
  periodStart,
  periodEnd,
  onPeriodStartChange,
  onPeriodEndChange,
  onResetPeriod,
}: StudentsFilterBarProps) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Filtrer par classe</label>
          <select
            value={selectedClass}
            onChange={(e) => onClassChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
          >
            {getClassOptions().map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Rechercher un élève</label>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Nom..."
              className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="w-full sm:w-auto">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Date d'entrée</label>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">
            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
            <span>Du :</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => onPeriodStartChange(e.target.value)}
              className="w-[130px] min-w-0 bg-transparent text-slate-700 focus:outline-none"
            />
            <span>au</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => onPeriodEndChange(e.target.value)}
              className="w-[130px] min-w-0 bg-transparent text-slate-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={onResetPeriod}
              title="Réinitialiser la période"
              className="ml-1 rounded-md p-1 text-slate-400 hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="ml-auto rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
          Total : <span className="font-bold text-slate-900">{total}</span> élève(s)
        </div>
      </div>
    </div>
  )
}
