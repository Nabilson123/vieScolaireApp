import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  RotateCcw,
  Printer,
  Info,
  FileText,
  BellOff,
  Shield,
  UtensilsCrossed,
  Target,
  Activity,
  Clock,
  Award,
  Pencil,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  FileSpreadsheet,
  MessageSquareWarning,
  CalendarClock,
  IdCard,
  History,
} from 'lucide-react'
import type { Student } from '../data/students'
import { recomputeStudentAttendance } from '../data/students'
import { defaultExtra, subjectColorClasses, EVALUATION_TYPES, type EventRecord, type RendezVousRecord } from '../data/studentDetails'
import {
  useStudentExtras,
  updateStudentReclamations,
  updateStudentRendezVous,
  updateStudentEventJustified,
  getStudentExtraSnapshot,
  updateStudentEvents,
} from '../services/studentDetailsService'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { buildFilteredView, computeMoyenneGenerale } from '../utils/studentAggregation'
import { moyenneScaleForClasse } from '../utils/alertEngine'
import { formatPeriodLabel } from '../utils/period'
import EventCard from './student-detail/EventCard'
import EditEventModal from './student-detail/EditEventModal'
import NotesTab from './student-detail/NotesTab'
import AbsencesTab from './student-detail/AbsencesTab'
import DisciplineTab from './student-detail/DisciplineTab'
import CantineTab from './student-detail/CantineTab'
import ProjetPersonnelTab from './student-detail/ProjetPersonnelTab'
import SanteTab from './student-detail/SanteTab'
import ReclamationsTab from './student-detail/ReclamationsTab'
import RendezVousTab from './student-detail/RendezVousTab'
import InformationsGeneralesTab from './student-detail/InformationsGeneralesTab'
import HistoriqueTab from './student-detail/HistoriqueTab'
import PrintPreviewModal from './student-detail/print/PrintPreviewModal'

interface StudentDetailProps {
  student: Student
  onBack: () => void
  initialTab?: string
  onStudentUpdated?: (student: Student) => void
}

const tabs = [
  { key: 'infos', label: 'Informations Générales', icon: IdCard },
  { key: 'synthese', label: 'Synthèse', icon: Info },
  { key: 'notes', label: 'Notes', icon: FileText },
  { key: 'absences', label: 'Absences', icon: BellOff },
  { key: 'discipline', label: 'Discipline', icon: Shield },
  { key: 'cantine', label: 'Garde Repas', icon: UtensilsCrossed },
  { key: 'projet', label: 'Projet Personnel', icon: Target },
  { key: 'sante', label: 'Santé & Infirmerie', icon: Activity },
  { key: 'reclamations', label: 'Réclamations', icon: MessageSquareWarning },
  { key: 'rendezvous', label: 'Rendez-vous', icon: CalendarClock },
  { key: 'historique', label: 'Historique', icon: History },
]

export default function StudentDetail({ student, onBack, initialTab, onStudentUpdated }: StudentDetailProps) {
  const queryClient = useQueryClient()
  const invalidateExtras = () => queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
  const [activeTab, setActiveTab] = useState(initialTab ?? 'synthese')
  const [showPrintMenu, setShowPrintMenu] = useState(false)
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [evaluationType, setEvaluationType] = useState(EVALUATION_TYPES[0])
  const printMenuRef = useRef<HTMLDivElement>(null)
  const { data: students } = useStudents()
  const { data: extrasMap } = useStudentExtras()
  const extra = extrasMap?.[student.id] ?? defaultExtra
  const { reclamations, rendezVous } = extra

  const handleTakeChargeReclamation = async (index: number) => {
    const next = reclamations.map((r, i) => (i === index ? { ...r, statut: 'En cours' as const } : r))
    await updateStudentReclamations(student.id, next)
    await invalidateExtras()
  }

  const handleResolveReclamation = async (index: number, resolution: string) => {
    const next = reclamations.map((r, i) => (i === index ? { ...r, statut: 'Résolue' as const, resolution } : r))
    await updateStudentReclamations(student.id, next)
    await invalidateExtras()
  }

  const handleDeleteReclamation = async (index: number) => {
    const next = reclamations.filter((_, i) => i !== index)
    await updateStudentReclamations(student.id, next)
    await invalidateExtras()
  }

  const handleRendezVousChange = async (list: RendezVousRecord[]) => {
    await updateStudentRendezVous(student.id, list)
    await invalidateExtras()
  }

  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null)

  const handleDeleteEvent = async (target: EventRecord) => {
    const remaining = getStudentExtraSnapshot(student.id).events.filter((e) => e !== target)
    await updateStudentEvents(student.id, remaining)
    await invalidateExtras()
    await recomputeStudentAttendance(student.id, remaining)
    await queryClient.invalidateQueries({ queryKey: ['students'] })
  }

  const view = useMemo(
    () =>
      buildFilteredView(
        { ...extra, reclamations, rendezVous },
        periodStart,
        periodEnd,
        student.classe,
        getStudentsSnapshot(),
        extrasMap ?? {}
      ),
    [extra, reclamations, rendezVous, periodStart, periodEnd, student.classe, extrasMap, students]
  )
  const periodLabel = formatPeriodLabel(periodStart, periodEnd)

  useEffect(() => {
    if (!showPrintMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setShowPrintMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPrintMenu])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Fiche Élève : {student.name}</h1>
            <p className="text-sm text-slate-500">
              Visualisation des statistiques d'absences par matière du programme marocain, historique
              détaillé et notes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
            <span>Période :</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-[130px] bg-transparent text-slate-700 focus:outline-none"
            />
            <span>au</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-[130px] bg-transparent text-slate-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setPeriodStart('')
                setPeriodEnd('')
              }}
              title="Réinitialiser la période"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative" ref={printMenuRef}>
            <button
              type="button"
              onClick={() => setShowPrintMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Imprimer Bilan
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {showPrintMenu && (
              <div className="absolute right-0 top-[calc(100%+4px)] z-20 w-64 overflow-hidden rounded-lg border border-slate-100 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => setShowPrintMenu(false)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Exporter Excel
                </button>
                <div className="border-t border-slate-100 px-4 py-2.5">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Type de contrôle
                  </label>
                  <select
                    value={evaluationType}
                    onChange={(e) => setEvaluationType(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none"
                  >
                    {EVALUATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPrintMenu(false)
                    setShowPrintPreview(true)
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4 text-indigo-600" />
                  Imprimer PDF A4
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPrintPreview && (
        <PrintPreviewModal
          student={student}
          extra={extra}
          view={view}
          periodLabel={periodLabel}
          evaluationType={evaluationType}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      <div className="mb-4 flex items-center gap-6">
        <span className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">
          {student.classe}
        </span>
        <div>
          <p className="text-xs text-slate-400">Taux de présence</p>
          <span className="rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-1 text-sm font-bold text-emerald-600">
            {student.taux.toFixed(1)} %
          </span>
        </div>
        <span className="text-xs text-slate-400">
          Période affichée : <span className="font-medium text-slate-600">{periodLabel}</span>
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'infos' && (
        <InformationsGeneralesTab
          student={student}
          cantine={extra.cantine}
          onStudentUpdated={(updated) => onStudentUpdated?.(updated)}
        />
      )}
      {activeTab === 'notes' && <NotesTab notes={view.notes} />}
      {activeTab === 'absences' && <AbsencesTab studentId={student.id} events={view.events} />}
      {activeTab === 'discipline' && (
        <DisciplineTab studentName={student.name} classe={student.classe} conduite={extra.conduite} events={view.discipline} />
      )}
      {activeTab === 'cantine' && <CantineTab studentId={student.id} studentName={student.name} cantine={extra.cantine} />}
      {activeTab === 'projet' && <ProjetPersonnelTab student={student} projet={extra.projet} />}
      {activeTab === 'sante' && <SanteTab sante={extra.sante} />}
      {activeTab === 'reclamations' && (
        <ReclamationsTab
          reclamations={reclamations}
          onTakeCharge={handleTakeChargeReclamation}
          onResolve={handleResolveReclamation}
          onDelete={handleDeleteReclamation}
        />
      )}
      {activeTab === 'rendezvous' && (
        <RendezVousTab studentId={student.id} rendezVous={rendezVous} onChange={handleRendezVousChange} />
      )}
      {activeTab === 'historique' && <HistoriqueTab dossierId={student.dossierId} currentStudentId={student.id} />}

      {activeTab === 'synthese' && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              icon={Clock}
              iconBg="bg-rose-50"
              iconColor="text-rose-500"
              value={view.absencesHeures}
              label={`Manquées par absence (${view.absencesFois} fois)`}
            />
            <StatCard
              icon={Clock}
              iconBg="bg-amber-50"
              iconColor="text-amber-500"
              value={view.retardsMin}
              label={`Manquées par retard (${view.retardsFois} fois)`}
            />
            <StatCard
              icon={Clock}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-500"
              value={view.totalHeures}
              label="Cumul total d'heures manquées"
            />
            <StatCard
              icon={Award}
              iconBg="bg-amber-50"
              iconColor="text-amber-500"
              value={`${extra.conduite}/20`}
              label="Note de conduite & discipline"
            />
            <StatCard
              icon={Pencil}
              iconBg="bg-violet-50"
              iconColor="text-violet-500"
              value={(() => {
                const m = computeMoyenneGenerale(extra.notes)
                return m === null ? '—' : `${m.toFixed(2)}/${moyenneScaleForClasse(student.classe) ?? 20}`
              })()}
              label="Moyenne Générale"
              highlight
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800">Bilan par Matière</h3>
              </div>

              {view.subjectBreakdown.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Aucune absence enregistrée.</p>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Matière</th>
                      <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Absences</th>
                      <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Retards</th>
                      <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Total Heures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.subjectBreakdown.map((row) => (
                      <tr key={row.subject} className="border-b border-slate-50 last:border-0">
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${subjectColorClasses[row.color]}`}
                          >
                            {row.subject.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 text-sm text-slate-700">{row.absences}</td>
                        <td className="py-3 text-sm text-slate-700">{row.retards}</td>
                        <td className="py-3">
                          <p className="text-sm font-bold text-indigo-600">{row.total}</p>
                          <div className="mt-1 h-1 w-24 rounded-full bg-slate-100">
                            <div
                              className="h-1 rounded-full bg-indigo-500"
                              style={{ width: `${row.barPct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800">Derniers Événements</h3>
              </div>

              {view.events.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Aucun événement récent.</p>
              ) : (
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {view.events.map((event, idx) => (
                    <EventCard
                      key={idx}
                      event={event}
                      onToggleJustified={async () => {
                        await updateStudentEventJustified(student.id, event, !event.justified)
                        await invalidateExtras()
                      }}
                      onEdit={() => setEditingEvent(event)}
                      onDelete={() => handleDeleteEvent(event)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {editingEvent && <EditEventModal studentId={student.id} event={editingEvent} onClose={() => setEditingEvent(null)} />}
    </div>
  )
}

interface StatCardProps {
  icon: typeof Clock
  iconBg: string
  iconColor: string
  value: string
  label: string
  highlight?: boolean
}

function StatCard({ icon: Icon, iconBg, iconColor, value, label, highlight }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        highlight ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-100'
      }`}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
