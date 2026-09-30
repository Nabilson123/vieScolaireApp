import { useState } from 'react'
import { Clock, Smile, Wand2, UserX, CheckCircle2, Search, Trash2, X } from 'lucide-react'
import { teacherName, initials, type Teacher } from '../../data/teachers'
import { suggestSubstitutes, type PendingReplacement } from '../../utils/replacementAggregation'
import { formatHeures } from '../../utils/teacherAggregation'
import { colorForSubject, subjectColorClasses } from '../../data/studentDetails'
import { parseAnyDate } from '../../utils/period'
import CreneauPickerModal from './CreneauPickerModal'
import { useIsViewedYearEditable } from '../../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../../services/permissions'

interface ReplacementAssistantTabProps {
  pendingList: PendingReplacement[]
  onAssign: (pending: PendingReplacement, teacherId: string, consignes: string, creneau: { start: string; end: string; hours: number }) => void
  onDismiss: (pending: PendingReplacement) => void
}

function formatDateLong(dateStr: string): string {
  const d = parseAnyDate(dateStr)
  if (!d) return dateStr
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function capitalize(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

export default function ReplacementAssistantTab({ pendingList, onAssign, onDismiss }: ReplacementAssistantTabProps) {
  const profile = useCurrentProfile()
  const isEditable = useIsViewedYearEditable() && getModuleAccess(profile, 'replacements').canEdit
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [consignes, setConsignes] = useState('')
  const [pickingTeacher, setPickingTeacher] = useState<Teacher | null>(null)
  const [confirmDismissIdx, setConfirmDismissIdx] = useState<number | null>(null)

  const selected = selectedIdx !== null ? pendingList[selectedIdx] : null
  const suggestions = selected ? suggestSubstitutes(selected) : []

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx)
    setConsignes('')
  }

  const handleAssignPart = (teacherId: string, creneau: { start: string; end: string; hours: number }) => {
    if (!selected) return
    onAssign(selected, teacherId, consignes, creneau)
  }

  const handleCloseWizard = () => {
    setPickingTeacher(null)
    setSelectedIdx(null)
  }

  const handleDismiss = (idx: number) => {
    onDismiss(pendingList[idx])
    setConfirmDismissIdx(null)
    if (selectedIdx === idx) setSelectedIdx(null)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Clock className="h-4 w-4 text-rose-400" />
          Absences en attente de remplacement ({pendingList.length})
        </h3>
        {pendingList.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
              <Smile className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-slate-600">Aucun cours en attente de remplacement</p>
            <p className="text-xs text-slate-400">Tous les cours sont actuellement assurés ou remplacés.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingList.map((p, idx) => (
              <div
                key={idx}
                className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                  selectedIdx === idx ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 bg-slate-50/50 hover:border-indigo-200'
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="font-semibold text-slate-800">{formatDateLong(p.date)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${subjectColorClasses[colorForSubject(p.subject)]}`}>
                    {p.subject}
                  </span>
                </div>
                <p className="mb-2 text-xs text-slate-500">
                  Absent : <span className="font-semibold text-slate-700">Prof. {teacherName(p.teacher)}</span>
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                    {p.classe} | {p.start} - {p.end} ({formatHeures(p.hours)})
                  </span>
                  {confirmDismissIdx === idx ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDismiss(idx)}
                        className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                      >
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDismissIdx(null)}
                        title="Annuler"
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelect(idx)}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                      >
                        <Search className="h-3.5 w-3.5" />
                        Trouver remplaçant
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDismissIdx(idx)}
                        disabled={!isEditable}
                        title="Écarter ce créneau"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Wand2 className="h-4 w-4 text-violet-400" />
          Assistant de Remplacement
        </h3>
        {!selected ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-300">
              <UserX className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-slate-500">Aucune absence sélectionnée.</p>
            <p className="text-xs text-slate-400">Sélectionnez une absence à gauche pour rechercher un enseignant disponible.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Cours à remplacer :</p>
              <p className="font-semibold text-slate-800">
                {selected.subject} en {selected.classe}
              </p>
              <p className="text-xs text-slate-500">
                Prof. absent : <span className="font-semibold text-slate-700">Prof. {teacherName(selected.teacher)}</span>
              </p>
              <p className="text-xs text-slate-500">
                Date : {formatDateLong(selected.date)} ({capitalize(selected.weekday)}) | Horaire : {selected.start} - {selected.end}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sélectionner un enseignant :</p>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
                {suggestions.length} DISPONIBLE(S)
              </span>
            </div>

            {suggestions.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Aucun remplaçant disponible trouvé pour ce créneau.</p>
            ) : (
              <div className="max-h-[360px] space-y-2 overflow-y-auto">
                {suggestions.map((s) => (
                  <div key={s.teacher.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
                        {initials(teacherName(s.teacher))}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-800">Prof. {teacherName(s.teacher)}</p>
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">Libre</span>
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
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Affecter
                    </button>
                  </div>
                ))}
              </div>
            )}

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
        )}
      </div>

      {selected && pickingTeacher && (
        <CreneauPickerModal
          pending={selected}
          initialTeacher={pickingTeacher}
          consignes={consignes}
          onClose={handleCloseWizard}
          onAssignPart={handleAssignPart}
        />
      )}
    </div>
  )
}
