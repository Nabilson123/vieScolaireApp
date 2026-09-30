import { UserX, Clock3, CalendarClock } from 'lucide-react'

export default function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
      <span className="flex items-center gap-1.5">
        <UserX className="h-3.5 w-3.5 text-rose-500" />
        <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Absence
      </span>
      <span className="flex items-center gap-1.5">
        <Clock3 className="h-3.5 w-3.5 text-amber-500" />
        <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Retard
      </span>
      <span className="flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5 text-emerald-500" />
        <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Rendez-vous Parents
      </span>
      <span className="h-4 w-px bg-slate-200" />
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Plein = Justifié / Réalisé
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-slate-400 bg-white" /> Pointillés = Non justifié / Planifié
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-slate-300 bg-slate-50" /> Grisé = Annulé
      </span>
    </div>
  )
}
