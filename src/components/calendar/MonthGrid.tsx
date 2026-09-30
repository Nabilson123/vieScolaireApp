import type { CalendarEvent } from '../../utils/calendarAggregation'
import type { MonthGridCell } from '../../utils/calendarAggregation'

const DAY_LABELS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']

function eventBarClasses(e: CalendarEvent): string {
  const base = 'truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight'
  if (e.cancelled) return `${base} border border-dashed border-slate-300 bg-slate-50 text-slate-400 line-through`
  const colorMap: Record<CalendarEvent['kind'], { solid: string; dotted: string }> = {
    ABSENCE: { solid: 'bg-rose-500 text-white', dotted: 'border border-dashed border-rose-400 bg-rose-50 text-rose-600' },
    RETARD: { solid: 'bg-amber-500 text-white', dotted: 'border border-dashed border-amber-400 bg-amber-50 text-amber-700' },
    RDV: { solid: 'bg-emerald-500 text-white', dotted: 'border border-dashed border-emerald-400 bg-emerald-50 text-emerald-700' },
  }
  const variant = colorMap[e.kind][e.status === 'plein' ? 'solid' : 'dotted']
  return `${base} ${variant}`
}

interface MonthGridProps {
  grid: MonthGridCell[]
  eventsByDay: Record<string, CalendarEvent[]>
  todayISO?: string
  maxVisible?: number
  onDayClick?: (date: string, events: CalendarEvent[]) => void
  cellHeight?: number
}

export default function MonthGrid({ grid, eventsByDay, todayISO, maxVisible = 3, onDayClick, cellHeight = 100 }: MonthGridProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((cell) => {
          const events = eventsByDay[cell.date] ?? []
          const visible = events.slice(0, maxVisible)
          const hidden = events.length - visible.length
          const isToday = cell.date === todayISO
          return (
            <button
              key={cell.date}
              type="button"
              onClick={onDayClick ? () => onDayClick(cell.date, events) : undefined}
              disabled={!onDayClick}
              className={`flex flex-col gap-0.5 border-b border-r border-slate-100 p-1.5 text-left last:border-r-0 ${
                cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/60'
              } ${onDayClick ? 'hover:bg-indigo-50/40' : ''}`}
              style={{ height: cellHeight }}
            >
              <span
                className={`text-xs font-semibold ${
                  !cell.isCurrentMonth ? 'text-slate-300' : isToday ? 'flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white' : 'text-slate-600'
                }`}
              >
                {cell.day}
              </span>
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {cell.isCurrentMonth &&
                  visible.map((e) => (
                    <span key={e.id} className={eventBarClasses(e)}>
                      {e.label}
                    </span>
                  ))}
                {cell.isCurrentMonth && hidden > 0 && <span className="text-[9px] font-semibold text-slate-400">+{hidden} autres</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
