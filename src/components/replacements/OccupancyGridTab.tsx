import { useState } from 'react'
import { Info, X, CheckCircle2 } from 'lucide-react'
import { teacherName, initials } from '../../data/teachers'
import { buildDayOccupancy, type PendingReplacement } from '../../utils/replacementAggregation'
import { formatHeures } from '../../utils/teacherAggregation'
import { useIsViewedYearEditable } from '../../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../../services/permissions'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

interface OccupancyGridTabProps {
  pendingList: PendingReplacement[]
  onAssign: (pending: PendingReplacement, teacherId: string, consignes: string, creneau: { start: string; end: string; hours: number }) => void
}

interface ClickedSlot {
  teacherId: string
  teacherLabel: string
  period: { start: string; end: string }
  candidates: PendingReplacement[]
}

export default function OccupancyGridTab({ pendingList, onAssign }: OccupancyGridTabProps) {
  const profile = useCurrentProfile()
  const isEditable = useIsViewedYearEditable() && getModuleAccess(profile, 'replacements').canEdit
  const [date, setDate] = useState(todayISO())
  const [clicked, setClicked] = useState<ClickedSlot | null>(null)
  const [consignes, setConsignes] = useState('')

  const occupancy = buildDayOccupancy(date)

  const handleLibreClick = (teacherId: string, teacherLabel: string, period: { start: string; end: string }) => {
    const candidates = pendingList.filter(
      (p) => p.date === date && p.start === period.start && p.end === period.end && p.teacher.id !== teacherId
    )
    setConsignes('')
    setClicked({ teacherId, teacherLabel, period, candidates })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Cette grille affiche l’occupation en temps réel de chaque enseignant. Cliquez sur un créneau libre pour assigner un
          remplacement en attente compatible.
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="text-sm text-slate-500">Date d’observation :</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        {occupancy.periods.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Aucun cours planifié ce jour-là.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2 pr-3 font-semibold">Enseignant</th>
                {occupancy.periods.map((p, idx) => (
                  <th key={idx} className="px-1.5 pb-2 font-semibold">
                    P{idx + 1} ({p.start} - {p.end})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {occupancy.rows.map((row) => (
                <tr key={row.teacher.id} className="border-t border-slate-50">
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                        {initials(teacherName(row.teacher))}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-700">Prof. {teacherName(row.teacher)}</p>
                        <p className="text-[10px] text-slate-400">{row.teacher.matieres.join(', ')}</p>
                      </div>
                    </div>
                  </td>
                  {row.cells.map((cell, idx) => (
                    <td key={idx} className="px-1.5 py-1.5">
                      {cell.status === 'libre' ? (
                        <button
                          type="button"
                          onClick={() => handleLibreClick(row.teacher.id, teacherName(row.teacher), occupancy.periods[idx])}
                          disabled={!isEditable}
                          className="w-full rounded-lg border border-teal-200 bg-teal-50 px-2 py-2 text-[11px] font-semibold text-teal-600 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Libre
                        </button>
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]">
                          <p className="font-semibold text-slate-700">{cell.subject}</p>
                          <p className="text-slate-400">Cl : {cell.classe}</p>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {clicked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Prof. {clicked.teacherLabel} · {clicked.period.start} - {clicked.period.end}
              </h2>
              <button
                type="button"
                onClick={() => setClicked(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-6 py-5">
              {clicked.candidates.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  Aucun remplacement en attente compatible avec ce professeur sur ce créneau.
                </p>
              ) : (
                <>
                  {clicked.candidates.map((c, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-sm">
                      <p className="font-semibold text-slate-800">
                        {c.subject} · Cl {c.classe}
                      </p>
                      <p className="text-xs text-slate-500">Prof. {teacherName(c.teacher)} absent · {formatHeures(c.hours)}</p>
                    </div>
                  ))}
                  <textarea
                    value={consignes}
                    onChange={(e) => setConsignes(e.target.value)}
                    rows={2}
                    placeholder="Consignes pour le remplaçant (optionnel)..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const c = clicked.candidates[0]
                      onAssign(c, clicked.teacherId, consignes, { start: c.start, end: c.end, hours: c.hours })
                      setClicked(null)
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Affecter ce professeur
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
