import { useState } from 'react'
import { CalendarCheck, DoorOpen, LogIn, Trash2, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { EventRecord } from '../../data/studentDetails'
import { getStudentExtraSnapshot, updateStudentEventJustified, updateStudentEvents } from '../../services/studentDetailsService'
import { recomputeStudentAttendance } from '../../data/students'
import { useSortiesAnticipees, useDeleteSortieAnticipee, useReintegrerSortieAnticipee } from '../../services/sortiesAnticipeesService'
import EventCard from './EventCard'
import EditEventModal from './EditEventModal'

interface AbsencesTabProps {
  studentId: string
  events: EventRecord[]
}

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AbsencesTab({ studentId, events }: AbsencesTabProps) {
  const queryClient = useQueryClient()
  const { data: sorties = [] } = useSortiesAnticipees()
  const sortiesEleve = sorties.filter((s) => s.studentId === studentId)
  const deleteSortie = useDeleteSortieAnticipee()
  const reintegrerSortie = useReintegrerSortieAnticipee()
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null)
  const [confirmDeleteSortieId, setConfirmDeleteSortieId] = useState<string | null>(null)
  const [reintegrerSortieId, setReintegrerSortieId] = useState<string | null>(null)
  const [heureRetour, setHeureRetour] = useState('')

  const handleDelete = async (target: EventRecord) => {
    const remaining = getStudentExtraSnapshot(studentId).events.filter((e) => e !== target)
    await updateStudentEvents(studentId, remaining)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    await recomputeStudentAttendance(studentId, remaining)
    await queryClient.invalidateQueries({ queryKey: ['students'] })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Historique Détaillé des Absences & Retards</h3>
        </div>

        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Aucun événement enregistré.</p>
        ) : (
          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {events.map((event, idx) => (
              <EventCard
                key={idx}
                event={event}
                onToggleJustified={async () => {
                  await updateStudentEventJustified(studentId, event, !event.justified)
                  await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
                }}
                onEdit={() => setEditingEvent(event)}
                onDelete={() => handleDelete(event)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800">Sorties anticipées</h3>
        </div>

        {sortiesEleve.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Aucune sortie anticipée enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {sortiesEleve.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {s.date} à {s.heure}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {s.source === 'parent' && (
                      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-600">
                        Déclarée par le parent
                      </span>
                    )}
                    {s.heureRetour ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600">
                        Revenu(e) à {s.heureRetour} ✓
                      </span>
                    ) : reintegrerSortieId === s.id ? (
                      <>
                        <input
                          type="time"
                          value={heureRetour}
                          onChange={(e) => setHeureRetour(e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700 focus:border-indigo-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!heureRetour) return
                            reintegrerSortie.mutate({ id: s.id, studentId, heureRetour })
                            setReintegrerSortieId(null)
                          }}
                          disabled={!heureRetour}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setReintegrerSortieId(null)}
                          title="Annuler"
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : confirmDeleteSortieId === s.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            deleteSortie.mutate({ id: s.id, studentId })
                            setConfirmDeleteSortieId(null)
                          }}
                          className="rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSortieId(null)}
                          title="Annuler"
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setReintegrerSortieId(s.id)
                            setHeureRetour(nowHHMM())
                          }}
                          title="Réintégrer (l'élève est revenu finir sa journée)"
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        >
                          <LogIn className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSortieId(s.id)}
                          title="Supprimer (déclarée par erreur)"
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-600">Récupéré par : {s.recuperePar}</p>
                {s.motif && <p className="mt-1 text-xs italic text-slate-400">Motif : "{s.motif}"</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {editingEvent && <EditEventModal studentId={studentId} event={editingEvent} onClose={() => setEditingEvent(null)} />}
    </div>
  )
}
