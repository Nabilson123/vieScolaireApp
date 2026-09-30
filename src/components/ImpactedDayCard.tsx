import { useState } from 'react'
import { useStudents } from '../services/studentsService'
import { useStudentExtras } from '../services/studentDetailsService'
import { useTeachers } from '../services/teachersService'
import { useTeacherExtras } from '../services/teacherExtrasService'
import { computeHeuresManqueesParJour } from '../utils/dashboardTrend'
import { formatHeures } from '../utils/teacherAggregation'

const COLOR_ELEVES = '#6366F1'
const COLOR_PROFS = '#14B8A6'

export default function ImpactedDayCard() {
  const { data: students } = useStudents()
  const { data: studentExtras } = useStudentExtras()
  const { data: teachers } = useTeachers()
  const { data: teacherExtras } = useTeacherExtras()
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)

  if (!students || !studentExtras || !teachers || !teacherExtras) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-400">Chargement...</p>
      </div>
    )
  }

  const days = computeHeuresManqueesParJour(students, studentExtras, teachers, teacherExtras)
  const maxHeures = Math.max(...days.map((d) => d.heures))
  const worstDay = days.find((d) => d.heures === maxHeures)
  const activeDay = days.find((d) => d.label === selectedLabel) ?? worstDay
  const isWorstDaySelected = activeDay && worstDay && activeDay.label === worstDay.label && maxHeures > 0

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Jour le Plus Impacté</h3>
        <span className="text-[11px] text-slate-400">Par heures manquées, historique complet</span>
      </div>

      {activeDay && (
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-indigo-600">{activeDay.heures > 0 ? formatHeures(activeDay.heures) : '0h'}</span>
          {isWorstDaySelected && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">Record</span>
          )}
        </div>
      )}
      {activeDay && (
        <p className="text-xs text-slate-500">
          {activeDay.label} · Élèves : {formatHeures(activeDay.heuresEleves)} · Profs : {formatHeures(activeDay.heuresProfs)}
        </p>
      )}

      {activeDay && isWorstDaySelected && (activeDay.topEleves.length > 0 || activeDay.topProfs.length > 0) && (
        <div className="mt-2 space-y-2 text-xs">
          {activeDay.topEleves.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-slate-500">Élèves les plus concernés</p>
              <ul className="space-y-1">
                {activeDay.topEleves.map((p) => (
                  <li key={p.name} className="text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 font-medium text-slate-800">{formatHeures(p.heures)}</span>
                    </div>
                    <p className="truncate text-[10px] text-slate-400">{p.dates.join(', ')}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {activeDay.topProfs.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-slate-500">Profs les plus concernés</p>
              <ul className="space-y-1">
                {activeDay.topProfs.map((p) => (
                  <li key={p.name} className="text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className="shrink-0 font-medium text-slate-800">{formatHeures(p.heures)}</span>
                    </div>
                    <p className="truncate text-[10px] text-slate-400">{p.dates.join(', ')}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex h-20 items-end justify-between gap-1">
        {days.map((day) => {
          const total = day.heures
          const heightPct = maxHeures > 0 ? Math.max(4, Math.round((total / maxHeures) * 100)) : 4
          const elevesSharePct = total > 0 ? Math.round((day.heuresEleves / total) * 100) : 0
          const isSelected = activeDay?.label === day.label
          return (
            <button
              key={day.label}
              type="button"
              onClick={() => setSelectedLabel(day.label)}
              aria-pressed={isSelected}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-1 transition-colors ${
                isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
              }`}
            >
              <span className={`text-[10px] ${isSelected ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>
                {total > 0 ? formatHeures(total) : '0h'}
              </span>
              <div className="flex w-full flex-col justify-end overflow-hidden rounded-md px-1" style={{ height: `${heightPct}%` }}>
                {day.heuresProfs > 0 && (
                  <div className="w-full" style={{ height: `${100 - elevesSharePct}%`, background: COLOR_PROFS }} />
                )}
                {day.heuresEleves > 0 && <div className="w-full" style={{ height: `${elevesSharePct}%`, background: COLOR_ELEVES }} />}
                {total === 0 && <div className="w-full flex-1" style={{ background: '#E2E8F0' }} />}
              </div>
              <span className={`text-[10px] ${isSelected ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>{day.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: COLOR_ELEVES }} />
          Élèves
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: COLOR_PROFS }} />
          Profs
        </span>
      </div>
    </div>
  )
}
