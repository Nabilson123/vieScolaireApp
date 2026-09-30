import SchoolLogo from '../print/SchoolLogo'
import MonthGrid from '../calendar/MonthGrid'
import CalendarLegend from '../calendar/CalendarLegend'
import type { CalendarEvent, MonthGridCell } from '../../utils/calendarAggregation'

interface PrintableCalendarReportProps {
  title: string
  subtitle: string
  grid: MonthGridCell[]
  eventsByDay: Record<string, CalendarEvent[]>
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

export default function PrintableCalendarReport({ title, subtitle, grid, eventsByDay }: PrintableCalendarReportProps) {
  return (
    <div id="printable-calendar-report" className="print-page bg-white px-8 py-6 text-slate-800">
      <header className="mb-4 grid grid-cols-3 items-center border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Groupe Scolaire Mondrian</p>
          <p className="text-[9px] uppercase tracking-wide text-slate-500">École de la Bienveillance</p>
        </div>
        <SchoolLogo size={72} />
        <div className="text-right">
          <p className="text-xs font-bold text-slate-900">{title}</p>
          <p className="text-[10px] text-slate-500 capitalize">{subtitle}</p>
          <p className="text-[10px] text-slate-500">Édité le {todayFR()}</p>
        </div>
      </header>

      <MonthGrid grid={grid} eventsByDay={eventsByDay} maxVisible={5} cellHeight={120} />

      <div className="mt-4">
        <CalendarLegend />
      </div>

      <div className="mt-4 border-t border-slate-200 pt-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        Direction de la Vie Scolaire
      </div>
    </div>
  )
}
