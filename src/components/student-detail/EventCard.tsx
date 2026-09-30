import { useState } from 'react'
import { Check, Undo2, Trash2, Pencil, X } from 'lucide-react'
import { subjectColorClasses, type EventRecord } from '../../data/studentDetails'

interface EventCardProps {
  event: EventRecord
  onToggleJustified?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export default function EventCard({ event, onToggleJustified, onEdit, onDelete }: EventCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{event.date}</span>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600">
            {event.type}
          </span>
          {event.justified && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600">
              <Check className="h-3 w-3" />
              JUSTIFIÉ
            </span>
          )}
        </div>
      </div>
      <p className="mb-1 text-sm text-slate-600">
        <span
          className={`mr-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${subjectColorClasses[event.subjectColor]}`}
        >
          {event.subject.toUpperCase()}
        </span>
        | Durée : {event.duree}
      </p>
      <p className="mb-2 text-xs italic text-slate-400">Motif : "{event.motif}"</p>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onToggleJustified}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
        >
          {event.justified ? (
            <>
              <Undo2 className="h-3 w-3" />
              Rendre injustifié
            </>
          ) : (
            <>
              <Check className="h-3 w-3" />
              Justifier
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onEdit}
          title="Modifier"
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {confirmingDelete ? (
          <>
            <button
              type="button"
              onClick={() => {
                onDelete?.()
                setConfirmingDelete(false)
              }}
              className="rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              title="Annuler"
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            title="Supprimer"
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
