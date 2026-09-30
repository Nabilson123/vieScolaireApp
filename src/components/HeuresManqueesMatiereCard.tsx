import { useState } from 'react'
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react'
import { computeHeuresManqueesParMatiere } from '../utils/pedagogieDisciplineAggregation'
import { formatHeures } from '../utils/teacherAggregation'
import { getClassOptions } from '../data/students'

const BAR_COLORS = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500']

export default function HeuresManqueesMatiereCard() {
  const [classe, setClasse] = useState('Toutes les classes')
  const rows = computeHeuresManqueesParMatiere(new Date(), classe).slice(0, 5)
  const total = rows.reduce((sum, r) => sum + r.totalMinutes, 0)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800">Heures Manquées par Matière</h3>
        </div>
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
      </div>
      <p className="mb-4 text-xs text-slate-400">Top 5 des matières les plus impactées par les absences (mois en cours).</p>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Aucune absence enregistrée ce mois-ci.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => {
            const pct = total === 0 ? 0 : Math.round((row.totalMinutes / total) * 100)
            const isOpen = expanded === row.subject
            return (
              <div key={row.subject}>
                <button type="button" onClick={() => setExpanded(isOpen ? null : row.subject)} className="w-full text-left">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-800">{row.subject}</span>
                    <span className="flex items-center gap-1 text-slate-500">
                      {formatHeures(row.totalMinutes / 60)} <span className="text-xs text-slate-400">({pct}%)</span>
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${BAR_COLORS[i % BAR_COLORS.length]}`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3">
                    {[...row.students]
                      .sort((a, b) => b.minutes - a.minutes)
                      .map((st) => (
                        <div key={st.studentId} className="flex items-center justify-between text-xs text-slate-600">
                          <span>
                            {st.studentName} <span className="text-slate-400">· {st.classe}</span>
                          </span>
                          <span className="font-semibold">{formatHeures(st.minutes / 60)}</span>
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
