import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import type { Student } from '../../data/students'
import type { StudentExtra } from '../../data/studentDetails'
import type { MonthBucket } from '../../utils/monthlyBuckets'
import {
  computeCycleSnapshotTiles,
  computeAbsencesElevesParMoisEtCycle,
  computeRetardsElevesParMoisEtCycle,
  computeDisciplineElevesParMoisEtCycle,
  type CycleTileCounts,
} from '../../utils/activiteMensuelleAggregation'
import PeriodRangeFilter from '../PeriodRangeFilter'
import StackedBarChart from './StackedBarChart'

interface CycleSnapshotSectionProps {
  students: Student[]
  studentExtras: Record<string, StudentExtra>
  monthBuckets: MonthBucket[]
}

const CYCLE_SERIES = [
  { key: 'maternelle', color: '#f59e0b', label: 'Maternelle' },
  { key: 'primaire', color: '#6366f1', label: 'Primaire' },
  { key: 'college', color: '#0ea5e9', label: 'Collège' },
]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function CycleKpiTile({ label, counts }: { label: string; counts: CycleTileCounts }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mb-1 text-2xl font-bold text-slate-900">{counts.total}</p>
      <p className="text-xs text-slate-400">
        Mat : {counts.maternelle} · Pri : {counts.primaire} · Col : {counts.college}
      </p>
    </div>
  )
}

export default function CycleSnapshotSection({ students, studentExtras, monthBuckets }: CycleSnapshotSectionProps) {
  const [periodStart, setPeriodStart] = useState(todayISO())
  const [periodEnd, setPeriodEnd] = useState(todayISO())

  const tiles = computeCycleSnapshotTiles(students, studentExtras, periodStart, periodEnd)
  const absencesParMoisEtCycle = computeAbsencesElevesParMoisEtCycle(students, studentExtras, monthBuckets)
  const retardsParMoisEtCycle = computeRetardsElevesParMoisEtCycle(students, studentExtras, monthBuckets)
  const disciplineParMoisEtCycle = computeDisciplineElevesParMoisEtCycle(students, studentExtras, monthBuckets)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ClipboardList className="h-4 w-4 text-indigo-500" />
          Instantané par Cycle
        </h3>
        <PeriodRangeFilter
          periodStart={periodStart}
          periodEnd={periodEnd}
          onDatesChange={(start, end) => {
            setPeriodStart(start)
            setPeriodEnd(end)
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <CycleKpiTile label="Abs. en nbre d'élèves" counts={tiles.absencesEleves} />
        <CycleKpiTile label="Ret. en nbre d'élèves" counts={tiles.retardsEleves} />
        <CycleKpiTile label="Problèmes disciplinaires" counts={tiles.disciplineEleves} />
        <CycleKpiTile label="Abs. en nbre de séances" counts={tiles.absencesSeances} />
        <CycleKpiTile label="Ret. en nbre de séances" counts={tiles.retardsSeances} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <StackedBarChart title="Absences des élèves par mois" data={absencesParMoisEtCycle} series={CYCLE_SERIES} heightClass="h-48" />
        <StackedBarChart title="Retards des élèves par mois" data={retardsParMoisEtCycle} series={CYCLE_SERIES} heightClass="h-48" />
        <StackedBarChart title="Problèmes disciplinaires par mois" data={disciplineParMoisEtCycle} series={CYCLE_SERIES} heightClass="h-48" />
      </div>
    </div>
  )
}
