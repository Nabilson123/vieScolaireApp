import { ArrowRight, Trophy } from 'lucide-react'
import { useClubsImpayes } from '../hooks/useClubsImpayes'
import { formatDH } from '../utils/clubsFinance'

interface ClubsImpayesCardProps {
  onManage?: () => void
}

/** Carte du tableau de bord : familles en retard sur les mensualités des clubs. N'apparaît que pour qui a le droit sur les paiements des clubs. */
export default function ClubsImpayesCard({ onManage }: ClubsImpayesCardProps) {
  const { visible, nbFamilles, totalCentimes } = useClubsImpayes()
  if (!visible) return null

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800">Clubs : impayés</h3>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className={`text-2xl font-bold ${nbFamilles > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{nbFamilles > 0 ? formatDH(totalCentimes) : 'À jour'}</span>
          <p className="text-xs text-slate-500">{nbFamilles > 0 ? `${nbFamilles} famille${nbFamilles > 1 ? 's' : ''} en retard` : 'Aucune mensualité en retard'}</p>
        </div>
        {nbFamilles > 0 && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-500">À relancer</span>}
      </div>

      <button type="button" onClick={onManage} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-800">
        Voir le recouvrement
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
