import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  PlusCircle,
  Pencil,
  Trash2,
  ArrowLeftRight,
  AlertTriangle,
  Copy,
  Download,
  History,
  ChevronDown,
  ChevronUp,
  Clock,
  Files,
  GraduationCap,
} from 'lucide-react'
import { getActiveClassNamesSnapshot } from '../services/classesService'
import { teacherName } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import type { RemplacementRecord } from '../data/teacherExtras'
import { useTeacherExtras, useUpdateTeacherAbsences, useUpdateTeacherRemplacements } from '../services/teacherExtrasService'
import { SCHEDULE_DAYS, timeToMinutes } from '../data/classSchedules'
import type { SoutienSeance } from '../data/soutien'
import {
  addCourseSlot,
  updateCourseSlot,
  deleteCourseSlot,
  moveCourseSlot,
  duplicateClassSchedule,
  computeTeacherWeeklyHours,
  getClassConflictSlotIds,
  getTeacherConflictSlotIds,
  useClassSchedules,
  useScheduleHistory,
} from '../services/classSchedulesService'
import { computeClassSchedule, computeClassVolume, type ClassScheduleSlot } from '../utils/classAggregation'
import { computeTeacherSchedule, formatHeures } from '../utils/teacherAggregation'
import type { PendingReplacement } from '../utils/replacementAggregation'
import CourseSlotModal, { type CourseSlotFormData } from '../components/CourseSlotModal'
import RemplacementDirectModal from '../components/RemplacementDirectModal'
import ScheduleTimeGrid from '../components/schedule/ScheduleTimeGrid'
import SchedulePrintPreviewModal from '../components/schedule-print/SchedulePrintPreviewModal'
import SchedulesExportModal from '../components/schedule-print/SchedulesExportModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import TeacherSearchSelect from '../components/TeacherSearchSelect'
import { getStudentsSnapshot } from '../services/studentsService'
import { getSoutienSeancesSnapshot, useSoutienInscriptions, useSoutienSeances, getSoutienInscriptionsSnapshot } from '../services/soutienService'
import { aujourdhuiLocalISO, blocsSoutienParJour, type BlocSoutien } from '../utils/soutienSeances'
import type { TimeGridSlot } from '../components/schedule/ScheduleTimeGrid'
import SoutienSortiesTab from '../components/soutien/SoutienSortiesTab'
import SoutienSeanceModal from '../components/soutien/SoutienSeanceModal'
import SoutienSeanceDetailModal from '../components/soutien/SoutienSeanceDetailModal'

const QUOTA_HEURES = 20

function mondayOf(dateStr: string): Date {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function formatDDMM(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function dateForWeekday(monday: Date, day: string): string {
  const idx = SCHEDULE_DAYS.indexOf(day)
  const d = new Date(monday)
  d.setDate(monday.getDate() + idx)
  return d.toISOString().slice(0, 10)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

type Vue = 'classe' | 'enseignant'
type Onglet = 'emploi' | 'soutien'

export default function EmploiDuTempsGlobal() {
  const queryClient = useQueryClient()
  const invalidateSchedules = async () => {
    await queryClient.invalidateQueries({ queryKey: ['classSchedules'] })
    await queryClient.invalidateQueries({ queryKey: ['classScheduleHistory'] })
  }
  const [, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((k) => k + 1)
  const { data: teacherExtras = {} } = useTeacherExtras()
  const updateAbsences = useUpdateTeacherAbsences()
  const updateRemplacements = useUpdateTeacherRemplacements()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'manager').canEdit
  const isEditable = canEditYear && canEditModule

  const activeClasses = getActiveClassNamesSnapshot()
  const [vue, setVue] = useState<Vue>('classe')
  const [selectedClasse, setSelectedClasse] = useState(activeClasses[0] ?? '')
  const [selectedTeacherId, setSelectedTeacherId] = useState(getTeachersSnapshot()[0]?.id ?? '')
  const [weekDate, setWeekDate] = useState(todayISO())
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSlot, setEditingSlot] = useState<{ day: string; slot: ClassScheduleSlot } | null>(null)
  const [remplacementDirect, setRemplacementDirect] = useState<PendingReplacement | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateTarget, setDuplicateTarget] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [dragSource, setDragSource] = useState<{ day: string; slotId: string } | null>(null)
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [showAllPrint, setShowAllPrint] = useState<'classes' | 'profs' | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('emploi')
  // Le soutien s'affiche par défaut (blocs hachurés) ; le masquer redonne l'emploi du temps des seuls cours.
  const [showSoutien, setShowSoutien] = useState(true)
  const [soutienDetail, setSoutienDetail] = useState<{ seanceId: string; classe?: string } | null>(null)
  const [editSeance, setEditSeance] = useState<SoutienSeance | null>(null)

  const monday = mondayOf(weekDate)
  // Abonnement direct (en plus du cache-warming dans App.tsx) : sans lui, changer d'année dans
  // la Sidebar ne force pas ce composant à se re-rendre après le rechargement des plannings, et
  // computeClassSchedule() continue de lire le cache de l'ancienne année jusqu'au prochain
  // re-rendu déclenché par une autre cause.
  useClassSchedules()
  // Abonnement aux séances de soutien : leurs blocs sont posés dans les grilles ci-dessous.
  useSoutienSeances()
  useSoutienInscriptions()
  const schedule = selectedClasse ? computeClassSchedule(selectedClasse) : {}
  const volume = selectedClasse ? computeClassVolume(selectedClasse) : { seances: 0, heures: 0 }

  const overQuota = getTeachersSnapshot().filter((t) => computeTeacherWeeklyHours(t.id) > QUOTA_HEURES)
  const { data: history = [] } = useScheduleHistory()

  const handleAddSubmit = async (data: CourseSlotFormData) => {
    await addCourseSlot(selectedClasse, data.day, { subject: data.subject, teacherId: data.teacherId, start: data.start, end: data.end, hours: data.hours })
    await invalidateSchedules()
    refresh()
    setShowAddModal(false)
  }

  const handleEditSubmit = async (data: CourseSlotFormData) => {
    if (!editingSlot) return
    if (data.day !== editingSlot.day) {
      await deleteCourseSlot(selectedClasse, editingSlot.day, editingSlot.slot.id)
      await addCourseSlot(selectedClasse, data.day, { subject: data.subject, teacherId: data.teacherId, start: data.start, end: data.end, hours: data.hours })
    } else {
      await updateCourseSlot(selectedClasse, editingSlot.day, editingSlot.slot.id, {
        subject: data.subject,
        teacherId: data.teacherId,
        start: data.start,
        end: data.end,
        hours: data.hours,
      })
    }
    await invalidateSchedules()
    refresh()
    setEditingSlot(null)
  }

  const handleDeleteSlot = async (day: string, slotId: string) => {
    await deleteCourseSlot(selectedClasse, day, slotId)
    await invalidateSchedules()
    refresh()
  }

  const handleDrop = async (toDay: string, newStart: string) => {
    if (!dragSource) return
    await moveCourseSlot(selectedClasse, dragSource.day, dragSource.slotId, toDay, newStart)
    await invalidateSchedules()
    refresh()
    setDragSource(null)
  }

  const handleOpenRemplacementDirect = (day: string, slot: ClassScheduleSlot) => {
    const date = dateForWeekday(monday, day)
    const teacher = getTeachersSnapshot().find((t) => t.id === slot.teacherId)
    if (!teacher) return
    const extra = teacherExtras[slot.teacherId] ?? { absences: [], remplacements: [] }
    const alreadyDeclared = extra.absences.some((a) => a.slotId === slot.id && a.date === date)
    if (!alreadyDeclared) {
      updateAbsences.mutate({
        teacherId: slot.teacherId,
        absences: [
          ...extra.absences,
          {
            date,
            type: 'ABSENCE',
            justified: true,
            classe: selectedClasse,
            duree: slot.hours,
            motif: 'Absence signalée depuis l’emploi du temps',
            slotId: slot.id,
          },
        ],
      })
    }
    setRemplacementDirect({
      teacher,
      absenceIndex: -1,
      date,
      weekday: day,
      classe: selectedClasse,
      subject: slot.subject,
      start: slot.start,
      end: slot.end,
      hours: slot.hours,
      motif: 'Absence signalée depuis l’emploi du temps',
    })
  }

  const handleRetablirPresence = () => {
    if (!remplacementDirect) return
    const extra = teacherExtras[remplacementDirect.teacher.id] ?? { absences: [], remplacements: [] }
    const absences = extra.absences.filter((a) => !(a.date === remplacementDirect.date && a.classe === remplacementDirect.classe))
    updateAbsences.mutate({ teacherId: remplacementDirect.teacher.id, absences })
    setRemplacementDirect(null)
  }

  const handleAffecter = (teacherId: string, consignes: string) => {
    if (!remplacementDirect) return
    const record: RemplacementRecord = {
      date: remplacementDirect.date,
      classe: remplacementDirect.classe,
      matiere: remplacementDirect.subject,
      profRemplace: teacherName(remplacementDirect.teacher),
      heures: remplacementDirect.hours,
      consignes: consignes.trim() || undefined,
    }
    const extra = teacherExtras[teacherId] ?? { absences: [], remplacements: [] }
    updateRemplacements.mutate({ teacherId, remplacements: [record, ...extra.remplacements] })
    setRemplacementDirect(null)
  }

  const handleDuplicate = async () => {
    if (!duplicateTarget) return
    await duplicateClassSchedule(selectedClasse, duplicateTarget)
    await invalidateSchedules()
    refresh()
    setShowDuplicateModal(false)
    setDuplicateTarget('')
  }

  const selectedTeacher = getTeachersSnapshot().find((t) => t.id === selectedTeacherId)
  const teacherSchedule = selectedTeacher ? computeTeacherSchedule(selectedTeacher) : {}
  const teacherWeeklyHours = selectedTeacher ? computeTeacherWeeklyHours(selectedTeacher.id) : 0
  const teacherClasses = selectedTeacher
    ? Array.from(new Set(Object.values(teacherSchedule).flat().map((s) => s.classe)))
    : []

  const classConflictIds = selectedClasse ? getClassConflictSlotIds(selectedClasse) : new Set<string>()
  const teacherConflictIds = selectedTeacher ? getTeacherConflictSlotIds(selectedTeacher.id) : new Set<string>()

  // Blocs de soutien : ceux de la classe affichée (ses élèves inscrits, ou les séances qui la visent) ou de l'enseignant.
  const seancesSoutien = getSoutienSeancesSnapshot()
  const inscriptionsSoutien = getSoutienInscriptionsSnapshot()
  const aujourdhui = aujourdhuiLocalISO()
  const classeParEleve = new Map(getStudentsSnapshot().map((s) => [s.id, s.classe]))
  const nomProf = new Map(getTeachersSnapshot().map((t) => [t.id, teacherName(t)]))
  const blocsClasse =
    showSoutien && vue === 'classe' && selectedClasse
      ? blocsSoutienParJour(seancesSoutien, inscriptionsSoutien, { classe: selectedClasse, classeDe: (id) => classeParEleve.get(id), aPartirDe: aujourdhui })
      : null
  const blocsEnseignant =
    showSoutien && vue === 'enseignant' && selectedTeacher
      ? blocsSoutienParJour(seancesSoutien, inscriptionsSoutien, { teacherId: selectedTeacher.id, classeDe: (id) => classeParEleve.get(id), aPartirDe: aujourdhui })
      : null
  const soutienSlots = (blocs: Record<string, BlocSoutien[]> | null, day: string, classe: string | undefined): TimeGridSlot[] =>
    (blocs?.[day] ?? []).map((b) => {
      const seance = seancesSoutien.find((s) => s.id === b.seanceId)
      return {
        id: `soutien-${b.seanceId}`,
        subject: b.label,
        start: b.start,
        end: b.end,
        hours: (timeToMinutes(b.end) - timeToMinutes(b.start)) / 60,
        subtitle: classe ? (seance?.teacherId ? `Prof. ${nomProf.get(seance.teacherId) ?? ''}` : 'Soutien scolaire') : seance?.classes.join(', ') || 'Soutien scolaire',
        variant: 'soutien' as const,
        onClick: () => setSoutienDetail({ seanceId: b.seanceId, classe }),
      }
    })
  const classGridSchedule: Record<string, TimeGridSlot[]> = Object.fromEntries(
    SCHEDULE_DAYS.map((day) => [
      day,
      [
        ...(schedule[day] ?? []).map((s) => ({ id: s.id, subject: s.subject, start: s.start, end: s.end, hours: s.hours, subtitle: `Prof. ${s.teacherName}` })),
        ...soutienSlots(blocsClasse, day, selectedClasse),
      ],
    ])
  )
  const teacherGridSchedule: Record<string, TimeGridSlot[]> = Object.fromEntries(
    SCHEDULE_DAYS.map((day) => [
      day,
      [
        ...(teacherSchedule[day] ?? []).map((s) => ({ id: s.id, subject: s.subject, start: s.start, end: s.end, hours: s.hours, subtitle: `Cl ${s.classe}` })),
        ...soutienSlots(blocsEnseignant, day, undefined),
      ],
    ])
  )
  // La grille s'arrête à 17 h, sauf si un soutien se termine plus tard.
  const finSoutienMax = Math.max(0, ...Object.values(blocsClasse ?? blocsEnseignant ?? {}).flat().map((b) => timeToMinutes(b.end)))
  const gridEndHour = Math.max(17, Math.ceil(finSoutienMax / 60))

  const weekEnd = new Date(monday)
  weekEnd.setDate(monday.getDate() + 4)
  const printTitle = vue === 'classe' ? `Emploi du Temps — ${selectedClasse}` : selectedTeacher ? `Emploi du Temps — ${teacherName(selectedTeacher)}` : ''

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Emplois du Temps
            <CalendarDays className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">Visualisez et gérez le calendrier hebdomadaire des cours par classe ou par enseignant.</p>
        </div>
        {onglet === 'emploi' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={vue}
              onChange={(e) => setVue(e.target.value as Vue)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
            >
              <option value="classe">Vue : Par Classe</option>
              <option value="enseignant">Vue : Par Enseignant</option>
            </select>
            {vue === 'classe' ? (
              <select
                value={selectedClasse}
                onChange={(e) => setSelectedClasse(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
              >
                {activeClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-60">
                <TeacherSearchSelect teachers={getTeachersSnapshot()} value={selectedTeacherId} onChange={setSelectedTeacherId} clearable={false} />
              </div>
            )}
            <input
              type="date"
              value={weekDate}
              onChange={(e) => setWeekDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
            />
            <label
              title="Afficher les séances de soutien scolaire (blocs hachurés) dans la grille"
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <input type="checkbox" checked={showSoutien} onChange={(e) => setShowSoutien(e.target.checked)} className="accent-violet-600" />
              Soutien
            </label>
            <button
              type="button"
              onClick={() => setShowPrintPreview(true)}
              title="Télécharger l'emploi du temps"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowAllPrint('classes')}
              title="Télécharger un seul PDF avec l'emploi du temps de toutes les classes"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Files className="h-4 w-4" />
              Toutes les classes
            </button>
            <button
              type="button"
              onClick={() => setShowAllPrint('profs')}
              title="Télécharger un seul PDF avec l'emploi du temps de tous les professeurs"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Files className="h-4 w-4" />
              Tous les profs
            </button>
            {vue === 'classe' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  disabled={!isEditable}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlusCircle className="h-4 w-4" />
                  Ajouter un cours
                </button>
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(true)}
                  disabled={!isEditable}
                  title="Dupliquer ce planning vers une autre classe"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <OngletBouton actif={onglet === 'emploi'} onClick={() => setOnglet('emploi')} icon={CalendarDays} label="Emplois du temps" />
        <OngletBouton actif={onglet === 'soutien'} onClick={() => setOnglet('soutien')} icon={GraduationCap} label="Soutien & Sorties" />
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      {onglet === 'soutien' && <SoutienSortiesTab isEditable={isEditable} />}

      {onglet === 'emploi' && (
        <>
          {overQuota.length > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">{overQuota.length} professeur(s)</span> dépassent le quota de {QUOTA_HEURES}h/semaine :{' '}
                {overQuota.map((t) => `${teacherName(t)} (${formatHeures(computeTeacherWeeklyHours(t.id))})`).join(', ')}
              </span>
            </div>
          )}

          {vue === 'classe' ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <ScheduleTimeGrid
                schedule={classGridSchedule}
                endHour={gridEndHour}
                dayHeaderExtra={(day) => {
                  const idx = SCHEDULE_DAYS.indexOf(day)
                  const dayDate = new Date(monday)
                  dayDate.setDate(monday.getDate() + idx)
                  return <p className="text-[11px] font-semibold text-indigo-500">{formatDDMM(dayDate)}</p>
                }}
                draggableSlots={isEditable}
                onDragStartSlot={(day, slotId) => setDragSource({ day, slotId })}
                onDropDay={handleDrop}
                conflictSlotIds={classConflictIds}
                renderActions={
                  isEditable
                    ? (day, gridSlot) => {
                        const slot = (schedule[day] ?? []).find((s) => s.id === gridSlot.id)
                        if (!slot) return null
                        return (
                          <>
                            <button type="button" title="Remplacement Direct" onClick={() => handleOpenRemplacementDirect(day, slot)} className="text-current opacity-60 hover:opacity-100">
                              <ArrowLeftRight className="h-3 w-3" />
                            </button>
                            <button type="button" title="Modifier" onClick={() => setEditingSlot({ day, slot })} className="text-current opacity-60 hover:opacity-100">
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button type="button" title="Supprimer" onClick={() => handleDeleteSlot(day, slot.id)} className="text-current opacity-60 hover:opacity-100">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )
                      }
                    : undefined
                }
              />
              <p className="mt-3 text-right text-xs text-slate-400">
                Total : {volume.seances} séances · {formatHeures(volume.heures)}/semaine
              </p>
            </div>
          ) : (
            selectedTeacher && (
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <TeacherStat icon={Clock} label="Total d’heures cette semaine" value={formatHeures(teacherWeeklyHours)} />
                  <TeacherStat icon={CalendarDays} label="Classes couvertes" value={String(teacherClasses.length)} />
                  <TeacherStat icon={ArrowLeftRight} label="Matière(s)" value={selectedTeacher.matieres.join(', ')} />
                </div>
                <ScheduleTimeGrid
                  schedule={teacherGridSchedule}
                  endHour={gridEndHour}
                  dayHeaderExtra={(day) => {
                    const idx = SCHEDULE_DAYS.indexOf(day)
                    const dayDate = new Date(monday)
                    dayDate.setDate(monday.getDate() + idx)
                    return <p className="text-[11px] font-semibold text-indigo-500">{formatDDMM(dayDate)}</p>
                  }}
                  conflictSlotIds={teacherConflictIds}
                />
              </div>
            )
          )}

          <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold text-slate-800">
              <span className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                Historique des Modifications ({history.length})
              </span>
              {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showHistory && (
              <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-400">Aucune modification enregistrée.</p>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50/60 px-3 py-2 text-xs">
                      <span className="text-slate-600">
                        <span className="font-semibold text-slate-800">{h.action}</span> · {h.classe} · {h.details}
                      </span>
                      <span className="text-slate-400">{new Date(h.date).toLocaleString('fr-FR')}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        </>
      )}

      {showAddModal && (
        <CourseSlotModal className={selectedClasse} initialDay="LUNDI" onClose={() => setShowAddModal(false)} onSubmit={handleAddSubmit} />
      )}

      {editingSlot && (
        <CourseSlotModal
          className={selectedClasse}
          initialDay={editingSlot.day}
          onClose={() => setEditingSlot(null)}
          onSubmit={handleEditSubmit}
          initial={{ slotId: editingSlot.slot.id, day: editingSlot.day, subject: editingSlot.slot.subject, teacherId: editingSlot.slot.teacherId, start: editingSlot.slot.start, end: editingSlot.slot.end }}
        />
      )}

      {soutienDetail &&
        (() => {
          const seance = seancesSoutien.find((s) => s.id === soutienDetail.seanceId)
          return seance ? (
            <SoutienSeanceDetailModal
              seance={seance}
              classe={soutienDetail.classe}
              onClose={() => setSoutienDetail(null)}
              onEdit={
                isEditable
                  ? () => {
                      setSoutienDetail(null)
                      setEditSeance(seance)
                    }
                  : undefined
              }
            />
          ) : null
        })()}
      {editSeance && <SoutienSeanceModal seance={editSeance} onClose={() => setEditSeance(null)} />}

      {remplacementDirect && (
        <RemplacementDirectModal
          pending={remplacementDirect}
          onClose={() => setRemplacementDirect(null)}
          onRetablirPresence={handleRetablirPresence}
          onAffecter={handleAffecter}
          isEditable={isEditable}
        />
      )}

      {showPrintPreview &&
        (vue === 'classe' ? (
          <SchedulePrintPreviewModal
            title={printTitle}
            variant="classe"
            classe={selectedClasse}
            weekStart={monday}
            weekEnd={weekEnd}
            schedule={schedule}
            onClose={() => setShowPrintPreview(false)}
          />
        ) : (
          selectedTeacher && (
            <SchedulePrintPreviewModal
              title={printTitle}
              variant="enseignant"
              teacherName={teacherName(selectedTeacher)}
              weekStart={monday}
              weekEnd={weekEnd}
              schedule={teacherSchedule}
              onClose={() => setShowPrintPreview(false)}
            />
          )
        ))}

      {showAllPrint === 'classes' && (
        <SchedulesExportModal variant="classes" classes={activeClasses} weekStart={monday} weekEnd={weekEnd} onClose={() => setShowAllPrint(null)} />
      )}
      {showAllPrint === 'profs' && (
        <SchedulesExportModal variant="profs" teachers={getTeachersSnapshot()} weekStart={monday} weekEnd={weekEnd} onClose={() => setShowAllPrint(null)} />
      )}

      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-3 text-base font-bold text-slate-900">Dupliquer le planning de {selectedClasse}</h2>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Vers la classe</label>
            <select
              value={duplicateTarget}
              onChange={(e) => setDuplicateTarget(e.target.value)}
              className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
            >
              <option value="">Sélectionnez une classe...</option>
              {activeClasses
                .filter((c) => c !== selectedClasse)
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
            <p className="mb-4 text-xs text-amber-600">Le planning actuel de la classe cible sera remplacé.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={!duplicateTarget || !isEditable}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Dupliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OngletBouton({ actif, onClick, icon: Icon, label }: { actif: boolean; onClick: () => void; icon: typeof CalendarDays; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
        actif ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function TeacherStat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">{value}</p>
        <p className="truncate text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  )
}
