import { useEffect, useMemo, useState } from 'react'
import { X, FileCheck2, AlertTriangle, MessageCircle, Check, RefreshCw } from 'lucide-react'
import { EXAM_TYPES, type ExamSession, type ExamType, type SurveillantAssignment } from '../../data/examPlanner'
import { getClassesSnapshot, useClasses } from '../../services/classesService'
import { getMatieresConfigSnapshot } from '../../services/matieresConfigService'
import { getMatieresForNiveau } from '../../data/referentiel'
import { teacherName, initials } from '../../data/teachers'
import { getExamEligibleClassNames, hasClasseConflict, hasSalleConflict, suggestSalles, suggestSurveillants } from '../../utils/examPlannerAggregation'
import { buildSurveillanceMessage, buildWhatsAppLink } from '../../utils/whatsapp'
import { useIsViewedYearEditable } from '../../services/viewedYear'

function formatChargeMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${m}`
}

interface ExamSessionModalProps {
  sessions: ExamSession[]
  initialSession?: ExamSession
  onClose: () => void
  onSave: (session: Omit<ExamSession, 'id'> | ExamSession) => void
  periodId?: string
  hideSurveillants?: boolean
}

export default function ExamSessionModal({ sessions, initialSession, onClose, onSave, periodId, hideSurveillants = false }: ExamSessionModalProps) {
  const [date, setDate] = useState(initialSession?.date ?? '')
  const [start, setStart] = useState(initialSession?.start ?? '')
  const [end, setEnd] = useState(initialSession?.end ?? '')
  const [classe, setClasse] = useState(initialSession?.classe ?? '')
  const [matiere, setMatiere] = useState(initialSession?.matiere ?? '')
  const [salleLabel, setSalleLabel] = useState(initialSession?.salleLabel ?? '')
  const [surveillants, setSurveillants] = useState<SurveillantAssignment[]>(initialSession?.surveillants ?? [])
  const [consignes, setConsignes] = useState(initialSession?.consignes ?? '')
  const [type, setType] = useState<ExamType>(initialSession?.type ?? 'Examen Officiel')
  const [surveillantCount, setSurveillantCount] = useState(3)

  const { data: classes } = useClasses()
  const isEditable = useIsViewedYearEditable()
  const niveau = useMemo(() => getClassesSnapshot().find((c) => c.nom === classe)?.niveau, [classe, classes])
  const matieresOptions = useMemo(
    () => (niveau ? getMatieresForNiveau(getMatieresConfigSnapshot(), niveau).map((m) => m.nom) : getMatieresConfigSnapshot().map((m) => m.nom)),
    [niveau]
  )

  const readyForConflictCheck = date !== '' && start !== '' && end !== '' && end > start

  const salleConflict =
    readyForConflictCheck && matiere !== '' && hasSalleConflict(sessions, date, start, end, salleLabel, matiere, initialSession?.id)
  const classeConflict = readyForConflictCheck && classe !== '' && hasClasseConflict(sessions, date, start, end, classe, initialSession?.id)

  const salleSuggestions =
    readyForConflictCheck && classe !== '' && matiere !== '' ? suggestSalles(sessions, classe, matiere, date, start, end, initialSession?.id) : []
  const surveillantSuggestions =
    !hideSurveillants && readyForConflictCheck ? suggestSurveillants(sessions, date, start, end, classe, matiere, initialSession?.id, salleLabel) : []

  const canSave =
    isEditable && date !== '' && start !== '' && end !== '' && end > start && classe !== '' && matiere !== '' && !salleConflict && !classeConflict

  // Génère automatiquement les surveillants dès que la session a assez d'informations, pour éviter
  // d'avoir à les cocher un par un à chaque fois (l'utilisateur peut toujours ajuster ensuite). Sauf
  // dans une session (hideSurveillants) : les surveillants y sont dispatchés à la fin, pas à la saisie.
  useEffect(() => {
    if (hideSurveillants) return
    if (surveillants.length > 0) return
    if (!(date !== '' && start !== '' && end !== '' && end > start && classe !== '' && matiere !== '' && salleLabel !== '')) return
    const suggestions = suggestSurveillants(sessions, date, start, end, classe, matiere, initialSession?.id, salleLabel)
    if (suggestions.length > 0) setSurveillants(suggestions.slice(0, surveillantCount).map((s) => ({ teacherId: s.teacher.id, start, end })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, start, end, classe, matiere, salleLabel, hideSurveillants])

  const toggleSurveillant = (teacherId: string) => {
    setSurveillants((prev) =>
      prev.some((a) => a.teacherId === teacherId) ? prev.filter((a) => a.teacherId !== teacherId) : [...prev, { teacherId, start, end }]
    )
  }

  const updateSurveillantWindow = (teacherId: string, patch: Partial<Pick<SurveillantAssignment, 'start' | 'end'>>) => {
    setSurveillants((prev) => prev.map((a) => (a.teacherId === teacherId ? { ...a, ...patch } : a)))
  }

  const regenerateSurveillants = () => {
    setSurveillants(surveillantSuggestions.slice(0, surveillantCount).map((s) => ({ teacherId: s.teacher.id, start, end })))
  }

  const handleSendWhatsApp = (teacherId: string) => {
    const t = surveillantSuggestions.find((s) => s.teacher.id === teacherId)?.teacher
    const assignment = surveillants.find((a) => a.teacherId === teacherId)
    if (!t || !assignment) return
    const message = buildSurveillanceMessage({
      teacherName: teacherName(t),
      date,
      creneau: `${assignment.start} - ${assignment.end}`,
      classe,
      matiere,
      salle: salleLabel || 'À confirmer',
      consignes: consignes || undefined,
    })
    const link = buildWhatsAppLink(t.telephoneMobile, message)
    if (link) window.open(link, '_blank', 'noopener,noreferrer')
  }

  const handleSubmit = () => {
    if (!canSave) return
    const payload = { date, start, end, classe, matiere, salleLabel, surveillants, consignes, type, periodId: periodId ?? initialSession?.periodId }
    onSave(initialSession ? { ...payload, id: initialSession.id } : payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileCheck2 className="h-5 w-5 text-indigo-500" />
            {initialSession ? "Modifier l'examen" : 'Planifier un examen'}
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
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Heure début</label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Heure fin</label>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Type d'examen</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ExamType)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              {EXAM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Classe</label>
              <select
                value={classe}
                onChange={(e) => {
                  setClasse(e.target.value)
                  setMatiere('')
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Sélectionner...</option>
                {getExamEligibleClassNames().map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Matière</label>
              <select
                value={matiere}
                onChange={(e) => setMatiere(e.target.value)}
                disabled={classe === ''}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">Sélectionner...</option>
                {matieresOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {classeConflict && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Cette classe a déjà un examen sur ce créneau.
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Salle</label>
            <select
              value={salleLabel}
              onChange={(e) => setSalleLabel(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">Sélectionner...</option>
              {salleSuggestions.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label} ({s.capacite} places){!s.suffisante ? ' ⚠ capacité insuffisante' : ''}
                </option>
              ))}
            </select>
            {readyForConflictCheck && classe !== '' && salleSuggestions.length === 0 && (
              <p className="mt-1 text-[11px] text-slate-400">Toutes les salles sont occupées sur ce créneau.</p>
            )}
          </div>

          {salleConflict && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Cette salle est déjà occupée sur ce créneau.
            </div>
          )}

          {hideSurveillants ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              Les surveillants seront dispatchés à la fin de la session, une fois tous les examens saisis.
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Surveillants {surveillants.length > 0 && `(${surveillants.length} sélectionné${surveillants.length > 1 ? 's' : ''})`}
                </p>
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] text-slate-400">Nombre</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={surveillantCount}
                    onChange={(e) => setSurveillantCount(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                    className="w-12 rounded-lg border border-slate-200 px-1.5 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={regenerateSurveillants}
                    disabled={surveillantSuggestions.length === 0}
                    title="Régénérer automatiquement"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-indigo-500 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {!readyForConflictCheck ? (
                <p className="py-2 text-center text-sm text-slate-400">Renseignez la date et le créneau pour voir les profs disponibles.</p>
              ) : surveillantSuggestions.length === 0 ? (
                <p className="py-2 text-center text-sm text-slate-400">Aucun professeur disponible sur ce créneau.</p>
              ) : (
                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                  {surveillantSuggestions.map((s) => {
                    const assignment = surveillants.find((a) => a.teacherId === s.teacher.id)
                    const checked = !!assignment
                    return (
                      <div key={s.teacher.id} className="rounded-xl border border-slate-100 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSurveillant(s.teacher.id)}
                            className="flex flex-1 items-center gap-2.5 text-left"
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                checked ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {checked ? <Check className="h-4 w-4" /> : initials(teacherName(s.teacher))}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">Prof. {teacherName(s.teacher)}</p>
                              <p className="text-[11px] text-slate-400">
                                {s.chargeSurPeriode > 0
                                  ? `${formatChargeMinutes(s.chargeSurPeriode)} de surveillance sur la période`
                                  : 'Aucune surveillance sur la période'}
                              </p>
                            </div>
                          </button>
                          {checked && (
                            <button
                              type="button"
                              onClick={() => handleSendWhatsApp(s.teacher.id)}
                              title="Envoyer un message WhatsApp"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {assignment && (
                          <div className="ml-10 mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                            <span>Horaire :</span>
                            <input
                              type="time"
                              min={start}
                              max={assignment.end}
                              value={assignment.start}
                              onChange={(e) => updateSurveillantWindow(s.teacher.id, { start: e.target.value })}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                            />
                            <span>→</span>
                            <input
                              type="time"
                              min={assignment.start}
                              max={end}
                              value={assignment.end}
                              onChange={(e) => updateSurveillantWindow(s.teacher.id, { end: e.target.value })}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Consignes (optionnel)</label>
            <textarea
              value={consignes}
              onChange={(e) => setConsignes(e.target.value)}
              rows={2}
              placeholder="Matériel autorisé, remarques particulières..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {initialSession ? 'Enregistrer' : "Planifier l'examen"}
          </button>
        </div>
      </div>
    </div>
  )
}
