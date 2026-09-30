import { useEffect, useMemo, useState } from 'react'
import { GitCompareArrows, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import PeriodRangeFilter from '../PeriodRangeFilter'
import { useStudents } from '../../services/studentsService'
import { useStudentExtras } from '../../services/studentDetailsService'
import { useTeachers } from '../../services/teachersService'
import { useTeacherExtras } from '../../services/teacherExtrasService'
import { getAnneesScolairesSnapshot } from '../../services/anneesScolairesService'
import { computeEcolePeriodStats, computeEcoleEffectifSummary } from '../../data/students'
import { computeSanctionCountsForPeriod } from '../../utils/pedagogieDisciplineAggregation'
import {
  fetchYearDataset,
  fetchTeacherYearDataset,
  computeMoyenneGeneraleForDatasetByCycle,
  computeSanctionCountsForDataset,
  computeAbsenceRetardSplit,
  computeMoyenneConduiteForDataset,
  computeHeuresManqueesProfs,
  totalSanctions,
  diffValue,
  type YearDataset,
  type TeacherYearDataset,
} from '../../services/comparatifsService'
import { cycleLabel } from '../../data/alertRules'

type Mode = 'periodes' | 'annees'

interface Metric {
  key: string
  label: string
  valueA: number | null
  valueB: number | null
  unit: string
  higherIsBetter: boolean
  decimals?: number
}

function formatMetricValue(v: number | null, unit: string, decimals: number): string {
  if (v === null) return '—'
  return `${v.toFixed(decimals)}${unit}`
}

function MetricRow({ metric }: { metric: Metric }) {
  const decimals = metric.decimals ?? 0
  const { delta } = diffValue(metric.valueA, metric.valueB)
  const improved = delta !== null && (metric.higherIsBetter ? delta > 0 : delta < 0)
  const worsened = delta !== null && (metric.higherIsBetter ? delta < 0 : delta > 0)
  const TrendIcon = improved ? TrendingUp : worsened ? TrendingDown : Minus
  const trendColor = delta === null || delta === 0 ? 'text-slate-400' : improved ? 'text-emerald-500' : 'text-rose-500'

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{metric.label}</p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase text-slate-400">A</p>
          <p className="text-lg font-bold text-slate-700">{formatMetricValue(metric.valueA, metric.unit, decimals)}</p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${trendColor}`}>
          <TrendIcon className="h-4 w-4" />
          {delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(decimals)}${metric.unit}` : '—'}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase text-slate-400">B</p>
          <p className="text-lg font-bold text-indigo-600">{formatMetricValue(metric.valueB, metric.unit, decimals)}</p>
        </div>
      </div>
    </div>
  )
}

export default function ComparatifsPanel() {
  const [mode, setMode] = useState<Mode>('periodes')
  const { data: students = [] } = useStudents()
  const { data: extras = {} } = useStudentExtras()
  const { data: teachers = [] } = useTeachers()
  const { data: teacherExtras = {} } = useTeacherExtras()

  const [startA, setStartA] = useState('')
  const [endA, setEndA] = useState('')
  const [startB, setStartB] = useState('')
  const [endB, setEndB] = useState('')

  // Mode années : même tranche de dates (ex. 01/09 → 30/09) appliquée à chaque année, pour comparer
  // une période équivalente d'une année sur l'autre plutôt que l'année entière.
  const [yearPeriodStartA, setYearPeriodStartA] = useState('')
  const [yearPeriodEndA, setYearPeriodEndA] = useState('')
  const [yearPeriodStartB, setYearPeriodStartB] = useState('')
  const [yearPeriodEndB, setYearPeriodEndB] = useState('')

  const annees = getAnneesScolairesSnapshot()
  const [yearAId, setYearAId] = useState(annees[1]?.id ?? annees[0]?.id ?? '')
  const [yearBId, setYearBId] = useState(annees[0]?.id ?? '')
  const [datasetA, setDatasetA] = useState<YearDataset | null>(null)
  const [datasetB, setDatasetB] = useState<YearDataset | null>(null)
  const [teacherDatasetA, setTeacherDatasetA] = useState<TeacherYearDataset | null>(null)
  const [teacherDatasetB, setTeacherDatasetB] = useState<TeacherYearDataset | null>(null)
  const [loadingYears, setLoadingYears] = useState(false)

  useEffect(() => {
    if (mode !== 'annees' || !yearAId || !yearBId) return
    let cancelled = false
    setLoadingYears(true)
    Promise.all([
      fetchYearDataset(yearAId),
      fetchYearDataset(yearBId),
      fetchTeacherYearDataset(yearAId),
      fetchTeacherYearDataset(yearBId),
    ])
      .then(([a, b, ta, tb]) => {
        if (cancelled) return
        setDatasetA(a)
        setDatasetB(b)
        setTeacherDatasetA(ta)
        setTeacherDatasetB(tb)
      })
      .finally(() => {
        if (!cancelled) setLoadingYears(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode, yearAId, yearBId])

  const metrics: Metric[] = useMemo(() => {
    if (mode === 'periodes') {
      const statsA = computeEcolePeriodStats(students, extras, startA, endA)
      const statsB = computeEcolePeriodStats(students, extras, startB, endB)
      const splitA = computeAbsenceRetardSplit(students, extras, startA, endA)
      const splitB = computeAbsenceRetardSplit(students, extras, startB, endB)
      const sanctionsA = totalSanctions(computeSanctionCountsForPeriod(startA, endA))
      const sanctionsB = totalSanctions(computeSanctionCountsForPeriod(startB, endB))
      const profsA = computeHeuresManqueesProfs(teachers, teacherExtras, startA, endA)
      const profsB = computeHeuresManqueesProfs(teachers, teacherExtras, startB, endB)
      return [
        { key: 'taux', label: 'Taux de présence', valueA: statsA.tauxPresence, valueB: statsB.tauxPresence, unit: '%', higherIsBetter: true, decimals: 1 },
        { key: 'absences', label: "Heures d'absence (élèves)", valueA: splitA.absenceHeures, valueB: splitB.absenceHeures, unit: 'h', higherIsBetter: false },
        { key: 'retards', label: 'Heures de retard (élèves)', valueA: splitA.retardHeures, valueB: splitB.retardHeures, unit: 'h', higherIsBetter: false },
        { key: 'profs', label: 'Heures manquées (profs)', valueA: profsA, valueB: profsB, unit: 'h', higherIsBetter: false },
        { key: 'sanctions', label: 'Sanctions disciplinaires', valueA: sanctionsA, valueB: sanctionsB, unit: '', higherIsBetter: false },
      ]
    }
    if (!datasetA || !datasetB || !teacherDatasetA || !teacherDatasetB) return []
    const effA = computeEcoleEffectifSummary(datasetA.students)
    const effB = computeEcoleEffectifSummary(datasetB.students)
    const statsA = computeEcolePeriodStats(datasetA.students, datasetA.extras, yearPeriodStartA, yearPeriodEndA)
    const statsB = computeEcolePeriodStats(datasetB.students, datasetB.extras, yearPeriodStartB, yearPeriodEndB)
    const splitA = computeAbsenceRetardSplit(datasetA.students, datasetA.extras, yearPeriodStartA, yearPeriodEndA)
    const splitB = computeAbsenceRetardSplit(datasetB.students, datasetB.extras, yearPeriodStartB, yearPeriodEndB)
    const moyByCycleA = computeMoyenneGeneraleForDatasetByCycle(datasetA.students, datasetA.extras)
    const moyByCycleB = computeMoyenneGeneraleForDatasetByCycle(datasetB.students, datasetB.extras)
    const moyenneCycles = Array.from(new Set([...moyByCycleA.map((c) => c.cycle), ...moyByCycleB.map((c) => c.cycle)]))
    const conduiteA = computeMoyenneConduiteForDataset(datasetA.students, datasetA.extras)
    const conduiteB = computeMoyenneConduiteForDataset(datasetB.students, datasetB.extras)
    const sancA = totalSanctions(computeSanctionCountsForDataset(datasetA.students, datasetA.extras, yearPeriodStartA, yearPeriodEndA))
    const sancB = totalSanctions(computeSanctionCountsForDataset(datasetB.students, datasetB.extras, yearPeriodStartB, yearPeriodEndB))
    const profsA = computeHeuresManqueesProfs(teacherDatasetA.teachers, teacherDatasetA.extras, yearPeriodStartA, yearPeriodEndA)
    const profsB = computeHeuresManqueesProfs(teacherDatasetB.teachers, teacherDatasetB.extras, yearPeriodStartB, yearPeriodEndB)
    // Effectif / moyenne générale / conduite ne sont pas datées dans ce modèle de données —
    // elles restent sur l'année entière même quand une période est filtrée, on le précise pour éviter toute confusion.
    const periodActive = Boolean(yearPeriodStartA || yearPeriodEndA || yearPeriodStartB || yearPeriodEndB)
    const wholeYearSuffix = periodActive ? ' (année entière)' : ''
    return [
      { key: 'effectif', label: `Effectif${wholeYearSuffix}`, valueA: effA.effectif, valueB: effB.effectif, unit: '', higherIsBetter: true },
      { key: 'taux', label: 'Taux de présence', valueA: statsA.tauxPresence, valueB: statsB.tauxPresence, unit: '%', higherIsBetter: true, decimals: 1 },
      { key: 'absences', label: "Heures d'absence (élèves)", valueA: splitA.absenceHeures, valueB: splitB.absenceHeures, unit: 'h', higherIsBetter: false },
      { key: 'retards', label: 'Heures de retard (élèves)', valueA: splitA.retardHeures, valueB: splitB.retardHeures, unit: 'h', higherIsBetter: false },
      { key: 'profs', label: 'Heures manquées (profs)', valueA: profsA, valueB: profsB, unit: 'h', higherIsBetter: false },
      ...moyenneCycles.map((cycle) => {
        const cmA = moyByCycleA.find((c) => c.cycle === cycle)
        const cmB = moyByCycleB.find((c) => c.cycle === cycle)
        const scale = cmA?.scale ?? cmB?.scale ?? 20
        return {
          key: `moyenne-${cycle}`,
          label: `Moyenne ${cycleLabel(cycle)}${wholeYearSuffix}`,
          valueA: cmA?.value ?? null,
          valueB: cmB?.value ?? null,
          unit: `/${scale}`,
          higherIsBetter: true,
          decimals: 2,
        }
      }),
      { key: 'conduite', label: `Moyenne de conduite${wholeYearSuffix}`, valueA: conduiteA, valueB: conduiteB, unit: '/20', higherIsBetter: true, decimals: 1 },
      { key: 'sanctions', label: 'Sanctions disciplinaires', valueA: sancA, valueB: sancB, unit: '', higherIsBetter: false },
    ]
  }, [
    mode,
    students,
    extras,
    teachers,
    teacherExtras,
    startA,
    endA,
    startB,
    endB,
    datasetA,
    datasetB,
    teacherDatasetA,
    teacherDatasetB,
    yearPeriodStartA,
    yearPeriodEndA,
    yearPeriodStartB,
    yearPeriodEndB,
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode('periodes')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${mode === 'periodes' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
        >
          Deux périodes
        </button>
        <button
          type="button"
          onClick={() => setMode('annees')}
          className={`rounded-full px-4 py-2 text-sm font-medium ${mode === 'annees' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
        >
          Deux années scolaires
        </button>
      </div>

      {mode === 'periodes' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Période A</p>
            <PeriodRangeFilter periodStart={startA} periodEnd={endA} onDatesChange={(s, e) => { setStartA(s); setEndA(e) }} />
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Période B</p>
            <PeriodRangeFilter periodStart={startB} periodEnd={endB} onDatesChange={(s, e) => { setStartB(s); setEndB(e) }} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Année A</p>
            <select value={yearAId} onChange={(e) => setYearAId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none">
              {annees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle}
                </option>
              ))}
            </select>
            <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Période dans l'année A (optionnel)</p>
            <PeriodRangeFilter periodStart={yearPeriodStartA} periodEnd={yearPeriodEndA} onDatesChange={(s, e) => { setYearPeriodStartA(s); setYearPeriodEndA(e) }} />
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Année B</p>
            <select value={yearBId} onChange={(e) => setYearBId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none">
              {annees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle}
                </option>
              ))}
            </select>
            <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Période dans l'année B (optionnel)</p>
            <PeriodRangeFilter periodStart={yearPeriodStartB} periodEnd={yearPeriodEndB} onDatesChange={(s, e) => { setYearPeriodStartB(s); setYearPeriodEndB(e) }} />
          </div>
        </div>
      )}

      {mode === 'annees' && loadingYears ? (
        <p className="py-10 text-center text-sm text-slate-400">Chargement des deux années…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <MetricRow key={m.key} metric={m} />
          ))}
        </div>
      )}

      {mode === 'annees' && metrics.length === 0 && !loadingYears && (
        <p className="py-6 text-center text-sm text-slate-400">
          <GitCompareArrows className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          Sélectionnez deux années scolaires à comparer.
        </p>
      )}
    </div>
  )
}
