import { useState } from 'react'
import { getActiveClassNamesSnapshot } from '../../services/classesService'
import { useClassSchedules } from '../../services/classSchedulesService'
import { computeClassSchedule } from '../../utils/classAggregation'
import ScheduleTimeGrid from '../schedule/ScheduleTimeGrid'

function mondayOf(dateStr: string): Date {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function formatDDMM(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

const SCHEDULE_DAYS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']

export default function ReplacementScheduleTab() {
  const activeClasses = getActiveClassNamesSnapshot()
  const [selectedClasse, setSelectedClasse] = useState(activeClasses[0] ?? '')
  const [weekDate, setWeekDate] = useState(todayISO())
  // Abonnement direct : computeClassSchedule() lit un cache module-level qui ne se re-render pas
  // tout seul quand l'année change dans la Sidebar.
  useClassSchedules()

  const schedule = selectedClasse ? computeClassSchedule(selectedClasse) : {}
  const monday = mondayOf(weekDate)

  const gridSchedule = Object.fromEntries(
    Object.entries(schedule).map(([day, slots]) => [
      day,
      slots.map((s) => ({ id: s.id, subject: s.subject, start: s.start, end: s.end, hours: s.hours, subtitle: `Prof. ${s.teacherName}` })),
    ])
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Filtrer par : Classe</span>
        </div>
        <select
          value={selectedClasse}
          onChange={(e) => setSelectedClasse(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
        >
          {activeClasses.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-slate-500">Semaine du :</span>
          <input
            type="date"
            value={weekDate}
            onChange={(e) => setWeekDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <ScheduleTimeGrid
          schedule={gridSchedule}
          dayHeaderExtra={(day) => {
            const idx = SCHEDULE_DAYS.indexOf(day)
            const dayDate = new Date(monday)
            dayDate.setDate(monday.getDate() + idx)
            return <p className="text-[11px] font-semibold text-indigo-500">{formatDDMM(dayDate)}</p>
          }}
        />
      </div>
    </div>
  )
}
