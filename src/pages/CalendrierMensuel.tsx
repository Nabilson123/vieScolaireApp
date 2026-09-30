import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getClassOptions, type Student } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import { teacherName, type Teacher } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import {
  computeCalendarEvents,
  groupEventsByDay,
  computeMonthStats,
  buildMonthGrid,
  monthLabel,
  addMonths,
  isBeforeSchoolYear,
  isAfterSchoolYear,
  findNearestMonthWithEvent,
  type CalendarTarget,
  type CalendarEvent,
} from '../utils/calendarAggregation'
import MonthGrid from '../components/calendar/MonthGrid'
import CalendarLegend from '../components/calendar/CalendarLegend'
import DayDetailModal from '../components/calendar/DayDetailModal'
import CalendarPrintPreviewModal from '../components/calendar-print/CalendarPrintPreviewModal'

interface CalendrierMensuelProps {
  onNavigateToStudent: (id: string) => void
  onNavigateToTeacher: (id: string) => void
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function initialViewDate() {
  const events = computeCalendarEvents('eleves', {})
  const today = new Date()
  return findNearestMonthWithEvent(events, today.getFullYear(), today.getMonth() + 1) ?? {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  }
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <p className="mb-1 text-[11px] font-semibold text-slate-500">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-lg font-bold text-slate-900">{value}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}

function TrendBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="flex items-center gap-0.5 text-[11px] font-medium text-slate-400"><Minus className="h-3 w-3" />0</span>
  if (delta > 0) return <span className="flex items-center gap-0.5 text-[11px] font-semibold text-rose-500"><TrendingUp className="h-3 w-3" />+{delta}</span>
  return <span className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600"><TrendingDown className="h-3 w-3" />{delta}</span>
}

export default function CalendrierMensuel({ onNavigateToStudent, onNavigateToTeacher }: CalendrierMensuelProps) {
  const [target, setTarget] = useState<CalendarTarget>('eleves')
  const [classe, setClasse] = useState('Toutes les classes')
  const [personId, setPersonId] = useState('')
  const [viewYear, setViewYear] = useState(() => initialViewDate().year)
  const [viewMonth, setViewMonth] = useState(() => initialViewDate().month)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showPrintPreview, setShowPrintPreview] = useState(false)

  const filters = { classe: target === 'eleves' ? classe : undefined, personId: personId || undefined }
  const events = computeCalendarEvents(target, filters)
  const eventsByDay = groupEventsByDay(events, viewYear, viewMonth)
  const grid = buildMonthGrid(viewYear, viewMonth)
  const stats = computeMonthStats(events, viewYear, viewMonth)
  const prev = addMonths(viewYear, viewMonth, -1)
  const prevStats = computeMonthStats(events, prev.year, prev.month)

  const prevNav = addMonths(viewYear, viewMonth, -1)
  const nextNav = addMonths(viewYear, viewMonth, 1)
  const canGoPrev = !isBeforeSchoolYear(prevNav.year, prevNav.month)
  const canGoNext = !isAfterSchoolYear(nextNav.year, nextNav.month)

  const personOptions =
    target === 'eleves'
      ? getStudentsSnapshot().filter((s) => classe === 'Toutes les classes' || s.classe === classe)
      : getTeachersSnapshot()

  const handleTargetChange = (value: CalendarTarget) => {
    setTarget(value)
    setClasse('Toutes les classes')
    setPersonId('')
  }

  const handlePersonChange = (id: string) => {
    setPersonId(id)
    if (id) {
      const personEvents = computeCalendarEvents(target, { classe: target === 'eleves' ? classe : undefined, personId: id })
      const nearest = findNearestMonthWithEvent(personEvents, viewYear, viewMonth)
      if (nearest) {
        setViewYear(nearest.year)
        setViewMonth(nearest.month)
      }
    }
  }

  const handleToday = () => {
    const d = new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth() + 1)
  }

  const handleOpenFiche = (e: CalendarEvent) => {
    setSelectedDate(null)
    if (e.personType === 'eleve') onNavigateToStudent(e.personId)
    else onNavigateToTeacher(e.personId)
  }

  const printTitle = `Calendrier Mensuel — ${target === 'eleves' ? 'Élèves' : 'Enseignants'}`
  const printSubtitle = monthLabel(viewYear, viewMonth)

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Calendrier Mensuel
            <CalendarDays className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">Consultez la répartition des absences et retards par jour pour les élèves et les enseignants.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={target}
            onChange={(e) => handleTargetChange(e.target.value as CalendarTarget)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            <option value="eleves">Cible : Élèves</option>
            <option value="enseignants">Cible : Enseignants</option>
          </select>
          {target === 'eleves' && (
            <select
              value={classe}
              onChange={(e) => {
                setClasse(e.target.value)
                setPersonId('')
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
            >
              {getClassOptions().map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <select
            value={personId}
            onChange={(e) => handlePersonChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            <option value="">{target === 'eleves' ? 'Tous les élèves' : 'Tous les enseignants'}</option>
            {target === 'eleves'
              ? (personOptions as Student[]).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              : (personOptions as Teacher[]).map((t) => (
                  <option key={t.id} value={t.id}>
                    {teacherName(t)}
                  </option>
                ))}
          </select>
          <button
            type="button"
            onClick={() => setShowPrintPreview(true)}
            title="Télécharger le calendrier"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Absences" value={String(stats.totalAbsences)} />
        <StatCard label="Retards" value={String(stats.totalRetards)} />
        <StatCard label="Rendez-vous" value={String(stats.totalRdv)} />
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="mb-1 text-[11px] font-semibold text-slate-500">% Justifié</p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-slate-900">{stats.pctJustifie}%</p>
            <TrendBadge delta={stats.totalAbsences + stats.totalRetards - (prevStats.totalAbsences + prevStats.totalRetards)} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setViewYear(prevNav.year)
              setViewMonth(prevNav.month)
            }}
            disabled={!canGoPrev}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold capitalize text-slate-900">{monthLabel(viewYear, viewMonth)}</h2>
            <button
              type="button"
              onClick={handleToday}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Aujourd'hui
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setViewYear(nextNav.year)
              setViewMonth(nextNav.month)
            }}
            disabled={!canGoNext}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <MonthGrid grid={grid} eventsByDay={eventsByDay} todayISO={todayISO()} onDayClick={(date) => setSelectedDate(date)} />

        <div className="mt-4 border-t border-slate-100 pt-3">
          <CalendarLegend />
        </div>
      </div>

      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          events={eventsByDay[selectedDate] ?? []}
          onClose={() => setSelectedDate(null)}
          onOpenFiche={handleOpenFiche}
        />
      )}

      {showPrintPreview && (
        <CalendarPrintPreviewModal
          title={printTitle}
          subtitle={printSubtitle}
          grid={grid}
          eventsByDay={eventsByDay}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  )
}
