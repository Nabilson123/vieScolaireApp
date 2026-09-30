import { useState } from 'react'
import { X, Plus, Trash2, Settings2 } from 'lucide-react'
import type { CreneauFixe, CreneauFixeIcon } from '../services/servicesCapaciteService'
import { SCHEDULE_DAYS } from '../data/classSchedules'
import { CRENEAU_ICON_OPTIONS, getCreneauIcon } from '../utils/creneauFixeIcons'

const DAY_SHORT_LABELS: Record<string, string> = { LUNDI: 'L', MARDI: 'M', MERCREDI: 'M', JEUDI: 'J', VENDREDI: 'V' }

function daysSummary(days: string[] | undefined): string {
  if (!days?.length) return 'Tous les jours'
  return days.map((d) => DAY_SHORT_LABELS[d] ?? d).join(', ')
}

interface TimelineCreneauxModalProps {
  creneaux: CreneauFixe[]
  onSave: (next: CreneauFixe[]) => void
  onClose: () => void
  isEditable: boolean
}

export default function TimelineCreneauxModal({ creneaux, onSave, onClose, isEditable }: TimelineCreneauxModalProps) {
  const [list, setList] = useState<CreneauFixe[]>(creneaux)
  const [label, setLabel] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [icon, setIcon] = useState<CreneauFixeIcon>('autre')
  const [days, setDays] = useState<string[]>(SCHEDULE_DAYS)

  const canAdd = label.trim() !== '' && start !== '' && end !== '' && start < end

  const toggleDay = (day: string) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => SCHEDULE_DAYS.indexOf(a) - SCHEDULE_DAYS.indexOf(b))))
  }

  const handleAdd = () => {
    if (!canAdd) return
    const entry: CreneauFixe = { label: label.trim(), start, end, icon, days: days.length === SCHEDULE_DAYS.length ? undefined : days }
    setList((prev) => [...prev, entry].sort((a, b) => (a.start < b.start ? -1 : 1)))
    setLabel('')
    setStart('')
    setEnd('')
    setIcon('autre')
    setDays(SCHEDULE_DAYS)
  }

  const handleRemove = (idx: number) => {
    setList((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    onSave(list)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            Créneaux fixes de la journée
            <Settings2 className="h-5 w-5 text-slate-700" />
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-xs text-slate-500">
            Ces créneaux (récréation, cantine, étude...) s'affichent chaque jour sur la timeline du Cockpit — ils ne viennent
            d'aucun emploi du temps, à configurer une fois pour toutes.
          </p>

          {!isEditable && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Année en lecture seule — basculez sur l'année active pour modifier ces créneaux.
            </div>
          )}

          <div className="space-y-2">
            {list.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Aucun créneau fixe configuré.</p>
            ) : (
              list.map((c, idx) => {
                const CreneauIcon = getCreneauIcon(c.icon)
                return (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <CreneauIcon className="h-4 w-4 shrink-0 text-slate-400" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{c.label}</p>
                        <p className="text-xs text-slate-500">
                          {c.start} - {c.end} · {daysSummary(c.days)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      disabled={!isEditable}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">Ajouter un créneau</p>
            <div className="mb-2 flex gap-1.5">
              {CRENEAU_ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIcon(opt.value)}
                  disabled={!isEditable}
                  title={opt.label}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    icon === opt.value ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <opt.Icon className="h-3.5 w-3.5" />
                </button>
              ))}
              <span className="ml-1 flex items-center text-[11px] text-slate-400">{CRENEAU_ICON_OPTIONS.find((o) => o.value === icon)?.label}</span>
            </div>
            <div className="mb-2 flex gap-1.5">
              {SCHEDULE_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  disabled={!isEditable}
                  title={day.charAt(0) + day.slice(1).toLowerCase()}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    days.includes(day) ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {DAY_SHORT_LABELS[day]}
                </button>
              ))}
              <span className="ml-1 flex items-center text-[11px] text-slate-400">{daysSummary(days.length === SCHEDULE_DAYS.length ? undefined : days)}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex : Récréation"
                disabled={!isEditable}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
              />
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={!isEditable}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
              />
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={!isEditable}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
              />
            </div>
            {label.trim() !== '' && (start === '' || end === '') && (
              <p className="mt-1.5 text-[11px] text-amber-600">
                Heure de début et de fin requises pour activer "Ajouter" — si votre navigateur affiche un sélecteur en
                12h (AM/PM), vérifiez que l'indicateur AM/PM est bien réglé, sinon l'heure reste incomplète et ne se
                valide pas.
              </p>
            )}
            {start !== '' && end !== '' && start >= end && (
              <p className="mt-1.5 text-[11px] text-amber-600">
                L'heure de fin doit être après l'heure de début (vérifiez l'AM/PM si l'heure choisie est l'après-midi).
              </p>
            )}
            <button
              type="button"
              onClick={handleAdd}
              disabled={!isEditable || !canAdd}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isEditable}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
