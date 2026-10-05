import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Clock, Columns3, List, Megaphone, PlusCircle, Printer, Search, Timer, X } from 'lucide-react'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { RECLAMATION_CATEGORIES, type ReclamationRecord } from '../data/studentDetails'
import { useStudentExtras } from '../services/studentDetailsService'
import NewReclamationModal from '../components/NewReclamationModal'
import ReclamationCard from '../components/ReclamationCard'
import EditReclamationModal from '../components/reclamations/EditReclamationModal'
import ReclamationMessageModal, { MESSAGE_KIND_LABELS, messageKindForStatut } from '../components/reclamations/ReclamationMessageModal'
import type { ReclamationMessageKind } from '../utils/whatsapp'
import { computeReclamationSignals, type ReclamationSignal } from '../utils/reclamationsAlerts'
import { delaiResolutionAutorise } from '../utils/reclamationsPolicy'
import ReclamationBridgeModal from '../components/reclamations/ReclamationBridgeModal'
import ReclamationDrawer from '../components/reclamations/ReclamationDrawer'
import ReclamationKanban from '../components/reclamations/ReclamationKanban'
import ResolveReclamationModal from '../components/reclamations/ResolveReclamationModal'
import { availableBridges, type BridgeKind } from '../components/reclamations/bridges'
import { computeLogicalGroups } from '../utils/suiviClasseGroups'
import { useClasses } from '../services/classesService'
import { getTeachersSnapshot } from '../services/teachersService'
import ReclamationsPrintPreviewModal from '../components/reclamations-print/ReclamationsPrintPreviewModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import { useReclamationActions } from '../hooks/useReclamationActions'
import {
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

interface MessageTarget {
  reclamation: ReclamationRecord
  studentId: string
  studentName: string
  classe: string
  kind: ReclamationMessageKind
  banner?: string
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
  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null)
  const [signalFilter, setSignalFilter] = useState<ReclamationSignal | null>(null)
  const [bridgeTarget, setBridgeTarget] = useState<{ kind: BridgeKind; item: FlatReclamation } | null>(null)
  const [view, setView] = useState<'liste' | 'kanban'>('liste')
  const [drawerKey, setDrawerKey] = useState<{ studentId: string; id: string } | null>(null)
  const [resolveTarget, setResolveTarget] = useState<FlatReclamation | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const { data: classes = [] } = useClasses()
  const teachers = getTeachersSnapshot()
  const logicalGroups = useMemo(() => computeLogicalGroups(classes, teachers), [classes, teachers])

  const flat: FlatReclamation[] = useMemo(() => {
    const list: FlatReclamation[] = []
    ;(students ?? getStudentsSnapshot()).forEach((s) => {
      ;(extrasMap?.[s.id]?.reclamations ?? []).forEach((r) => {
        list.push({ ...r, studentId: s.id, studentName: s.name, classe: s.classe })
      })
    })
    return list
  }, [students, extrasMap])

  // Regroupements récents qui méritent l'attention (même classe + même catégorie, même enseignant, même élève).
  const signals = useMemo(
    () => computeReclamationSignals(flat.map((r) => ({ studentId: r.studentId, studentName: r.studentName, classe: r.classe, record: r }))),
    [flat]
  )

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
    const matchesSignal = !signalFilter || signalFilter.ids.includes(r.id)
    return matchesSearch && matchesCategorie && matchesSignal
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
  const delaisDates = kpiBase.map((r) => ({ jours: delaiResolutionJours(r), autorise: delaiResolutionAutorise(r) })).filter((d): d is { jours: number; autorise: number } => d.jours !== null)
  const delais = delaisDates.map((d) => d.jours)
  const delaiMoyen = delais.length > 0 ? delais.reduce((s, d) => s + d, 0) / delais.length : null
  const sousDelai = delais.length > 0 ? Math.round((delaisDates.filter((d) => d.jours <= d.autorise).length / delais.length) * 100) : null

  const openMessage = (item: FlatReclamation, record: ReclamationRecord, kind: ReclamationMessageKind, banner?: string) =>
    setMessageTarget({ reclamation: record, studentId: item.studentId, studentName: item.studentName, classe: item.classe, kind, banner })

  const handleTakeCharge = async (item: FlatReclamation) => {
    const updated = await actions.prendreEnCharge(item.studentId, item.id)
    if (updated) openMessage(item, updated, 'prise_en_charge')
  }

  // Dépôt d'une carte sur une autre colonne du Kanban. « Résolue » demande toujours le texte de la solution ;
  // on ne revient pas à « En attente » (une réclamation prise en charge ne repasse pas en attente).
  const handleKanbanDrop = async (item: FlatReclamation, target: ReclamationRecord['statut']) => {
    if (target === 'En cours') {
      if (item.statut === 'En attente') await handleTakeCharge(item)
      else await actions.rouvrir(item.studentId, item.id)
    } else if (target === 'Résolue') {
      setResolveTarget(item)
    } else {
      setHint('Une réclamation prise en charge ne repasse pas « En attente ». Utilisez « Rouvrir » pour une réclamation résolue.')
      setTimeout(() => setHint(null), 5000)
    }
  }

  const handleCreate = async (payload: Parameters<typeof actions.creer>[0]) => {
    const list = await actions.creer(payload)
    if (!list) return
    setShowNewModal(false)
    const student = (students ?? getStudentsSnapshot()).find((s) => s.id === payload.studentId)
    const first = list[0]
    if (first && student) {
      setMessageTarget({
        reclamation: { ...first, objet: payload.items.map((i) => cleanReclamationText(i.objet)).join(' ; ') },
        studentId: student.id,
        studentName: student.name,
        classe: student.classe,
        kind: 'accuse',
        banner: `${payload.items.length > 1 ? 'Réclamations enregistrées' : 'Réclamation enregistrée'}. Vous pouvez envoyer un accusé de réception au parent.`,
      })
    }
  }

  const renderCard = (item: FlatReclamation) => (
    <ReclamationCard
      key={`${item.studentId}-${item.id}`}
      reclamation={item}
      studentName={item.studentName}
      classe={item.classe}
      isEditable={isEditable}
      onTakeCharge={() => handleTakeCharge(item)}
      onResolve={async (resolution) => {
        const updated = await actions.resoudre(item.studentId, item.id, resolution)
        if (updated) openMessage(item, updated, 'resolution')
      }}
      onMessage={() => openMessage(item, item, messageKindForStatut(item.statut))}
      onAssign={(responsable, echeance) => actions.assigner(item.studentId, item.id, responsable, echeance || undefined)}
      bridges={availableBridges(item, item.classe, logicalGroups, teachers)}
      onBridge={(kind) => setBridgeTarget({ kind, item })}
      onHistory={() => setDrawerKey({ studentId: item.studentId, id: item.id })}
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

      {hint && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{hint}</div>}

      {signals.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Signaux à surveiller ({signals.length})
            {signalFilter && (
              <button type="button" onClick={() => setSignalFilter(null)} className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold normal-case text-amber-700 hover:bg-amber-100">
                Afficher toutes les réclamations
              </button>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {signals.slice(0, 6).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSignalFilter(signalFilter?.key === s.key ? null : s)}
                title="Filtrer sur ce regroupement"
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  signalFilter?.key === s.key ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-100'
                }`}
              >
                {s.label}
              </button>
            ))}
            {signals.length > 6 && <span className="self-center text-xs text-amber-700">+ {signals.length - 6} autre(s)</span>}
          </div>
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
          label="Hors délai"
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
          label="Résolues dans le délai"
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
        <div className="flex items-center rounded-lg border border-slate-200 p-0.5" role="group" aria-label="Affichage">
          {([
            { key: 'liste', label: 'Liste', Icon: List },
            { key: 'kanban', label: 'Colonnes', Icon: Columns3 },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${view === key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
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
      ) : view === 'kanban' ? (
        <ReclamationKanban
          items={[...active, ...resolved]}
          getKey={(i) => `${i.studentId}-${i.id}`}
          getStatut={(i) => i.statut}
          renderCard={renderCard}
          canDrag={isEditable}
          onDropTo={handleKanbanDrop}
        />
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

      {drawerKey &&
        (() => {
          const current = flat.find((r) => r.studentId === drawerKey.studentId && r.id === drawerKey.id)
          return current ? <ReclamationDrawer reclamation={current} studentName={current.studentName} classe={current.classe} onClose={() => setDrawerKey(null)} /> : null
        })()}

      {resolveTarget && (
        <ResolveReclamationModal
          title={`${resolveTarget.studentName} — ${cleanReclamationText(resolveTarget.objet)}`}
          onClose={() => setResolveTarget(null)}
          onSubmit={async (resolution) => {
            const target = resolveTarget
            setResolveTarget(null)
            const updated = await actions.resoudre(target.studentId, target.id, resolution)
            if (updated) openMessage(target, updated, 'resolution')
          }}
        />
      )}

      {bridgeTarget && (
        <ReclamationBridgeModal
          kind={bridgeTarget.kind}
          reclamation={bridgeTarget.item}
          studentId={bridgeTarget.item.studentId}
          studentName={bridgeTarget.item.studentName}
          classe={bridgeTarget.item.classe}
          groups={logicalGroups}
          teachers={teachers}
          onDone={(detail) => {
            const target = bridgeTarget
            setBridgeTarget(null)
            actions.journaliserAction(target.item.studentId, target.item.id, detail)
          }}
          onClose={() => setBridgeTarget(null)}
        />
      )}

      {messageTarget && (
        <ReclamationMessageModal
          reclamation={messageTarget.reclamation}
          studentId={messageTarget.studentId}
          studentName={messageTarget.studentName}
          classe={messageTarget.classe}
          kind={messageTarget.kind}
          banner={messageTarget.banner}
          onShared={(kind) => actions.journaliserMessage(messageTarget.studentId, messageTarget.reclamation.id, MESSAGE_KIND_LABELS[kind])}
          onClose={() => setMessageTarget(null)}
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
