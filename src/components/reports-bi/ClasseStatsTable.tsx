import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { ClasseStatsRow, ClasseStatsSortKey } from '../../utils/reportsBIAggregation'
import { moyenneScaleForClasse } from '../../utils/alertEngine'

interface ClasseStatsTableProps {
  rows: ClasseStatsRow[]
  sortKey: ClasseStatsSortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: ClasseStatsSortKey) => void
  onNavigateToClasse?: (classe: string) => void
}

const COLUMNS: { key: ClasseStatsSortKey; label: string }[] = [
  { key: 'classe', label: 'Classe' },
  { key: 'effectif', label: 'Effectif' },
  { key: 'tauxPresence', label: 'Taux de présence' },
  { key: 'absencesCount', label: 'Absences' },
  { key: 'retardsCount', label: 'Retards' },
  { key: 'heuresManquees', label: 'Heures manquées' },
  { key: 'moyenneGenerale', label: 'Moyenne générale' },
  { key: 'incidents', label: 'Sanctions' },
  { key: 'pointsSanction', label: 'Points sanction' },
  { key: 'moyenneConduite', label: 'Conduite' },
]

function tauxPresenceBadgeClass(taux: number): string {
  if (taux >= 90) return 'bg-emerald-50 text-emerald-600'
  if (taux >= 80) return 'bg-amber-50 text-amber-600'
  return 'bg-rose-50 text-rose-600'
}

export default function ClasseStatsTable({ rows, sortKey, sortDir, onSort, onNavigateToClasse }: ClasseStatsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left">
          <thead>
            <tr className="border-b border-slate-100">
              {COLUMNS.map((col) => {
                const active = sortKey === col.key
                const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
                return (
                  <th key={col.key} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={`flex items-center gap-1 hover:text-slate-600 ${active ? 'text-indigo-600' : ''}`}
                    >
                      {col.label}
                      <Icon className="h-3 w-3" />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.classe}
                onClick={() => onNavigateToClasse?.(row.classe)}
                className={`border-b border-slate-50 last:border-0 ${onNavigateToClasse ? 'cursor-pointer hover:bg-slate-50/60' : ''}`}
              >
                <td className="px-4 py-2.5">
                  <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">{row.classe}</span>
                </td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{row.effectif}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tauxPresenceBadgeClass(row.tauxPresence)}`}>
                    {row.tauxPresence}%
                  </span>
                </td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{row.absencesCount}</td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{row.retardsCount}</td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{row.heuresManquees}h</td>
                <td className="px-4 py-2.5 text-sm font-semibold text-slate-800">
                  {row.moyenneGenerale !== null ? `${row.moyenneGenerale.toFixed(1)}/${moyenneScaleForClasse(row.classe) ?? 20}` : '—'}
                </td>
                <td className="px-4 py-2.5">
                  {row.incidents > 0 ? (
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">{row.incidents}</span>
                  ) : (
                    <span className="text-sm text-slate-400">0</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-sm font-medium text-rose-500">{row.pointsSanction}</td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{row.moyenneConduite}/20</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Aucune classe active.</p>}
    </div>
  )
}
