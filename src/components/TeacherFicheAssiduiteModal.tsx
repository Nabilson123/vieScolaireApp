import { useEffect, useState } from 'react'
import { X, Briefcase, Clock, AlertCircle, RefreshCw, Layers, Printer, Undo2, Redo2, PlusCircle, Check, Award, Download } from 'lucide-react'
import type { Teacher } from '../data/teachers'
import { teacherName as formatTeacherName } from '../data/teachers'
import type { TeacherExtra, RemplacementRecord, TeacherAbsenceRecord } from '../data/teacherExtras'
import { computeTeacherSchedule, computeTeacherStats, formatHeures, formatFois, type ClasseHeuresRow } from '../utils/teacherAggregation'
import { useClassSchedules } from '../services/classSchedulesService'
import { isWithinPeriod } from '../utils/period'
import { getMention } from '../data/inspections'
import { getLatestInspection } from '../utils/inspectionAggregation'
import RemplacementModal from './RemplacementModal'
import TeacherDetailReportPreviewModal from './teacher-print/TeacherDetailReportPreviewModal'
import SchedulePrintPreviewModal from './schedule-print/SchedulePrintPreviewModal'
import ScheduleTimeGrid from './schedule/ScheduleTimeGrid'

function mondayOf(dateStr: string): Date {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface TeacherFicheAssiduiteModalProps {
  teacher: Teacher
  extra: TeacherExtra
  otherTeachers: Teacher[]
  periodStart: string
  periodEnd: string
  onClose: () => void
  onToggleJustified: (index: number) => void
  onAddRemplacement: (record: RemplacementRecord, remplacantId: string) => void
  isEditable: boolean
}

type TabKey = 'tout' | 'emploi' | 'absences' | 'remplacements'

export default function TeacherFicheAssiduiteModal({
  teacher,
  extra,
  otherTeachers,
  periodStart,
  periodEnd,
  onClose,
  onToggleJustified,
  onAddRemplacement,
  isEditable,
}: TeacherFicheAssiduiteModalProps) {
  const [tab, setTab] = useState<TabKey>('tout')
  const [showRemplacement, setShowRemplacement] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [weekDate, setWeekDate] = useState(todayISO())

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  // Abonnement direct : computeTeacherSchedule() lit un cache module-level qui ne se re-render
  // pas tout seul quand l'année change dans la Sidebar.
  useClassSchedules()
  const schedule = computeTeacherSchedule(teacher)
  const stats = computeTeacherStats(extra.absences, extra.remplacements, periodStart, periodEnd)

  const absencesWithIndex = extra.absences
    .map((a, idx) => ({ a, idx }))
    .filter(({ a }) => isWithinPeriod(a.date, periodStart, periodEnd))
  const filteredRemplacements = extra.remplacements.filter((r) => isWithinPeriod(r.date, periodStart, periodEnd))

  const remplacementsParClasse = new Map<string, { classe: string; nb: number; heures: number }>()
  filteredRemplacements.forEach((r) => {
    const row = remplacementsParClasse.get(r.classe) ?? { classe: r.classe, nb: 0, heures: 0 }
    row.nb += 1
    row.heures += r.heures
    remplacementsParClasse.set(r.classe, row)
  })

  const showEmploi = tab === 'tout' || tab === 'emploi'
  const showAbsences = tab === 'tout' || tab === 'absences'
  const showRemplacements = tab === 'tout' || tab === 'remplacements'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Briefcase className="h-5 w-5 text-indigo-500" />
              Fiche d’Assiduité de Prof. {teacher.prenom} {teacher.nom}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Matière : {teacher.matieres.join(', ')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-[10px] text-slate-400">Taux d’assiduité global</p>
              <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-bold text-emerald-600">
                {stats.tauxAssiduite.toFixed(1)}%
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Rapport
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <FicheKpi icon={Clock} color="rose" value={formatHeures(stats.absencesHeures)} label={`Absences (${formatFois(stats.absencesFois)})`} />
            <FicheKpi icon={AlertCircle} color="amber" value={formatHeures(stats.retardsHeures)} label={`Retards (${formatFois(stats.retardsFois)})`} />
            <FicheKpi icon={RefreshCw} color="emerald" value={formatHeures(stats.remplacementsHeures)} label={`Remplacements (${stats.remplacementsFois})`} />
            <FicheKpi icon={Layers} color="indigo" value={formatHeures(stats.heuresPerdues)} label="Cumul Heures Perdues" />
            {(() => {
              const latestInspection = getLatestInspection(teacher.id)
              if (!latestInspection) {
                return <FicheKpi icon={Award} color="violet" value="—" label="Aucune inspection" />
              }
              const mention = getMention(latestInspection.noteGlobale)
              return (
                <FicheKpi
                  icon={Award}
                  color="violet"
                  value={`${latestInspection.noteGlobale}/20`}
                  label={`Dernière Inspection · ${mention.label} · ${latestInspection.date}`}
                />
              )
            })()}
          </div>

          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === 'tout'} onClick={() => setTab('tout')}>
              Tout afficher
            </TabButton>
            <TabButton active={tab === 'emploi'} onClick={() => setTab('emploi')}>
              Emploi du Temps
            </TabButton>
            <TabButton active={tab === 'absences'} onClick={() => setTab('absences')}>
              Absences & Retards ({extra.absences.length})
            </TabButton>
            <TabButton active={tab === 'remplacements'} onClick={() => setTab('remplacements')}>
              Remplacements Effectués ({extra.remplacements.length})
            </TabButton>
          </div>

          {showEmploi && (
            <section className="rounded-2xl border border-slate-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Emploi du Temps de l’enseignant (Hebdomadaire)</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Semaine du :</span>
                  <input
                    type="date"
                    value={weekDate}
                    onChange={(e) => setWeekDate(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPrintPreview(true)}
                    title="Télécharger l'emploi du temps"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <ScheduleTimeGrid
                schedule={Object.fromEntries(
                  Object.entries(schedule).map(([day, slots]) => [
                    day,
                    slots.map((s) => ({ id: s.id, subject: s.subject, start: s.start, end: s.end, hours: s.hours, subtitle: `Cl ${s.classe}` })),
                  ])
                )}
              />
            </section>
          )}

          {showAbsences && (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Historique des absences et retards</h3>
                {absencesWithIndex.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">Aucune absence enregistrée sur cette période.</p>
                ) : (
                  <div className="space-y-2">
                    {absencesWithIndex.map(({ a, idx }) => (
                      <AbsenceRow key={idx} record={a} onToggle={() => onToggleJustified(idx)} isEditable={isEditable} />
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-100 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Heures Manquées par Classe</h3>
                <ClasseHeuresTable rows={stats.heuresParClasse} />
              </div>
            </section>
          )}

          {showRemplacements && (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Historique des remplacements effectués</h3>
                  <button
                    type="button"
                    onClick={() => setShowRemplacement(true)}
                    disabled={!isEditable}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Ajouter
                  </button>
                </div>
                {filteredRemplacements.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">Aucun remplacement effectué sur cette période.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredRemplacements.map((r, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{r.date}</span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-600">{r.heures}h</span>
                        </div>
                        <p className="text-slate-600">
                          {r.matiere} · Classe {r.classe}
                        </p>
                        <p className="text-slate-400">Remplacement de {r.profRemplace}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-100 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Remplacements par Classe</h3>
                {remplacementsParClasse.size === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">Aucune statistique disponible.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-1.5 pr-2 font-semibold">CLASSE</th>
                        <th className="py-1.5 pr-2 font-semibold">NB. REMPLACEMENTS</th>
                        <th className="py-1.5 font-semibold">HEURES EFFECTUÉES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(remplacementsParClasse.values()).map((row) => (
                        <tr key={row.classe} className="border-b border-slate-50">
                          <td className="py-1.5 pr-2 font-semibold text-slate-700">{row.classe}</td>
                          <td className="py-1.5 pr-2 text-slate-600">{row.nb}</td>
                          <td className="py-1.5 font-semibold text-emerald-600">{formatHeures(row.heures)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {showRemplacement && (
        <RemplacementModal
          otherTeachers={otherTeachers}
          initialRemplacantId={teacher.id}
          onClose={() => setShowRemplacement(false)}
          onSubmit={(r, remplacantId) => {
            onAddRemplacement(r, remplacantId)
            setShowRemplacement(false)
          }}
        />
      )}

      {showReport && (
        <TeacherDetailReportPreviewModal
          teacher={teacher}
          extra={extra}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onClose={() => setShowReport(false)}
        />
      )}

      {showPrintPreview &&
        (() => {
          const weekStart = mondayOf(weekDate)
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekStart.getDate() + 4)
          return (
            <SchedulePrintPreviewModal
              title={`Emploi du Temps — ${formatTeacherName(teacher)}`}
              variant="enseignant"
              teacherName={formatTeacherName(teacher)}
              weekStart={weekStart}
              weekEnd={weekEnd}
              schedule={schedule}
              onClose={() => setShowPrintPreview(false)}
            />
          )
        })()}
    </div>
  )
}

const KPI_COLORS: Record<string, { bg: string; text: string }> = {
  rose: { bg: 'bg-rose-50', text: 'text-rose-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-500' },
}

function FicheKpi({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: typeof Clock
  color: keyof typeof KPI_COLORS
  value: string
  label: string
}) {
  const c = KPI_COLORS[color]
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 p-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${c.bg}`}>
        <Icon className={`h-4 w-4 ${c.text}`} />
      </div>
      <div className="min-w-0">
        <p className="text-base font-bold text-slate-900">{value}</p>
        <p className="truncate text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function AbsenceRow({ record, onToggle, isEditable }: { record: TeacherAbsenceRecord; onToggle: () => void; isEditable: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{record.date}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              record.type === 'ABSENCE' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            {record.type}
          </span>
          <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              record.justified ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {record.justified && <Check className="h-3 w-3" />}
            {record.justified ? 'JUSTIFIÉ' : 'INJUSTIFIÉ'}
          </span>
        </div>
      </div>
      <p className="mb-1 text-xs text-slate-600">
        CLASSE : {record.classe} | Cours : {formatHeures(record.duree)}
      </p>
      <p className="mb-2 text-xs italic text-slate-400">Motif : « {record.motif} »</p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onToggle}
          disabled={!isEditable}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {record.justified ? <Undo2 className="h-3 w-3" /> : <Redo2 className="h-3 w-3" />}
          {record.justified ? 'Rendre Injustifié' : 'Rendre Justifié'}
        </button>
      </div>
    </div>
  )
}

function ClasseHeuresTable({ rows }: { rows: ClasseHeuresRow[] }) {
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-slate-400">Aucune statistique disponible.</p>
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th className="py-1.5 pr-2 font-semibold">CLASSE</th>
          <th className="py-1.5 pr-2 font-semibold">ABSENCES</th>
          <th className="py-1.5 pr-2 font-semibold">RETARDS</th>
          <th className="py-1.5 font-semibold">TOTAL PERDU</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.classe} className="border-b border-slate-50">
            <td className="py-1.5 pr-2 font-semibold text-slate-700">{r.classe}</td>
            <td className="py-1.5 pr-2 text-slate-600">
              {formatHeures(r.absencesHeures)} ({formatFois(r.absencesFois)})
            </td>
            <td className="py-1.5 pr-2 text-slate-600">
              {formatHeures(r.retardsHeures)} ({formatFois(r.retardsFois)})
            </td>
            <td className="py-1.5 font-semibold text-indigo-600">{formatHeures(r.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
