import { useState } from 'react'
import { X, ArrowLeftRight, CheckCircle2, MessageCircle, Undo2 } from 'lucide-react'
import { teacherName, initials, type Teacher } from '../data/teachers'
import { suggestSubstitutes, type PendingReplacement } from '../utils/replacementAggregation'
import CreneauPickerModal from './replacements/CreneauPickerModal'

interface RemplacementDirectModalProps {
  pending: PendingReplacement
  onClose: () => void
  onRetablirPresence: () => void
  onAffecter: (teacherId: string, consignes: string, creneau: { start: string; end: string; hours: number }) => void
  isEditable: boolean
}

export default function RemplacementDirectModal({ pending, onClose, onRetablirPresence, onAffecter, isEditable }: RemplacementDirectModalProps) {
  const [consignes, setConsignes] = useState('')
  const [pickingTeacher, setPickingTeacher] = useState<Teacher | null>(null)
  const suggestions = suggestSubstitutes(pending)

  const handleAssignPart = (teacherId: string, creneau: { start: string; end: string; hours: number }) => {
    onAffecter(teacherId, consignes, creneau)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ArrowLeftRight className="h-5 w-5 text-teal-500" />
            Remplacement Direct
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
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Nouveau remplaçant</p>
            <div className="mb-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] text-slate-400">Heure de début</p>
                <p className="font-semibold text-slate-700">{pending.start}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Heure de fin</p>
                <p className="font-semibold text-slate-700">{pending.end}</p>
              </div>
            </div>
            <p className="mb-3 text-sm text-slate-600">
              Enseignant de la séance : <span className="font-semibold text-slate-800">Prof. {teacherName(pending.teacher)}</span>
            </p>
            <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
              <span className="text-sm text-slate-600">Déclarer absent ?</span>
              <button
                type="button"
                onClick={onRetablirPresence}
                disabled={!isEditable}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Rétablir Présence
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Sélectionner un remplaçant :</p>
            {suggestions.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Aucun remplaçant disponible trouvé pour ce créneau.</p>
            ) : (
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <div key={s.teacher.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {initials(teacherName(s.teacher))}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-800">Prof. {teacherName(s.teacher)}</p>
                          <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-600">Libre</span>
                          {s.enseigneCetteClasse && (
                            <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">
                              Enseigne cette classe
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">{s.teacher.matieres.join(', ')}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPickingTeacher(s.teacher)}
                      disabled={!isEditable}
                      title="Affecter et envoyer un message WhatsApp au remplaçant"
                      className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Affecter
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Consignes pour le remplaçant (optionnel)</label>
            <textarea
              value={consignes}
              onChange={(e) => setConsignes(e.target.value)}
              rows={2}
              placeholder="Contenu prévu, exercices à faire faire..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {pickingTeacher && (
        <CreneauPickerModal
          pending={pending}
          initialTeacher={pickingTeacher}
          consignes={consignes}
          onClose={() => setPickingTeacher(null)}
          onAssignPart={handleAssignPart}
        />
      )}
    </div>
  )
}
