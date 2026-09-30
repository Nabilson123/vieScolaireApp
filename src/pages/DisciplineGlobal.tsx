import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Shield,
  FileBarChart,
  FileSpreadsheet,
  PlusCircle,
  ThumbsUp,
  ThumbsDown,
  Star,
  AlertCircle,
  Search,
  Trash2,
  Trophy,
  History,
  Printer,
  Gavel,
} from 'lucide-react'
import { getClassOptions, initials } from '../data/students'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { getStudentExtraSnapshot, updateStudentDiscipline, updateStudentConduite } from '../services/studentDetailsService'
import { isWithinPeriod } from '../utils/period'
import RegisterDisciplineModal from '../components/RegisterDisciplineModal'
import DisciplinePrintPreviewModal from '../components/discipline-print/DisciplinePrintPreviewModal'
import DisciplineNoticePreviewModal from '../components/discipline-print/DisciplineNoticePreviewModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import { exportDisciplineJournalExcel } from '../utils/disciplineExport'
import { SANCTION_LEVELS, CONSEIL_STATUTS, CONSEIL_STATUT_LABELS, computeConduite, type ConseilStatut } from '../data/disciplineTypes'
import { enqueueNotification } from '../services/notificationQueueService'

interface FlatEntry {
  id: string
  index: number
  studentId: string
  studentName: string
  classe: string
  date: string
  title: string
  description: string
  points: number
  author: string
  typeCode?: string
  sanction?: string
  conseilStatut?: string
  procedureStepsDone?: number[]
  retenueDate?: string
  retenueDuree?: string
  procedureStepDetails?: Record<number, string>
  procedureDetailsPrintable?: boolean
  privationActivite?: string
  privationDuree?: string
}

function buildEntries(): FlatEntry[] {
  const entries: FlatEntry[] = []
  getStudentsSnapshot().forEach((s) => {
    const extra = getStudentExtraSnapshot(s.id)
    extra.discipline.forEach((d, idx) => {
      entries.push({
        id: `${s.id}-${idx}`,
        index: idx,
        studentId: s.id,
        studentName: s.name,
        classe: s.classe,
        date: d.date,
        title: d.title,
        description: d.description,
        points: d.points,
        author: d.author,
        typeCode: d.typeCode,
        sanction: d.sanction,
        conseilStatut: d.conseilStatut,
        procedureStepsDone: d.procedureStepsDone,
        retenueDate: d.retenueDate,
        retenueDuree: d.retenueDuree,
        procedureStepDetails: d.procedureStepDetails,
        procedureDetailsPrintable: d.procedureDetailsPrintable,
        privationActivite: d.privationActivite,
        privationDuree: d.privationDuree,
      })
    })
  })
  return entries.sort((a, b) => (a.date < b.date ? 1 : -1))
}

function buildConduiteMap(): Record<string, number> {
  const map: Record<string, number> = {}
  getStudentsSnapshot().forEach((s) => {
    map[s.id] = getStudentExtraSnapshot(s.id).conduite
  })
  return map
}

function statutFor(note: number): { label: string; className: string } {
  if (note >= 12) return { label: 'BON', className: 'bg-teal-50 text-teal-600' }
  if (note >= 8) return { label: 'ASSEZ BIEN', className: 'bg-amber-50 text-amber-600' }
  return { label: 'ALERTE', className: 'bg-rose-50 text-rose-600' }
}

// Mêmes seuils que statutFor() (12/8), vocabulaire du rapport imprimé (Bon/Moyen/Insuffisant).
function statutForRapport(note: number): string {
  if (note >= 12) return 'Bon'
  if (note >= 8) return 'Moyen'
  return 'Insuffisant'
}

interface DisciplineGlobalProps {
  onDataChanged?: () => void
}

export default function DisciplineGlobal({ onDataChanged }: DisciplineGlobalProps) {
  const queryClient = useQueryClient()
  // buildEntries/buildConduiteMap lisent getStudentsSnapshot() : il faut la référence `students`
  // (retournée par useStudents()) dans les deps, pas juste l'id de l'année consultée — celui-ci
  // change avant la fin du fetch réseau, donc un useMemo qui ne dépendrait que de lui recalcule
  // trop tôt et jamais une seconde fois une fois les données fraîches arrivées.
  const { data: students } = useStudents()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'discipline').canEdit
  const isEditable = canEditYear && canEditModule
  const [refreshKey, setRefreshKey] = useState(0)
  const entries = useMemo(buildEntries, [refreshKey, students])
  const conduiteMap = useMemo(buildConduiteMap, [refreshKey, students])
  const [showModal, setShowModal] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [printEntry, setPrintEntry] = useState<FlatEntry | null>(null)
  const [search, setSearch] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [classe, setClasse] = useState('Toutes les classes')

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesSearch = e.studentName.toLowerCase().includes(search.toLowerCase())
      const matchesClasse = classe === 'Toutes les classes' || e.classe === classe
      const matchesPeriod = isWithinPeriod(e.date, dateStart, dateEnd)
      return matchesSearch && matchesClasse && matchesPeriod
    })
  }, [entries, search, classe, dateStart, dateEnd])

  const palmares = useMemo(() => {
    return getStudentsSnapshot()
      .filter((s) => classe === 'Toutes les classes' || s.classe === classe)
      .map((s) => ({ ...s, conduite: conduiteMap[s.id] ?? 20 }))
      .sort((a, b) => b.conduite - a.conduite)
  }, [classe, conduiteMap, students])

  // Bilan du rapport imprimé : contrairement au palmarès à l'écran (tous les élèves, note globale
  // de l'année), ce rapport ne doit lister que les élèves ayant eu au moins un avertissement sur la
  // période sélectionnée, avec une note recalculée sur cette seule période (pas la note annuelle).
  const reportPalmares = useMemo(() => {
    const pointsByStudent = new Map<string, number[]>()
    filteredEntries.forEach((e) => {
      const list = pointsByStudent.get(e.studentId)
      if (list) list.push(e.points)
      else pointsByStudent.set(e.studentId, [e.points])
    })
    return getStudentsSnapshot()
      .filter((s) => (pointsByStudent.get(s.id) ?? []).some((p) => p < 0))
      .map((s) => ({ ...s, conduite: computeConduite(pointsByStudent.get(s.id) ?? []) }))
      .sort((a, b) => a.conduite - b.conduite)
  }, [filteredEntries, students])

  const recompenses = filteredEntries.filter((e) => e.points > 0).length
  const avertissements = filteredEntries.filter((e) => e.points < 0).length
  const moyenneConduite = palmares.length
    ? Math.round((palmares.reduce((sum, s) => sum + s.conduite, 0) / palmares.length) * 10) / 10
    : 0
  const elevesSousAlerte = palmares.filter((s) => s.conduite < 8).length

  const sanctionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    SANCTION_LEVELS.forEach((s) => (counts[s] = 0))
    filteredEntries.forEach((e) => {
      if (e.sanction) counts[e.sanction] = (counts[e.sanction] ?? 0) + 1
    })
    return counts
  }, [filteredEntries])

  const conseilCases = useMemo(
    () => entries.filter((e) => e.sanction === 'Conseil de discipline').sort((a, b) => (a.date < b.date ? 1 : -1)),
    [entries],
  )

  const handleRegister = async (payload: {
    studentId: string
    title: string
    description: string
    points: number
    author: string
    date: string
    typeCode?: string
    sanction?: string
    conseilStatut?: string
    procedureStepsDone?: number[]
    retenueDate?: string
    retenueDuree?: string
    procedureStepDetails?: Record<number, string>
    procedureDetailsPrintable?: boolean
    privationActivite?: string
    privationDuree?: string
  }) => {
    const student = getStudentsSnapshot().find((s) => s.id === payload.studentId)
    if (!student) return

    const extra = getStudentExtraSnapshot(payload.studentId)
    const nextDiscipline = [
      {
        date: payload.date,
        title: payload.title,
        description: payload.description,
        points: payload.points,
        author: payload.author,
        typeCode: payload.typeCode,
        sanction: payload.sanction,
        conseilStatut: payload.conseilStatut,
        procedureStepsDone: payload.procedureStepsDone,
        retenueDate: payload.retenueDate,
        retenueDuree: payload.retenueDuree,
        procedureStepDetails: payload.procedureStepDetails,
        procedureDetailsPrintable: payload.procedureDetailsPrintable,
        privationActivite: payload.privationActivite,
        privationDuree: payload.privationDuree,
      },
      ...extra.discipline,
    ]
    await updateStudentDiscipline(payload.studentId, nextDiscipline)
    await updateStudentConduite(payload.studentId, computeConduite(nextDiscipline.map((d) => d.points)))
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    // Seuls les vrais incidents (points négatifs) notifient les parents — pas les mérites/récompenses.
    if (payload.points < 0) {
      await enqueueNotification({
        studentId: payload.studentId,
        templateCode: 'incident_disciplinaire',
        variables: { eleve: student.name, classe: student.classe, date: payload.date, motif: payload.title },
      })
    }
    setShowModal(false)
    setRefreshKey((k) => k + 1)
    onDataChanged?.()
  }

  const handleDelete = async (entry: FlatEntry) => {
    const extra = getStudentExtraSnapshot(entry.studentId)
    const nextDiscipline = extra.discipline.filter((_, i) => i !== entry.index)
    await updateStudentDiscipline(entry.studentId, nextDiscipline)
    await updateStudentConduite(entry.studentId, computeConduite(nextDiscipline.map((d) => d.points)))
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setRefreshKey((k) => k + 1)
    onDataChanged?.()
  }

  const handleUpdateConseilStatut = async (entry: FlatEntry, statut: ConseilStatut) => {
    const extra = getStudentExtraSnapshot(entry.studentId)
    const nextDiscipline = extra.discipline.map((d, i) => (i === entry.index ? { ...d, conseilStatut: statut } : d))
    await updateStudentDiscipline(entry.studentId, nextDiscipline)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setRefreshKey((k) => k + 1)
    onDataChanged?.()
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Suivi Disciplinaire des Élèves
            <Shield className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            Registre des incidents de conduite, avertissements et encouragements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportDisciplineJournalExcel(filteredEntries)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exporter Excel
          </button>
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileBarChart className="h-4 w-4" />
            Rapports
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            Enregistrer un fait disciplinaire
          </button>
        </div>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-slate-100 pb-4">
        <KpiInline icon={ThumbsUp} iconColor="text-emerald-500" barColor="bg-emerald-500" label="Récompenses / Mérites" value={recompenses} />
        <KpiInline icon={ThumbsDown} iconColor="text-rose-500" barColor="bg-rose-500" label="Avertissements / Incidents" value={avertissements} />
        <KpiInline icon={Star} iconColor="text-indigo-500" barColor="bg-indigo-500" label="Moyenne de conduite" value={`${moyenneConduite}/20`} />
        <KpiInline icon={AlertCircle} iconColor="text-amber-500" barColor="bg-amber-500" label="Élèves sous alerte (<8)" value={elevesSousAlerte} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Répartition par sanction :</span>
        {SANCTION_LEVELS.map((s) => (
          <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {s} <span className="text-slate-900">{sanctionCounts[s] ?? 0}</span>
          </span>
        ))}
      </div>

      {conseilCases.length > 0 && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Gavel className="h-4 w-4 text-rose-600" />
            <h3 className="text-sm font-semibold text-slate-800">Conseil de Discipline — Suivi</h3>
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
              {conseilCases.filter((c) => c.conseilStatut !== 'instance_tenue').length} en attente
            </span>
          </div>
          <div className="space-y-2">
            {conseilCases.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {c.studentName} <span className="font-normal text-slate-400">({c.classe})</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.date} · {c.typeCode ? `${c.typeCode} — ` : ''}
                    {c.title}
                  </p>
                </div>
                <select
                  value={c.conseilStatut ?? 'a_convoquer'}
                  onChange={(e) => handleUpdateConseilStatut(c, e.target.value as ConseilStatut)}
                  disabled={!isEditable}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {CONSEIL_STATUTS.map((s) => (
                    <option key={s} value={s}>
                      {CONSEIL_STATUT_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un élève..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Du :</span>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-2 text-slate-700 focus:outline-none"
          />
          <span>au</span>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-2 text-slate-700 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Classe :</span>
          <select
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            {getClassOptions().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-800">Palmarès & Notes de Conduite</h3>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Élève</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Classe</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Note/20</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Statut</th>
                </tr>
              </thead>
              <tbody>
                {palmares.map((s) => {
                  const statut = statutFor(s.conduite)
                  return (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-[10px] font-bold text-white">
                            {initials(s.name)}
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-sm text-slate-600">{s.classe}</td>
                      <td className="py-3 text-sm font-bold text-slate-900">{s.conduite}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statut.className}`}>
                          {statut.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800">Journal Disciplinaire Récent</h3>
          </div>
          {filteredEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucun fait disciplinaire trouvé.</p>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Date</th>
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Élève</th>
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Type</th>
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Fait / Catégorie
                    </th>
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Commentaire
                    </th>
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Par</th>
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e) => {
                    const positive = e.points >= 0
                    return (
                      <tr key={e.id} className="border-b border-slate-50 last:border-0 align-top">
                        <td className="py-3 text-sm text-slate-600 whitespace-nowrap">{e.date}</td>
                        <td className="py-3 text-sm font-semibold text-slate-900">{e.studentName}</td>
                        <td className="py-3">
                          <span
                            className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                              positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {positive ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                            {positive ? '+' : ''}
                            {e.points}
                          </span>
                        </td>
                        <td className="py-3 text-sm font-medium text-slate-800">
                          {e.typeCode && <span className="mr-1.5 text-xs font-normal text-slate-400">{e.typeCode}</span>}
                          {e.title}
                          {e.sanction && (
                            <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                              {e.sanction}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-sm text-slate-600">{e.description}</td>
                        <td className="py-3 text-sm text-slate-500">{e.author}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPrintEntry(e)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                              title="Imprimer la notification"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(e)}
                              disabled={!isEditable}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <RegisterDisciplineModal onClose={() => setShowModal(false)} onSubmit={handleRegister} />
      )}

      {showReport && (
        <DisciplinePrintPreviewModal
          classe={classe}
          dateStart={dateStart}
          dateEnd={dateEnd}
          palmares={reportPalmares.map((s) => ({
            id: s.id,
            name: s.name,
            classe: s.classe,
            conduite: s.conduite,
            statutLabel: statutForRapport(s.conduite),
          }))}
          entries={filteredEntries}
          onClose={() => setShowReport(false)}
        />
      )}

      {printEntry && (
        <DisciplineNoticePreviewModal
          studentName={printEntry.studentName}
          classe={printEntry.classe}
          date={printEntry.date}
          author={printEntry.author}
          typeCode={printEntry.typeCode}
          title={printEntry.title}
          description={printEntry.description}
          sanction={printEntry.sanction}
          procedureStepsDone={printEntry.procedureStepsDone}
          retenueDate={printEntry.retenueDate}
          retenueDuree={printEntry.retenueDuree}
          procedureStepDetails={printEntry.procedureStepDetails}
          procedureDetailsPrintable={printEntry.procedureDetailsPrintable}
          privationActivite={printEntry.privationActivite}
          privationDuree={printEntry.privationDuree}
          onClose={() => setPrintEntry(null)}
        />
      )}
    </div>
  )
}

function KpiInline({
  icon: Icon,
  iconColor,
  barColor,
  label,
  value,
}: {
  icon: typeof ThumbsUp
  iconColor: string
  barColor: string
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`h-6 w-1 rounded-full ${barColor}`} />
      <span className="text-sm text-slate-500">
        {label} <span className="font-bold text-slate-900">{value}</span>
      </span>
      <Icon className={`h-4 w-4 ${iconColor}`} />
    </div>
  )
}
