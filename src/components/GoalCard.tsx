import { useStudents } from '../services/studentsService'
import { useStudentExtras } from '../services/studentDetailsService'
import { computeEcolePeriodStats } from '../data/students'

const TARGET = 95

export default function GoalCard() {
  const { data: students } = useStudents()
  const { data: studentExtras } = useStudentExtras()

  if (!students || !studentExtras) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-400">Chargement...</p>
      </div>
    )
  }

  const { tauxPresence: current } = computeEcolePeriodStats(students, studentExtras, '', '')
  const reached = current >= TARGET
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(current / 100, 1)
  const offset = circumference * (1 - progress)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Objectif d'Assiduité</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            reached ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}
        >
          Cible {TARGET}%
        </span>
      </div>

      <div className="flex items-center gap-4">
        <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0 -rotate-90">
          <circle cx="42" cy="42" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle
            cx="42"
            cy="42"
            r={radius}
            fill="none"
            stroke={reached ? '#10b981' : '#f43f5e'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div>
          <p className="text-xl font-bold text-slate-900">{current}%</p>
          <p className="text-xs text-slate-500">
            {reached
              ? `Objectif dépassé de +${(current - TARGET).toFixed(1)} pt`
              : `Objectif non atteint (-${(TARGET - current).toFixed(1)} pt)`}
          </p>
        </div>
      </div>
    </div>
  )
}
