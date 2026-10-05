import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, X } from 'lucide-react'
import type { EventRecord } from '../data/studentDetails'
import { getStudentExtraSnapshot, updateStudentEventJustified, updateStudentEvents } from '../services/studentDetailsService'
import { recomputeStudentAttendance } from '../data/students'
import EventCard from './student-detail/EventCard'
import EditEventModal from './student-detail/EditEventModal'

interface CorrigerSignalementModalProps {
  studentId: string
  studentName: string
  classe: string
  date: string
  type: 'ABSENCE' | 'RETARD'
  /** Même découpage matin / après-midi que le tableau d'où l'on vient (heure de début de l'événement). */
  isInPeriod: (event: EventRecord) => boolean
  periodLabel: string
  /** Appelé après chaque modification, pour que le tableau d'origine se recalcule. */
  onChanged: () => void
  onClose: () => void
}

/**
 * Corriger un signalement d'absence/retard saisi par erreur depuis le Bilan Journalier : lister les
 * événements de l'élève pour ce jour et ce créneau, puis les modifier (type, durée, motif...) ou les
 * supprimer — mêmes actions et mêmes effets de bord (recalcul de l'assiduité) que l'onglet Absences de la
 * fiche élève.
 */
export default function CorrigerSignalementModal({
  studentId,
  studentName,
  classe,
  date,
  type,
  isInPeriod,
  periodLabel,
  onChanged,
  onClose,
}: CorrigerSignalementModalProps) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<EventRecord | null>(null)
  const [, setTick] = useState(0)

  // Relu à chaque rendu depuis le cache : après une modification ou une suppression, la liste reflète l'état réel.
  const events = getStudentExtraSnapshot(studentId).events.filter((e) => e.date === date && e.type === type && isInPeriod(e))

  const refresh = () => {
    setTick((v) => v + 1)
    onChanged()
  }

  const handleDelete = async (target: EventRecord) => {
    const remaining = getStudentExtraSnapshot(studentId).events.filter((e) => e !== target)
    await updateStudentEvents(studentId, remaining)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    await recomputeStudentAttendance(studentId, remaining)
    await queryClient.invalidateQueries({ queryKey: ['students'] })
    refresh()
  }

  const dateFR = date.split('-').reverse().join('/')

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
        <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Pencil className="h-5 w-5 text-indigo-500" />
                Corriger le signalement
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {studentName} · {classe} · {type === 'ABSENCE' ? 'Absence' : 'Retard'} du {dateFR} ({periodLabel})
              </p>
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 overflow-y-auto px-6 py-5">
            <p className="text-xs text-slate-400">
              Modifiez le type (absence ↔ retard), la durée ou le motif, ou supprimez ce qui a été saisi par erreur.
            </p>
            {events.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm italic text-slate-400">Plus aucun signalement pour ce créneau.</p>
            ) : (
              events.map((event, idx) => (
                <EventCard
                  key={`${event.subject}-${event.start ?? ''}-${idx}`}
                  event={event}
                  onToggleJustified={async () => {
                    await updateStudentEventJustified(studentId, event, !event.justified)
                    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
                    refresh()
                  }}
                  onEdit={() => setEditing(event)}
                  onDelete={() => handleDelete(event)}
                />
              ))
            )}
          </div>

          <div className="flex justify-end border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Fermer
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <EditEventModal
          studentId={studentId}
          event={editing}
          onClose={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </>
  )
}
