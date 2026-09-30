import { useState, useEffect } from 'react'
import { Users, GraduationCap, Clock, AlertTriangle, ChevronRight, ChevronLeft, Printer } from 'lucide-react'
import { useClasses } from '../../services/classesService'
import { CYCLES, cycleOfNiveau } from '../../data/referentiel'
import { getTeachersSnapshot } from '../../services/teachersService'
import { teacherName } from '../../data/teachers'
import type { SuiviProf } from '../../data/suiviProfs'
import {
  useSuiviProfs,
  useAddSuiviProf,
  useUpdateSuiviProfStatut,
} from '../../services/suiviProfsService'
import SuiviProfModal from '../SuiviProfModal'
import { findPPConflicts } from '../../utils/suiviProfsAggregation'
import { timeToMinutes, minutesToTime } from '../../data/classSchedules'
import { computeAtRiskStudentsForNiveaux, computeOpenReclamationsForNiveaux } from '../../utils/suiviClasseRisqueAggregation'
import { useAlertRules } from '../../services/alertRulesService'
import { useCurrentProfile } from '../../services/permissions'
import {
  useSuiviClasseActions,
  useAddSuiviClasseAction,
  useUpdateSuiviClasseActionStatut,
  useDeleteSuiviClasseAction,
} from '../../services/suiviClasseActionsService'
import SuiviClasseTimetable, { type DayColumn } from './SuiviClasseTimetable'
import SuiviClasseDrawer from './SuiviClasseDrawer'
import SuiviClassePrintPreviewModal from './SuiviClassePrintPreviewModal'
import type { PrintSuiviClasseSlot } from './PrintableSuiviClasseSchedule'
import { getWeekdayName } from '../../utils/replacementAggregation'
import { computeLogicalGroups, type LogicalGroup } from '../../utils/suiviClasseGroups'
import { hasCompteRenduContent } from '../../data/suiviCompteRendu'

export const JOUR_LABELS: Record<string, string> = {
  LUNDI: 'Lundi',
  MARDI: 'Mardi',
  MERCREDI: 'Mercredi',
  JEUDI: 'Jeudi',
  VENDREDI: 'Vendredi',
}
const SCHEDULE_DAYS_LOCAL = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']

export function weekdayLabelFromDate(iso: string): string {
  const label = new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function mondayOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(m.getDate() + diff)
  return m
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function dm(d: Date): string {
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')
}

interface SuiviClasseTabProps {
  isEditable: boolean
  onGoToReunion: (niveau: string, suiviId?: string) => void
}

export default function SuiviClasseTab({ isEditable, onGoToReunion }: SuiviClasseTabProps) {
  const { data: classes = [] } = useClasses()
  const { data: suivis = [] } = useSuiviProfs()
  const { data: actions = [] } = useSuiviClasseActions()
  const { data: alertRules } = useAlertRules()
  const profile = useCurrentProfile()
  const allTeachers = getTeachersSnapshot()

  const addMutation = useAddSuiviProf()
  const updateStatutMutation = useUpdateSuiviProfStatut()
  const addActionMutation = useAddSuiviClasseAction()
  const toggleActionMutation = useUpdateSuiviClasseActionStatut()
  const deleteActionMutation = useDeleteSuiviClasseAction()

  const [prefillTarget, setPrefillTarget] = useState<{ niveau: string; teacherIds: string[]; jour: string; heure: string } | null>(null)
  const [collapsedCycles, setCollapsedCycles] = useState<Set<string>>(new Set())
  const [weekMonday, setWeekMonday] = useState(() => mondayOfWeek(new Date()))
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'planned'>('all')
  const [showPrint, setShowPrint] = useState(false)
  const [hasAutoJumped, setHasAutoJumped] = useState(false)

  const todayIso = new Date().toISOString().slice(0, 10)
  const directionName = profile?.nomComplet || profile?.email || 'Direction de la vie scolaire'

  // "Cette semaine" (semaine ISO courante) tombe souvent hors du champ des séries déjà planifiées
  // (ex. tous les jours ouvrés déjà passés) — sans ça, le tableau semble vide alors que des niveaux
  // sont bel et bien planifiés, juste pas cette semaine précise. Ne saute qu'une fois par montage,
  // et seulement si la semaine par défaut n'a effectivement rien à montrer.
  useEffect(() => {
    if (hasAutoJumped || suivis.length === 0) return
    const weekMondayIsoNow = mondayOfWeek(weekMonday).toISOString().slice(0, 10)
    const weekFridayIsoNow = addDays(mondayOfWeek(weekMonday), 4).toISOString().slice(0, 10)
    const hasSomethingThisWeek = suivis.some((sp) => sp.statut !== 'Annulé' && sp.date >= weekMondayIsoNow && sp.date <= weekFridayIsoNow)
    if (!hasSomethingThisWeek) {
      const earliest = suivis.filter((sp) => sp.statut !== 'Annulé' && sp.date >= todayIso).sort((a, b) => (a.date < b.date ? -1 : 1))[0]
      if (earliest) setWeekMonday(mondayOfWeek(new Date(earliest.date + 'T00:00:00')))
    }
    setHasAutoJumped(true)
  }, [suivis, hasAutoJumped, todayIso, weekMonday])

  const logicalGroups: LogicalGroup[] = computeLogicalGroups(classes, allTeachers)

  const weekMondayIso = toISO(weekMonday)
  const weekFridayIso = toISO(addDays(weekMonday, 4))
  const weekEnd = addDays(weekMonday, 4)

  const weekSuiviFor = (g: LogicalGroup): SuiviProf | undefined =>
    suivis.find((sp) => sp.niveau === g.key && sp.statut !== 'Annulé' && sp.date >= weekMondayIso && sp.date <= weekFridayIso)

  const upcomingFor = (g: LogicalGroup): SuiviProf[] =>
    suivis.filter((sp) => sp.niveau === g.key && sp.statut !== 'Annulé' && sp.date >= todayIso).sort((a, b) => (a.date < b.date ? -1 : 1))

  // Créneau hebdomadaire habituel par groupe, pour affichage/impression type "emploi du temps" —
  // uniquement les niveaux réellement planifiés (une série existe), jamais un créneau juste
  // suggéré : un document affiché au bureau doit refléter ce qui est confirmé, pas une hypothèse.
  const printSlots: PrintSuiviClasseSlot[] = logicalGroups
    .map((g): PrintSuiviClasseSlot | null => {
      const upcoming = upcomingFor(g)
      if (upcoming.length === 0) return null
      const jour = getWeekdayName(upcoming[0].date)
      if (!jour) return null
      return { key: g.key, label: g.label, color: g.color, jour, start: upcoming[0].heure, duree: upcoming[0].duree, ppNames: g.teachers.map(teacherName).join(', ') }
    })
    .filter((s): s is PrintSuiviClasseSlot => !!s)

  // Conflits PP réels sur le créneau déjà retenu cette semaine (le suivi ne se compare jamais à
  // lui-même grâce à excludeSuiviId) — et chevauchements entre groupes le même jour à la même heure.
  const weekMeetings = logicalGroups.map((g) => ({ group: g, suivi: weekSuiviFor(g) })).filter((m): m is { group: LogicalGroup; suivi: SuiviProf } => !!m.suivi)

  const ppConflictsByGroup = new Map<string, ReturnType<typeof findPPConflicts>>()
  weekMeetings.forEach(({ group, suivi }) => {
    const conflicts = findPPConflicts(group.teachers, suivi.date, suivi.heure, suivi.duree, suivi.id)
    if (conflicts.length > 0) ppConflictsByGroup.set(group.key, conflicts)
  })

  const overlapAlerts: { title: string; text: string; onOpen: () => void }[] = []
  SCHEDULE_DAYS_LOCAL.forEach((jour) => {
    const dayMeetings = weekMeetings.filter(({ suivi }) => weekdayLabelFromDate(suivi.date).toUpperCase() === (JOUR_LABELS[jour] ?? '').toUpperCase())
    // Regroupe par chevauchement réel d'intervalle (pas seulement même heure exacte).
    const clusters: { group: LogicalGroup; suivi: SuiviProf }[][] = []
    dayMeetings
      .slice()
      .sort((a, b) => a.suivi.heure.localeCompare(b.suivi.heure))
      .forEach((m) => {
        const mStart = timeToMinutes(m.suivi.heure)
        const mEnd = mStart + m.suivi.duree
        const cluster = clusters.find((c) =>
          c.some((o) => {
            const oStart = timeToMinutes(o.suivi.heure)
            const oEnd = oStart + o.suivi.duree
            return oStart < mEnd && oEnd > mStart
          })
        )
        if (cluster) cluster.push(m)
        else clusters.push([m])
      })
    clusters
      .filter((c) => c.length > 1)
      .forEach((c) => {
        const names = c.map((m) => m.group.label).join(', ')
        overlapAlerts.push({
          title: `${JOUR_LABELS[jour]} ${c[0].suivi.heure} :`,
          text: `${names} au même créneau.`,
          onOpen: () => setSelectedKey(c[0].group.key),
        })
      })
  })
  const ppAlerts = weekMeetings
    .filter(({ group }) => ppConflictsByGroup.has(group.key))
    .map(({ group }) => {
      const conflicts = ppConflictsByGroup.get(group.key)!
      return {
        title: `${group.label} — PP indisponible :`,
        text: conflicts.map((c) => `${c.teacherName} a un autre engagement ${c.busyStart}–${c.busyEnd}`).join(', ') + '.',
        onOpen: () => setSelectedKey(group.key),
      }
    })
  const alerts = [...overlapAlerts, ...ppAlerts]

  // KPI réels.
  const weekCount = weekMeetings.length
  const riskByGroup = new Map<string, ReturnType<typeof computeAtRiskStudentsForNiveaux>>()
  if (alertRules) {
    logicalGroups.forEach((g) => riskByGroup.set(g.key, computeAtRiskStudentsForNiveaux(g.niveauxBruts, alertRules)))
  }
  const riskTotal = Array.from(riskByGroup.values()).reduce((n, list) => n + list.length, 0)
  const reclamationsByGroup = new Map<string, ReturnType<typeof computeOpenReclamationsForNiveaux>>()
  logicalGroups.forEach((g) => reclamationsByGroup.set(g.key, computeOpenReclamationsForNiveaux(g.niveauxBruts)))
  const actionsEnCours = actions.filter((a) => a.statut !== 'faite').length
  const conflictGroupKeys = new Set<string>()
  weekMeetings.forEach(({ group }) => {
    if (ppConflictsByGroup.has(group.key)) conflictGroupKeys.add(group.key)
  })
  overlapAlerts.forEach(() => {
    /* déjà couvert visuellement par le bandeau ; on compte les groupes distincts en conflit ci-dessous */
  })
  SCHEDULE_DAYS_LOCAL.forEach((jour) => {
    const dayMeetings = weekMeetings.filter(({ suivi }) => weekdayLabelFromDate(suivi.date).toUpperCase() === (JOUR_LABELS[jour] ?? '').toUpperCase())
    dayMeetings.forEach((m, i) => {
      const mStart = timeToMinutes(m.suivi.heure)
      const mEnd = mStart + m.suivi.duree
      dayMeetings.forEach((o, j) => {
        if (i === j) return
        const oStart = timeToMinutes(o.suivi.heure)
        const oEnd = oStart + o.suivi.duree
        if (oStart < mEnd && oEnd > mStart) conflictGroupKeys.add(m.group.key)
      })
    })
  })
  const confCount = conflictGroupKeys.size

  const visibleGroups = logicalGroups.filter((g) => {
    if (statusFilter === 'all') return true
    const hasMeeting = !!weekSuiviFor(g)
    return statusFilter === 'todo' ? !hasMeeting : hasMeeting
  })

  const groupsByCycle = CYCLES.map((cycle) => ({ cycle, rows: visibleGroups.filter((g) => g.niveauxBruts.every((n) => cycleOfNiveau(n)?.key === cycle.key)) })).filter(
    (c) => c.rows.length > 0
  )

  const toggleCycle = (key: string) => {
    setCollapsedCycles((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleAdd = (dataList: { teacherIds: string[]; date: string; heure: string; duree: number; lieu: string; motif: string; notes: string; niveau?: string }[]) => {
    dataList.forEach((data) => addMutation.mutate(data))
    // La série démarre souvent la semaine suivante (le jour choisi cette semaine-ci est déjà
    // passé) — sans ça, le suivi qu'on vient de créer semble ne "pas apparaître" dans le tableau.
    const first = dataList[0]
    if (first) {
      setWeekMonday(mondayOfWeek(new Date(first.date + 'T00:00:00')))
      if (first.niveau) setSelectedKey(first.niveau)
    }
    setPrefillTarget(null)
  }

  // Annuler ne doit pas laisser le niveau coincé en "Planifié" avec seulement la séance de cette
  // semaine retirée — ça annule donc toutes les occurrences à venir de la série, pas seulement
  // celle actuellement affichée, pour que le niveau redevienne "À planifier" et soit replanifiable.
  const cancelSeries = (niveau: string) => {
    suivis.filter((sp) => sp.niveau === niveau && sp.statut !== 'Annulé' && sp.date >= todayIso).forEach((sp) => updateStatutMutation.mutate({ id: sp.id, statut: 'Annulé' }))
  }

  // Colonnes du tableau hebdomadaire (5 jours), une carte par groupe ayant un suivi cette semaine.
  // Échelle verticale dynamique (reprend le principe du handoff design) : seules les heures qui
  // contiennent réellement un suivi (planifié cette semaine, ou suggéré si rien n'est encore
  // planifié) reçoivent une hauteur lisible — les heures creuses se compressent, pour éviter
  // d'afficher une grille 07h30-18h00 quasi vide.
  const DAY_MIN = 7 * 60 + 30
  const DAY_MAX = 18 * 60
  const BUSY_PX = 60
  const IDLE_PX = 14

  const candidateTimes: number[] = []
  logicalGroups.forEach((g) => {
    if (g.suggestion) candidateTimes.push(timeToMinutes(g.suggestion.start), timeToMinutes(g.suggestion.start) + 30)
  })
  weekMeetings.forEach(({ suivi }) => candidateTimes.push(timeToMinutes(suivi.heure), timeToMinutes(suivi.heure) + suivi.duree))

  const H0 = candidateTimes.length ? Math.max(DAY_MIN, Math.floor(Math.min(...candidateTimes) / 60) * 60) : 8 * 60
  const H1 = candidateTimes.length ? Math.min(DAY_MAX, Math.ceil(Math.max(...candidateTimes) / 60) * 60) : 12 * 60

  const segCount = Math.max(1, (H1 - H0) / 60)
  const segs: number[] = []
  for (let t = H0, i = 0; i < segCount; t += 60, i++) {
    const busy = weekMeetings.some(({ suivi }) => timeToMinutes(suivi.heure) < t + 60 && timeToMinutes(suivi.heure) + suivi.duree > t)
    segs.push(busy ? BUSY_PX : IDLE_PX)
  }
  const Y = (t: number): number => {
    let y = 0
    for (let i = 0, s = H0; s < t && i < segs.length; s += 60, i++) y += segs[i] * Math.min(1, (t - s) / 60)
    return y
  }

  const days: DayColumn[] = SCHEDULE_DAYS_LOCAL.map((jour, di) => {
    const date = addDays(weekMonday, di)
    const dayMeetings = weekMeetings.filter(({ suivi }) => weekdayLabelFromDate(suivi.date).toUpperCase() === (JOUR_LABELS[jour] ?? '').toUpperCase())
    const clusters: { group: LogicalGroup; suivi: SuiviProf }[][] = []
    dayMeetings
      .slice()
      .sort((a, b) => a.suivi.heure.localeCompare(b.suivi.heure))
      .forEach((m) => {
        const mStart = timeToMinutes(m.suivi.heure)
        const mEnd = mStart + m.suivi.duree
        const cluster = clusters.find((c) =>
          c.some((o) => {
            const oStart = timeToMinutes(o.suivi.heure)
            const oEnd = oStart + o.suivi.duree
            return oStart < mEnd && oEnd > mStart
          })
        )
        if (cluster) cluster.push(m)
        else clusters.push([m])
      })
    const cards: DayColumn['cards'] = []
    clusters.forEach((cluster) => {
      if (cluster.length > 2) {
        const starts = cluster.map((m) => timeToMinutes(m.suivi.heure))
        const ends = cluster.map((m) => timeToMinutes(m.suivi.heure) + m.suivi.duree)
        const s = Math.min(...starts),
          e = Math.max(...ends)
        cards.push({
          kind: 'group',
          top: Y(s),
          height: Math.max(Y(e) - Y(s), 58),
          chips: cluster.map((m) => ({ key: m.group.key, label: m.group.label, color: m.group.color, onOpen: () => setSelectedKey(m.group.key) })),
        })
        return
      }
      cluster.forEach((m, i) => {
        const s = timeToMinutes(m.suivi.heure)
        const e = s + m.suivi.duree
        cards.push({
          kind: 'single',
          key: m.group.key,
          label: m.group.label,
          color: m.group.color,
          time: `${m.suivi.heure}–${minutesToTime(e)}`,
          ppNames: m.group.teachers.map(teacherName).join(', '),
          statut: m.suivi.statut,
          hasConflict: ppConflictsByGroup.has(m.group.key),
          top: Y(s),
          height: Math.max(Y(e) - Y(s), 26),
          left: `calc(${(i * 100) / cluster.length}% + 2px)`,
          width: `calc(${100 / cluster.length}% - 4px)`,
          selected: selectedKey === m.group.key,
          onOpen: () => setSelectedKey(m.group.key),
        })
      })
    })
    return { key: jour, label: JOUR_LABELS[jour].toUpperCase(), dateLabel: dm(date), count: dayMeetings.length, cards }
  })

  // Toujours étiqueter chaque heure (même repliée à IDLE_PX) — sans quoi une semaine sans aucun
  // suivi planifié affiche une grille vide sans aucun repère, qui ressemble à un bug plutôt qu'à un
  // état compact légitime.
  const hourMarks: { label: string; top: number }[] = []
  for (let t = H0; t <= H1; t += 60) hourMarks.push({ label: String(Math.floor(t / 60)).padStart(2, '0') + ':00', top: Y(t) })
  const gridHeight = Y(H1)

  const selectedGroup = logicalGroups.find((g) => g.key === selectedKey)
  const selectedWeekSuivi = selectedGroup ? weekSuiviFor(selectedGroup) : undefined
  const selectedActions = actions.filter((a) => a.niveau === selectedKey)
  const selectedRisks = selectedKey ? riskByGroup.get(selectedKey) ?? [] : []
  const selectedReclamations = selectedKey ? reclamationsByGroup.get(selectedKey) ?? [] : []

  return (
    <>
      <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Réunion hebdomadaire de suivi par niveau (avancement des élèves), avec le ou les Professeurs Principaux des classes concernées — CE1-A et CE1-B, par exemple, partagent une seule
          réunion commune, et tout le collège (1APIC/2APIC/3APIC) n'en forme qu'une seule.
        </p>
      </div>

      {logicalGroups.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">Aucune classe active.</div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
              <button type="button" onClick={() => setWeekMonday((w) => addDays(w, -7))} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-1.5 text-sm font-semibold text-slate-700">
                Semaine du {dm(weekMonday)} au {dm(weekEnd)}
              </span>
              <button type="button" onClick={() => setWeekMonday((w) => addDays(w, 7))} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setWeekMonday(mondayOfWeek(new Date()))}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            >
              Cette semaine
            </button>
            <div className="ml-auto flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  ['all', 'Tous'],
                  ['todo', 'À planifier'],
                  ['planned', 'Planifiés'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setStatusFilter(k)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${statusFilter === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowPrint(true)}
              disabled={printSlots.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer className="h-3.5 w-3.5" />
              Télécharger
            </button>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50">
                <Clock className="h-4.5 w-4.5 text-violet-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">
                  {weekCount}
                  <span className="text-sm font-medium text-slate-400"> / {logicalGroups.length}</span>
                </p>
                <p className="text-xs text-slate-500">Suivis prévus cette semaine</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50">
                <AlertTriangle className="h-4.5 w-4.5 text-rose-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{riskTotal}</p>
                <p className="text-xs text-slate-500">Élèves à risque signalés</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                <GraduationCap className="h-4.5 w-4.5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{actionsEnCours}</p>
                <p className="text-xs text-slate-500">Actions en cours</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${confCount ? 'bg-orange-50' : 'bg-slate-100'}`}>
                <Users className={`h-4.5 w-4.5 ${confCount ? 'text-orange-500' : 'text-slate-400'}`} />
              </div>
              <div>
                <p className={`text-xl font-bold ${confCount ? 'text-orange-600' : 'text-slate-900'}`}>{confCount}</p>
                <p className="text-xs text-slate-500">Créneaux en conflit</p>
              </div>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="mb-5 flex flex-col gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-3 text-sm text-orange-800">
              {alerts.map((al, i) => (
                <div key={i} className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">
                    <b>{al.title}</b> {al.text}
                  </span>
                  <button type="button" onClick={al.onOpen} className="rounded-md border border-orange-300 bg-white px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50">
                    Voir
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative mb-6">
            <SuiviClasseTimetable days={days} hourMarks={hourMarks} gridHeight={gridHeight} />
            {selectedGroup && (
              <SuiviClasseDrawer
                group={selectedGroup}
                weekSuivi={selectedWeekSuivi}
                directionName={directionName}
                riskStudents={selectedRisks}
                reclamations={selectedReclamations}
                actions={selectedActions}
                isEditable={isEditable}
                onClose={() => setSelectedKey(null)}
                onGoToReunion={() => onGoToReunion(selectedGroup.key, selectedWeekSuivi?.id)}
                onCancel={() => cancelSeries(selectedGroup.key)}
                onAddAction={(input) => addActionMutation.mutate({ niveau: selectedGroup.key, ...input })}
                onToggleAction={(id, statut) => toggleActionMutation.mutate({ id, statut })}
                onDeleteAction={(id) => deleteActionMutation.mutate(id)}
              />
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-slate-900">Planification par niveau</span>
              <span className="text-sm text-slate-500">Cliquez un niveau pour ouvrir son détail.</span>
            </div>
            {groupsByCycle.map(({ cycle, rows: cycleRows }) => {
              const collapsed = collapsedCycles.has(cycle.key)
              return (
                <div key={cycle.key} className="mb-2">
                  <button
                    type="button"
                    onClick={() => toggleCycle(cycle.key)}
                    className="mb-2 flex w-full items-center gap-1.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                  >
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
                    {cycle.label}
                    <span className="font-normal normal-case text-slate-400">({cycleRows.length})</span>
                  </button>

                  {!collapsed && (
                    <div className="space-y-2.5">
                      {cycleRows.map((g) => {
                        const missing = g.divisions.filter((d) => !d.pp).map((d) => d.classe.nom)
                        const thisWeek = weekSuiviFor(g)
                        const upcoming = upcomingFor(g)
                        const isPlanned = upcoming.length > 0
                        const borderClass = !g.allHavePP ? 'border-amber-200' : isPlanned ? 'border-emerald-200' : 'border-slate-100'
                        return (
                          <div key={g.key} className={`rounded-2xl border bg-white p-4 shadow-sm ${borderClass}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div onClick={() => setSelectedKey(g.key)} className="min-w-[220px] flex-1 cursor-pointer">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-sm" style={{ background: g.color }} />
                                  <span className="text-base font-bold text-slate-900">{g.label}</span>
                                  {!g.allHavePP ? (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">PP incomplet</span>
                                  ) : isPlanned ? (
                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">Planifié</span>
                                  ) : (
                                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">À planifier</span>
                                  )}
                                  {ppConflictsByGroup.has(g.key) && (
                                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-600">⚠ Conflit</span>
                                  )}
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {g.divisions.map((d) => (
                                    <span
                                      key={d.classe.id}
                                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                        d.pp ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-amber-200 bg-amber-50 text-amber-600'
                                      }`}
                                    >
                                      {d.classe.nom} · {d.pp ? teacherName(d.pp) : 'PP manquant'}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="text-right">
                                {!g.allHavePP ? (
                                  <p className="flex items-center gap-1.5 text-xs text-amber-600">
                                    <AlertTriangle className="h-3.5 w-3.5" />À désigner dans Classes : {missing.join(', ')}
                                  </p>
                                ) : isPlanned ? (
                                  <>
                                    <p className="flex items-center justify-end gap-1.5 text-sm font-semibold text-emerald-600">
                                      <Clock className="h-3.5 w-3.5" />
                                      Tous les {weekdayLabelFromDate(upcoming[0].date).toLowerCase()}s à {upcoming[0].heure}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      Prochaine séance : {new Date(upcoming[0].date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} · {upcoming.length} restante
                                      {upcoming.length > 1 ? 's' : ''}
                                    </p>
                                    <div className="mt-1.5 flex justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => cancelSeries(g.key)}
                                        disabled={!isEditable}
                                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        Annuler
                                      </button>
                                      {thisWeek && (
                                        <button
                                          type="button"
                                          onClick={() => onGoToReunion(g.key, thisWeek.id)}
                                          disabled={!isEditable}
                                          className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          {hasCompteRenduContent(thisWeek.compteRendu) ? 'Modifier le C.R.' : 'Compte-rendu'}
                                        </button>
                                      )}
                                    </div>
                                  </>
                                ) : g.suggestion ? (
                                  <>
                                    <p className="flex items-center justify-end gap-1.5 text-sm font-semibold text-indigo-600">
                                      <Clock className="h-3.5 w-3.5" />
                                      {JOUR_LABELS[g.suggestion.jour]} {g.suggestion.start}–{g.suggestion.end}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!g.suggestion) return
                                        setPrefillTarget({ niveau: g.key, teacherIds: g.teachers.map((t) => t.id), jour: g.suggestion.jour, heure: g.suggestion.start })
                                      }}
                                      disabled={!isEditable}
                                      className="mt-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Planifier
                                    </button>
                                  </>
                                ) : (
                                  <p className="text-xs text-slate-400">Aucun créneau commun libre cette semaine</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {prefillTarget && (
        <SuiviProfModal
          onClose={() => setPrefillTarget(null)}
          onSubmit={handleAdd}
          prefillRecurrent={{
            teacherIds: prefillTarget.teacherIds,
            jourSemaine: prefillTarget.jour,
            heure: prefillTarget.heure,
            duree: 30,
            motif: `Suivi hebdomadaire du niveau ${prefillTarget.niveau} — avancement des élèves`,
            niveau: prefillTarget.niveau,
          }}
        />
      )}

      {showPrint && <SuiviClassePrintPreviewModal slots={printSlots} onClose={() => setShowPrint(false)} />}
    </>
  )
}
