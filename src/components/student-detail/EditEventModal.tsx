import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, X } from 'lucide-react'
import { colorForSubject, type EventRecord } from '../../data/studentDetails'
import { getStudentExtraSnapshot, updateStudentEvents } from '../../services/studentDetailsService'
import { parseDuration, recomputeStudentAttendance } from '../../data/students'
import { formatHeures } from '../../utils/teacherAggregation'
import { useAbsencesConfig } from '../../services/absencesConfigService'
import { useIsViewedYearEditable } from '../../services/viewedYear'

interface EditEventModalProps {
  studentId: string
  event: EventRecord
  onClose: () => void
}

export default function EditEventModal({ studentId, event, onClose }: EditEventModalProps) {
  const queryClient = useQueryClient()
  const { data: absencesConfig } = useAbsencesConfig()
  const motifOptions = absencesConfig?.motifs ?? []
  const isEditable = useIsViewedYearEditable()

  const initialMinutes = parseDuration(event.duree)
  const [type, setType] = useState<EventRecord['type']>(event.type)
  const [date, setDate] = useState(event.date)
  const [start, setStart] = useState(event.start ?? '')
  const [subject, setSubject] = useState(event.subject)
  const [hours, setHours] = useState(Math.floor(initialMinutes / 60))
  const [minutes, setMinutes] = useState(initialMinutes % 60)
  const [motif, setMotif] = useState(event.motif)
  const [justified, setJustified] = useState(event.justified)
  const [saving, setSaving] = useState(false)

  const totalMinutes = hours * 60 + minutes
  const canSave = isEditable && date.trim() !== '' && subject.trim() !== '' && totalMinutes > 0

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const updated: EventRecord = {
        date,
        type,
        justified,
        subject: subject.trim(),
        subjectColor: colorForSubject(subject.trim()),
        duree: formatHeures(totalMinutes / 60),
        motif,
        start: start || undefined,
      }
      const events = getStudentExtraSnapshot(studentId).events.map((e) => (e === event ? updated : e))
      await updateStudentEvents(studentId, events)
      await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      await recomputeStudentAttendance(studentId, events)
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Pencil className="h-5 w-5 text-indigo-500" />
            Modifier l'événement
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {!isEditable && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Année en lecture seule — basculez sur l'année active pour modifier.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EventRecord['type'])}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="ABSENCE">Absence</option>
                <option value="RETARD">Retard</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Matière</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {type === 'RETARD' ? "Heure d'arrivée" : 'Heure (optionnel)'}
              </label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Durée manquée</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={hours}
                onChange={(e) => setHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
              <span className="shrink-0 text-sm text-slate-500">h</span>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
              <span className="shrink-0 text-sm text-slate-500">min</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motif</label>
            <select
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">Sélectionner un motif...</option>
              {motifOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              {motif && !motifOptions.includes(motif) && <option value={motif}>{motif}</option>}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={justified}
              onChange={(e) => setJustified(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            />
            Justifié
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
