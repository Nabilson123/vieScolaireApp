import { useMemo, useState } from 'react'
import { X, CalendarRange, AlertTriangle, ArrowRight } from 'lucide-react'
import type { ExamSession } from '../../data/examPlanner'
import { daysBetween, hasClasseConflict, hasSalleConflict, shiftDateByDays } from '../../utils/examPlannerAggregation'

interface DuplicateExamSessionsModalProps {
  sessions: ExamSession[]
  onClose: () => void
  onDuplicate: (payloads: Omit<ExamSession, 'id'>[]) => void
}

function dateFR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DuplicateExamSessionsModal({ sessions, onClose, onDuplicate }: DuplicateExamSessionsModalProps) {
  const [sourceStart, setSourceStart] = useState('')
  const [sourceEnd, setSourceEnd] = useState('')
  const [targetStart, setTargetStart] = useState('')

  const sourceSessions = useMemo(
    () =>
      sourceStart && sourceEnd
        ? sessions.filter((s) => s.date >= sourceStart && s.date <= sourceEnd).sort((a, b) => (a.date === b.date ? (a.start < b.start ? -1 : 1) : a.date < b.date ? -1 : 1))
        : [],
    [sessions, sourceStart, sourceEnd]
  )

  const offset = sourceStart && targetStart ? daysBetween(sourceStart, targetStart) : null

  const preview = useMemo(() => {
    if (offset === null) return []
    return sourceSessions.map((s) => ({ source: s, newDate: shiftDateByDays(s.date, offset) }))
  }, [sourceSessions, offset])

  const previewConflicts = useMemo(() => {
    const result = new Map<string, boolean>()
    preview.forEach(({ source, newDate }, idx) => {
      const others = preview.filter((_, i) => i !== idx).map((p) => ({ ...p.source, date: p.newDate }))
      const allForConflict = [...sessions, ...others]
      const conflict =
        hasSalleConflict(allForConflict, newDate, source.start, source.end, source.salleLabel, source.matiere) ||
        hasClasseConflict(allForConflict, newDate, source.start, source.end, source.classe)
      result.set(`${source.id}`, conflict)
    })
    return result
  }, [preview, sessions])

  const canDuplicate = preview.length > 0

  const handleSubmit = () => {
    if (!canDuplicate) return
    onDuplicate(
      preview.map(({ source, newDate }) => ({
        date: newDate,
        start: source.start,
        end: source.end,
        classe: source.classe,
        matiere: source.matiere,
        salleLabel: source.salleLabel,
        surveillants: [],
        consignes: source.consignes,
        type: source.type,
      }))
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <CalendarRange className="h-5 w-5 text-indigo-500" />
            Dupliquer un planning d'examens
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Copier les examens du</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={sourceStart}
                onChange={(e) => setSourceStart(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
              <input
                type="date"
                value={sourceEnd}
                onChange={(e) => setSourceEnd(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Vers le (nouvelle date de début)</label>
            <input
              type="date"
              value={targetStart}
              onChange={(e) => setTargetStart(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          {sourceStart && sourceEnd && sourceSessions.length === 0 && (
            <p className="text-sm text-slate-400">Aucun examen trouvé sur cette période source.</p>
          )}

          {preview.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {preview.length} examen{preview.length > 1 ? 's' : ''} à dupliquer
              </p>
              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {preview.map(({ source, newDate }) => {
                  const conflict = previewConflicts.get(source.id)
                  return (
                    <div key={source.id} className="rounded-xl border border-slate-100 p-2.5 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-medium text-slate-800">
                          {source.classe} · {source.matiere}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          {dateFR(source.date)} <ArrowRight className="h-3 w-3" /> {dateFR(newDate)}
                        </span>
                      </div>
                      {conflict && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Conflit possible à la nouvelle date — à vérifier après duplication.
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Les surveillants ne sont pas copiés (leur disponibilité doit être revérifiée pour les nouvelles dates).
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canDuplicate}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Dupliquer {preview.length > 0 ? `(${preview.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
