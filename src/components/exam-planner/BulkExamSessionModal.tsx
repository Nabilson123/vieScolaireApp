import { useMemo, useState } from 'react'
import { X, ListPlus, AlertTriangle, Copy, Trash2, Plus, RefreshCw } from 'lucide-react'
import { EXAM_TYPES, type ExamSession, type ExamType, type SurveillantAssignment } from '../../data/examPlanner'
import { getClassesSnapshot } from '../../services/classesService'
import { getMatieresConfigSnapshot } from '../../services/matieresConfigService'
import { getMatieresForNiveau } from '../../data/referentiel'
import { getSallesSnapshot } from '../../services/sallesService'
import { fullLabel } from '../../data/salles'
import { teacherName } from '../../data/teachers'
import { getExamEligibleClassNames, hasClasseConflict, hasSalleConflict, suggestSurveillants } from '../../utils/examPlannerAggregation'
import { useIsViewedYearEditable } from '../../services/viewedYear'

interface DraftRow {
  key: string
  date: string
  classes: string[]
  start: string
  end: string
  matiere: string
  salleLabel: string
  surveillants: SurveillantAssignment[]
  surveillantCount: number
  type: ExamType
  consignes: string
}

function emptyRow(overrides?: Partial<DraftRow>): DraftRow {
  return {
    key: crypto.randomUUID(),
    date: '',
    classes: [],
    start: '',
    end: '',
    matiere: '',
    salleLabel: '',
    surveillants: [],
    surveillantCount: 3,
    type: 'Examen Officiel',
    consignes: '',
    ...overrides,
  }
}

function expandRowToSessions(row: DraftRow, periodId?: string): ExamSession[] {
  return row.classes.map((classe, i) => ({
    id: `${row.key}-${i}`,
    date: row.date,
    start: row.start,
    end: row.end,
    classe,
    matiere: row.matiere,
    salleLabel: row.salleLabel,
    surveillants: row.surveillants,
    consignes: row.consignes,
    type: row.type,
    periodId,
  }))
}

function isRowComplete(row: DraftRow): boolean {
  return row.date !== '' && row.start !== '' && row.end !== '' && row.end > row.start && row.classes.length > 0 && row.matiere !== '' && row.salleLabel !== ''
}

interface BulkExamSessionModalProps {
  sessions: ExamSession[]
  onClose: () => void
  onSaveAll: (payloads: Omit<ExamSession, 'id'>[]) => void
  periodId?: string
  hideSurveillants?: boolean
  initialClasses?: string[]
}

export default function BulkExamSessionModal({ sessions, onClose, onSaveAll, periodId, hideSurveillants = false, initialClasses }: BulkExamSessionModalProps) {
  const isEditable = useIsViewedYearEditable()
  const [rows, setRows] = useState<DraftRow[]>([emptyRow(initialClasses && initialClasses.length > 0 ? { classes: initialClasses } : undefined)])

  const allDraftSessionsExcept = (rowKey: string, from: DraftRow[]) => from.filter((r) => r.key !== rowKey).flatMap((r) => expandRowToSessions(r))

  // Génère automatiquement les surveillants dès qu'une ligne devient complète (date/créneau/classe(s)/
  // matière/salle) et qu'elle n'en a pas déjà — pour éviter d'avoir à les cocher un par un à chaque
  // épreuve. L'utilisateur peut toujours décocher/recocher ensuite avant de valider.
  const updateRow = (rowKey: string, patch: Partial<DraftRow>) => {
    setRows((prev) => {
      const otherRowsSessions = allDraftSessionsExcept(rowKey, prev)
      return prev.map((r) => {
        if (r.key !== rowKey) return r
        const merged = { ...r, ...patch }
        if (!hideSurveillants && merged.surveillants.length === 0 && isRowComplete(merged)) {
          const suggestions = suggestSurveillants(
            [...sessions, ...otherRowsSessions],
            merged.date,
            merged.start,
            merged.end,
            merged.classes,
            merged.matiere,
            undefined,
            merged.salleLabel
          )
          if (suggestions.length > 0)
            merged.surveillants = suggestions.slice(0, merged.surveillantCount).map((s) => ({ teacherId: s.teacher.id, start: merged.start, end: merged.end }))
        }
        return merged
      })
    })
  }

  const regenerateRow = (rowKey: string) => {
    setRows((prev) => {
      const otherRowsSessions = allDraftSessionsExcept(rowKey, prev)
      return prev.map((r) => {
        if (r.key !== rowKey) return r
        const suggestions = suggestSurveillants([...sessions, ...otherRowsSessions], r.date, r.start, r.end, r.classes, r.matiere, undefined, r.salleLabel)
        return { ...r, surveillants: suggestions.slice(0, r.surveillantCount).map((s) => ({ teacherId: s.teacher.id, start: r.start, end: r.end })) }
      })
    })
  }

  const updateSurveillantWindow = (rowKey: string, teacherId: string, patch: Partial<Pick<SurveillantAssignment, 'start' | 'end'>>) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key !== rowKey ? r : { ...r, surveillants: r.surveillants.map((a) => (a.teacherId === teacherId ? { ...a, ...patch } : a)) }
      )
    )
  }

  // Une nouvelle ligne recopie automatiquement la date et les classes de la ligne précédente (comme
  // étirer une formule dans un tableur) — l'utilisateur ne retape que ce qui change réellement d'une
  // épreuve à l'autre (horaire, matière, salle), ce qui est le cas le plus courant.
  const addRow = () =>
    setRows((prev) => {
      const last = prev[prev.length - 1]
      return [...prev, emptyRow(last ? { date: last.date, classes: last.classes } : undefined)]
    })
  const removeRow = (rowKey: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== rowKey) : prev))
  const duplicateRow = (row: DraftRow) =>
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.key === row.key)
      const copy = emptyRow({ date: row.date, classes: row.classes, salleLabel: row.salleLabel, type: row.type })
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]
    })

  const allSalles = getSallesSnapshot().map((s) => fullLabel(s))

  const rowConflicts = useMemo(() => {
    const result = new Map<string, { salle: boolean; classes: string[] }>()
    rows.forEach((row) => {
      if (!isRowComplete(row)) return
      const allForConflict = [...sessions, ...allDraftSessionsExcept(row.key, rows)]
      const salleConflict = hasSalleConflict(allForConflict, row.date, row.start, row.end, row.salleLabel, row.matiere)
      const classeConflicts = row.classes.filter((c) => hasClasseConflict(allForConflict, row.date, row.start, row.end, c))
      result.set(row.key, { salle: salleConflict, classes: classeConflicts })
    })
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sessions])

  const matieresForRow = (row: DraftRow) => {
    if (row.classes.length === 0) return getMatieresConfigSnapshot().map((m) => m.nom)
    const niveau = getClassesSnapshot().find((c) => c.nom === row.classes[0])?.niveau
    return niveau ? getMatieresForNiveau(getMatieresConfigSnapshot(), niveau).map((m) => m.nom) : getMatieresConfigSnapshot().map((m) => m.nom)
  }

  const surveillantsForRow = (row: DraftRow) => {
    if (hideSurveillants) return []
    if (row.date === '' || row.start === '' || row.end === '' || row.end <= row.start) return []
    return suggestSurveillants(
      [...sessions, ...allDraftSessionsExcept(row.key, rows)],
      row.date,
      row.start,
      row.end,
      row.classes,
      row.matiere,
      undefined,
      row.salleLabel
    )
  }

  const completeRows = rows.filter(isRowComplete)
  const hasAnyConflict = completeRows.some((row) => {
    const c = rowConflicts.get(row.key)
    return c && (c.salle || c.classes.length > 0)
  })
  const canSave = isEditable && completeRows.length > 0 && !hasAnyConflict

  const handleSubmit = () => {
    if (!canSave) return
    onSaveAll(completeRows.flatMap((row) => expandRowToSessions(row, periodId)).map(({ id: _id, ...payload }) => payload))
  }

  const conflictTitle = (row: DraftRow): string | undefined => {
    const c = rowConflicts.get(row.key)
    if (!c) return undefined
    const parts: string[] = []
    if (c.salle) parts.push('Salle déjà occupée sur ce créneau.')
    if (c.classes.length > 0) parts.push(`${c.classes.join(', ')} ${c.classes.length > 1 ? 'ont' : 'a'} déjà un examen sur ce créneau.`)
    return parts.length > 0 ? parts.join(' ') : undefined
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ${hideSurveillants ? 'max-w-5xl' : 'max-w-4xl'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ListPlus className="h-5 w-5 text-indigo-500" />
            Planifier une session complète
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {hideSurveillants ? (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-2 py-2.5">Date</th>
                      <th className="px-2 py-2.5">Début</th>
                      <th className="px-2 py-2.5">Fin</th>
                      <th className="w-40 px-2 py-2.5">Classe(s)</th>
                      <th className="px-2 py-2.5">Matière</th>
                      <th className="px-2 py-2.5">Salle</th>
                      <th className="px-2 py-2.5">Type</th>
                      <th className="px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const conflictMsg = conflictTitle(row)
                      return (
                        <tr key={row.key} className="border-b border-slate-50 last:border-0">
                          <td className="px-2 py-1.5">
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => updateRow(row.key, { date: e.target.value })}
                              className="w-32 rounded-lg border border-slate-200 px-1.5 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="time"
                              value={row.start}
                              onChange={(e) => updateRow(row.key, { start: e.target.value })}
                              className="w-20 rounded-lg border border-slate-200 px-1.5 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="time"
                              value={row.end}
                              onChange={(e) => updateRow(row.key, { end: e.target.value })}
                              className="w-20 rounded-lg border border-slate-200 px-1.5 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              multiple
                              size={2}
                              value={row.classes}
                              onChange={(e) => updateRow(row.key, { classes: Array.from(e.target.selectedOptions).map((o) => o.value), matiere: '' })}
                              className="w-36 rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                            >
                              {getExamEligibleClassNames().map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={row.matiere}
                              onChange={(e) => updateRow(row.key, { matiere: e.target.value })}
                              disabled={row.classes.length === 0}
                              className="w-32 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none disabled:bg-slate-50"
                            >
                              <option value="">Sélectionner...</option>
                              {matieresForRow(row).map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={row.salleLabel}
                              onChange={(e) => updateRow(row.key, { salleLabel: e.target.value })}
                              className="w-36 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                            >
                              <option value="">Sélectionner...</option>
                              {allSalles.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select
                              value={row.type}
                              onChange={(e) => updateRow(row.key, { type: e.target.value as ExamType })}
                              className="w-28 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                            >
                              {EXAM_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1">
                              {conflictMsg && (
                                <span title={conflictMsg}>
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => duplicateRow(row)}
                                title="Dupliquer cette ligne"
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRow(row.key)}
                                disabled={rows.length === 1}
                                title="Supprimer cette ligne"
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={addRow}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white py-2 text-sm font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
              >
                <Plus className="h-4 w-4" />
                Ajouter une ligne
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row, idx) => {
                const conflict = rowConflicts.get(row.key)
                const surveillantOptions = surveillantsForRow(row)
                return (
                  <div key={row.key} className="rounded-xl border border-slate-100 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Épreuve {idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicateRow(row)}
                          title="Dupliquer cette ligne"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          disabled={rows.length === 1}
                          title="Supprimer cette ligne"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateRow(row.key, { date: e.target.value })}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                      />
                      <input
                        type="time"
                        value={row.start}
                        onChange={(e) => updateRow(row.key, { start: e.target.value })}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                      />
                      <input
                        type="time"
                        value={row.end}
                        onChange={(e) => updateRow(row.key, { end: e.target.value })}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                      />
                      <select
                        value={row.type}
                        onChange={(e) => updateRow(row.key, { type: e.target.value as ExamType })}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                      >
                        {EXAM_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-500">Classe(s)</label>
                        <select
                          multiple
                          value={row.classes}
                          onChange={(e) => updateRow(row.key, { classes: Array.from(e.target.selectedOptions).map((o) => o.value), matiere: '' })}
                          size={3}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                        >
                          {getExamEligibleClassNames().map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-500">Matière</label>
                        <select
                          value={row.matiere}
                          onChange={(e) => updateRow(row.key, { matiere: e.target.value })}
                          disabled={row.classes.length === 0}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none disabled:bg-slate-50"
                        >
                          <option value="">Sélectionner...</option>
                          {matieresForRow(row).map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <label className="mb-1 mt-2 block text-[10px] font-semibold text-slate-500">Salle</label>
                        <select
                          value={row.salleLabel}
                          onChange={(e) => updateRow(row.key, { salleLabel: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                        >
                          <option value="">Sélectionner...</option>
                          {allSalles.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <label className="text-[10px] font-semibold text-slate-500">Surveillants</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={6}
                              value={row.surveillantCount}
                              onChange={(e) => updateRow(row.key, { surveillantCount: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })}
                              title="Nombre de surveillants"
                              className="w-9 rounded border border-slate-200 px-1 py-0.5 text-[10px] text-slate-700 focus:border-indigo-400 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => regenerateRow(row.key)}
                              disabled={surveillantOptions.length === 0}
                              title="Régénérer automatiquement"
                              className="flex h-5 w-5 items-center justify-center rounded text-indigo-500 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-slate-300"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {surveillantOptions.length === 0 ? (
                          <p className="text-[11px] text-slate-400">{row.date && row.start && row.end ? 'Aucun prof disponible.' : 'Renseignez date/créneau.'}</p>
                        ) : (
                          <div className="max-h-32 space-y-1 overflow-y-auto">
                            {surveillantOptions.map((s) => {
                              const assignment = row.surveillants.find((a) => a.teacherId === s.teacher.id)
                              const checked = !!assignment
                              return (
                                <div key={s.teacher.id}>
                                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        updateRow(row.key, {
                                          surveillants: checked
                                            ? row.surveillants.filter((a) => a.teacherId !== s.teacher.id)
                                            : [...row.surveillants, { teacherId: s.teacher.id, start: row.start, end: row.end }],
                                        })
                                      }
                                    />
                                    {teacherName(s.teacher)}
                                  </label>
                                  {assignment && (
                                    <div className="ml-4 mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                                      <input
                                        type="time"
                                        min={row.start}
                                        max={assignment.end}
                                        value={assignment.start}
                                        onChange={(e) => updateSurveillantWindow(row.key, s.teacher.id, { start: e.target.value })}
                                        className="rounded border border-slate-200 px-1 py-0.5 text-[10px] text-slate-700 focus:border-indigo-400 focus:outline-none"
                                      />
                                      <span>→</span>
                                      <input
                                        type="time"
                                        min={assignment.start}
                                        max={row.end}
                                        value={assignment.end}
                                        onChange={(e) => updateSurveillantWindow(row.key, s.teacher.id, { end: e.target.value })}
                                        className="rounded border border-slate-200 px-1 py-0.5 text-[10px] text-slate-700 focus:border-indigo-400 focus:outline-none"
                                      />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {conflict?.salle && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-600">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Salle déjà occupée sur ce créneau.
                      </div>
                    )}
                    {conflict && conflict.classes.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-600">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {conflict.classes.join(', ')} {conflict.classes.length > 1 ? 'ont' : 'a'} déjà un examen sur ce créneau.
                      </div>
                    )}
                  </div>
                )
              })}

              <button
                type="button"
                onClick={addRow}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white py-2 text-sm font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
              >
                <Plus className="h-4 w-4" />
                Ajouter une épreuve
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-xs text-slate-400">
            {completeRows.length} épreuve{completeRows.length > 1 ? 's' : ''} prête{completeRows.length > 1 ? 's' : ''} à planifier
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              Planifier {completeRows.length > 0 ? `(${completeRows.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
