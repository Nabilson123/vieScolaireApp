import { Users2 } from 'lucide-react'
import type { AnneeEffectifPoint } from '../../utils/multiYearAggregation'
import MiniBarChart from './MiniBarChart'
import StackedBarChart from './StackedBarChart'

interface EffectifsDemographieSectionProps {
  anneeData: AnneeEffectifPoint[]
}

export default function EffectifsDemographieSection({ anneeData }: EffectifsDemographieSectionProps) {
  const hasAnyYear = anneeData.some((a) => a.effectif > 0)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Users2 className="h-4 w-4 text-indigo-500" />
        Effectifs & Démographie par Année Scolaire
      </h3>
      {!hasAnyYear && (
        <p className="mb-3 text-xs text-slate-400">
          Historique limité aux années scolaires créées dans l'application — les barres se rempliront au fil des rentrées.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MiniBarChart
          title="Élèves par année scolaire"
          data={anneeData.map((a) => ({ label: a.label, value: a.effectif }))}
          color="#6366f1"
        />
        <MiniBarChart
          title="Classes par année scolaire"
          data={anneeData.map((a) => ({ label: a.label, value: a.nbClasses }))}
          color="#0ea5e9"
        />
        <StackedBarChart
          title="% d'élèves par genre par année scolaire"
          data={anneeData.map((a) => ({ label: a.label, garcons: a.pctGarcons, filles: a.pctFilles }))}
          series={[
            { key: 'garcons', color: '#3b82f6', label: 'Garçons' },
            { key: 'filles', color: '#ec4899', label: 'Filles' },
          ]}
          formatter={(v) => `${v}%`}
        />
      </div>
    </div>
  )
}
