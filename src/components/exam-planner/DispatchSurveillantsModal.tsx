import { useState } from 'react'
import { X, Shuffle, Plus, Trash2, MessageCircle, Wand2, ShieldCheck, ShieldAlert, ShieldQuestion, ChevronDown, ChevronUp } from 'lucide-react'
import type { ExamSession, SurveillantAssignment } from '../../data/examPlanner'
import { useUpdateExamSession } from '../../services/examPlannerService'
import { teacherName, initials, type Teacher } from '../../data/teachers'
import { getTeachersSnapshot } from '../../services/teachersService'
import {
  computeAutoCompletion,
  DEFAULT_REQUIRED_SURVEILLANTS,
  isFullyCovered,
  isFullyFreeSuggestion,
  largestInterval,
  suggestSurveillantsWithPartial,
  type PartialSurveillantSuggestion,
} from '../../utils/examPlannerAggregation'
import { timeToMinutes } from '../../data/classSchedules'
import { buildSurveillanceMessage, buildSurveillanceRecapMessage, buildWhatsAppLink } from '../../utils/whatsapp'

function dateFR(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function dateFRShort(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function formatDuree(start: string, end: string): string {
  const totalMinutes = Math.max(0, timeToMinutes(end) - timeToMinutes(start))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${m}`
}

function teacherOf(teacherId: string): Teacher | undefined {
  return getTeachersSnapshot().find((t) => t.id === teacherId)
}

interface CreneauGroup {
  date: string
  start: string
  end: string
  sessions: ExamSession[]
}

function groupByCreneau(sessions: ExamSession[]): CreneauGroup[] {
  const map = new Map<string, CreneauGroup>()
  sessions.forEach((s) => {
    const key = `${s.date}|${s.start}|${s.end}`
    const existing = map.get(key)
    if (existing) existing.sessions.push(s)
    else map.set(key, { date: s.date, start: s.start, end: s.end, sessions: [s] })
  })
  return Array.from(map.values()).sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.start < b.start ? -1 : 1))
}

interface TeacherCreneau {
  date: string
  start: string
  end: string
  classe: string
  matiere: string
  salleLabel: string
}

interface TeacherRecap {
  teacher: Teacher
  creneaux: TeacherCreneau[]
}

/** Regroupe tous les créneaux de surveillance de la période PAR PROF (plutôt que par examen) — pour
 * envoyer un seul message WhatsApp récapitulatif par prof au lieu d'un message séparé à chaque créneau. */
function groupByTeacher(sessions: ExamSession[]): TeacherRecap[] {
  const map = new Map<string, TeacherCreneau[]>()
  sessions.forEach((s) => {
    s.surveillants.forEach((a) => {
      const list = map.get(a.teacherId) ?? []
      list.push({ date: s.date, start: a.start, end: a.end, classe: s.classe, matiere: s.matiere, salleLabel: s.salleLabel })
      map.set(a.teacherId, list)
    })
  })
  return Array.from(map.entries())
    .map(([teacherId, creneaux]) => ({
      teacher: teacherOf(teacherId),
      creneaux: creneaux.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.start < b.start ? -1 : 1)),
    }))
    .filter((r): r is TeacherRecap => !!r.teacher)
    .sort((a, b) => teacherName(a.teacher).localeCompare(teacherName(b.teacher)))
}

interface DispatchSurveillantsModalProps {
  /** Les examens de la session (période) à dispatcher — regroupés par créneau exact. */
  sessions: ExamSession[]
  /** Tous les examens de l'app, pour calculer la disponibilité réelle de chaque prof. */
  allSessions: ExamSession[]
  onClose: () => void
}

/**
 * Regroupe les examens d'une session par créneau exact (date+heure) : sur un même créneau, plusieurs
 * examens peuvent tomber en même temps (ex: CE6 et 3APIC) — chacun garde son propre pool de surveillants
 * disponibles (selon sa classe/matière), mais un prof assigné à l'un disparaît automatiquement du pool
 * des autres sur le créneau précis qu'il couvre (il peut couvrir 30min et redevenir libre ensuite).
 */
export default function DispatchSurveillantsModal({ sessions, allSessions, onClose }: DispatchSurveillantsModalProps) {
  const updateSession = useUpdateExamSession()
  const groups = groupByCreneau(sessions)
  const teacherRecaps = groupByTeacher(sessions)
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [targetCounts, setTargetCounts] = useState<Record<string, number>>({})
  const [viewMode, setViewMode] = useState<'creneau' | 'professeur'>('creneau')

  const removeSurveillant = (session: ExamSession, teacherId: string) => {
    updateSession.mutate({ ...session, surveillants: session.surveillants.filter((a) => a.teacherId !== teacherId) })
  }

  const addSurveillant = (session: ExamSession, teacherId: string, interval: { start: string; end: string }) => {
    updateSession.mutate({ ...session, surveillants: [...session.surveillants, { teacherId, start: interval.start, end: interval.end }] })
    setAddingFor(null)
  }

  const updateWindow = (session: ExamSession, teacherId: string, patch: Partial<Pick<SurveillantAssignment, 'start' | 'end'>>) => {
    updateSession.mutate({
      ...session,
      surveillants: session.surveillants.map((a) => (a.teacherId === teacherId ? { ...a, ...patch } : a)),
    })
  }

  // Complète cet examen jusqu'à ce que `target` surveillants soient présents SIMULTANÉMENT sur tout le
  // créneau (pas juste `target` personnes au total) — comble en priorité les trous les plus francs avec
  // les profs qui les couvrent le mieux, plutôt que d'empiler des gens sur les mêmes horaires déjà remplis.
  const completeAutomatically = (session: ExamSession, candidates: PartialSurveillantSuggestion[]) => {
    const target = targetCounts[session.id] ?? DEFAULT_REQUIRED_SURVEILLANTS
    const additions = computeAutoCompletion(session.surveillants, session.start, session.end, target, candidates)
    if (additions.length === 0) return
    updateSession.mutate({ ...session, surveillants: [...session.surveillants, ...additions] })
  }

  // Complète TOUS les examens de la session en une fois. Traite les examens dans l'ordre en tenant à jour
  // une copie locale de tous les examens : un prof assigné à l'un pendant ce calcul en mémoire disparaît
  // immédiatement du pool des suivants sur le même créneau, pour éviter de le proposer deux fois au même
  // moment (ce que des mises à jour indépendantes basées sur les données déjà en base ne verraient pas).
  const completeAllAutomatically = () => {
    let localSessions = [...allSessions]
    const patches: ExamSession[] = []

    sessions.forEach((original) => {
      const current = localSessions.find((s) => s.id === original.id) ?? original
      const target = targetCounts[current.id] ?? DEFAULT_REQUIRED_SURVEILLANTS
      if (isFullyCovered(current.surveillants, current.start, current.end, target)) return

      const suggestions = suggestSurveillantsWithPartial(
        localSessions,
        current.date,
        current.start,
        current.end,
        current.classe,
        current.matiere,
        current.id,
        current.salleLabel
      )
      const assignedIds = new Set(current.surveillants.map((a) => a.teacherId))
      const candidates = suggestions.filter((s) => !assignedIds.has(s.teacher.id))
      const additions = computeAutoCompletion(current.surveillants, current.start, current.end, target, candidates)
      if (additions.length === 0) return

      const updated = { ...current, surveillants: [...current.surveillants, ...additions] }
      localSessions = localSessions.map((s) => (s.id === updated.id ? updated : s))
      patches.push(updated)
    })

    patches.forEach((p) => updateSession.mutate(p))
  }

  const allCovered = sessions.every((s) => isFullyCovered(s.surveillants, s.start, s.end, targetCounts[s.id] ?? DEFAULT_REQUIRED_SURVEILLANTS))

  const handleSendWhatsApp = (session: ExamSession, a: SurveillantAssignment) => {
    const t = teacherOf(a.teacherId)
    if (!t) return
    const message = buildSurveillanceMessage({
      teacherName: teacherName(t),
      date: session.date,
      creneau: `${a.start} - ${a.end}`,
      classe: session.classe,
      matiere: session.matiere,
      salle: session.salleLabel || 'À confirmer',
      consignes: session.consignes || undefined,
    })
    const link = buildWhatsAppLink(t.telephoneMobile, message)
    if (link) window.open(link, '_blank', 'noopener,noreferrer')
  }

  const handleSendRecap = (recap: TeacherRecap) => {
    const message = buildSurveillanceRecapMessage({
      teacherName: teacherName(recap.teacher),
      creneaux: recap.creneaux.map((c) => ({
        date: c.date,
        creneau: `${c.start} - ${c.end}`,
        classe: c.classe,
        matiere: c.matiere,
        salle: c.salleLabel || 'À confirmer',
      })),
    })
    const link = buildWhatsAppLink(recap.teacher.telephoneMobile, message)
    if (link) window.open(link, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Shuffle className="h-5 w-5 text-indigo-500" />
              Dispatcher les surveillants
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">L'horaire de chaque surveillant est ajustable — il peut couvrir juste une partie du créneau.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-6 pt-3">
          <button
            type="button"
            onClick={() => setViewMode('creneau')}
            className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${
              viewMode === 'creneau' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Par créneau
          </button>
          <button
            type="button"
            onClick={() => setViewMode('professeur')}
            className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${
              viewMode === 'professeur' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Par professeur ({teacherRecaps.length})
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {viewMode === 'professeur' ? (
            teacherRecaps.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Aucun surveillant assigné pour l'instant.</p>
            ) : (
              <div className="space-y-2">
                {teacherRecaps.map((recap) => (
                  <div key={recap.teacher.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                      {initials(teacherName(recap.teacher))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{teacherName(recap.teacher)}</p>
                      <p className="truncate text-[11px] text-slate-400">
                        {recap.creneaux.length} créneau{recap.creneaux.length > 1 ? 'x' : ''} ·{' '}
                        {recap.creneaux.map((c) => `${dateFRShort(c.date)} ${c.start}`).join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSendRecap(recap)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-100"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Envoyer
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Aucun examen à dispatcher.</p>
          ) : (
            groups.map((group) => (
              <div key={`${group.date}|${group.start}|${group.end}`}>
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-600">
                  {dateFR(group.date)}
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
                    {group.start} - {group.end}
                  </span>
                </p>
                <div className="space-y-2.5">
                  {group.sessions.map((session) => {
                    const suggestions = suggestSurveillantsWithPartial(
                      allSessions,
                      session.date,
                      session.start,
                      session.end,
                      session.classe,
                      session.matiere,
                      session.id,
                      session.salleLabel
                    )
                    const assignedIds = new Set(session.surveillants.map((a) => a.teacherId))
                    const candidates = suggestions.filter((s) => !assignedIds.has(s.teacher.id))
                    const target = targetCounts[session.id] ?? DEFAULT_REQUIRED_SURVEILLANTS
                    const covered = isFullyCovered(session.surveillants, session.start, session.end, target)
                    const isAdding = addingFor === session.id

                    return (
                      <div key={session.id} className="rounded-xl border border-slate-100 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">
                            {session.classe} · {session.matiere}
                            <span className="font-normal text-slate-400"> — {session.salleLabel || 'Salle à définir'}</span>
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                max={6}
                                value={target}
                                onChange={(e) =>
                                  setTargetCounts((prev) => ({ ...prev, [session.id]: Math.max(1, Math.min(6, Number(e.target.value) || 1)) }))
                                }
                                title="Nombre de surveillants requis simultanément"
                                className="w-9 rounded border border-slate-200 px-1 py-0.5 text-[10px] text-slate-700 focus:border-indigo-400 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => completeAutomatically(session, candidates)}
                                disabled={candidates.length === 0 || covered}
                                title="Compléter automatiquement"
                                className="flex h-6 w-6 items-center justify-center rounded text-indigo-500 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-slate-300"
                              >
                                <Wand2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {session.surveillants.length === 0 ? (
                              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                <ShieldQuestion className="h-3 w-3" />
                                Non couvert
                              </span>
                            ) : covered ? (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                                <ShieldCheck className="h-3 w-3" />
                                Couvert
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                                <ShieldAlert className="h-3 w-3" />
                                Partiellement couvert
                              </span>
                            )}
                          </div>
                        </div>

                        {session.surveillants.length > 0 && (
                          <div className="mb-2 space-y-1.5">
                            {session.surveillants.map((a) => {
                              const t = teacherOf(a.teacherId)
                              return (
                                <div key={a.teacherId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
                                    {t ? initials(teacherName(t)) : '?'}
                                  </span>
                                  <span className="flex-1 truncate text-xs font-medium text-slate-700">{t ? teacherName(t) : a.teacherId}</span>
                                  <input
                                    type="time"
                                    min={session.start}
                                    max={a.end}
                                    value={a.start}
                                    onChange={(e) => updateWindow(session, a.teacherId, { start: e.target.value })}
                                    className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 focus:border-indigo-400 focus:outline-none"
                                  />
                                  <span className="text-slate-300">→</span>
                                  <input
                                    type="time"
                                    min={a.start}
                                    max={session.end}
                                    value={a.end}
                                    onChange={(e) => updateWindow(session, a.teacherId, { end: e.target.value })}
                                    className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-700 focus:border-indigo-400 focus:outline-none"
                                  />
                                  <span className="w-11 shrink-0 text-right text-[10px] text-slate-400">{formatDuree(a.start, a.end)}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleSendWhatsApp(session, a)}
                                    title="Envoyer un message WhatsApp"
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-emerald-500 hover:bg-emerald-50"
                                  >
                                    <MessageCircle className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeSurveillant(session, a.teacherId)}
                                    title="Retirer"
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {isAdding ? (
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <p className="text-[11px] font-semibold text-slate-500">Ajouter un surveillant</p>
                              <button
                                type="button"
                                onClick={() => setAddingFor(null)}
                                className="flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-slate-600"
                              >
                                <ChevronUp className="h-3 w-3" />
                                Fermer
                              </button>
                            </div>
                            {candidates.length === 0 ? (
                              <p className="text-[11px] text-slate-400">Aucun autre professeur disponible sur ce créneau.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {candidates.map((c) => {
                                  const fullyFree = isFullyFreeSuggestion(c, session.start, session.end)
                                  const interval = largestInterval(c.freeIntervals)
                                  return (
                                    <button
                                      key={c.teacher.id}
                                      type="button"
                                      onClick={() => addSurveillant(session, c.teacher.id, interval)}
                                      title={fullyFree ? undefined : `Libre seulement de ${interval.start} à ${interval.end}`}
                                      className={
                                        fullyFree
                                          ? 'rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                                          : 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:border-amber-400'
                                      }
                                    >
                                      {teacherName(c.teacher)}
                                      {!fullyFree && (
                                        <span className="ml-1 font-normal">
                                          ({interval.start}-{interval.end})
                                        </span>
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAddingFor(session.id)}
                            className="flex items-center gap-1 text-[11px] font-medium text-indigo-500 hover:underline"
                          >
                            <Plus className="h-3 w-3" />
                            Ajouter un surveillant
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={completeAllAutomatically}
            disabled={allCovered}
            title="Compléter automatiquement tous les examens de la session"
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300"
          >
            <Wand2 className="h-4 w-4" />
            Tout compléter
          </button>
          <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
            Terminé
          </button>
        </div>
      </div>
    </div>
  )
}
