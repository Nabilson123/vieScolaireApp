import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarCheck, CheckSquare, ChevronDown, ChevronRight, Columns3, List, ListChecks, MailCheck, Megaphone, PlusCircle, Printer, Search, X } from 'lucide-react'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { RECLAMATION_CATEGORIES, type ReclamationRecord } from '../data/studentDetails'
import { assignerBatch, prendreEnChargeBatch, marquerUrgenteBatch, useStudentExtras } from '../services/studentDetailsService'
import { buildStaffOptions } from '../utils/staffOptions'
import NewReclamationModal from '../components/NewReclamationModal'
import ReclamationCard from '../components/ReclamationCard'
import EditReclamationModal from '../components/reclamations/EditReclamationModal'
import ReclamationMessageModal, { MESSAGE_KIND_LABELS, messageKindForStatut } from '../components/reclamations/ReclamationMessageModal'
import type { ReclamationMessageKind } from '../utils/whatsapp'
import { computeReclamationSignals, type ReclamationSignal } from '../utils/reclamationsAlerts'
import { delaiResolutionAutorise, niveauOf } from '../utils/reclamationsPolicy'
import ReclamationAgenda from '../components/reclamations/ReclamationAgenda'
import { agendaTotal, computeAgenda } from '../utils/reclamationsAgenda'
import ReclamationQueueModal from '../components/reclamations/ReclamationQueueModal'
import BulkAccusesModal from '../components/reclamations/BulkAccusesModal'
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
  isAccuseAEnvoyer,
  isAccuseEnRetard,
  isHorsDelai,
  isRelanceDue,
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

type QuickFilter = 'toutes' | 'a_traiter' | 'accuse_a_envoyer' | 'urgentes' | 'a_relancer' | 'en_attente' | 'en_cours' | 'hors_delai' | 'sans_responsable' | 'mes' | 'echeance_depassee' | 'resolues'
type SortMode = 'urgence' | 'recent'
type View = 'aujourdhui' | 'liste' | 'kanban'

const CHIPS: { key: QuickFilter; label: string }[] = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'a_traiter', label: 'À traiter' },
  { key: 'accuse_a_envoyer', label: 'Accusé à envoyer' },
  { key: 'urgentes', label: 'Urgentes' },
  { key: 'a_relancer', label: 'À relancer' },
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
  const [view, setView] = useState<View>('liste')
  // Tant que l'utilisateur n'a pas choisi sa vue, la page s'ouvre sur « Aujourd'hui » s'il y a quelque chose à faire.
  const viewChosen = useRef(false)
  const chooseView = (v: View) => {
    viewChosen.current = true
    setView(v)
  }
  const [signalsOpen, setSignalsOpen] = useState(false)
  // Traiter la file / actions groupées.
  const [queueKeys, setQueueKeys] = useState<{ studentId: string; id: string }[] | null>(null)
  const [bulkAccuseKeys, setBulkAccuseKeys] = useState<{ studentId: string; id: string }[] | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState<'prendre' | 'urgente' | 'assigner' | null>(null)
  const [bulkAssignee, setBulkAssignee] = useState('')
  const [bulkEcheance, setBulkEcheance] = useState('')
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
    accuse_a_envoyer: (r) => isAccuseAEnvoyer(r),
    urgentes: (r) => r.statut !== 'Résolue' && niveauOf(r) === 'urgent',
    a_relancer: (r) => isRelanceDue(r),
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

  // « Aujourd'hui » : le compteur de l'onglet porte sur tout, la vue respecte la recherche et la catégorie.
  const agendaAll = useMemo(() => computeAgenda(flat, myName), [flat, myName])
  const agendaSections = computeAgenda(kpiBase, myName)
  const agendaCount = agendaTotal(agendaAll)
  useEffect(() => {
    if (viewChosen.current || !students || !extrasMap) return
    viewChosen.current = true
    setView(agendaCount > 0 ? 'aujourdhui' : 'liste')
  }, [students, extrasMap, agendaCount])

  const pickQuick = (k: QuickFilter) => {
    setQuick(k)
    if (view === 'aujourdhui') chooseView('liste')
  }

  // « Urgence » : urgentes d'abord, puis hors délai, puis l'échéance la plus proche, puis la plus ancienne réception.
  const urgency = (a: FlatReclamation, b: FlatReclamation) => {
    const au = niveauOf(a) === 'urgent' ? 0 : 1
    const bu = niveauOf(b) === 'urgent' ? 0 : 1
    if (au !== bu) return au - bu
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

  // « Traiter la file » : ce qui attend un tri — accusé à envoyer ou pas encore prise en charge —, le plus urgent
  // d'abord. Respecte la recherche et la catégorie choisies : on peut trier « tout ce qui concerne la cantine ».
  const queue = kpiBase.filter((r) => r.statut !== 'Résolue' && (isAccuseAEnvoyer(r) || r.statut === 'En attente')).sort(urgency)

  // Sélection pour les actions groupées.
  const keyOf = (r: { studentId: string; id: string }) => `${r.studentId}|${r.id}`
  const selectedItems = flat.filter((r) => selected.has(keyOf(r)))
  const toggleSelected = (r: FlatReclamation) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(keyOf(r))) next.delete(keyOf(r))
      else next.add(keyOf(r))
      return next
    })
  const exitSelection = () => {
    setSelectMode(false)
    setSelected(new Set())
    setBulkConfirm(null)
  }
  const bulkTargets = (kind: 'prendre' | 'urgente' | 'assigner') =>
    selectedItems.filter((r) => {
      if (kind === 'prendre') return r.statut === 'En attente'
      if (kind === 'urgente') return r.statut !== 'Résolue' && niveauOf(r) !== 'urgent'
      return r.statut !== 'Résolue'
    })
  const flashHint = (text: string) => {
    setHint(text)
    setTimeout(() => setHint(null), 5000)
  }
  const runBulk = async (kind: 'prendre' | 'urgente' | 'assigner') => {
    const targets = bulkTargets(kind).map((r) => ({ studentId: r.studentId, id: r.id }))
    setBulkConfirm(null)
    if (targets.length === 0) return
    const done = await actions.enLot(targets, (studentId, ids) =>
      kind === 'prendre' ? prendreEnChargeBatch(studentId, ids) : kind === 'urgente' ? marquerUrgenteBatch(studentId, ids) : assignerBatch(studentId, ids, bulkAssignee, bulkEcheance || undefined)
    )
    const s = done > 1 ? 's' : ''
    const phrase = kind === 'prendre' ? `prise${s} en charge` : kind === 'urgente' ? `rendue${s} urgente${s}` : `assignée${s}`
    flashHint(`${done} réclamation${s} ${phrase}.`)
    setSelected(new Set())
  }

  const total = kpiBase.length
  const aTraiter = counts.a_traiter
  const enCours = counts.en_cours
  const horsDelai = counts.hors_delai
  const accusesAEnvoyer = counts.accuse_a_envoyer
  const accusesEnRetard = kpiBase.filter((r) => isAccuseEnRetard(r)).length
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
      onMarkAccuse={() => actions.marquerAccuse(item.studentId, item.id)}
      onToggleUrgent={() => actions.basculerUrgente(item.studentId, item.id)}
      selectable={selectMode && item.statut !== 'Résolue'}
      selected={selected.has(keyOf(item))}
      onToggleSelect={() => toggleSelected(item)}
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setQueueKeys(queue.map((r) => ({ studentId: r.studentId, id: r.id })))}
            disabled={queue.length === 0}
            title={queue.length === 0 ? 'Rien en attente de tri' : 'Passer en revue les réclamations à trier, une par une'}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ListChecks className="h-4 w-4" />
            Traiter la file ({queue.length})
          </button>
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

      {(signals.length > 0 || signalFilter) && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {signals.length > 0 && (
              <button type="button" onClick={() => setSignalsOpen((v) => !v)} className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {signals.length} signal{signals.length > 1 ? 'aux' : ''} à surveiller
                {signalsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
            {signalFilter && (
              <button
                type="button"
                onClick={() => setSignalFilter(null)}
                title="Afficher toutes les réclamations"
                className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-600"
              >
                Filtre : {signalFilter.label}
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {signalsOpen && signals.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {signals.slice(0, 8).map((sg) => (
                <button
                  key={sg.key}
                  type="button"
                  onClick={() => setSignalFilter(signalFilter?.key === sg.key ? null : sg)}
                  title="Filtrer sur ce regroupement"
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    signalFilter?.key === sg.key ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  {sg.label}
                </button>
              ))}
              {signals.length > 8 && <span className="self-center text-xs text-amber-700">+ {signals.length - 8} autre(s)</span>}
            </div>
          )}
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatTile value={total} label="Total" active={quick === 'toutes'} onClick={() => pickQuick('toutes')} />
        <StatTile value={aTraiter} label="À traiter" sub={`dont ${enCours} en cours`} active={quick === 'a_traiter'} onClick={() => pickQuick('a_traiter')} />
        <StatTile
          value={accusesAEnvoyer}
          label="Accusés à envoyer"
          sub={accusesEnRetard > 0 ? `dont ${accusesEnRetard} en retard` : undefined}
          tone={accusesEnRetard > 0 ? 'danger' : accusesAEnvoyer > 0 ? 'warning' : undefined}
          active={quick === 'accuse_a_envoyer'}
          onClick={() => pickQuick('accuse_a_envoyer')}
        />
        <StatTile value={horsDelai} label="Hors délai" tone={horsDelai > 0 ? 'danger' : undefined} active={quick === 'hors_delai'} onClick={() => pickQuick('hors_delai')} />
        <StatTile value={resolues} label="Résolues" sub={`${tauxResolution} % du total`} active={quick === 'resolues'} onClick={() => pickQuick('resolues')} />
        <StatTile
          value={sousDelai === null ? '—' : `${sousDelai} %`}
          label="Dans le délai"
          sub={sousDelai === null ? 'dès les prochaines résolutions' : `sur ${delais.length} datée${delais.length > 1 ? 's' : ''}`}
        />
        <StatTile
          value={delaiMoyen === null ? '—' : `${delaiMoyen.toFixed(1).replace('.', ',')} j`}
          label="Délai moyen"
          sub={delaiMoyen === null ? 'dès les prochaines résolutions' : 'de résolution'}
        />
      </div>

      <div className="sticky top-0 z-20 -mx-6 mb-3 border-b border-slate-200/70 bg-[#f3f4f8]/95 px-6 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Affichage">
            {([
              { key: 'aujourdhui', label: "Aujourd'hui", Icon: CalendarCheck },
              { key: 'liste', label: 'Liste', Icon: List },
              { key: 'kanban', label: 'Colonnes', Icon: Columns3 },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => chooseView(key)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${view === key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {key === 'aujourdhui' && agendaCount > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] font-bold ${view === key ? 'bg-white/25' : 'bg-rose-100 text-rose-700'}`}>{agendaCount}</span>
                )}
              </button>
            ))}
          </div>
          {isEditable && view !== 'aujourdhui' && (
            <button
              type="button"
              onClick={() => (selectMode ? exitSelection() : setSelectMode(true))}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${selectMode ? 'border-indigo-400 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Sélectionner
            </button>
          )}
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher élève, parent, prof, motif..."
              className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <select
            value={categorieFilter}
            onChange={(e) => setCategorieFilter(e.target.value)}
            aria-label="Catégorie"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none"
          >
            <option value="Toutes">Toutes les catégories</option>
            {RECLAMATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {view !== 'aujourdhui' && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              aria-label="Tri"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none"
            >
              <option value="urgence">Urgence d'abord</option>
              <option value="recent">Plus récentes d'abord</option>
            </select>
          )}
        </div>
        {view !== 'aujourdhui' && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setQuick(c.key)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  quick === c.key
                    ? 'bg-indigo-600 text-white'
                    : (c.key === 'hors_delai' || c.key === 'urgentes') && counts[c.key] > 0
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : c.key === 'accuse_a_envoyer' && counts.accuse_a_envoyer > 0
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : c.key === 'a_relancer' && counts.a_relancer > 0
                          ? 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {c.label}
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${quick === c.key ? 'bg-white/25' : 'bg-slate-100'}`}>{counts[c.key]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'aujourdhui' ? (
        <ReclamationAgenda
          sections={agendaSections}
          isEditable={isEditable}
          onAccuse={(item) => openMessage(item, item, 'accuse')}
          onTakeCharge={handleTakeCharge}
          onFollowUp={(item) => openMessage(item, item, 'relance')}
          onOpen={(item) => setDrawerKey({ studentId: item.studentId, id: item.id })}
          onShowList={() => chooseView('liste')}
        />
      ) : filtered.length === 0 ? (
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
          return current ? <ReclamationDrawer reclamation={current} studentId={current.studentId} studentName={current.studentName} classe={current.classe} isEditable={isEditable} onClose={() => setDrawerKey(null)} /> : null
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

      {queueKeys && (
        <ReclamationQueueModal
          keys={queueKeys}
          items={flat}
          isEditable={isEditable}
          onAccuse={(item) => openMessage(item, item, 'accuse')}
          onMessage={(item, kind) => openMessage(item, item, kind)}
          onClose={() => setQueueKeys(null)}
        />
      )}

      {bulkAccuseKeys && <BulkAccusesModal keys={bulkAccuseKeys} items={flat} isEditable={isEditable} onClose={() => setBulkAccuseKeys(null)} />}

      {messageTarget && (
        <ReclamationMessageModal
          reclamation={messageTarget.reclamation}
          studentId={messageTarget.studentId}
          studentName={messageTarget.studentName}
          classe={messageTarget.classe}
          kind={messageTarget.kind}
          banner={messageTarget.banner}
          onShared={(kind) => {
            // L'enregistrement le plus récent : l'accusé a pu être posé depuis une autre vue entre-temps.
            const current = flat.find((r) => r.studentId === messageTarget.studentId && r.id === messageTarget.reclamation.id) ?? messageTarget.reclamation
            actions.messagePartage(messageTarget.studentId, current, kind, MESSAGE_KIND_LABELS[kind])
          }}
          onClose={() => setMessageTarget(null)}
        />
      )}

      {selectMode && view !== 'aujourdhui' && (
        <div className="sticky bottom-3 z-30 mt-4 rounded-2xl border border-indigo-200 bg-white p-3 shadow-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-indigo-700">
              {selected.size} sélectionnée{selected.size > 1 ? 's' : ''}
            </span>
            <button type="button" onClick={() => setSelected(new Set(active.map(keyOf)))} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Tout sélectionner ({active.length})
            </button>
            <button type="button" onClick={() => setSelected(new Set())} disabled={selected.size === 0} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Désélectionner
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select
                value={bulkAssignee}
                onChange={(e) => setBulkAssignee(e.target.value)}
                aria-label="Assigner à"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none"
              >
                <option value="">Assigner à…</option>
                {buildStaffOptions().map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={bulkEcheance}
                onChange={(e) => setBulkEcheance(e.target.value)}
                aria-label="Échéance"
                title="Échéance (facultative : sinon celle de chaque réclamation)"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none"
              />
              <button type="button" disabled={!bulkAssignee || bulkTargets('assigner').length === 0} onClick={() => setBulkConfirm('assigner')} className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40">
                Assigner
              </button>
              <button type="button" disabled={bulkTargets('prendre').length === 0} onClick={() => setBulkConfirm('prendre')} className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40">
                Prendre en charge
              </button>
              <button type="button" disabled={bulkTargets('urgente').length === 0} onClick={() => setBulkConfirm('urgente')} className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40">
                Rendre urgentes
              </button>
              <button
                type="button"
                disabled={selectedItems.filter((r) => isAccuseAEnvoyer(r)).length === 0}
                onClick={() => setBulkAccuseKeys(selectedItems.filter((r) => isAccuseAEnvoyer(r)).sort(urgency).map((r) => ({ studentId: r.studentId, id: r.id })))}
                className="flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <MailCheck className="h-3.5 w-3.5" />
                Accusés de réception…
              </button>
              <button type="button" onClick={exitSelection} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Terminer
              </button>
            </div>
          </div>
          {bulkConfirm && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <span className="font-semibold">
                {bulkConfirm === 'prendre' ? 'Prendre en charge' : bulkConfirm === 'urgente' ? 'Rendre urgentes' : `Assigner à ${bulkAssignee}`} {bulkTargets(bulkConfirm).length} réclamation
                {bulkTargets(bulkConfirm).length > 1 ? 's' : ''} ?
              </span>
              <button type="button" onClick={() => runBulk(bulkConfirm)} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700">
                Confirmer
              </button>
              <button type="button" onClick={() => setBulkConfirm(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">
                Annuler
              </button>
            </div>
          )}
        </div>
      )}

      {showPrint && <ReclamationsPrintPreviewModal records={filtered} onClose={() => setShowPrint(false)} />}
    </div>
  )
}

/** Indicateur compact d'une ligne ; cliquable quand il sert de filtre. */
function StatTile({
  value,
  label,
  sub,
  tone,
  active,
  onClick,
}: {
  value: string | number
  label: string
  sub?: string
  tone?: 'danger' | 'warning'
  active?: boolean
  onClick?: () => void
}) {
  const valueClass = tone === 'danger' ? 'text-rose-600' : tone === 'warning' ? 'text-amber-600' : 'text-slate-900'
  const content = (
    <>
      <p className="flex items-baseline gap-1.5">
        <span className={`text-lg font-bold leading-none ${valueClass}`}>{value}</span>
        <span className="text-[11px] font-medium leading-tight text-slate-500">{label}</span>
      </p>
      {sub && <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{sub}</p>}
    </>
  )
  const base = 'rounded-xl border bg-white px-3 py-2 text-left shadow-sm'
  if (!onClick) return <div className={`${base} border-slate-100`}>{content}</div>
  return (
    <button type="button" onClick={onClick} className={`${base} transition-colors hover:bg-slate-50 ${active ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-slate-100'}`}>
      {content}
    </button>
  )
}
