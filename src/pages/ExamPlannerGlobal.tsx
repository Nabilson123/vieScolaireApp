import { useState } from 'react'
import { FileCheck2, Plus, Printer, Pencil, Trash2, Clock, MapPin, Users, ShieldCheck, ShieldAlert, ListPlus, CalendarRange } from 'lucide-react'
import { EXAM_TYPES, type ExamSession, type ExamType } from '../data/examPlanner'
import { useAddExamSession, useDeleteExamSession, useExamSessions, useUpdateExamSession } from '../services/examPlannerService'
import { teacherName, type Teacher } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import { isFullyCovered } from '../utils/examPlannerAggregation'
import ExamSessionModal from '../components/exam-planner/ExamSessionModal'
import BulkExamSessionModal from '../components/exam-planner/BulkExamSessionModal'
import DuplicateExamSessionsModal from '../components/exam-planner/DuplicateExamSessionsModal'
import ExamPlannerPrintPreviewModal from '../components/exam-planner-print/ExamPlannerPrintPreviewModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

function dateFR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function todayISO(): string {
  return new Date().toLocaleDateString('sv-SE')
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

function resolveTeachers(ids: string[]): Teacher[] {
  const teachers = getTeachersSnapshot()
  return ids.map((id) => teachers.find((t) => t.id === id)).filter((t): t is Teacher => !!t)
}

const TYPE_BADGE: Record<ExamType, string> = {
  'Examen Officiel': 'bg-indigo-50 text-indigo-600',
  'Examen Blanc': 'bg-amber-50 text-amber-600',
}

export default function ExamPlannerGlobal() {
  const { data: sessions } = useExamSessions()
  const addSession = useAddExamSession()
  const updateSession = useUpdateExamSession()
  const deleteSession = useDeleteExamSession()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'examPlanner').canEdit
  const isEditable = canEditYear && canEditModule

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ExamSession | null>(null)
  const [deleting, setDeleting] = useState<ExamSession | null>(null)
  const [showPrint, setShowPrint] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [onlyUpcoming, setOnlyUpcoming] = useState(true)
  const [typeFilter, setTypeFilter] = useState<ExamType | 'Tous'>('Tous')

  if (!sessions) {
    return <div className="flex h-full items-center justify-center p-10 text-slate-400">Chargement...</div>
  }

  const filtered = sessions
    .filter((s) => (onlyUpcoming ? s.date >= todayISO() : true))
    .filter((s) => (typeFilter === 'Tous' ? true : s.type === typeFilter))
  const grouped = groupByDate(filtered)

  const handleSave = (payload: Omit<ExamSession, 'id'> | ExamSession) => {
    if ('id' in payload) {
      updateSession.mutate(payload)
    } else {
      addSession.mutate(payload)
    }
    setShowForm(false)
    setEditing(null)
  }

  const handleConfirmDelete = () => {
    if (deleting) deleteSession.mutate(deleting.id)
    setDeleting(null)
  }

  const handleSaveAll = async (payloads: Omit<ExamSession, 'id'>[]) => {
    await Promise.all(payloads.map((p) => addSession.mutateAsync(p)))
    setShowBulk(false)
  }

  const handleDuplicate = async (payloads: Omit<ExamSession, 'id'>[]) => {
    await Promise.all(payloads.map((p) => addSession.mutateAsync(p)))
    setShowDuplicate(false)
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <FileCheck2 className="h-5 w-5 text-indigo-500" />
            Planificateur d'Examens
          </h1>
          <p className="text-sm text-slate-500">Sessions, surveillants et planning des examens formels.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDuplicate(true)}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarRange className="h-4 w-4" />
            Dupliquer un planning
          </button>
          <button
            type="button"
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Imprimer
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

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyUpcoming(true)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${onlyUpcoming ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
          >
            À venir
          </button>
          <button
            type="button"
            onClick={() => setOnlyUpcoming(false)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${!onlyUpcoming ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
          >
            Tous
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTypeFilter('Tous')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${typeFilter === 'Tous' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
          >
            Tous les types
          </button>
          {EXAM_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${typeFilter === t ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          Aucun examen planifié{onlyUpcoming ? ' à venir' : ''}.
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
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-semibold text-slate-800">
                              {s.classe} · {s.matiere}
                            </p>
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_BADGE[s.type]}`}>{s.type}</span>
                          </div>
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
          sessions={sessions}
          initialSession={editing ?? undefined}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      )}

      {showBulk && <BulkExamSessionModal sessions={sessions} onClose={() => setShowBulk(false)} onSaveAll={handleSaveAll} />}

      {showDuplicate && <DuplicateExamSessionsModal sessions={sessions} onClose={() => setShowDuplicate(false)} onDuplicate={handleDuplicate} />}

      {deleting && <ConfirmDeleteModal onCancel={() => setDeleting(null)} onConfirm={handleConfirmDelete} />}

      {showPrint && <ExamPlannerPrintPreviewModal sessions={filtered} onClose={() => setShowPrint(false)} />}
    </div>
  )
}
