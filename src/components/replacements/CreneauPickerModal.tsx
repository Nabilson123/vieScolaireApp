import { useState } from 'react'
import { X, Clock, CheckCircle2, ArrowRight, PartyPopper } from 'lucide-react'
import { teacherName, initials, type Teacher } from '../../data/teachers'
import { suggestSubstitutes, subtractCoveredIntervals, intervalHours, type PendingReplacement } from '../../utils/replacementAggregation'
import { formatHeures } from '../../utils/teacherAggregation'
import { buildRemplacementMessage, buildWhatsAppLink } from '../../utils/whatsapp'
import { useIsViewedYearEditable } from '../../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../../services/permissions'

interface CreneauPickerModalProps {
  pending: PendingReplacement
  initialTeacher: Teacher
  consignes: string
  onClose: () => void
  onAssignPart: (teacherId: string, creneau: { start: string; end: string; hours: number }) => void
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function CreneauPickerModal({ pending, initialTeacher, consignes, onClose, onAssignPart }: CreneauPickerModalProps) {
  const profile = useCurrentProfile()
  const isEditable = useIsViewedYearEditable() && getModuleAccess(profile, 'replacements').canEdit
  const [phase, setPhase] = useState<'time' | 'next-teacher' | 'done'>('time')
  const [teacher, setTeacher] = useState<Teacher>(initialTeacher)
  const [usedTeacherIds, setUsedTeacherIds] = useState<string[]>([initialTeacher.id])
  const [gapStart, setGapStart] = useState(pending.start)
  const [gapEnd, setGapEnd] = useState(pending.end)
  const [pickStart, setPickStart] = useState(pending.start)
  const [pickEnd, setPickEnd] = useState(pending.end)

  const withinBounds = pickStart >= gapStart && pickEnd <= gapEnd
  const valid = isEditable && withinBounds && timeToMinutes(pickStart) < timeToMinutes(pickEnd)
  const hours = valid ? intervalHours({ start: pickStart, end: pickEnd }) : 0
  const isFullGap = pickStart === gapStart && pickEnd === gapEnd

  const handleConfirm = () => {
    if (!valid) return
    onAssignPart(teacher.id, { start: pickStart, end: pickEnd, hours })

    const message = buildRemplacementMessage({
      teacherName: teacherName(teacher),
      date: pending.date,
      creneau: `${pickStart} - ${pickEnd}`,
      classe: pending.classe,
      matiere: pending.subject,
      consignes: consignes.trim() || undefined,
    })
    const link = buildWhatsAppLink(teacher.telephoneMobile, message)
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer')
    } else {
      window.alert(`Remplacement affecté, mais aucun numéro WhatsApp valide pour Prof. ${teacherName(teacher)}.`)
    }

    const remaining = subtractCoveredIntervals(gapStart, gapEnd, [{ start: pickStart, end: pickEnd }])
    if (remaining.length === 0) {
      setPhase('done')
      return
    }
    const nextGap = remaining[0]
    setGapStart(nextGap.start)
    setGapEnd(nextGap.end)
    setPickStart(nextGap.start)
    setPickEnd(nextGap.end)
    setPhase('next-teacher')
  }

  const handlePickNextTeacher = (t: Teacher) => {
    setTeacher(t)
    setUsedTeacherIds((prev) => [...prev, t.id])
    setPhase('time')
  }

  const suggestions =
    phase === 'next-teacher'
      ? suggestSubstitutes({ ...pending, start: gapStart, end: gapEnd }).filter((s) => !usedTeacherIds.includes(s.teacher.id))
      : []

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Clock className="h-4.5 w-4.5 text-indigo-500" />
            {phase === 'done' ? 'Remplacement complet' : 'Créneau du remplacement'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-800">
              {pending.subject} en {pending.classe}
            </p>
            <p className="text-xs text-slate-500">
              Séance complète : {pending.start} - {pending.end}
            </p>
          </div>

          {phase === 'time' && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Portion à affecter à Prof. {teacherName(teacher)}
                  {gapStart !== pending.start || gapEnd !== pending.end ? ` (reste : ${gapStart} - ${gapEnd})` : ''}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Début</label>
                    <input
                      type="time"
                      value={pickStart}
                      min={gapStart}
                      max={gapEnd}
                      onChange={(e) => setPickStart(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Fin</label>
                    <input
                      type="time"
                      value={pickEnd}
                      min={gapStart}
                      max={gapEnd}
                      onChange={(e) => setPickEnd(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                </div>
                {!valid && (
                  <p className="mt-1.5 text-xs text-rose-500">
                    L'horaire doit rester dans la portion disponible ({gapStart} - {gapEnd}) et se terminer après son début.
                  </p>
                )}
                {valid && !isFullGap && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    Séance divisée : {formatHeures(hours)} affectée(s) à ce remplaçant, le reste sera à affecter à un autre.
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={!valid}
                onClick={handleConfirm}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmer ce créneau
              </button>
            </>
          )}

          {phase === 'next-teacher' && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Portion restante à affecter : <strong>{gapStart} - {gapEnd}</strong> ({formatHeures(intervalHours({ start: gapStart, end: gapEnd }))})
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Choisir un remplaçant pour le reste :
                </p>
                {suggestions.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">Aucun remplaçant disponible pour cette portion.</p>
                ) : (
                  <div className="max-h-[260px] space-y-2 overflow-y-auto">
                    {suggestions.map((s) => (
                      <div key={s.teacher.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                            {initials(teacherName(s.teacher))}
                          </span>
                          <p className="text-sm font-semibold text-slate-800">Prof. {teacherName(s.teacher)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePickNextTeacher(s.teacher)}
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                        >
                          Choisir
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Terminer sans affecter le reste
              </button>
            </>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                <PartyPopper className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-slate-700">Toute la séance a été affectée.</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-1 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
