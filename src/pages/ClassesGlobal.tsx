import { useState } from 'react'
import { School, PlusCircle, Search, Users, Layers, BarChart3, UserX, AlertTriangle, DoorClosed, Scale } from 'lucide-react'
import { NIVEAUX_ORDER, type SchoolClass } from '../data/schoolStructure'
import { useClasses, useAddClass, useUpdateClass, useArchiveClass, useDeleteClass } from '../services/classesService'
import { teacherName } from '../data/teachers'
import { useTeachers } from '../services/teachersService'
import { useClassSchedules } from '../services/classSchedulesService'
import { computeClassVolume, computeGlobalStats, detectNiveauImbalance, detectSalleConflicts, getClassEffectif } from '../utils/classAggregation'
import { formatHeures } from '../utils/teacherAggregation'
import ClassFormModal from '../components/ClassFormModal'
import ClassDetailModal from '../components/ClassDetailModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

export default function ClassesGlobal() {
  const { data: allClasses = [], isLoading } = useClasses()
  const addClass = useAddClass()
  const updateClass = useUpdateClass()
  const archiveClass = useArchiveClass()
  const deleteClass = useDeleteClass()
  const { data: teachers = [] } = useTeachers()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'classes').canEdit
  const isEditable = canEditYear && canEditModule
  // Abonnement direct : computeClassVolume() lit un cache module-level qui ne se re-render pas
  // tout seul quand l'année change dans la Sidebar.
  useClassSchedules()

  const [, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((k) => k + 1)

  const [search, setSearch] = useState('')
  const [filterNiveau, setFilterNiveau] = useState('Tous')
  const [filterStatut, setFilterStatut] = useState('Tous')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const q = search.toLowerCase()
  const filtered = allClasses.filter((c) => {
    const matchesSearch = !q || c.nom.toLowerCase().includes(q)
    const matchesNiveau = filterNiveau === 'Tous' || c.niveau === filterNiveau
    const matchesStatut = filterStatut === 'Tous' || c.statut === filterStatut
    return matchesSearch && matchesNiveau && matchesStatut
  })

  const stats = computeGlobalStats()
  const salleConflicts = detectSalleConflicts()
  const imbalances = detectNiveauImbalance()

  const editingClass = editingId ? allClasses.find((c) => c.id === editingId) : undefined
  const duplicatingClass = duplicatingId ? allClasses.find((c) => c.id === duplicatingId) : undefined
  const detailClass = detailId ? allClasses.find((c) => c.id === detailId) : undefined

  const handleCreate = (data: Omit<SchoolClass, 'id'>) => {
    addClass.mutate(data)
    setShowCreateModal(false)
  }

  const handleEditSubmit = (data: Omit<SchoolClass, 'id'>) => {
    if (!editingClass) return
    updateClass.mutate({ ...editingClass, ...data })
    setEditingId(null)
  }

  const handleDuplicateSubmit = (data: Omit<SchoolClass, 'id'>) => {
    addClass.mutate(data)
    setDuplicatingId(null)
  }

  const handleArchive = (id: string) => {
    archiveClass.mutate(id)
  }

  const handleDelete = (id: string) => {
    deleteClass.mutate(id)
    setDetailId(null)
    setDeleteConfirmId(null)
  }

  const handleAssignPP = (id: string, teacherId: string | undefined) => {
    const cls = allClasses.find((c) => c.id === id)
    if (!cls) return
    updateClass.mutate({ ...cls, professeurPrincipalId: teacherId })
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-400">Chargement…</div>
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Gestion des Classes
            <School className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            Visualisez, ajoutez, renommez ou supprimez les classes et divisions de l’établissement.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={!isEditable}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusCircle className="h-4 w-4" />
          Nouvelle Classe
        </button>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      {stats.classesSansPP.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <UserX className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{stats.classesSansPP.length} classe(s)</span> sans Professeur Principal :{' '}
            {stats.classesSansPP.map((c) => c.nom).join(', ')}
          </span>
        </div>
      )}

      {salleConflicts.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <DoorClosed className="h-4 w-4 shrink-0" />
          <span>
            Salle en double :{' '}
            {salleConflicts.map((s) => `${s.salle} (${s.classes.join(', ')})`).join(' · ')}
          </span>
        </div>
      )}

      {imbalances.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
          <Scale className="h-4 w-4 shrink-0" />
          <span>
            Déséquilibre d’effectif détecté :{' '}
            {imbalances.map((i) => `Niveau ${i.niveau} (écart de ${i.diff} élèves)`).join(' · ')}
          </span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={School} iconBg="bg-indigo-50" iconColor="text-indigo-500" value={stats.totalActives} label="Classes actives" />
        <KpiCard icon={Users} iconBg="bg-emerald-50" iconColor="text-emerald-500" value={stats.totalEleves} label="Élèves inscrits" />
        <KpiCard icon={BarChart3} iconBg="bg-amber-50" iconColor="text-amber-500" value={stats.moyenneElevesParClasse.toFixed(1)} label="Moyenne élèves / classe" />
        <KpiCard icon={AlertTriangle} iconBg="bg-rose-50" iconColor="text-rose-500" value={stats.classesSansPP.length} label="Classes sans PP" />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une classe..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Niveau :</span>
          <select
            value={filterNiveau}
            onChange={(e) => setFilterNiveau(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            <option>Tous</option>
            {NIVEAUX_ORDER.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Statut :</span>
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            <option>Tous</option>
            <option>Active</option>
            <option>Archivée</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          Aucune classe ne correspond à ces filtres.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((c) => {
            const effectif = getClassEffectif(c.nom)
            const volume = computeClassVolume(c.nom)
            const pp = teachers.find((t) => t.id === c.professeurPrincipalId)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setDetailId(c.id)}
                className="rounded-2xl border-2 border-indigo-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-300"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-base font-bold text-slate-900">{c.nom}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      c.statut === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    Classe {c.statut === 'Active' ? 'Active' : 'Archivée'}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-slate-500">
                  <p className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Élèves inscrits : <span className="font-semibold text-slate-700">{effectif}</span>
                    <span className="text-slate-400">/ {c.capaciteMax}</span>
                  </p>
                  <p className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    Cours hebdomadaires : <span className="font-semibold text-slate-700">{volume.seances} séances</span>
                  </p>
                  <p className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    Volume horaire : <span className="font-semibold text-slate-700">{formatHeures(volume.heures)}/sem</span>
                  </p>
                  <p className="truncate">PP : <span className="font-semibold text-slate-700">{pp ? teacherName(pp) : 'Non assigné'}</span></p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {showCreateModal && <ClassFormModal onClose={() => setShowCreateModal(false)} onSubmit={handleCreate} mode="create" />}

      {editingClass && (
        <ClassFormModal onClose={() => setEditingId(null)} onSubmit={handleEditSubmit} initial={editingClass} mode="edit" />
      )}

      {duplicatingClass && (
        <ClassFormModal onClose={() => setDuplicatingId(null)} onSubmit={handleDuplicateSubmit} initial={duplicatingClass} mode="duplicate" />
      )}

      {detailClass && (
        <ClassDetailModal
          schoolClass={detailClass}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEditingId(detailClass.id)
          }}
          onDuplicate={() => {
            setDuplicatingId(detailClass.id)
          }}
          onArchive={() => handleArchive(detailClass.id)}
          onDelete={() => setDeleteConfirmId(detailClass.id)}
          onAssignPP={(teacherId) => handleAssignPP(detailClass.id, teacherId)}
          onRefresh={refresh}
          isEditable={isEditable}
        />
      )}

      {deleteConfirmId && (
        <ConfirmDeleteModal
          className={allClasses.find((c) => c.id === deleteConfirmId)?.nom ?? ''}
          onCancel={() => setDeleteConfirmId(null)}
          onConfirm={() => handleDelete(deleteConfirmId)}
        />
      )}
    </div>
  )
}

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  value,
  label,
}: {
  icon: typeof School
  iconBg: string
  iconColor: string
  value: string | number
  label: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({ className, onCancel, onConfirm }: { className: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-base font-bold text-slate-900">Supprimer cette classe ?</h2>
        <p className="mb-5 text-sm text-slate-500">
          Cette action supprimera définitivement la classe <span className="font-semibold text-slate-700">{className}</span>. Les élèves qui y
          sont inscrits ne seront pas automatiquement réaffectés.
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
