import { Bus, UtensilsCrossed, Clock3 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ServicesGlobalCounts, ServiceNiveauPoint } from '../../utils/servicesNiveauAggregation'
import type { ServicesCapacite } from '../../services/servicesCapaciteService'
import type { Refectoire } from '../../utils/cantineAggregation'
import { occupancyLevel, occupancyPct } from '../../utils/reportsBIAggregation'
import MiniBarChart from './MiniBarChart'

interface ServicesParNiveauSectionProps {
  globalCounts: ServicesGlobalCounts
  parNiveau: ServiceNiveauPoint[]
  effectif: number
  nbClasses: number
  capacite: ServicesCapacite
  capaciteClasses: number
  /** Somme des capacités des 5 lignes de transport — remplace capacite.transportCapacite (obsolète). */
  transportCapaciteTotal: number
  /** Élèves ayant la cantine, groupés par réfectoire — remplace globalCounts.cantine (obsolète pour l'occupation). */
  cantineCountsByRefectoire: Record<Refectoire, number>
  /** Sous-ensemble maternelle (PS/MS/GS) de cantineCountsByRefectoire.sousSol — tuile dédiée avec sa propre capacité. */
  cantinePrescolaireSousSol: number
}

const OCCUPANCY_BAR_CLASS = { ok: 'bg-emerald-500', warn: 'bg-amber-500', over: 'bg-rose-500' }
const OCCUPANCY_TEXT_CLASS = { ok: 'text-emerald-600', warn: 'text-amber-600', over: 'text-rose-600' }

function OccupancyBadge({ label, value, capacity }: { label: string; value: number; capacity: number }) {
  const pct = occupancyPct(value, capacity)
  const level = occupancyLevel(value, capacity)
  return (
    <div className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-600">
      {label} : <span className={`font-bold ${OCCUPANCY_TEXT_CLASS[level]}`}>{pct}%</span> ({value}/{capacity} places)
    </div>
  )
}

function ServiceOccupancyCard({
  label,
  value,
  capacity,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string
  value: number
  capacity: number
  icon: LucideIcon
  iconBg: string
  iconColor: string
}) {
  const pct = occupancyPct(value, capacity)
  const level = occupancyLevel(value, capacity)
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <p className="mb-1 text-2xl font-bold text-slate-900">
        {value}
        <span className="text-sm font-normal text-slate-400"> / {capacity}</span>
      </p>
      <div className="mb-1 h-1.5 w-full rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${OCCUPANCY_BAR_CLASS[level]}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-xs font-semibold ${OCCUPANCY_TEXT_CLASS[level]}`}>{pct}% occupé</p>
    </div>
  )
}

export default function ServicesParNiveauSection({
  globalCounts,
  parNiveau,
  effectif,
  nbClasses,
  capacite,
  capaciteClasses,
  transportCapaciteTotal,
  cantineCountsByRefectoire,
  cantinePrescolaireSousSol,
}: ServicesParNiveauSectionProps) {
  const ratioClasse = nbClasses > 0 ? (effectif / nbClasses).toFixed(1) : '—'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ServiceOccupancyCard
          label="Élèves ayant le Transport"
          value={globalCounts.transport}
          capacity={transportCapaciteTotal}
          icon={Bus}
          iconBg="bg-sky-50"
          iconColor="text-sky-500"
        />
        <ServiceOccupancyCard
          label="Cantine — Sous-Sol"
          value={cantineCountsByRefectoire.sousSol}
          capacity={capacite.cantineCapaciteSousSol}
          icon={UtensilsCrossed}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
        />
        <ServiceOccupancyCard
          label="Cantine — Terrasse"
          value={cantineCountsByRefectoire.terrasse}
          capacity={capacite.cantineCapaciteTerrasse}
          icon={UtensilsCrossed}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
        />
        <ServiceOccupancyCard
          label="Cantine Préscolaire — Sous-Sol"
          value={cantinePrescolaireSousSol}
          capacity={capacite.cantineCapacitePrescolaire}
          icon={UtensilsCrossed}
          iconBg="bg-pink-50"
          iconColor="text-pink-500"
        />
        <ServiceOccupancyCard
          label="Élèves ayant la Garde"
          value={globalCounts.garde}
          capacity={capacite.gardeCapacite}
          icon={Clock3}
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <div className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-600">
          Ratio élèves / classe : <span className="font-bold text-slate-800">{ratioClasse}</span>
        </div>
        <OccupancyBadge label="Taux d'occupation des classes" value={effectif} capacity={capaciteClasses} />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Services par Niveau</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniBarChart
            title="Transport"
            data={parNiveau.map((p) => ({ label: p.niveau, value: p.transport }))}
            color="#0ea5e9"
            heightClass="h-40"
          />
          <MiniBarChart
            title="Cantine"
            data={parNiveau.map((p) => ({ label: p.niveau, value: p.cantine }))}
            color="#f59e0b"
            heightClass="h-40"
          />
          <MiniBarChart
            title="Garde"
            data={parNiveau.map((p) => ({ label: p.niveau, value: p.garde }))}
            color="#8b5cf6"
            heightClass="h-40"
          />
        </div>
      </div>
    </div>
  )
}
