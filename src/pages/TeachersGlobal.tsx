import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Briefcase,
  FileBarChart2,
  UserPlus,
  Search,
  RotateCcw,
  Plus,
  X,
  Pencil,
  Phone,
  Mail,
  RefreshCw,
  MessageCircle,
} from 'lucide-react'
import { teacherName, initials, type Teacher } from '../data/teachers'
import { useTeachers, useAddTeacher, useUpdateTeacher, useDeleteTeacher } from '../services/teachersService'
import type { RemplacementRecord } from '../data/teacherExtras'
import { useTeacherExtras, useUpdateTeacherAbsences, useUpdateTeacherRemplacements } from '../services/teacherExtrasService'
import { syncTeacherProfileFromSchedule } from '../services/classSchedulesService'
import TeacherFormModal from '../components/TeacherFormModal'
import TeacherFicheAssiduiteModal from '../components/TeacherFicheAssiduiteModal'
import TeacherPrintPreviewModal from '../components/teacher-print/TeacherPrintPreviewModal'
import TeacherWhatsAppModal from '../components/TeacherWhatsAppModal'
import BulkTeacherWhatsAppModal from '../components/BulkTeacherWhatsAppModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

interface TeachersGlobalProps {
  initialTeacherId?: string
}

export default function TeachersGlobal({ initialTeacherId }: TeachersGlobalProps) {
  const queryClient = useQueryClient()
  const { data: teachers = [], isLoading } = useTeachers()
  const addTeacher = useAddTeacher()
  const updateTeacher = useUpdateTeacher()
  const deleteTeacher = useDeleteTeacher()
  const { data: teacherExtras = {} } = useTeacherExtras()
  const updateAbsences = useUpdateTeacherAbsences()
  const updateRemplacements = useUpdateTeacherRemplacements()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'teachers').canEdit
  const isEditable = canEditYear && canEditModule

  const [selectedId, setSelectedId] = useState<string | null>(initialTeacherId ?? null)
  const [search, setSearch] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [showFiche, setShowFiche] = useState(!!initialTeacherId)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showPrint, setShowPrint] = useState(false)
  const [lastTeacher, setLastTeacher] = useState<Teacher | null>(null)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [showBulkWhatsApp, setShowBulkWhatsApp] = useState(false)

  const selected = teachers.find((t) => t.id === selectedId) ?? null

  useEffect(() => {
    if (selected) setLastTeacher(selected)
  }, [selected])

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-400">Chargement…</div>
  }

  const q = search.toLowerCase()
  const filtered = teachers.filter(
    (t) => !q || teacherName(t).toLowerCase().includes(q) || t.matieres.some((m) => m.toLowerCase().includes(q))
  )

  const panelTeacher = selected ?? lastTeacher

  const handleCreate = async (data: Omit<Teacher, 'id'>) => {
    const id = await addTeacher.mutateAsync(data)
    setShowCreateModal(false)
    setSelectedId(id)
  }

  const handleEditSubmit = (data: Omit<Teacher, 'id'>) => {
    if (!editingTeacher) return
    updateTeacher.mutate({ id: editingTeacher.id, data })
    setEditingTeacher(null)
  }

  const handleDelete = (id: string) => {
    deleteTeacher.mutate(id)
    if (selectedId === id) setSelectedId(null)
    setDeleteConfirmId(null)
  }

  const handleToggleJustified = (teacherId: string, index: number) => {
    const extra = teacherExtras[teacherId] ?? { absences: [], remplacements: [] }
    const absences = extra.absences.map((a, i) => (i === index ? { ...a, justified: !a.justified } : a))
    updateAbsences.mutate({ teacherId, absences })
  }

  const handleAddRemplacement = (teacherId: string, record: RemplacementRecord) => {
    const extra = teacherExtras[teacherId] ?? { absences: [], remplacements: [] }
    const remplacements = [record, ...extra.remplacements]
    updateRemplacements.mutate({ teacherId, remplacements })
  }

  const handleRecalculateProfiles = async () => {
    setIsRecalculating(true)
    try {
      await Promise.all(teachers.map((t) => syncTeacherProfileFromSchedule(t.id)))
      await queryClient.invalidateQueries({ queryKey: ['teachers'] })
    } finally {
      setIsRecalculating(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Registre des Enseignants
            <Briefcase className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">Gestion des profs, bilan d’assiduité par matière et suivi des cours non assurés.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRecalculateProfiles}
            disabled={isRecalculating || !isEditable}
            title="Recalcule Niveaux/Matières/Classes de chaque prof à partir de son emploi du temps réel"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Recalcul…' : 'Recalculer depuis l’emploi du temps'}
          </button>
          <button
            type="button"
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <FileBarChart2 className="h-4 w-4" />
            Rapports
          </button>
          <button
            type="button"
            onClick={() => setShowBulkWhatsApp(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <MessageCircle className="h-4 w-4 text-emerald-500" />
            Envoi rapide — Emplois du temps
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Inscrire un Enseignant
          </button>
        </div>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou matière..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Du :</span>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          />
          <span className="text-sm text-slate-500">au :</span>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setPeriodStart('')
              setPeriodEnd('')
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">Total : {filtered.length} prof(s)</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={!isEditable}
          className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white text-slate-400 hover:border-indigo-300 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-white">
            <Plus className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium">Ajouter</span>
        </button>

        {filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelectedId(t.id)}
            className={`flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-4 text-center shadow-sm transition-colors ${
              selectedId === t.id ? 'border-2 border-indigo-500' : 'border-slate-100 hover:border-indigo-200'
            }`}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
              {initials(teacherName(t))}
            </span>
            <span className="text-sm font-semibold text-slate-900">{teacherName(t)}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.matieres[0]}</span>
          </button>
        ))}
      </div>

      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 ${
          selected ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSelectedId(null)}
        aria-hidden="true"
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 w-[340px] max-w-[90vw] overflow-y-auto border-l border-slate-100 bg-white p-5 shadow-xl transition-transform duration-200 ease-out ${
          selected ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {panelTeacher && (
          <TeacherDetailPanel
            teacher={panelTeacher}
            onBack={() => setSelectedId(null)}
            onEdit={() => setEditingTeacher(panelTeacher)}
            onOpenFiche={() => setShowFiche(true)}
            onDeleteRequest={() => setDeleteConfirmId(panelTeacher.id)}
            onContactWhatsApp={() => setShowWhatsApp(true)}
            isEditable={isEditable}
          />
        )}
      </div>

      {showCreateModal && <TeacherFormModal onClose={() => setShowCreateModal(false)} onSubmit={handleCreate} />}

      {editingTeacher && (
        <TeacherFormModal onClose={() => setEditingTeacher(null)} onSubmit={handleEditSubmit} initial={editingTeacher} />
      )}

      {showFiche && selected && (
        <TeacherFicheAssiduiteModal
          teacher={selected}
          extra={teacherExtras[selected.id] ?? { absences: [], remplacements: [] }}
          otherTeachers={teachers.filter((t) => t.id !== selected.id)}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onClose={() => setShowFiche(false)}
          onToggleJustified={(idx) => handleToggleJustified(selected.id, idx)}
          onAddRemplacement={(record, remplacantId) => handleAddRemplacement(remplacantId, record)}
          isEditable={isEditable}
        />
      )}

      {deleteConfirmId && (
        <ConfirmDeleteModal
          teacherName={teacherName(teachers.find((t) => t.id === deleteConfirmId)!)}
          onCancel={() => setDeleteConfirmId(null)}
          onConfirm={() => handleDelete(deleteConfirmId)}
        />
      )}

      {showPrint && <TeacherPrintPreviewModal teachers={filtered} onClose={() => setShowPrint(false)} />}

      {showWhatsApp && panelTeacher && <TeacherWhatsAppModal teacher={panelTeacher} onClose={() => setShowWhatsApp(false)} />}

      {showBulkWhatsApp && <BulkTeacherWhatsAppModal teachers={teachers} onClose={() => setShowBulkWhatsApp(false)} />}
    </div>
  )
}

function TeacherDetailPanel({
  teacher,
  onBack,
  onEdit,
  onOpenFiche,
  onDeleteRequest,
  onContactWhatsApp,
  isEditable,
}: {
  teacher: Teacher
  onBack: () => void
  onEdit: () => void
  onOpenFiche: () => void
  onDeleteRequest: () => void
  onContactWhatsApp: () => void
  isEditable: boolean
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDeleteRequest}
          disabled={!isEditable}
          className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Supprimer
        </button>
      </div>

      <div className="mb-4 flex flex-col items-center text-center">
        <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-600">
          {initials(teacherName(teacher))}
        </span>
        <p className="text-base font-bold text-slate-900">{teacherName(teacher)}</p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">{teacher.matieres.join(', ')}</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenFiche}
          className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-600 hover:bg-sky-100"
        >
          Fiche professeur
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={!isEditable}
          className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Éditer
        </button>
        <button
          type="button"
          onClick={onContactWhatsApp}
          className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Contacter par WhatsApp
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Informations générales</p>
        <button
          type="button"
          onClick={onEdit}
          disabled={!isEditable}
          className="text-emerald-500 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2.5 text-sm">
        <InfoRow label="Prénom" value={teacher.prenom} />
        <InfoRow label="Nom de famille" value={teacher.nom} />
        <InfoRow label="Matricule" value={teacher.matricule || '—'} />
        <InfoRow
          label="Adresse e-mail"
          value={
            <span className="flex items-center gap-1 text-slate-700">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              {teacher.email}
            </span>
          }
        />
        <InfoRow
          label="Téléphone mobile"
          value={
            <span className="flex items-center gap-1 text-slate-700">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              {teacher.telephoneMobile || '—'}
            </span>
          }
        />
        <InfoRow label="Statut" value={teacher.statut} />
        <InfoRow label="Type" value={teacher.type} />
        <InfoRow label="Niveaux" value={<PillList values={teacher.niveaux} />} />
        <InfoRow label="Matières" value={<PillList values={teacher.matieres} />} />
        <InfoRow label="Classes" value={<PillList values={teacher.classes} />} />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-700">{value}</span>
    </div>
  )
}

function PillList({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="text-slate-400">—</span>
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {values.map((v) => (
        <span key={v} className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
          {v}
        </span>
      ))}
    </span>
  )
}

function ConfirmDeleteModal({
  teacherName,
  onCancel,
  onConfirm,
}: {
  teacherName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-base font-bold text-slate-900">Supprimer cet enseignant ?</h2>
        <p className="mb-5 text-sm text-slate-500">
          Cette action supprimera définitivement le profil de <span className="font-semibold text-slate-700">{teacherName}</span>.
        </p>
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
