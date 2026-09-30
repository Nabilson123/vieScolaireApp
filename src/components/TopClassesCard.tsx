import { Trophy, TrendingDown } from 'lucide-react'
import { computeClassesMoyenne } from '../utils/pedagogieDisciplineAggregation'
import { cycleOfClasse } from '../utils/alertEngine'
import { moyenneScale } from '../data/referentiel'
import { CYCLE_KEYS, cycleLabel } from '../data/alertRules'

interface TopClassesCardProps {
  onNavigateToClasse: (classe: string) => void
}

export default function TopClassesCard({ onNavigateToClasse }: TopClassesCardProps) {
  const rows = computeClassesMoyenne()
  const groups = CYCLE_KEYS.map((cycle) => {
    const scale = moyenneScale(cycle)
    const cycleRows = rows.filter((r) => cycleOfClasse(r.classe) === cycle)
    return { cycle, scale, top: cycleRows[0], bottom: cycleRows.length > 1 ? cycleRows[cycleRows.length - 1] : undefined }
  }).filter((g): g is typeof g & { scale: number } => g.scale !== null && g.top !== undefined)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-bold text-slate-800">Top Classes (Moyenne)</h3>
      </div>

      {groups.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Aucune moyenne disponible pour l'instant.</p>
      ) : (
        <div className="space-y-5">
          {groups.map(({ cycle, scale, top, bottom }) => (
            <div key={cycle}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{cycleLabel(cycle)}</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onNavigateToClasse(top.classe)}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <span>🥇</span> {top.classe}
                  </span>
                  <span className="text-sm font-bold text-indigo-600">{top.moyenne.toFixed(1)} /{scale}</span>
                </button>
                {bottom && (
                  <button
                    type="button"
                    onClick={() => onNavigateToClasse(bottom.classe)}
                    className="flex w-full items-center justify-between rounded-xl bg-rose-50/60 px-4 py-3 text-left hover:bg-rose-50"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <TrendingDown className="h-3.5 w-3.5 text-rose-500" /> {bottom.classe}
                    </span>
                    <span className="text-sm font-bold text-rose-600">{bottom.moyenne.toFixed(1)} /{scale}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
