import { Scale } from 'lucide-react'
import { computeDisciplineBilanMois } from '../utils/pedagogieDisciplineAggregation'

export default function BilanDisciplinaireCard() {
  const { pointsValeur, pointsSanction } = computeDisciplineBilanMois()
  const sanctionAbs = Math.abs(pointsSanction)
  const total = pointsValeur + sanctionAbs
  const valeurPct = total === 0 ? 50 : Math.round((pointsValeur / total) * 100)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Scale className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-800">Bilan Disciplinaire (Mois)</h3>
      </div>

      <div className="mb-4 flex items-center justify-around text-center">
        <div>
          <p className="text-3xl font-bold text-emerald-500">+{pointsValeur}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Points de valeur</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-orange-500">{pointsSanction}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Points de sanction</p>
        </div>
      </div>

      <div className="mb-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-emerald-500" style={{ width: `${valeurPct}%` }} />
        <div className="h-full bg-orange-500" style={{ width: `${100 - valeurPct}%` }} />
      </div>
      <p className="text-center text-xs italic text-slate-400">Ratio récompenses / sanctions sur la période.</p>
    </div>
  )
}
