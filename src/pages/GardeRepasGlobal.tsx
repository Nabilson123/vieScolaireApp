import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  UtensilsCrossed,
  Eye,
  Lock,
  Unlock,
  Zap,
  Snowflake,
  CircleAlert,
  ShieldCheck,
  FileSpreadsheet,
  Search,
  RotateCcw,
  Clock,
  LayoutGrid,
  List,
  ClipboardList,
  Settings,
} from 'lucide-react'
import CapaciteField from '../components/CapaciteField'
import { useServicesCapacite, useUpdateServicesCapacite } from '../services/servicesCapaciteService'
import { initials, getClassOptions, type Student } from '../data/students'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import {
  getEnrolledStudents,
  computeCantineStats,
  computeRegimeBreakdown,
  computeBesoinsParClasse,
  isPointedToday,
  isPastThreshold,
  addPointage,
  flattenFluxRows,
  refectoireForClasse,
  REFECTOIRE_LABELS,
} from '../utils/cantineAggregation'
import { formatPeriodLabel } from '../utils/period'
import { downloadCSV } from '../utils/csvExport'
import PointageModal from '../components/cantine/PointageModal'
import CantinePrintPreviewModal from '../components/cantine-print/CantinePrintPreviewModal'
import type { CantineReportVariant } from '../components/cantine-print/PrintableCantineReport'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

interface GardeRepasGlobalProps {
  onNavigateToStudent: (id: string, tab?: string) => void
  onDataChanged?: () => void
}

type QuickFilter = 'tous' | 'autorise' | 'maintien' | 'besoin' | 'pai'
type PageTab = 'registre' | 'services'

const PAGE_TABS: { key: PageTab; label: string; icon: typeof ClipboardList }[] = [
  { key: 'registre', label: 'Registre', icon: ClipboardList },
  { key: 'services', label: 'Capacité Cantine', icon: Settings },
]

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  active,
  color,
  onClick,
}: {
  icon: typeof Lock
  label: string
  value: string
  sub: string
  active: boolean
  color: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start justify-between gap-2 rounded-2xl border p-4 text-left shadow-sm ${
        active ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-100 bg-white hover:bg-slate-50'
      }`}
    >
      <div>
        <p className="mb-1 text-[11px] font-semibold text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
      </div>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
    </button>
  )
}

export default function GardeRepasGlobal({ onNavigateToStudent, onDataChanged }: GardeRepasGlobalProps) {
  const queryClient = useQueryClient()
  const profile = useCurrentProfile()
  const canEdit = getModuleAccess(profile, 'lunch').canEdit
  const { data: capacite } = useServicesCapacite()
  const updateCapacite = useUpdateServicesCapacite()
  const [pageTab, setPageTab] = useState<PageTab>('registre')
  const [, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((k) => k + 1)

  const [search, setSearch] = useState('')
  const [classe, setClasse] = useState('Toutes les classes')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('tous')
  const [groupByClasse, setGroupByClasse] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [seuil, setSeuil] = useState('12:30')
  const [pointageTarget, setPointageTarget] = useState<Student | null>(null)
  const [printVariant, setPrintVariant] = useState<CantineReportVariant | null>(null)

  const enrolled = getEnrolledStudents()
  const stats = computeCantineStats(enrolled)
  const regime = computeRegimeBreakdown(enrolled)
  const besoinsParClasse = computeBesoinsParClasse(enrolled)
  const pastThreshold = isPastThreshold(seuil)
  const nonPointes = enrolled.filter((s) => !isPointedToday(getStudentExtraSnapshot(s.id).cantine))

  const q = search.toLowerCase()
  const filtered = enrolled.filter((s) => {
    const c = getStudentExtraSnapshot(s.id).cantine
    if (classe !== 'Toutes les classes' && s.classe !== classe) return false
    if (q && !s.name.toLowerCase().includes(q)) return false
    if (quickFilter === 'autorise' && c.interdictionSortie) return false
    if (quickFilter === 'maintien' && !c.interdictionSortie) return false
    if (quickFilter === 'besoin' && !(c.rechauffage || c.conservation)) return false
    if (quickFilter === 'pai' && !c.alertePAI) return false
    return true
  })

  const groupedByClasse = groupByClasse
    ? filtered.reduce<Record<string, Student[]>>((acc, s) => {
        acc[s.classe] = [...(acc[s.classe] ?? []), s]
        return acc
      }, {})
    : null

  const toggleQuickFilter = (f: QuickFilter) => setQuickFilter((prev) => (prev === f ? 'tous' : f))

  const handlePointageSubmit = async (arrivee: string, sortie: string, surveillant: string) => {
    if (!pointageTarget) return
    await addPointage(pointageTarget.id, arrivee, sortie, surveillant)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setPointageTarget(null)
    refresh()
  }

  const handleExportRegistre = () => {
    const rows = flattenFluxRows(filtered, periodStart, periodEnd)
    downloadCSV(
      `registre-garde-repas-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Élève', 'Classe', 'Arrivée', 'Sortie / Maintien', 'Surveillant'],
      rows.map((r) => [r.date, r.studentName, r.classe, r.arrivee, r.sortie, r.surveillant])
    )
  }

  const printRows = (variant: CantineReportVariant) =>
    (variant === 'securite' ? filtered.filter((s) => getStudentExtraSnapshot(s.id).cantine.interdictionSortie) : filtered.filter((s) => getStudentExtraSnapshot(s.id).cantine.alertePAI)).map(
      (s) => ({ student: s, cantine: getStudentExtraSnapshot(s.id).cantine })
    )

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 p-5 text-white shadow-sm">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <UtensilsCrossed className="h-5 w-5" />
            Garde Repas & Contrôle des Sorties du Midi
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-white/80">Tableau de bord analytique, gestion de la pause déjeuner & sécurité au portail.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPrintVariant('securite')}
            className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/25"
          >
            <ShieldCheck className="h-4 w-4" />
            Fiche Sécurité Portail
          </button>
          <button
            type="button"
            onClick={handleExportRegistre}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-orange-600 hover:bg-white/90"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel Global
          </button>
        </div>
      </div>

      {!canEdit && <NoEditAccessBanner />}

      <div className="mb-5 inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {PAGE_TABS.map((t) => {
          const Icon = t.icon
          const isActive = pageTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setPageTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {pageTab === 'services' && (
        <div className="max-w-xl rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="mb-5 text-sm text-slate-500">
            Nombre de places disponibles dans chaque réfectoire — utilisé pour calculer le taux d'occupation affiché dans les Rapports BI.
            Le Réfectoire Sous-Sol sert la maternelle et les CE1/CE2 ; le Réfectoire Terrasse sert les élèves de CE3 à 3APIC.
            La capacité Cantine Préscolaire isole la part maternelle (PS/MS/GS) du Réfectoire Sous-Sol.
          </p>
          <fieldset disabled={!canEdit} className="contents space-y-4">
            {capacite && (
              <>
                <CapaciteField
                  icon={UtensilsCrossed}
                  iconColor="text-amber-500"
                  label="Capacité Réfectoire Sous-Sol"
                  value={capacite.cantineCapaciteSousSol}
                  onChange={(cantineCapaciteSousSol) => {
                    updateCapacite.mutate({ id: capacite.id, cantineCapaciteSousSol })
                    onDataChanged?.()
                  }}
                />
                <CapaciteField
                  icon={UtensilsCrossed}
                  iconColor="text-orange-500"
                  label="Capacité Réfectoire Terrasse"
                  value={capacite.cantineCapaciteTerrasse}
                  onChange={(cantineCapaciteTerrasse) => {
                    updateCapacite.mutate({ id: capacite.id, cantineCapaciteTerrasse })
                    onDataChanged?.()
                  }}
                />
                <CapaciteField
                  icon={UtensilsCrossed}
                  iconColor="text-pink-500"
                  label="Capacité Cantine Préscolaire (PS/MS/GS)"
                  value={capacite.cantineCapacitePrescolaire}
                  onChange={(cantineCapacitePrescolaire) => {
                    updateCapacite.mutate({ id: capacite.id, cantineCapacitePrescolaire })
                    onDataChanged?.()
                  }}
                />
              </>
            )}
          </fieldset>
        </div>
      )}

      {pageTab === 'registre' && (
        <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          icon={UtensilsCrossed}
          label="Inscrits Garde Repas"
          value={String(stats.inscrits)}
          sub="Effectif inscrit"
          active={quickFilter === 'tous'}
          color="bg-slate-100 text-slate-500"
          onClick={() => setQuickFilter('tous')}
        />
        <KpiCard
          icon={Unlock}
          label="Autorisés Sortie (Midi)"
          value={String(stats.autorisesSortie)}
          sub="Sortie autorisée après repas"
          active={quickFilter === 'autorise'}
          color="bg-emerald-50 text-emerald-500"
          onClick={() => toggleQuickFilter('autorise')}
        />
        <KpiCard
          icon={Lock}
          label="Maintien Obligatoire"
          value={String(stats.maintienObligatoire)}
          sub="Interdiction de sortir"
          active={quickFilter === 'maintien'}
          color="bg-rose-50 text-rose-500"
          onClick={() => toggleQuickFilter('maintien')}
        />
        <KpiCard
          icon={Zap}
          label="Besoin Micro-ondes / Frigo"
          value={String(stats.besoinMicroOndes)}
          sub="Avec conservation frigo"
          active={quickFilter === 'besoin'}
          color="bg-amber-50 text-amber-500"
          onClick={() => toggleQuickFilter('besoin')}
        />
        <KpiCard
          icon={CircleAlert}
          label="Alertes PAI / Allergies"
          value={String(stats.alertesPAI)}
          sub="Surveillance réfectoire requise"
          active={quickFilter === 'pai'}
          color="bg-rose-50 text-rose-500"
          onClick={() => toggleQuickFilter('pai')}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Répartition Régimes de Sortie</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Sortie Seul(e) (Accord signé)</span>
              <span className="font-semibold text-emerald-600">{regime.seul}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${stats.inscrits ? (regime.seul / stats.inscrits) * 100 : 0}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Sortie Accompagnée</span>
              <span className="font-semibold text-sky-600">{regime.accompagne}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-sky-500" style={{ width: `${stats.inscrits ? (regime.accompagne / stats.inscrits) * 100 : 0}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Maintien sur place (Interdiction)</span>
              <span className="font-semibold text-rose-600">{regime.maintien}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-rose-500" style={{ width: `${stats.inscrits ? (regime.maintien / stats.inscrits) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Besoins Logistiques par Classe</h3>
          {besoinsParClasse.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Aucune donnée.</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1 text-xs">
              {besoinsParClasse.map((row) => (
                <div key={row.classe} className="flex items-center justify-between rounded-lg bg-slate-50/60 px-2.5 py-1.5">
                  <span className="font-medium text-slate-700">Classe {row.classe}</span>
                  <span className="flex items-center gap-2 text-slate-500">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-orange-500" />
                      {row.microOndes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Snowflake className="h-3 w-3 text-sky-500" />
                      {row.frigo}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Alertes & Conformité</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-rose-50/60 px-2.5 py-1.5">
              <span className="text-rose-600">Sans décharge parentale signée</span>
              <span className="font-bold text-rose-600">{stats.sansDecharge}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50/60 px-2.5 py-1.5">
              <span className="text-amber-600">Non pointés aujourd'hui{pastThreshold ? ` (après ${seuil})` : ''}</span>
              <span className="font-bold text-amber-600">{nonPointes.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Centre d'Exportation de Rapports & Filtres Multicritères</h3>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un élève..."
              className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <select
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            {getClassOptions().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            Seuil pointage :
          </span>
          <input
            type="time"
            value={seuil}
            onChange={(e) => setSeuil(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setGroupByClasse((v) => !v)}
            title={groupByClasse ? 'Vue liste' : 'Vue groupée par classe'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            {groupByClasse ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-400">Période des exports : {formatPeriodLabel(periodStart, periodEnd)}</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setPrintVariant('securite')}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
          >
            <ShieldCheck className="h-4 w-4" />
            Imprimer Fiche Portail (PDF)
          </button>
          <button
            type="button"
            onClick={() => setPrintVariant('refectoire')}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-rose-500"
          >
            <CircleAlert className="h-4 w-4" />
            Imprimer Surveillance Cantine (PDF)
          </button>
          <button
            type="button"
            onClick={handleExportRegistre}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exporter Registre (Excel)
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-slate-800">Registre des Élèves ({filtered.length} résultats filtrés)</h3>
          <p className="text-xs text-slate-400">Consultez les autorisations de sortie et les besoins logistiques en temps réel.</p>
        </div>

        {groupedByClasse
          ? Object.entries(groupedByClasse)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([cls, list]) => (
                <div key={cls}>
                  <div className="bg-slate-50/60 px-6 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Classe {cls} ({list.length})
                  </div>
                  <RegistreTable
                    rows={list}
                    onNavigateToStudent={onNavigateToStudent}
                    onPointer={setPointageTarget}
                    canEdit={canEdit}
                  />
                </div>
              ))
          : filtered.length === 0
            ? <p className="py-10 text-center text-sm text-slate-400">Aucun élève ne correspond aux filtres sélectionnés.</p>
            : <RegistreTable rows={filtered} onNavigateToStudent={onNavigateToStudent} onPointer={setPointageTarget} canEdit={canEdit} />}
      </div>

      {pointageTarget && (
        <PointageModal studentName={pointageTarget.name} onClose={() => setPointageTarget(null)} onSubmit={handlePointageSubmit} />
      )}

      {printVariant && (
        <CantinePrintPreviewModal
          title={printVariant === 'securite' ? 'Fiche Sécurité Portail' : 'Surveillance Réfectoire & Allergies'}
          subtitle={formatPeriodLabel(periodStart, periodEnd)}
          variant={printVariant}
          rows={printRows(printVariant)}
          onClose={() => setPrintVariant(null)}
        />
      )}
        </>
      )}
    </div>
  )
}

function RegistreTable({
  rows,
  onNavigateToStudent,
  onPointer,
  canEdit,
}: {
  rows: Student[]
  onNavigateToStudent: (id: string, tab?: string) => void
  onPointer: (s: Student) => void
  canEdit: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left">
        <thead>
          <tr className="border-b border-slate-100">
            {['ÉLÈVE', 'CLASSE', 'RÉFECTOIRE', 'AUTORISATION SORTIE (MIDI)', 'DÉCHARGE PARENTALE', 'BESOINS LOGISTIQUES', 'ALERTE PAI', 'ACTION'].map((col) => (
              <th key={col} className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((student) => {
            const c = getStudentExtraSnapshot(student.id).cantine
            const pointed = isPointedToday(c)
            return (
              <tr key={student.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
                      {initials(student.name)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                      {!pointed && <p className="text-[10px] font-semibold text-amber-500">Non pointé aujourd'hui</p>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-sm text-slate-600">{student.classe}</td>
                <td className="px-6 py-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {REFECTOIRE_LABELS[refectoireForClasse(student.classe)]}
                  </span>
                </td>
                <td className="px-6 py-3">
                  {c.interdictionSortie ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600">
                      <Lock className="h-3 w-3" />
                      Interdiction de sortir
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
                      <Unlock className="h-3 w-3" />
                      {c.modaliteSortie}
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-xs">
                  {c.dechargeSignee ? (
                    <span className="text-emerald-600">Signée ({c.dechargeDate})</span>
                  ) : (
                    <span className="font-semibold text-rose-600">Non signée</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {c.rechauffage && (
                      <span className="flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5 text-orange-500" /> Micro-ondes
                      </span>
                    )}
                    {c.conservation && (
                      <span className="flex items-center gap-1">
                        <Snowflake className="h-3.5 w-3.5 text-sky-500" /> Frigo
                      </span>
                    )}
                    {!c.rechauffage && !c.conservation && <span className="text-slate-300">Aucun</span>}
                  </div>
                </td>
                <td className="px-6 py-3 text-xs">
                  {c.alertePAI ? (
                    <span className="flex max-w-[160px] items-center gap-1 truncate text-rose-600" title={c.alertePAI}>
                      <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                      {c.alertePAI}
                    </span>
                  ) : (
                    <span className="text-slate-300">Aucune</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPointer(student)}
                      disabled={!canEdit}
                      title="Pointer aujourd'hui"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateToStudent(student.id, c.alertePAI ? 'sante' : 'cantine')}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Voir Fiche
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
