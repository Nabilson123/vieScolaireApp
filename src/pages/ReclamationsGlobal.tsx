import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Megaphone, PlusCircle, Printer, Search, CircleDot, CheckCircle, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { RECLAMATION_CATEGORIES, type ReclamationRecord } from '../data/studentDetails'
import { getStudentExtraSnapshot, updateStudentReclamations, createReclamations } from '../services/studentDetailsService'
import NewReclamationModal from '../components/NewReclamationModal'
import ReclamationCard from '../components/ReclamationCard'
import ReclamationsPrintPreviewModal from '../components/reclamations-print/ReclamationsPrintPreviewModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

interface FlatReclamation extends ReclamationRecord {
  id: string
  studentId: string
  studentName: string
  classe: string
}

function buildInitialMap(): Record<string, ReclamationRecord[]> {
  const map: Record<string, ReclamationRecord[]> = {}
  getStudentsSnapshot().forEach((s) => {
    map[s.id] = getStudentExtraSnapshot(s.id).reclamations
  })
  return map
}

export default function ReclamationsGlobal() {
  const queryClient = useQueryClient()
  // reclamationsMap est semé une fois depuis getStudentsSnapshot() (année-scopé) puis maintenu
  // localement en écriture optimiste : sans ce reset, changer d'année garderait l'ancienne année.
  // Le déclencheur est la référence `students` (retournée par useStudents()), pas l'id de l'année
  // consultée : celui-ci change avant la fin du fetch réseau, donc un reset qui ne dépendrait que
  // de lui reseedrait trop tôt, avec les données encore périmées.
  const { data: students } = useStudents()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'reclamations').canEdit
  const isEditable = canEditYear && canEditModule
  const [reclamationsMap, setReclamationsMap] = useState<Record<string, ReclamationRecord[]>>(buildInitialMap)
  useEffect(() => {
    setReclamationsMap(buildInitialMap())
  }, [students])
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState('Tous')
  const [categorieFilter, setCategorieFilter] = useState('Toutes')
  const [showNewModal, setShowNewModal] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [resolvedOpen, setResolvedOpen] = useState(false)

  const flat: FlatReclamation[] = useMemo(() => {
    const list: FlatReclamation[] = []
    getStudentsSnapshot().forEach((s) => {
      ;(reclamationsMap[s.id] ?? []).forEach((r, idx) => {
        list.push({ ...r, id: `${s.id}-${idx}`, studentId: s.id, studentName: s.name, classe: s.classe })
      })
    })
    return list.sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [reclamationsMap, students])

  // Base pour les indicateurs (Total/En cours/Résolues/Taux) : recherche + catégorie seulement, PAS
  // le statut — sinon filtrer sur "En attente" ramène mécaniquement "En cours"/"Résolues" à 0 et les
  // indicateurs perdent leur sens de vue d'ensemble.
  const kpiBase = flat.filter((r) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      r.studentName.toLowerCase().includes(q) ||
      r.enseignant.toLowerCase().includes(q) ||
      (r.parentNom ?? '').toLowerCase().includes(q) ||
      r.objet.toLowerCase().includes(q)
    const matchesCategorie = categorieFilter === 'Toutes' || r.type === categorieFilter
    return matchesSearch && matchesCategorie
  })

  const filtered = kpiBase.filter((r) => statutFilter === 'Tous' || r.statut === statutFilter)

  const active = filtered.filter((r) => r.statut !== 'Résolue')
  const resolved = filtered.filter((r) => r.statut === 'Résolue')
  const isResolvedExpanded = resolvedOpen || active.length === 0

  const total = kpiBase.length
  const enCours = kpiBase.filter((r) => r.statut === 'En cours').length
  const resolues = kpiBase.filter((r) => r.statut === 'Résolue').length
  const tauxResolution = total > 0 ? Math.round((resolues / total) * 100) : 0

  const persist = async (studentId: string, list: ReclamationRecord[]) => {
    await updateStudentReclamations(studentId, list)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
  }

  const handleCreate = async (payload: {
    studentId: string
    parentNom: string
    date: string
    items: { category: string; objet: string; description: string; concernant: string }[]
  }) => {
    const updated = await createReclamations(payload)
    setReclamationsMap((prev) => ({ ...prev, [payload.studentId]: updated }))
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setShowNewModal(false)
  }

  const handleTakeCharge = async (item: FlatReclamation) => {
    const list = (reclamationsMap[item.studentId] ?? []).map((r, idx) =>
      `${item.studentId}-${idx}` === item.id ? { ...r, statut: 'En cours' as const } : r
    )
    setReclamationsMap((prev) => ({ ...prev, [item.studentId]: list }))
    await persist(item.studentId, list)
  }

  const handleResolve = async (item: FlatReclamation, resolution: string) => {
    const list = (reclamationsMap[item.studentId] ?? []).map((r, idx) =>
      `${item.studentId}-${idx}` === item.id ? { ...r, statut: 'Résolue' as const, resolution } : r
    )
    setReclamationsMap((prev) => ({ ...prev, [item.studentId]: list }))
    await persist(item.studentId, list)
  }

  const handleDelete = async (item: FlatReclamation) => {
    const list = (reclamationsMap[item.studentId] ?? []).filter((_, idx) => `${item.studentId}-${idx}` !== item.id)
    setReclamationsMap((prev) => ({ ...prev, [item.studentId]: list }))
    await persist(item.studentId, list)
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Gestion des Réclamations
            <Megaphone className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            Suivi et résolution des plaintes et réclamations formulées par les parents d'élèves.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Imprimer Rapport
          </button>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            Nouvelle Réclamation
          </button>
        </div>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Megaphone} iconBg="bg-rose-50" iconColor="text-rose-500" value={total} label="Total réclamations" />
        <KpiCard icon={CircleDot} iconBg="bg-amber-50" iconColor="text-amber-500" value={enCours} label="En cours de traitement" />
        <KpiCard icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-500" value={resolues} label="Plaintes résolues" />
        <KpiCard icon={TrendingUp} iconBg="bg-sky-50" iconColor="text-sky-500" value={`${tauxResolution}%`} label="Taux de résolution" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher élève, parent, prof, motif..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Statut :</span>
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            <option>Tous</option>
            <option>En attente</option>
            <option>En cours</option>
            <option>Résolue</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Catégorie :</span>
          <select
            value={categorieFilter}
            onChange={(e) => setCategorieFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            <option>Toutes</option>
            {RECLAMATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          Aucune réclamation ne correspond à ces filtres.
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">À traiter ({active.length})</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((item) => (
                  <ReclamationCard
                    key={item.id}
                    reclamation={item}
                    studentName={item.studentName}
                    classe={item.classe}
                    onTakeCharge={() => handleTakeCharge(item)}
                    onResolve={(resolution) => handleResolve(item, resolution)}
                    onDelete={() => handleDelete(item)}
                    isEditable={isEditable}
                  />
                ))}
              </div>
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setResolvedOpen((v) => !v)}
                className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
              >
                {isResolvedExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Résolues ({resolved.length})
              </button>
              {isResolvedExpanded && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {resolved.map((item) => (
                    <ReclamationCard
                      key={item.id}
                      reclamation={item}
                      studentName={item.studentName}
                      classe={item.classe}
                      onTakeCharge={() => handleTakeCharge(item)}
                      onResolve={(resolution) => handleResolve(item, resolution)}
                      onDelete={() => handleDelete(item)}
                      isEditable={isEditable}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showNewModal && <NewReclamationModal onClose={() => setShowNewModal(false)} onSubmit={handleCreate} />}

      {showPrint && <ReclamationsPrintPreviewModal records={filtered} onClose={() => setShowPrint(false)} />}
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
  icon: typeof Megaphone
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
