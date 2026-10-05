import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Clock, Megaphone, PlusCircle, Printer, Search, Timer, X } from 'lucide-react'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { RECLAMATION_CATEGORIES, type ReclamationRecord } from '../data/studentDetails'
import { useStudentExtras } from '../services/studentDetailsService'
import NewReclamationModal from '../components/NewReclamationModal'
import ReclamationCard from '../components/ReclamationCard'
import EditReclamationModal from '../components/reclamations/EditReclamationModal'
import ReclamationsPrintPreviewModal from '../components/reclamations-print/ReclamationsPrintPreviewModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import { useReclamationActions } from '../hooks/useReclamationActions'
import {
  RECLAMATION_DELAI_JOURS,
  cleanReclamationText,
  delaiResolutionJours,
  echeanceStatut,
  isHorsDelai,
} from '../utils/reclamationsLogic'

interface FlatReclamation extends ReclamationRecord {
  studentId: string
  studentName: string
  classe: string
}

type QuickFilter = 'toutes' | 'a_traiter' | 'en_attente' | 'en_cours' | 'hors_delai' | 'sans_responsable' | 'mes' | 'echeance_depassee' | 'resolues'
type SortMode = 'urgence' | 'recent'

const CHIPS: { key: QuickFilter; label: string }[] = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'a_traiter', label: 'À traiter' },
  { key: 'en_attente', label: 'En attente' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'hors_delai', label: 'Hors délai' },
  { key: 'echeance_depassee', label: 'Échéance dépassée' },
  { key: 'sans_responsable', label: 'Sans responsable' },
  { key: 'mes', label: 'Mes réclamations' },
  { key: 'resolues', label: 'Résolues' },
]

export default function ReclamationsGlobal() {
  const { data: students } = useStudents()
  // Lu depuis la requête (et non copié dans un état local) : un changement venu d'ailleurs — « Marquer
  // traitée » dans la Réunion de suivi, la fiche élève — apparaît ici sans recharger la page.
  const { data: extrasMap } = useStudentExtras()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'reclamations').canEdit
  const isEditable = canEditYear && canEditModule
  const myName = profile?.nomComplet || profile?.email || ''
  const actions = useReclamationActions()

  const [search, setSearch] = useState('')
  const [categorieFilter, setCategorieFilter] = useState('Toutes')
  const [quick, setQuick] = useState<QuickFilter>('toutes')
  const [sort, setSort] = useState<SortMode>('urgence')
  const [showNewModal, setShowNewModal] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [resolvedOpen, setResolvedOpen] = useState(false)
  const [editing, setEditing] = useState<FlatReclamation | null>(null)

  const flat: FlatReclamation[] = useMemo(() => {
    const list: FlatReclamation[] = []
    ;(students ?? getStudentsSnapshot()).forEach((s) => {
      ;(extrasMap?.[s.id]?.reclamations ?? []).forEach((r) => {
        list.push({ ...r, studentId: s.id, studentName: s.name, classe: s.classe })
      })
    })
    return list
  }, [students, extrasMap])

  // Base des indicateurs et des compteurs de filtres : recherche + catégorie seulement, PAS le filtre
  // rapide — sinon choisir « Hors délai » ramènerait mécaniquement les autres compteurs à 0.
  const kpiBase = flat.filter((r) => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      r.studentName.toLowerCase().includes(q) ||
      r.enseignant.toLowerCase().includes(q) ||
      (r.parentNom ?? '').toLowerCase().includes(q) ||
      (r.responsable ?? '').toLowerCase().includes(q) ||
      cleanReclamationText(r.objet).toLowerCase().includes(q)
    const matchesCategorie = categorieFilter === 'Toutes' || r.type === categorieFilter
    return matchesSearch && matchesCategorie
  })

  const predicates: Record<QuickFilter, (r: FlatReclamation) => boolean> = {
    toutes: () => true,
    a_traiter: (r) => r.statut !== 'Résolue',
    en_attente: (r) => r.statut === 'En attente',
    en_cours: (r) => r.statut === 'En cours',
    hors_delai: (r) => isHorsDelai(r),
    echeance_depassee: (r) => echeanceStatut(r) === 'depassee',
    sans_responsable: (r) => r.statut !== 'Résolue' && !r.responsable,
    mes: (r) => !!myName && r.responsable === myName && r.statut !== 'Résolue',
    resolues: (r) => r.statut === 'Résolue',
  }
  const counts = Object.fromEntries(CHIPS.map((c) => [c.key, kpiBase.filter(predicates[c.key]).length])) as Record<QuickFilter, number>

  const filtered = kpiBase.filter(predicates[quick])

  // « Urgence » : hors délai d'abord, puis l'échéance la plus proche, puis la plus ancienne réception.
  const urgency = (a: FlatReclamation, b: FlatReclamation) => {
    const ah = isHorsDelai(a) ? 0 : 1
    const bh = isHorsDelai(b) ? 0 : 1
    if (ah !== bh) return ah - bh
    const ae = a.echeance ?? '9999-99-99'
    const be = b.echeance ?? '9999-99-99'
    if (ae !== be) return ae < be ? -1 : 1
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  }
  const recent = (a: FlatReclamation, b: FlatReclamation) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
  const active = filtered.filter((r) => r.statut !== 'Résolue').sort(sort === 'urgence' ? urgency : recent)
  const resolved = filtered.filter((r) => r.statut === 'Résolue').sort(recent)
  const isResolvedExpanded = resolvedOpen || active.length === 0

  const total = kpiBase.length
  const aTraiter = counts.a_traiter
  const enCours = counts.en_cours
  const horsDelai = counts.hors_delai
  const resolues = counts.resolues
  const tauxResolution = total > 0 ? Math.round((resolues / total) * 100) : 0
  // Durées réelles : seulement pour les réclamations résolues APRÈS l'enregistrement de la date de
  // résolution — les plus anciennes n'en ont pas, on ne devine pas.
  const delais = kpiBase.map((r) => delaiResolutionJours(r)).filter((d): d is number => d !== null)
  const delaiMoyen = delais.length > 0 ? delais.reduce((s, d) => s + d, 0) / delais.length : null
  const sousDelai = delais.length > 0 ? Math.round((delais.filter((d) => d <= RECLAMATION_DELAI_JOURS).length / delais.length) * 100) : null

  const handleCreate = async (payload: Parameters<typeof actions.creer>[0]) => {
    if (await actions.creer(payload)) setShowNewModal(false)
  }

  const renderCard = (item: FlatReclamation) => (
    <ReclamationCard
      key={`${item.studentId}-${item.id}`}
      reclamation={item}
      studentName={item.studentName}
      classe={item.classe}
      isEditable={isEditable}
      onTakeCharge={() => actions.prendreEnCharge(item.studentId, item.id)}
      onResolve={(resolution) => actions.resoudre(item.studentId, item.id, resolution)}
      onReopen={() => actions.rouvrir(item.studentId, item.id)}
      onEdit={() => setEditing(item)}
      onDelete={() => actions.supprimer(item.studentId, item.id)}
    />
  )

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

      {actions.error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{actions.error}</span>
          <button type="button" onClick={actions.clearError} title="Fermer" className="shrink-0 text-rose-400 hover:text-rose-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          icon={Megaphone}
          iconBg="bg-rose-50"
          iconColor="text-rose-500"
          value={total}
          label="Total réclamations"
          active={quick === 'toutes'}
          onClick={() => setQuick('toutes')}
        />
        <KpiCard
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          value={aTraiter}
          label="À traiter"
          sub={`dont ${enCours} en cours`}
          active={quick === 'a_traiter'}
          onClick={() => setQuick('a_traiter')}
        />
        <KpiCard
          icon={AlertTriangle}
          iconBg={horsDelai > 0 ? 'bg-rose-100' : 'bg-emerald-50'}
          iconColor={horsDelai > 0 ? 'text-rose-600' : 'text-emerald-500'}
          value={horsDelai}
          label="Hors délai (> 72 h)"
          valueClass={horsDelai > 0 ? 'text-rose-600' : undefined}
          active={quick === 'hors_delai'}
          onClick={() => setQuick('hors_delai')}
        />
        <KpiCard
          icon={Megaphone}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          value={resolues}
          label="Résolues"
          sub={`${tauxResolution} % du total`}
          active={quick === 'resolues'}
          onClick={() => setQuick('resolues')}
        />
        <KpiCard
          icon={Timer}
          iconBg="bg-sky-50"
          iconColor="text-sky-500"
          value={sousDelai === null ? '—' : `${sousDelai} %`}
          label="Résolues sous 72 h"
          sub={sousDelai === null ? 'dès les prochaines résolutions' : `sur ${delais.length} datée${delais.length > 1 ? 's' : ''}`}
        />
        <KpiCard
          icon={Timer}
          iconBg="bg-sky-50"
          iconColor="text-sky-500"
          value={delaiMoyen === null ? '—' : `${delaiMoyen.toFixed(1).replace('.', ',')} j`}
          label="Délai moyen"
          sub={delaiMoyen === null ? 'dès les prochaines résolutions' : 'de résolution'}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Tri :</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            <option value="urgence">Urgence d'abord</option>
            <option value="recent">Plus récentes d'abord</option>
          </select>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setQuick(c.key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              quick === c.key
                ? 'bg-indigo-600 text-white'
                : c.key === 'hors_delai' && counts.hors_delai > 0
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {c.label}
            <span className={`rounded-full px-1.5 text-[10px] font-bold ${quick === c.key ? 'bg-white/25' : 'bg-white'}`}>{counts[c.key]}</span>
          </button>
        ))}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{active.map(renderCard)}</div>
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
              {isResolvedExpanded && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{resolved.map(renderCard)}</div>}
            </div>
          )}
        </div>
      )}

      {showNewModal && <NewReclamationModal onClose={() => setShowNewModal(false)} onSubmit={handleCreate} />}

      {editing && (
        <EditReclamationModal
          reclamation={editing}
          studentId={editing.studentId}
          studentName={editing.studentName}
          onClose={() => setEditing(null)}
          onSave={async (patch, detail) => {
            const target = editing
            setEditing(null)
            await actions.modifier(target.studentId, target.id, patch, detail)
          }}
        />
      )}

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
  sub,
  valueClass,
  active,
  onClick,
}: {
  icon: typeof Megaphone
  iconBg: string
  iconColor: string
  value: string | number
  label: string
  sub?: string
  valueClass?: string
  active?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div className="min-w-0 text-left">
        <p className={`text-xl font-bold ${valueClass ?? 'text-slate-900'}`}>{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
    </>
  )
  const base = 'flex items-center gap-3 rounded-2xl border bg-white p-3.5 shadow-sm'
  if (!onClick) return <div className={`${base} border-slate-100`}>{content}</div>
  return (
    <button type="button" onClick={onClick} className={`${base} transition-colors hover:bg-slate-50 ${active ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-slate-100'}`}>
      {content}
    </button>
  )
}
