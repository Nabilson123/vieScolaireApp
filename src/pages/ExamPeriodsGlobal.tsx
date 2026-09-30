import { useState } from 'react'
import { CalendarClock, Plus, Trash2, X, FileCheck2, ShieldCheck } from 'lucide-react'
import { useExamPeriods, useAddExamPeriod, useDeleteExamPeriod } from '../services/examPeriodService'
import { useExamSessions } from '../services/examPlannerService'
import { getExamEligibleClassNames, isFullyCovered } from '../utils/examPlannerAggregation'
import type { ExamPeriod } from '../data/examPeriod'
import type { ExamSession } from '../data/examPlanner'
import ExamPeriodDetail from '../components/exam-planner/ExamPeriodDetail'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

function dateFR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function dateRangeLabel(sessions: ExamSession[]): string {
  if (sessions.length === 0) return 'Aucun examen'
  const dates = sessions.map((s) => s.date).sort()
  const min = dates[0]
  const max = dates[dates.length - 1]
  return min === max ? dateFR(min) : `${dateFR(min)} → ${dateFR(max)}`
}

function CreatePeriodModal({ onClose, onCreate }: { onClose: () => void; onCreate: (label: string, classes: string[]) => void }) {
  const [label, setLabel] = useState('')
  const [classes, setClasses] = useState<string[]>([])
  const canCreate = label.trim() !== '' && classes.length > 0
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <CalendarClock className="h-5 w-5 text-indigo-500" />
            Nouvelle session
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Nom de la session</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex: Session Juin 2026"
              autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Classes concernées</label>
            <select
              multiple
              value={classes}
              onChange={(e) => setClasses(Array.from(e.target.selectedOptions).map((o) => o.value))}
              size={6}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              {getExamEligibleClassNames().map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">Ctrl/Cmd + clic pour sélectionner plusieurs classes (ex: CE6-A, CE6-B, 3APIC-A).</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => canCreate && onCreate(label.trim(), classes)}
            disabled={!canCreate}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDeletePeriodModal({ period, onCancel, onConfirm }: { period: ExamPeriod; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-base font-bold text-slate-900">Supprimer « {period.label} » ?</h2>
        <p className="mb-5 text-sm text-slate-500">
          Les examens déjà saisis dans cette session ne seront pas supprimés, mais ne seront plus rattachés à aucune session.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-600">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ExamPeriodsGlobal() {
  const { data: periods } = useExamPeriods()
  const { data: sessions } = useExamSessions()
  const addPeriod = useAddExamPeriod()
  const deletePeriod = useDeleteExamPeriod()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'examPeriods').canEdit
  const isEditable = canEditYear && canEditModule

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleting, setDeleting] = useState<ExamPeriod | null>(null)
  const [pendingClasses, setPendingClasses] = useState<string[] | null>(null)

  if (!periods || !sessions) {
    return <div className="flex h-full items-center justify-center p-10 text-slate-400">Chargement...</div>
  }

  const selected = selectedId ? periods.find((p) => p.id === selectedId) : null

  if (selected) {
    return (
      <div className="p-4 lg:p-6">
        <ExamPeriodDetail
          period={selected}
          allSessions={sessions}
          onBack={() => setSelectedId(null)}
          initialClasses={pendingClasses ?? undefined}
          onInitialClassesConsumed={() => setPendingClasses(null)}
        />
      </div>
    )
  }

  const handleCreate = async (label: string, classes: string[]) => {
    const period = await addPeriod.mutateAsync(label)
    setShowCreate(false)
    setPendingClasses(classes)
    setSelectedId(period.id)
  }

  const handleConfirmDelete = () => {
    if (deleting) deletePeriod.mutate(deleting.id)
    setDeleting(null)
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <CalendarClock className="h-5 w-5 text-indigo-500" />
            Sessions d'Examens
          </h1>
          <p className="text-sm text-slate-500">Regroupe les examens d'une même période (ex: CE6 + 3APIC) pour dispatcher les surveillants à la fin.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={!isEditable}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Nouvelle session
        </button>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      {periods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          Aucune session créée pour l'instant.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {periods.map((period) => {
            const periodSessions = sessions.filter((s) => s.periodId === period.id)
            const coveredCount = periodSessions.filter((s) => isFullyCovered(s.surveillants, s.start, s.end)).length
            return (
              <div
                key={period.id}
                className="group relative rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-indigo-200 hover:shadow-md"
              >
                <button type="button" onClick={() => setSelectedId(period.id)} className="block w-full text-left">
                  <p className="pr-6 text-sm font-bold text-slate-900">{period.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{dateRangeLabel(periodSessions)}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <FileCheck2 className="h-3.5 w-3.5" />
                      {periodSessions.length} examen{periodSessions.length > 1 ? 's' : ''}
                    </span>
                    {periodSessions.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {coveredCount}/{periodSessions.length} couvert{coveredCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(period)}
                  disabled={!isEditable}
                  title="Supprimer cette session"
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 opacity-0 hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && <CreatePeriodModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {deleting && <ConfirmDeletePeriodModal period={deleting} onCancel={() => setDeleting(null)} onConfirm={handleConfirmDelete} />}
    </div>
  )
}
