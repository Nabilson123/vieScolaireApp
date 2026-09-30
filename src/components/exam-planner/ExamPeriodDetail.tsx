import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Pencil, Trash2, Clock, MapPin, Users, ShieldCheck, ShieldAlert, ListPlus, Shuffle, Printer, BarChart3 } from 'lucide-react'
import type { ExamPeriod } from '../../data/examPeriod'
import type { ExamSession } from '../../data/examPlanner'
import { useAddExamSession, useDeleteExamSession, useUpdateExamSession } from '../../services/examPlannerService'
import { teacherName, type Teacher } from '../../data/teachers'
import { getTeachersSnapshot } from '../../services/teachersService'
import { isFullyCovered } from '../../utils/examPlannerAggregation'
import ExamSessionModal from './ExamSessionModal'
import BulkExamSessionModal from './BulkExamSessionModal'
import DispatchSurveillantsModal from './DispatchSurveillantsModal'
import ExamPeriodStatsModal from './ExamPeriodStatsModal'
import ExamPlannerPrintPreviewModal from '../exam-planner-print/ExamPlannerPrintPreviewModal'
import ReadOnlyYearBanner from '../ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../../services/viewedYear'

function dateFR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function groupByDate(sessions: ExamSession[]): { date: string; sessions: ExamSession[] }[] {
  const map = new Map<string, ExamSession[]>()
  sessions.forEach((s) => {
    map.set(s.date, [...(map.get(s.date) ?? []), s])
  })
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, group]) => ({ date, sessions: group.sort((a, b) => (a.start < b.start ? -1 : 1)) }))
}

function resolveTeachers(ids: string[]): Teacher[] {
  const teachers = getTeachersSnapshot()
  return ids.map((id) => teachers.find((t) => t.id === id)).filter((t): t is Teacher => !!t)
}

function ConfirmDeleteModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-base font-bold text-slate-900">Supprimer cet examen ?</h2>
        <p className="mb-5 text-sm text-slate-500">Cette action supprimera définitivement cette session d'examen planifiée.</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-600"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

interface ExamPeriodDetailProps {
  period: ExamPeriod
  allSessions: ExamSession[]
  onBack: () => void
  initialClasses?: string[]
  onInitialClassesConsumed?: () => void
}

export default function ExamPeriodDetail({ period, allSessions, onBack, initialClasses, onInitialClassesConsumed }: ExamPeriodDetailProps) {
  const sessions = allSessions.filter((s) => s.periodId === period.id)

  const addSession = useAddExamSession()
  const updateSession = useUpdateExamSession()
  const deleteSession = useDeleteExamSession()
  const isEditable = useIsViewedYearEditable()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ExamSession | null>(null)
  const [deleting, setDeleting] = useState<ExamSession | null>(null)
  const [showBulk, setShowBulk] = useState(() => !!initialClasses && initialClasses.length > 0)
  const [bulkInitialClasses] = useState(() => initialClasses)
  const [showDispatch, setShowDispatch] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [showStats, setShowStats] = useState(false)

  useEffect(() => {
    if (initialClasses && initialClasses.length > 0) onInitialClassesConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grouped = groupByDate(sessions)
  const coveredCount = sessions.filter((s) => isFullyCovered(s.surveillants, s.start, s.end)).length

  const handleSave = (payload: Omit<ExamSession, 'id'> | ExamSession) => {
    if ('id' in payload) {
      updateSession.mutate(payload)
    } else {
      addSession.mutate(payload)
    }
    setShowForm(false)
    setEditing(null)
  }

  const handleSaveAll = async (payloads: Omit<ExamSession, 'id'>[]) => {
    await Promise.all(payloads.map((p) => addSession.mutateAsync(p)))
    setShowBulk(false)
  }

  const handleConfirmDelete = () => {
    if (deleting) deleteSession.mutate(deleting.id)
    setDeleting(null)
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Toutes les sessions
      </button>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{period.label}</h1>
          <p className="text-sm text-slate-500">
            {sessions.length} examen{sessions.length > 1 ? 's' : ''} · {coveredCount}/{sessions.length} avec surveillant(s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowStats(true)}
            disabled={sessions.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <BarChart3 className="h-4 w-4" />
            Statistiques
          </button>
          <button
            type="button"
            onClick={() => setShowPrint(true)}
            disabled={sessions.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button
            type="button"
            onClick={() => setShowDispatch(true)}
            disabled={sessions.length === 0 || !isEditable}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Shuffle className="h-4 w-4" />
            Dispatcher les surveillants
          </button>
          <button
            type="button"
            onClick={() => setShowBulk(true)}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ListPlus className="h-4 w-4" />
            Session complète
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Nouvel Examen
          </button>
        </div>
      </div>

      {!isEditable && <ReadOnlyYearBanner />}

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          Aucun examen dans cette session pour l'instant.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.date}>
              <h2 className="mb-2 text-sm font-bold capitalize text-slate-700">{dateFR(group.date)}</h2>
              <div className="space-y-2">
                {group.sessions.map((s) => {
                  const surveillants = resolveTeachers(s.surveillants.map((a) => a.teacherId))
                  const covered = isFullyCovered(s.surveillants, s.start, s.end)
                  return (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600">
                          <Clock className="h-3.5 w-3.5" />
                          {s.start} - {s.end}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {s.classe} · {s.matiere}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {s.salleLabel || 'Salle à définir'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {surveillants.length > 0 ? surveillants.map((t) => teacherName(t)).join(', ') : 'Aucun surveillant'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {surveillants.length > 0 &&
                          (covered ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                              <ShieldCheck className="h-3 w-3" />
                              Couvert
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-600">
                              <ShieldAlert className="h-3 w-3" />
                              Partiel
                            </span>
                          ))}
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(s)
                            setShowForm(true)
                          }}
                          disabled={!isEditable}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(s)}
                          disabled={!isEditable}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ExamSessionModal
          sessions={allSessions}
          initialSession={editing ?? undefined}
          periodId={editing ? undefined : period.id}
          hideSurveillants={!editing}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      )}

      {showBulk && (
        <BulkExamSessionModal
          sessions={allSessions}
          periodId={period.id}
          hideSurveillants
          initialClasses={bulkInitialClasses}
          onClose={() => setShowBulk(false)}
          onSaveAll={handleSaveAll}
        />
      )}

      {deleting && <ConfirmDeleteModal onCancel={() => setDeleting(null)} onConfirm={handleConfirmDelete} />}

      {showDispatch && <DispatchSurveillantsModal sessions={sessions} allSessions={allSessions} onClose={() => setShowDispatch(false)} />}

      {showPrint && <ExamPlannerPrintPreviewModal sessions={sessions} onClose={() => setShowPrint(false)} />}

      {showStats && <ExamPeriodStatsModal sessions={sessions} periodLabel={period.label} onClose={() => setShowStats(false)} />}
    </div>
  )
}
