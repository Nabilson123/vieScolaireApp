import { useMemo, useState } from 'react'
import { Trophy, History, Pencil, Trash2, Repeat, Clock, Users, UserCheck, BookOpen, Printer, RotateCcw, EyeOff } from 'lucide-react'
import { teacherName } from '../../data/teachers'
import {
  computeRemplacementGlobalStats,
  computeMatiereBreakdown,
  computeClasseBreakdown,
  computeEquiteStats,
  type FlatRemplacement,
  type PendingReplacement,
} from '../../utils/replacementAggregation'
import { formatHeures } from '../../utils/teacherAggregation'
import { isWithinPeriod, formatPeriodLabel } from '../../utils/period'
import ClasseImpactChart from './ClasseImpactChart'
import RemplacementsPrintPreviewModal from '../replacements-print/RemplacementsPrintPreviewModal'
import PeriodRangeFilter from '../PeriodRangeFilter'
import { useIsViewedYearEditable } from '../../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../../services/permissions'

interface RemplacementsHistoriqueTabProps {
  historique: FlatRemplacement[]
  ignoredList: PendingReplacement[]
  onEdit: (remplacantId: string, index: number) => void
  onDelete: (remplacantId: string, index: number) => void
  onRestore: (item: PendingReplacement) => void
}

function KpiCard({ icon: Icon, label, value, color }: { icon: typeof Repeat; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export default function RemplacementsHistoriqueTab({ historique, ignoredList, onEdit, onDelete, onRestore }: RemplacementsHistoriqueTabProps) {
  const profile = useCurrentProfile()
  const isEditable = useIsViewedYearEditable() && getModuleAccess(profile, 'replacements').canEdit
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [showPrint, setShowPrint] = useState(false)

  const filtered = useMemo(
    () => historique.filter((r) => isWithinPeriod(r.date, periodStart, periodEnd)),
    [historique, periodStart, periodEnd]
  )

  const stats = computeRemplacementGlobalStats(filtered)
  const matiereBreakdown = computeMatiereBreakdown(filtered)
  const classeBreakdown = computeClasseBreakdown(filtered)
  const equite = computeEquiteStats(filtered)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <PeriodRangeFilter
          periodStart={periodStart}
          periodEnd={periodEnd}
          onDatesChange={(start, end) => {
            setPeriodStart(start)
            setPeriodEnd(end)
          }}
          onReset={() => {
            setPeriodStart('')
            setPeriodEnd('')
          }}
        />
        <span className="text-xs text-slate-400">{formatPeriodLabel(periodStart, periodEnd)}</span>
        <button
          type="button"
          onClick={() => setShowPrint(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
        >
          <Printer className="h-4 w-4" />
          Télécharger le Rapport (PDF)
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Repeat} label="Remplacements assurés" value={String(stats.totalRemplacements)} color="bg-indigo-50 text-indigo-500" />
        <KpiCard icon={Clock} label="Volume horaire total" value={formatHeures(stats.totalHeures)} color="bg-violet-50 text-violet-500" />
        <KpiCard icon={Users} label="Professeurs mobilisés" value={String(stats.profsMobilises)} color="bg-emerald-50 text-emerald-500" />
        <KpiCard icon={UserCheck} label="Absences couvertes (profs)" value={String(stats.profsAbsentsCouverts)} color="bg-amber-50 text-amber-500" />
      </div>

      <ClasseImpactChart data={classeBreakdown} />

      {matiereBreakdown.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BookOpen className="h-4 w-4 text-sky-500" />
            Répartition par Matière
          </h3>
          <div className="space-y-2">
            {matiereBreakdown.map((row) => (
              <div key={row.matiere} className="rounded-lg bg-slate-50/60 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-600">{row.matiere}</span>
                  <span className="text-slate-500">
                    {row.count} remplacement{row.count > 1 ? 's' : ''} · <span className="font-semibold text-slate-700">{formatHeures(row.heures)}</span>
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span>
                    <span className="font-semibold text-slate-600">Profs absents :</span> {row.profsAbsents.join(', ')}
                  </span>
                  <span>
                    <span className="font-semibold text-slate-600">Niveaux :</span> {row.niveaux.join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {equite.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Trophy className="h-4 w-4 text-amber-400" />
            Équité des Remplacements
          </h3>
          <div className="space-y-1.5">
            {equite.map((row) => (
              <div key={row.teacher.id} className="flex items-center justify-between rounded-lg bg-slate-50/60 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">Prof. {teacherName(row.teacher)}</span>
                <span className="text-slate-500">
                  {row.count} remplacement{row.count > 1 ? 's' : ''} · <span className="font-semibold text-slate-700">{formatHeures(row.heures)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ignoredList.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <EyeOff className="h-4 w-4 text-slate-400" />
            Créneaux écartés ({ignoredList.length})
          </h3>
          <div className="space-y-1.5">
            {ignoredList.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50/60 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-700">
                    {item.date} · {item.classe} | {item.start} - {item.end} ({formatHeures(item.hours)})
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.subject} — Prof. {teacherName(item.teacher)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(item)}
                  disabled={!isEditable}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Remettre en attente
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <History className="h-4 w-4 text-slate-400" />
          Historique des Remplacements assurés
        </h3>
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Aucun remplacement assuré pour l’instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1.5 pr-3 font-semibold">Date</th>
                  <th className="py-1.5 pr-3 font-semibold">Classe & Cours</th>
                  <th className="py-1.5 pr-3 font-semibold">Matière</th>
                  <th className="py-1.5 pr-3 font-semibold">Professeur Absent</th>
                  <th className="py-1.5 pr-3 font-semibold">Professeur Remplaçant</th>
                  <th className="py-1.5 pr-3 font-semibold">Volume Horaire</th>
                  <th className="py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={idx} className="border-b border-slate-50">
                    <td className="py-2 pr-3 whitespace-nowrap">{r.date}</td>
                    <td className="py-2 pr-3 font-semibold text-slate-700">{r.classe}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-600">{r.matiere}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">Prof. {r.profRemplace}</td>
                    <td className="py-2 pr-3 font-semibold text-emerald-600">Prof. {r.remplacantName}</td>
                    <td className="py-2 pr-3">{formatHeures(r.heures)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">ASSURÉ</span>
                        <button
                          type="button"
                          onClick={() => onEdit(r.remplacantId, r.sourceIndex)}
                          disabled={!isEditable}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(r.remplacantId, r.sourceIndex)}
                          disabled={!isEditable}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPrint && (
        <RemplacementsPrintPreviewModal
          periodStart={periodStart}
          periodEnd={periodEnd}
          stats={stats}
          equite={equite}
          historique={filtered}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
