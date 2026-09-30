import { X, BarChart3 } from 'lucide-react'
import type { ExamSession } from '../../data/examPlanner'
import {
  computeCoverageByCreneau,
  computeExamCountsByClasseMatiere,
  computeNeverSolicited,
  computeSurveillanceHoursByTeacher,
} from '../../utils/examPlannerAggregation'
import { teacherName } from '../../data/teachers'

interface ExamPeriodStatsModalProps {
  sessions: ExamSession[]
  periodLabel: string
  onClose: () => void
}

function formatHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${m}`
}

function formatFloatHours(hours: number): string {
  return formatHoursMinutes(Math.round(hours * 60))
}

function dateFRShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })
}

export default function ExamPeriodStatsModal({ sessions, periodLabel, onClose }: ExamPeriodStatsModalProps) {
  const hoursByTeacher = computeSurveillanceHoursByTeacher(sessions)
  const coverage = computeCoverageByCreneau(sessions)
  const neverSolicited = computeNeverSolicited(sessions)
  const examCounts = computeExamCountsByClasseMatiere(sessions)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            Statistiques — {periodLabel}
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Heures de surveillance par prof</h3>
            <p className="mb-2 text-[11px] text-slate-400">
              La colonne "Cours ces jours-là" donne le contexte : un prof déjà chargé en cours les jours d'examen ne devrait pas, en plus, porter le
              plus gros de la surveillance.
            </p>
            {hoursByTeacher.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun surveillant assigné pour l'instant.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2">Prof</th>
                      <th className="px-3 py-2 text-right">Surveillance</th>
                      <th className="px-3 py-2 text-right">Cours ces jours-là</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoursByTeacher.map(({ teacher, minutes, classHoursOnExamDays }) => (
                      <tr key={teacher.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-1.5 font-medium text-slate-700">{teacherName(teacher)}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{formatHoursMinutes(minutes)}</td>
                        <td className="px-3 py-1.5 text-right text-slate-400">{formatFloatHours(classHoursOnExamDays)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Couverture par créneau</h3>
            {coverage.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun examen planifié.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Créneau</th>
                      <th className="px-3 py-2 text-center">Couvert</th>
                      <th className="px-3 py-2 text-center">Partiel</th>
                      <th className="px-3 py-2 text-center">Non couvert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.map((c) => (
                      <tr key={`${c.date}|${c.start}|${c.end}`} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-1.5 capitalize text-slate-700">{dateFRShort(c.date)}</td>
                        <td className="px-3 py-1.5 text-slate-500">
                          {c.start} - {c.end}
                        </td>
                        <td className="px-3 py-1.5 text-center font-semibold text-emerald-600">{c.covered}</td>
                        <td className="px-3 py-1.5 text-center font-semibold text-amber-600">{c.partial}</td>
                        <td className="px-3 py-1.5 text-center font-semibold text-slate-400">{c.uncovered}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Profs jamais sollicités {neverSolicited.length > 0 && `(${neverSolicited.length})`}
            </h3>
            {neverSolicited.length === 0 ? (
              <p className="text-sm text-slate-400">Tous les profs éligibles ont au moins une surveillance.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {neverSolicited.map((t) => (
                  <span key={t.id} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {teacherName(t)}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Examens par classe / matière</h3>
            {examCounts.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun examen planifié.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2">Classe</th>
                      <th className="px-3 py-2">Matière</th>
                      <th className="px-3 py-2 text-right">Examens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examCounts.map((c) => (
                      <tr key={`${c.classe}|${c.matiere}`} className="border-b border-slate-50 last:border-0">
                        <td className="px-3 py-1.5 font-medium text-slate-700">{c.classe}</td>
                        <td className="px-3 py-1.5 text-slate-500">{c.matiere}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
