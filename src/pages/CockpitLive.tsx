import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Printer,
  UserX,
  AlertTriangle,
  ClipboardCheck,
  ShieldAlert,
  Bus,
  Stethoscope,
  Clock,
  CheckCircle2,
  PlusCircle,
  UserPlus,
  Settings2,
  CalendarClock,
  MessageSquareWarning,
  PhoneCall,
} from 'lucide-react'
import { initials as studentInitials } from '../data/students'
import { useStudents } from '../services/studentsService'
import { useStudentExtras } from '../services/studentDetailsService'
import { useStudentIdentities } from '../services/studentIdentityService'
import { teacherName } from '../data/teachers'
import { useTeachers } from '../services/teachersService'
import type { RemplacementRecord } from '../data/teacherExtras'
import { useTeacherExtras, useUpdateTeacherAbsences, useUpdateTeacherRemplacements } from '../services/teacherExtrasService'
import { getPendingReplacements, getAllTeacherAbsenceDetails, type PendingReplacement } from '../utils/replacementAggregation'
import { formatHeures } from '../utils/teacherAggregation'
import { isWithinPeriod } from '../utils/period'
import { useClassSchedules } from '../services/classSchedulesService'
import { useClasses } from '../services/classesService'
import { useServicesCapacite, useUpdateServicesCapacite, type CreneauFixe } from '../services/servicesCapaciteService'
import { getCreneauIcon, getCreneauColorClass } from '../utils/creneauFixeIcons'
import { useAppelsToday, useMarkAppelDone } from '../services/appelsService'
import { useAppelsParentsToday, useMarkAppelParentDone } from '../services/appelsParentsService'
import MarquerAppelParentModal from '../components/MarquerAppelParentModal'
import { timeToMinutes } from '../data/classSchedules'
import {
  buildIncidents,
  computeCockpitKpis,
  computeCockpitStatus,
  getAbsentStudentsDetail,
  getInfirmerieAccidentsDetail,
  buildDayTimeline,
  getAppelsNonFaits,
  getClassesLiveStatus,
  getParentsToCallToday,
  buildRecentEvents,
  type ParentToCall,
} from '../utils/liveCockpitAggregation'
import { computeCockpitReclamations } from '../utils/reclamationsAlerts'
import RemplacementDirectModal from '../components/RemplacementDirectModal'
import TimelineCreneauxModal from '../components/TimelineCreneauxModal'
import CockpitPrintPreviewModal from '../components/cockpit-print/CockpitPrintPreviewModal'
import RegisterDisciplineModal from '../components/RegisterDisciplineModal'
import { saveDisciplineEntries } from '../services/disciplineRegistration'
import type { DisciplinePayload } from '../utils/disciplineIncident'
import SignalerAbsenceModal from '../components/SignalerAbsenceModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekStartISO(): string {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return d.toISOString().slice(0, 10)
}

/** Fenêtre (en minutes) au-delà de la dernière/première heure de cours dans laquelle un marqueur ou créneau fixe est encore considéré applicable au jour. */
const TIMELINE_EXTENSION_MIN = 120

interface CockpitLiveProps {
  onDataChanged?: () => void
  onNavigateToJournalAppelsParents?: () => void
}

export default function CockpitLive({ onDataChanged, onNavigateToJournalAppelsParents }: CockpitLiveProps) {
  const queryClient = useQueryClient()
  // Les useMemo ci-dessous dépendent des références réellement retournées par les hooks (pas juste
  // l'id de l'année consultée, qui change avant la fin du fetch réseau) — même raison que documentée
  // à l'origine dans ce fichier pour absentTeachers/incidents.
  const { data: teachers } = useTeachers()
  const { data: schedules } = useClassSchedules()
  const { data: students } = useStudents()
  const { data: studentExtras } = useStudentExtras()
  const { data: teacherExtras = {} } = useTeacherExtras()
  const { data: classes } = useClasses()
  const { data: capacite } = useServicesCapacite()
  const { data: appelsToday } = useAppelsToday()
  const { data: appelsParentsToday } = useAppelsParentsToday()
  useStudentIdentities()
  const updateAbsences = useUpdateTeacherAbsences()
  const updateRemplacements = useUpdateTeacherRemplacements()
  const markAppelDone = useMarkAppelDone()
  const markAppelParentDone = useMarkAppelParentDone()
  const updateServicesCapacite = useUpdateServicesCapacite()
  const isEditable = useIsViewedYearEditable()
  const profile = useCurrentProfile()
  const canEditDiscipline = getModuleAccess(profile, 'discipline').canEdit
  const canEditAbsences = getModuleAccess(profile, 'absences').canEdit

  const [period, setPeriod] = useState<'today' | 'week'>('today')
  const [remplacementDirect, setRemplacementDirect] = useState<PendingReplacement | null>(null)
  const [showPrint, setShowPrint] = useState(false)
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [showAbsenceProfModal, setShowAbsenceProfModal] = useState(false)
  const [showCreneauxModal, setShowCreneauxModal] = useState(false)
  const [callingStudent, setCallingStudent] = useState<ParentToCall | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date())
  const [nowTick, setNowTick] = useState(0)

  // Rafraîchissement data — 45s. queryClient.invalidateQueries(...) directement (pas onDataChanged,
  // qui ne fait que bumper un compteur non lu ailleurs dans l'app) sur les seules clés volatiles
  // pendant une journée : schedules/students changent rarement et s'auto-invalident déjà via leurs
  // propres mutations.
  useEffect(() => {
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['teacherExtras'] })
      queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      queryClient.invalidateQueries({ queryKey: ['appels'] })
      setLastRefreshedAt(new Date())
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 45_000)
    return () => clearInterval(id)
  }, [queryClient])

  // Tick label "il y a Ns" + curseur "maintenant" de la timeline — 1s, aucun réseau.
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 1_000)
    return () => clearInterval(id)
  }, [])

  const today = todayISO()
  const periodStart = period === 'today' ? today : weekStartISO()
  const periodEnd = today
  const periodLabel = period === 'today' ? "Aujourd'hui" : 'Cette Semaine'

  const absentTeachers = useMemo(
    () => getPendingReplacements().filter((p) => isWithinPeriod(p.date, periodStart, periodEnd)),
    [periodStart, periodEnd, teacherExtras, teachers, schedules]
  )

  // Vue détaillée pour le rapport imprimé : TOUTES les absences profs de la période (remplacées ou
  // non), avec le(s) remplaçant(s) — contrairement à absentTeachers (carte à l'écran) qui ne liste
  // que les créneaux encore non couverts, actionnables maintenant.
  const absentTeachersDetailed = useMemo(
    () => getAllTeacherAbsenceDetails().filter((p) => isWithinPeriod(p.date, periodStart, periodEnd)),
    [periodStart, periodEnd, teacherExtras, teachers, schedules]
  )

  const absentStudents = useMemo(() => getAbsentStudentsDetail(periodStart, periodEnd), [periodStart, periodEnd, students, studentExtras])

  const infirmerieAccidents = useMemo(() => getInfirmerieAccidentsDetail(periodStart, periodEnd), [periodStart, periodEnd, students, studentExtras])

  const incidents = useMemo(() => buildIncidents(periodStart, periodEnd), [periodStart, periodEnd, students, studentExtras])

  const kpis = useMemo(() => computeCockpitKpis(today), [today, students, studentExtras, teachers, teacherExtras, schedules])
  const status = useMemo(() => computeCockpitStatus(kpis), [kpis])
  const timeline = useMemo(() => buildDayTimeline(today), [today, schedules, classes, capacite])
  const appelsNonFaits = useMemo(() => getAppelsNonFaits(new Date()), [today, nowTick, schedules, classes, appelsToday])
  const classesLiveStatus = useMemo(() => getClassesLiveStatus(new Date()), [today, nowTick, schedules, classes, appelsToday])
  const parentsToCall = useMemo(() => getParentsToCallToday(today), [today, students, studentExtras, appelsParentsToday])
  const recentEvents = useMemo(() => buildRecentEvents(today, 20), [today, students, studentExtras])
  const reclamationsCockpit = useMemo(() => computeCockpitReclamations(), [today, students, studentExtras])

  const nowMin = useMemo(() => {
    void nowTick
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  }, [nowTick])

  // Ancrage de la journée = vrais cours + créneaux fixes (ces derniers sont déjà filtrés par jour via
  // leurs cases L/M/M/J/V, donc dignes de confiance même sans cours réels ce jour-là). Seuls les 3
  // marqueurs transport globaux (matin/soir primaire/soir collège, sans granularité par jour) sont
  // ensuite inclus uniquement s'ils tombent à proximité de cet ancrage (fenêtre TIMELINE_EXTENSION_MIN)
  // — sinon un horaire de transport 16h/17h s'affiche même quand la seule donnée du jour est un
  // créneau fixe qui finit à midi (ex. vendredi), ce qui a été le bug initial de cette logique.
  const timelineBounds = useMemo(() => {
    const anchorMins = [
      ...timeline.blocks.map((b) => b.start),
      ...timeline.blocks.map((b) => b.end),
      ...timeline.fixedSlots.map((f) => f.start),
      ...timeline.fixedSlots.map((f) => f.end),
    ].map(timeToMinutes)

    if (anchorMins.length === 0) {
      const markerMins = timeline.markers.map((m) => timeToMinutes(m.time))
      if (markerMins.length === 0) return null
      return { start: Math.min(...markerMins), end: Math.max(...markerMins) }
    }

    const anchorStart = Math.min(...anchorMins)
    const anchorEnd = Math.max(...anchorMins)
    const nearbyMarkerMins = timeline.markers
      .map((m) => timeToMinutes(m.time))
      .filter((t) => t >= anchorStart - TIMELINE_EXTENSION_MIN && t <= anchorEnd + TIMELINE_EXTENSION_MIN)
    return { start: Math.min(anchorStart, ...nearbyMarkerMins), end: Math.max(anchorEnd, ...nearbyMarkerMins) }
  }, [timeline])

  const cursorPct =
    timelineBounds && nowMin >= timelineBounds.start && nowMin <= timelineBounds.end
      ? ((nowMin - timelineBounds.start) / (timelineBounds.end - timelineBounds.start)) * 100
      : null

  const pctInTimeline = (hhmm: string): number => {
    if (!timelineBounds) return 0
    return ((timeToMinutes(hhmm) - timelineBounds.start) / (timelineBounds.end - timelineBounds.start)) * 100
  }

  // Marqueurs/créneaux fixes hors de la journée réelle (ex : horaires transport 16h/17h un vendredi
  // qui finit à midi) sont masqués plutôt que de forcer l'axe à s'étirer pour les inclure.
  const visibleMarkers = timeline.markers.filter((m) => {
    const p = pctInTimeline(m.time)
    return p >= 0 && p <= 100
  })
  const visibleFixedSlots = timeline.fixedSlots.filter((f) => pctInTimeline(f.end) > 0 && pctInTimeline(f.start) < 100)

  // Marqueurs transport et créneaux fixes affichés dans une seule rangée icône + heure, dans le même
  // style visuel (comme les icônes 🚍 transport) — triés chronologiquement, peu importe leur origine.
  // Couleur alignée sur le bloc correspondant (indigo = cours/transport, teal = créneau fixe) pour
  // que les icônes se distinguent au premier coup d'œil plutôt que d'être toutes grises et identiques.
  const iconMarkers = [
    ...visibleMarkers.map((m) => ({ time: m.time, label: m.time, title: m.label, Icon: Bus, color: 'text-indigo-400' })),
    ...visibleFixedSlots.map((f) => ({
      time: f.start,
      label: f.start,
      title: `${f.label} (${f.start}-${f.end})`,
      Icon: getCreneauIcon(f.icon),
      color: getCreneauColorClass(f.icon) === 'indigo' ? 'text-indigo-400' : 'text-teal-500',
    })),
  ].sort((a, b) => (a.time < b.time ? -1 : 1))

  const secondsAgo = useMemo(() => {
    void nowTick
    return Math.max(0, Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000))
  }, [nowTick, lastRefreshedAt])

  const handleRetablirPresence = () => {
    if (!remplacementDirect) return
    const extra = teacherExtras[remplacementDirect.teacher.id] ?? { absences: [], remplacements: [] }
    const absences = extra.absences.filter(
      (a) => !(a.date === remplacementDirect.date && a.classe === remplacementDirect.classe)
    )
    updateAbsences.mutate({ teacherId: remplacementDirect.teacher.id, absences })
    setRemplacementDirect(null)
    onDataChanged?.()
  }

  const handleAffecter = (teacherId: string, consignes: string, creneau: { start: string; end: string; hours: number }) => {
    if (!remplacementDirect) return
    const record: RemplacementRecord = {
      date: remplacementDirect.date,
      classe: remplacementDirect.classe,
      matiere: remplacementDirect.subject,
      profRemplace: teacherName(remplacementDirect.teacher),
      heures: creneau.hours,
      start: creneau.start,
      end: creneau.end,
      consignes: consignes.trim() || undefined,
    }
    const extra = teacherExtras[teacherId] ?? { absences: [], remplacements: [] }
    updateRemplacements.mutate({ teacherId, remplacements: [record, ...extra.remplacements] })
    onDataChanged?.()
  }

  const teacherLabel = (teacherId: string): string => {
    const t = teachers?.find((t) => t.id === teacherId)
    return t ? teacherName(t) : ''
  }

  const handleConfirmAppelParent = (note: string, parentAppele: string) => {
    if (!callingStudent) return
    const markedBy = profile?.nomComplet || profile?.email || ''
    markAppelParentDone.mutate(
      { studentId: callingStudent.studentId, markedBy, note: note.trim() || undefined, parentAppele },
      { onSuccess: () => setCallingStudent(null) }
    )
  }

  const handleSaveCreneaux = (next: CreneauFixe[]) => {
    if (!capacite) return
    updateServicesCapacite.mutate({ id: capacite.id, creneauxFixes: next })
  }

  const handleRegisterIncident = async (payloads: DisciplinePayload[]) => {
    await saveDisciplineEntries(payloads)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setShowIncidentModal(false)
    onDataChanged?.()
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Cockpit Opérationnel
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Live
            </span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            Surveillance et rapport des absences et incidents · mis à jour il y a {secondsAgo}s
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {(['today', 'week'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  period === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {key === 'today' ? "Aujourd'hui" : 'Cette Semaine'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            Imprimer / PDF
          </button>
        </div>
      </div>

      {!isEditable && <ReadOnlyYearBanner />}

      {/* Bandeau KPI — toujours "aujourd'hui", indépendant de l'onglet période */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiTile label="Taux de présence" value={`${kpis.presenceRate}%`} />
        <KpiTile label="Présents / Attendus" value={`${kpis.studentsPresent} / ${kpis.studentsExpected}`} />
        <KpiTile label="Profs absents" value={String(kpis.teachersAbsentToday)} />
        <KpiTile label="Remplacements assurés" value={`${kpis.replacementsCoveredToday} / ${kpis.replacementsTotalToday}`} />
        <KpiTile label="Incidents" value={String(kpis.incidentsToday)} />
      </div>

      {/* Bandeau de statut global — remplace les anciens états "aucune donnée" */}
      <div
        className={`mb-4 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
          status.level === 'ok' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}
      >
        {status.level === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
        {status.message}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Timeline de la journée */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Timeline de la journée</h3>
              <button
                type="button"
                onClick={() => setShowCreneauxModal(true)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                title="Configurer les créneaux fixes (récréation, cantine, étude...)"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Configurer les créneaux
              </button>
            </div>
            {timeline.blocks.length === 0 && timeline.fixedSlots.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Pas de cours programmé aujourd'hui — journée calme.</p>
            ) : (
              <div className="pb-6">
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  {timeline.blocks.map((b, idx) => (
                    <div
                      key={`block-${idx}`}
                      className={`absolute top-0 h-full ${b.type === 'cours' ? 'bg-indigo-400' : 'bg-slate-200'}`}
                      style={{ left: `${pctInTimeline(b.start)}%`, width: `${pctInTimeline(b.end) - pctInTimeline(b.start)}%` }}
                      title={`${b.type === 'cours' ? 'Cours' : 'Pause'} ${b.start}-${b.end}`}
                    />
                  ))}
                  {visibleFixedSlots.map((f, idx) => (
                    <div
                      key={`fixed-${idx}`}
                      className={`absolute top-0 h-full ${getCreneauColorClass(f.icon) === 'indigo' ? 'bg-indigo-400' : 'bg-teal-400'}`}
                      style={{ left: `${pctInTimeline(f.start)}%`, width: `${Math.max(1, pctInTimeline(f.end) - pctInTimeline(f.start))}%` }}
                      title={`${f.label} ${f.start}-${f.end}`}
                    />
                  ))}
                  {cursorPct !== null && (
                    <div
                      className="absolute top-[-4px] h-[20px] w-[2px] bg-rose-500"
                      style={{ left: `${cursorPct}%` }}
                      title={`Maintenant (${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')})`}
                    />
                  )}
                </div>
                <div className="relative mt-2 h-8 text-[10px] text-slate-500">
                  {iconMarkers.map((m, idx) => (
                    <div
                      key={idx}
                      className="absolute flex -translate-x-1/2 flex-col items-center gap-0.5"
                      style={{ left: `${pctInTimeline(m.time)}%` }}
                      title={m.title}
                    >
                      <m.Icon className={`h-3.5 w-3.5 ${m.color}`} />
                      <span className="whitespace-nowrap">{m.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-400" /> Cours
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-200" /> Pause
                  </span>
                  {visibleFixedSlots.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-teal-400" /> Créneau fixe
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-[2px] bg-rose-500" /> Maintenant
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Professeurs Absents */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-rose-500" />
                <h3 className="text-sm font-bold text-slate-800">Professeurs Absents {periodLabel}</h3>
              </div>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600">
                {absentTeachers.length} signalement(s)
              </span>
            </div>

            {absentTeachers.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Toutes les absences sont remplacées — aucune action requise.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Professeur & Matière</th>
                      <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Classe & Durée</th>
                      <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Statut</th>
                      <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absentTeachers.map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-50 last:border-0">
                        <td className="py-3">
                          <p className="text-sm font-semibold text-slate-900">{teacherName(p.teacher)}</p>
                          <p className="text-xs text-slate-500">{p.subject}</p>
                        </td>
                        <td className="py-3">
                          <p className="text-sm font-semibold text-slate-800">{p.classe}</p>
                          <p className="text-xs text-slate-500">{formatHeures(p.hours)} d'absence</p>
                        </td>
                        <td className="py-3">
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-500">● Non remplacé</span>
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => setRemplacementDirect(p)}
                            disabled={!isEditable}
                            className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Gérer →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Classes en direct */}
          {/* Parents à appeler */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-800">Parents à appeler</h3>
              </div>
              <div className="flex items-center gap-2">
                {onNavigateToJournalAppelsParents && (
                  <button
                    type="button"
                    onClick={onNavigateToJournalAppelsParents}
                    className="text-[11px] font-semibold text-indigo-600 hover:underline"
                  >
                    Journal des appels →
                  </button>
                )}
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
                  {parentsToCall.length} élève(s)
                </span>
              </div>
            </div>

            {parentsToCall.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Aucun parent à appeler pour l'instant.</p>
            ) : (
              <div className="space-y-2">
                {parentsToCall.map((p) => (
                  <div key={p.studentId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {p.studentName} <span className="font-normal text-slate-400">{p.classe}</span>
                      </p>
                      <p className="truncate text-xs text-slate-500">{p.reasons.join(' · ')}</p>
                      {(p.parent1Tel || p.parent2Tel) && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {p.parent1Tel && (
                            <a href={`tel:${p.parent1Tel}`} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
                              <PhoneCall className="h-3 w-3" />
                              {p.parent1Nom || 'Parent 1'} · {p.parent1Tel}
                            </a>
                          )}
                          {p.parent2Tel && (
                            <a href={`tel:${p.parent2Tel}`} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
                              <PhoneCall className="h-3 w-3" />
                              {p.parent2Nom || 'Parent 2'} · {p.parent2Tel}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCallingStudent(p)}
                      disabled={!isEditable}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Marquer appelé
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Classes en direct — plan de salle compact : une pastille par classe, colorée si en cours */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-800">Classes en direct</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {classesLiveStatus.filter((c) => c.slot).length} en cours
                </span>
                {appelsNonFaits.length > 0 && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                    {appelsNonFaits.length} appel(s) en attente
                  </span>
                )}
              </div>
            </div>

            {classesLiveStatus.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Aucune classe active.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {classesLiveStatus.map((c) => {
                  const active = c.slot !== null
                  const done = active && c.appelFait
                  const clickable = active && !done
                  const teacher = c.slot ? teacherLabel(c.slot.teacherId) : ''
                  return (
                    <button
                      key={c.classe}
                      type="button"
                      onClick={() =>
                        clickable &&
                        markAppelDone.mutate({ classe: c.classe, slotId: c.slot!.id, markedBy: profile?.nomComplet || profile?.email || '' })
                      }
                      disabled={!clickable || !isEditable}
                      title={c.slot ? `${c.slot.subject} · ${c.slot.start}-${c.slot.end}${teacher ? ' · ' + teacher : ''}` : 'Pas de cours'}
                      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-3 text-center transition-colors ${
                        done
                          ? 'border-emerald-200 bg-emerald-50'
                          : active
                            ? 'cursor-pointer border-indigo-200 bg-indigo-50 hover:bg-indigo-100'
                            : 'border-slate-100 bg-slate-50/60'
                      } ${!clickable ? 'disabled:cursor-default' : ''}`}
                    >
                      {clickable && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />}
                      {done && <CheckCircle2 className="absolute right-1 top-1 h-3.5 w-3.5 text-emerald-500" />}
                      <span className={`text-xs font-bold ${done ? 'text-emerald-700' : active ? 'text-indigo-700' : 'text-slate-400'}`}>
                        {c.classe}
                      </span>
                      <span className={`w-full truncate text-[10px] font-semibold ${done ? 'text-emerald-600' : active ? 'text-indigo-500' : 'text-slate-300'}`}>
                        {c.slot ? c.slot.subject : '—'}
                      </span>
                      {active && (
                        <span className={`w-full truncate text-[10px] ${done ? 'text-emerald-500' : 'text-indigo-400'}`}>{teacher || '—'}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-1">
          {/* Actions rapides */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-800">Actions rapides</h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowIncidentModal(true)}
                disabled={!isEditable || !canEditDiscipline}
                title={!canEditDiscipline ? "Vous n'avez pas les droits d'édition sur le module Discipline." : undefined}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Signaler un incident
              </button>
              <button
                type="button"
                onClick={() => setShowAbsenceProfModal(true)}
                disabled={!isEditable || !canEditAbsences}
                title={!canEditAbsences ? "Vous n'avez pas les droits d'édition sur le module Absences." : undefined}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4 text-indigo-500" />
                Déclarer une absence prof
              </button>
              <button
                type="button"
                onClick={() => setShowPrint(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <PlusCircle className="h-4 w-4 text-slate-500" />
                Imprimer la feuille du jour
              </button>
            </div>
          </div>

          {/* Incidents Disciplinaires */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-800">Incidents Disciplinaires</h3>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                {incidents.length} {period === 'today' ? 'du jour' : 'de la semaine'}
              </span>
            </div>

            {incidents.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Aucun incident — journée sereine.</p>
            ) : (
              <div className="space-y-3">
                {incidents.map((inc, idx) => (
                  <div key={idx} className="rounded-xl bg-white p-3 shadow-sm">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-[10px] font-bold text-white">
                        {studentInitials(inc.studentName)}
                      </div>
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {inc.studentName} <span className="font-normal text-slate-400">{inc.classe}</span>
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-rose-600">
                      {inc.title} ({inc.points})
                    </p>
                    <p className="text-xs italic text-slate-500">« {inc.description} »</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Réclamations parents à traiter */}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="h-4 w-4 text-rose-500" />
                <h3 className="text-sm font-bold text-slate-800">Réclamations parents</h3>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  reclamationsCockpit.horsDelai > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {reclamationsCockpit.horsDelai > 0 ? `${reclamationsCockpit.horsDelai} hors délai` : 'Aucune hors délai'}
              </span>
            </div>
            {(reclamationsCockpit.accusesAEnvoyer > 0 || reclamationsCockpit.relances > 0) && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {reclamationsCockpit.accusesAEnvoyer > 0 && (
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${reclamationsCockpit.accusesEnRetard > 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                    {reclamationsCockpit.accusesAEnvoyer} accusé{reclamationsCockpit.accusesAEnvoyer > 1 ? 's' : ''} à envoyer
                    {reclamationsCockpit.accusesEnRetard > 0 ? ` (${reclamationsCockpit.accusesEnRetard} en retard)` : ''}
                  </span>
                )}
                {reclamationsCockpit.relances > 0 && (
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                    {reclamationsCockpit.relances} famille{reclamationsCockpit.relances > 1 ? 's' : ''} à relancer
                  </span>
                )}
              </div>
            )}
            {reclamationsCockpit.ouvertes === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Aucune réclamation en attente.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  {reclamationsCockpit.ouvertes} réclamation{reclamationsCockpit.ouvertes > 1 ? 's' : ''} à traiter · les plus anciennes :
                </p>
                {reclamationsCockpit.anciennes.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {r.studentName} <span className="font-normal text-slate-400">{r.classe}</span>
                      </p>
                      <p className="truncate text-xs text-slate-500">{r.objet}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${r.horsDelai ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.jours} j
                    </span>
                  </div>
                ))}
                {reclamationsCockpit.signaux.length > 0 && (
                  <p className="pt-1 text-xs font-medium text-amber-700">
                    {reclamationsCockpit.signaux.length} signal{reclamationsCockpit.signaux.length > 1 ? 'aux' : ''} de récurrence — voir Réclamations Parents.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Événements récents */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-800">Événements récents</h3>
            {recentEvents.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Aucun événement aujourd'hui — journée fluide.</p>
            ) : (
              <div className="space-y-2.5">
                {recentEvents.map((e, idx) => {
                  const Icon =
                    e.kind === 'infirmerie'
                      ? Stethoscope
                      : e.kind === 'retard'
                        ? Clock
                        : e.kind === 'rdv'
                          ? CalendarClock
                          : e.kind === 'reclamation'
                            ? MessageSquareWarning
                            : ShieldAlert
                  const color =
                    e.kind === 'infirmerie'
                      ? 'text-teal-500'
                      : e.kind === 'retard'
                        ? 'text-amber-500'
                        : e.kind === 'rdv'
                          ? 'text-indigo-500'
                          : e.kind === 'reclamation'
                            ? 'text-orange-500'
                            : 'text-rose-500'
                  return (
                    <div key={idx} className="flex items-start gap-2.5">
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">
                          {e.studentName} <span className="font-normal text-slate-400">{e.classe}</span>
                          {e.time && <span className="ml-1 font-normal text-slate-400">· {e.time}</span>}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{e.label}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {callingStudent && (
        <MarquerAppelParentModal
          eleve={callingStudent}
          onClose={() => setCallingStudent(null)}
          onConfirm={handleConfirmAppelParent}
          isSaving={markAppelParentDone.isPending}
        />
      )}

      {remplacementDirect && (
        <RemplacementDirectModal
          pending={remplacementDirect}
          onClose={() => setRemplacementDirect(null)}
          onRetablirPresence={handleRetablirPresence}
          onAffecter={handleAffecter}
          isEditable={isEditable}
        />
      )}

      {showPrint && (
        <CockpitPrintPreviewModal
          periodLabel={periodLabel}
          periodStart={periodStart}
          periodEnd={periodEnd}
          absentTeachers={absentTeachersDetailed}
          absentStudents={absentStudents}
          incidents={incidents}
          infirmerieAccidents={infirmerieAccidents}
          onClose={() => setShowPrint(false)}
        />
      )}

      {showIncidentModal && <RegisterDisciplineModal onClose={() => setShowIncidentModal(false)} onSubmit={handleRegisterIncident} />}

      {showAbsenceProfModal && (
        <SignalerAbsenceModal
          initialTypeCible="professeur"
          onClose={() => setShowAbsenceProfModal(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['teacherExtras'] })
            onDataChanged?.()
          }}
        />
      )}

      {showCreneauxModal && (
        <TimelineCreneauxModal
          creneaux={timeline.fixedSlots}
          onSave={handleSaveCreneaux}
          onClose={() => setShowCreneauxModal(false)}
          isEditable={isEditable}
        />
      )}
    </div>
  )
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}
