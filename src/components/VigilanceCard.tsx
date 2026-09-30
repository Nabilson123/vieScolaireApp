import { AlertTriangle, ChevronRight } from 'lucide-react'
import { computeVigilanceRows, VIGILANCE_THRESHOLD_HOURS } from '../utils/vigilanceAggregation'

interface VigilanceCardProps {
  onNavigateToStudent?: (id: string) => void
  onNavigateToTeacher?: (id: string) => void
}

export default function VigilanceCard({ onNavigateToStudent, onNavigateToTeacher }: VigilanceCardProps) {
  const rows = computeVigilanceRows()
  const elevesCount = rows.filter((r) => r.kind === 'eleve').length
  const profsCount = rows.filter((r) => r.kind === 'prof').length

  const handleClick = (row: (typeof rows)[number]) => {
    if (row.kind === 'eleve') onNavigateToStudent?.(row.id)
    else onNavigateToTeacher?.(row.id)
  }

  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          <h3 className="text-sm font-semibold text-slate-800">
            Vigilance (&gt;{VIGILANCE_THRESHOLD_HOURS}h perdues sur la période)
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-600">
            {elevesCount} ÉLÈVE(S)
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            {profsCount} PROF(S)
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Aucun élève ou professeur au-dessus du seuil.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={`${row.kind}-${row.id}`}
              className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                <p className="text-xs text-slate-500">
                  {row.kind === 'eleve' ? 'Élève' : 'Professeur'} - Classe : {row.classe}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-600">
                  {row.heuresLabel} MANQUÉES
                </span>
                <button
                  type="button"
                  onClick={() => handleClick(row)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
                >
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
