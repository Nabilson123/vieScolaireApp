import { X, UserX, Clock3, CalendarClock, ArrowUpRight } from 'lucide-react'
import type { CalendarEvent } from '../../utils/calendarAggregation'

interface DayDetailModalProps {
  date: string
  events: CalendarEvent[]
  onClose: () => void
  onOpenFiche: (event: CalendarEvent) => void
}

function formatDateFR(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const KIND_META: Record<CalendarEvent['kind'], { label: string; icon: typeof UserX; color: string }> = {
  ABSENCE: { label: 'Absence', icon: UserX, color: 'text-rose-600 bg-rose-50' },
  RETARD: { label: 'Retard', icon: Clock3, color: 'text-amber-600 bg-amber-50' },
  RDV: { label: 'Rendez-vous Parents', icon: CalendarClock, color: 'text-emerald-600 bg-emerald-50' },
}

export default function DayDetailModal({ date, events, onClose, onOpenFiche }: DayDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold capitalize text-slate-900">{formatDateFR(date)}</h2>
            <p className="text-xs text-slate-500">{events.length} événement(s)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aucun événement ce jour-là.</p>
          ) : (
            events.map((e) => {
              const meta = KIND_META[e.kind]
              const Icon = meta.icon
              return (
                <div key={e.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {e.personName}
                          {e.cancelled && <span className="ml-1.5 text-[10px] font-medium uppercase text-slate-400">Annulé</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {meta.label}
                          {e.subject && ` · ${e.subject}`}
                          {e.classe && e.personType === 'eleve' && ` · ${e.classe}`}
                          {e.classe && e.personType === 'enseignant' && ` · Classe ${e.classe}`}
                          {e.rdvWith && e.personType === 'eleve' && ` · avec ${e.rdvWith}`}
                          {e.rdvWith && e.personType === 'enseignant' && ` · élève ${e.rdvWith}`}
                        </p>
                        {e.motif && <p className="mt-1 text-xs text-slate-500">{e.motif}</p>}
                        <p className="mt-1 text-[11px]">
                          {e.kind === 'RDV' ? (
                            <span
                              className={
                                e.cancelled
                                  ? 'text-slate-400'
                                  : e.status === 'plein'
                                    ? 'font-semibold text-emerald-600'
                                    : 'font-semibold text-slate-500'
                              }
                            >
                              {e.statutRdv}
                            </span>
                          ) : (
                            <span className={e.justified ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                              {e.justified ? 'Justifié' : 'Non justifié'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenFiche(e)}
                      title="Voir la fiche"
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Fiche
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
