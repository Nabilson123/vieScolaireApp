import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { computeRepartitionIncidents } from '../utils/pedagogieDisciplineAggregation'
import { getClassOptions } from '../data/students'

export default function RepartitionIncidentsCard() {
  const [classe, setClasse] = useState('Toutes les classes')
  const rows = computeRepartitionIncidents(new Date(), classe)
  const maxCount = rows.length > 0 ? rows[0].count : 0
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-800">Répartition des Incidents</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:border-indigo-400 focus:outline-none"
          >
            {getClassOptions().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Top Motifs
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Aucun incident enregistré ce mois-ci.</p>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 6).map((row) => {
            const pct = maxCount === 0 ? 0 : Math.round((row.count / maxCount) * 100)
            const isOpen = expanded === row.motif
            return (
              <div key={row.motif}>
                <button type="button" onClick={() => setExpanded(isOpen ? null : row.motif)} className="w-full text-left">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-800">{row.motif}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{row.count}</span>
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-orange-400" style={{ width: `${pct}%` }} />
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3">
                    {row.students.map((st, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-slate-600">
                        <span>
                          {st.studentName} <span className="text-slate-400">· {st.classe}</span>
                        </span>
                        <span className="text-slate-400">
                          {st.date} · {st.points} pt{Math.abs(st.points) > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
