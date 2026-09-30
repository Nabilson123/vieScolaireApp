import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, PlusCircle, Star, Award, Sparkle, FileBarChart2, AlertTriangle, LayoutGrid, Search } from 'lucide-react'
import { teacherName } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import type { InspectionRecord, PlanProgresItem } from '../data/inspections'
import {
  useInspections,
  generateInspectionId,
  insertInspection,
  updateInspectionRow,
  deleteInspectionRow,
} from '../services/inspectionsService'
import { computeTeamStats, getPreviousInspection, getTeachersStaleInspected } from '../utils/inspectionAggregation'
import NewInspectionModal from '../components/NewInspectionModal'
import InspectionCard from '../components/InspectionCard'
import PlanProgresModal from '../components/PlanProgresModal'
import CommentaireEnseignantModal from '../components/CommentaireEnseignantModal'
import InspectionOverviewTab from '../components/InspectionOverviewTab'
import InspectionBilanPreviewModal from '../components/inspection-print/InspectionBilanPreviewModal'
import InspectionConsolidatedPreviewModal from '../components/inspection-print/InspectionConsolidatedPreviewModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

const STALE_MONTHS_THRESHOLD = 6

type TabKey = 'rapports' | 'apercu'

export default function InspectionsGlobal() {
  const queryClient = useQueryClient()
  const invalidateInspections = () => queryClient.invalidateQueries({ queryKey: ['inspections'] })
  const { data: inspectionsList = [] } = useInspections()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'inspections').canEdit
  const isEditable = canEditYear && canEditModule
  const [tab, setTab] = useState<TabKey>('rapports')
  const [search, setSearch] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<InspectionRecord | null>(null)
  const [apercuRecord, setApercuRecord] = useState<InspectionRecord | null>(null)
  const [planProgresRecord, setPlanProgresRecord] = useState<InspectionRecord | null>(null)
  const [commentaireRecord, setCommentaireRecord] = useState<InspectionRecord | null>(null)
  const [showConsolidated, setShowConsolidated] = useState(false)

  const handleCreate = async (data: Omit<InspectionRecord, 'id'>) => {
    await insertInspection({ id: generateInspectionId(), ...data })
    await invalidateInspections()
    setShowNewModal(false)
  }

  const handleEditSubmit = async (data: Omit<InspectionRecord, 'id'>) => {
    if (!editingRecord) return
    await updateInspectionRow(editingRecord.id, data)
    await invalidateInspections()
    setEditingRecord(null)
  }

  const handleDelete = async (id: string) => {
    await deleteInspectionRow(id)
    await invalidateInspections()
  }

  const handleSavePlanProgres = async (items: PlanProgresItem[]) => {
    if (!planProgresRecord) return
    await updateInspectionRow(planProgresRecord.id, { planProgres: items })
    await invalidateInspections()
    setPlanProgresRecord(null)
  }

  const handleSaveCommentaire = async (comment: string) => {
    if (!commentaireRecord) return
    await updateInspectionRow(commentaireRecord.id, { commentaireEnseignant: comment || undefined })
    await invalidateInspections()
    setCommentaireRecord(null)
  }

  const stats = computeTeamStats()
  const staleTeachers = getTeachersStaleInspected(STALE_MONTHS_THRESHOLD)

  const q = search.toLowerCase()
  const filteredInspections = inspectionsList.filter((record) => {
    const teacher = getTeachersSnapshot().find((t) => t.id === record.teacherId)
    return !q || (teacher && teacherName(teacher).toLowerCase().includes(q))
  })

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Inspections & Rapports Pédagogiques
            <ClipboardCheck className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            Suivi global, rapports détaillés et évaluation des enseignants et Professeurs Principaux.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConsolidated(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <FileBarChart2 className="h-4 w-4" />
            Rapport Consolidé
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            Nouvelle Évaluation & Rapport
          </button>
        </div>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      {staleTeachers.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{staleTeachers.length} professeur(s)</span> non inspecté(s) depuis plus de {STALE_MONTHS_THRESHOLD} mois :{' '}
            {staleTeachers.map((t) => teacherName(t)).join(', ')}
          </span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={ClipboardCheck} iconBg="bg-indigo-50" iconColor="text-indigo-500" title="TOTAL INSPECTIONS" value={stats.total} label="Rapports enregistrés" />
        <KpiCard icon={Star} iconBg="bg-amber-50" iconColor="text-amber-500" title="PROFESSEURS PRINCIPAUX" value={stats.ppCount} label="Évaluations rôle PP" />
        <KpiCard icon={Award} iconBg="bg-emerald-50" iconColor="text-emerald-500" title="NIVEAU EXCELLENCE" value={stats.excellenceCount} label="Score ≥ 16/20" />
        <KpiCard
          icon={Sparkle}
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
          title="MOYENNE GLOBALE"
          value={`${stats.moyenne.toFixed(1)}/20`}
          label="Score moyen staff"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <TabButton active={tab === 'rapports'} onClick={() => setTab('rapports')} icon={ClipboardCheck} label="Rapports" />
          <TabButton active={tab === 'apercu'} onClick={() => setTab('apercu')} icon={LayoutGrid} label="Vue d’ensemble" />
        </div>
        {tab === 'rapports' && (
          <div className="flex min-w-[220px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un professeur..."
              className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        )}
      </div>

      {tab === 'rapports' ? (
        filteredInspections.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
            {inspectionsList.length === 0 ? 'Aucune inspection enregistrée pour l’instant.' : 'Aucun rapport ne correspond à cette recherche.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredInspections.map((record) => {
              const teacher = getTeachersSnapshot().find((t) => t.id === record.teacherId)
              if (!teacher) return null
              return (
                <InspectionCard
                  key={record.id}
                  record={record}
                  teacher={teacher}
                  previous={getPreviousInspection(record)}
                  onEdit={() => setEditingRecord(record)}
                  onDelete={() => handleDelete(record.id)}
                  onApercu={() => setApercuRecord(record)}
                  onImprimer={() => setApercuRecord(record)}
                  onOpenPlanProgres={() => setPlanProgresRecord(record)}
                  onOpenCommentaire={() => setCommentaireRecord(record)}
                  isEditable={isEditable}
                />
              )
            })}
          </div>
        )
      ) : (
        <InspectionOverviewTab onOpenPlanProgres={(record) => setPlanProgresRecord(record)} />
      )}

      {showNewModal && <NewInspectionModal onClose={() => setShowNewModal(false)} onSubmit={handleCreate} />}

      {editingRecord && (
        <NewInspectionModal onClose={() => setEditingRecord(null)} onSubmit={handleEditSubmit} initial={editingRecord} />
      )}

      {apercuRecord &&
        (() => {
          const teacher = getTeachersSnapshot().find((t) => t.id === apercuRecord.teacherId)
          if (!teacher) return null
          return <InspectionBilanPreviewModal record={apercuRecord} teacher={teacher} onClose={() => setApercuRecord(null)} />
        })()}

      {planProgresRecord && (
        <PlanProgresModal
          teacherName={teacherName(getTeachersSnapshot().find((t) => t.id === planProgresRecord.teacherId)!)}
          planProgres={planProgresRecord.planProgres}
          onClose={() => setPlanProgresRecord(null)}
          onSave={handleSavePlanProgres}
          isEditable={isEditable}
        />
      )}

      {commentaireRecord && (
        <CommentaireEnseignantModal
          teacherName={teacherName(getTeachersSnapshot().find((t) => t.id === commentaireRecord.teacherId)!)}
          initial={commentaireRecord.commentaireEnseignant}
          onClose={() => setCommentaireRecord(null)}
          onSave={handleSaveCommentaire}
        />
      )}

      {showConsolidated && <InspectionConsolidatedPreviewModal onClose={() => setShowConsolidated(false)} />}
    </div>
  )
}

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  value,
  label,
}: {
  icon: typeof ClipboardCheck
  iconBg: string
  iconColor: string
  title: string
  value: string | number
  label: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof ClipboardCheck
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}
