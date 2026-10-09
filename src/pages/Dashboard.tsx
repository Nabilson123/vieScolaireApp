import { useEffect, useState, lazy, Suspense } from 'react'
import { Eye, GraduationCap, Clock, Star, ShieldAlert, Users } from 'lucide-react'
import Header from '../components/Header'
import KpiCard from '../components/KpiCard'
import TrendChart from '../components/TrendChart'
import CantineCard from '../components/CantineCard'
import TransportCard from '../components/TransportCard'
import ClubsImpayesCard from '../components/ClubsImpayesCard'
import ImpactedDayCard from '../components/ImpactedDayCard'
import GoalCard from '../components/GoalCard'
import VigilanceCard from '../components/VigilanceCard'
import AlertesCentreCard from '../components/AlertesCentreCard'
import BilanDisciplinaireCard from '../components/BilanDisciplinaireCard'
import TopClassesCard from '../components/TopClassesCard'
import HeuresManqueesMatiereCard from '../components/HeuresManqueesMatiereCard'
import RepartitionIncidentsCard from '../components/RepartitionIncidentsCard'
import AgendaRdvCard from '../components/AgendaRdvCard'
import { useAlertRules } from '../services/alertRulesService'
import { useStudents } from '../services/studentsService'
import { useStudentExtras } from '../services/studentDetailsService'
import { useTeachers } from '../services/teachersService'
import { useTeacherExtras } from '../services/teacherExtrasService'
import { usePeriodes } from '../services/periodesService'
import { computeSchoolMoyenneGeneraleByCycle, computeActiveAlertsSummary } from '../utils/alertEngine'
import { cycleLabel } from '../data/alertRules'
import { markAlertsSeen } from '../utils/alertsSeenStore'
import { computeEcoleEffectifSummary, computeEcolePeriodStats } from '../data/students'
import { computeEcoleHeuresManqueesProfs } from '../utils/teacherAggregation'
import { computePresetRange, formatPeriodLabel, previousPeriodRange, isWithinPeriod, type PeriodPresetKey } from '../utils/period'
import { computeEcoleWeeklyTrend } from '../utils/dashboardTrend'
import {
  computeClasseAbsencesSummary,
  computeClasseDisciplineSummary,
  computeInfirmerieSummary,
  computeReclamationsSummary,
  computeRendezVousSummary,
} from '../utils/adminReportAggregation'
import { computeClassesMoyenne, computeSanctionCountsMois } from '../utils/pedagogieDisciplineAggregation'
import { SANCTION_LEVELS } from '../data/disciplineTypes'
import { getAllRemplacementsFlat, computeRemplacementGlobalStats, computeClasseBreakdown } from '../utils/replacementAggregation'
import { getEnrolledStudents, computeCantineStats, computeBesoinsParClasse, isPointedToday } from '../utils/cantineAggregation'
import { getStudentExtraSnapshot } from '../services/studentDetailsService'
import type { AdminReportData } from '../components/dashboard-print/PrintableDashboardBilan'
import { downloadCSV } from '../utils/csvExport'

const DashboardPrintPreviewModal = lazy(() => import('../components/dashboard-print/DashboardPrintPreviewModal'))

interface DashboardProps {
  onNavigateToStudent: (id: string) => void
  onNavigateToTeacher?: (id: string) => void
  onNavigateToClasse?: (classe: string) => void
  onNavigateToRendezVous?: () => void
  onNavigateToLunch?: () => void
  onNavigateToTransport?: () => void
  onNavigateToClubs?: () => void
  onDataChanged?: () => void
}

export default function Dashboard({
  onNavigateToStudent,
  onNavigateToTeacher,
  onNavigateToClasse,
  onNavigateToRendezVous,
  onNavigateToLunch,
  onNavigateToTransport,
  onNavigateToClubs,
  onDataChanged,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState('global')
  const [showPrint, setShowPrint] = useState(false)
  const { data: rules } = useAlertRules()
  const { data: students } = useStudents()
  const { data: studentExtras } = useStudentExtras()
  const { data: teachers } = useTeachers()
  const { data: teacherExtras } = useTeacherExtras()
  const { data: periodes } = usePeriodes()
  const moyenneEcoleParCycle = computeSchoolMoyenneGeneraleByCycle()

  const [periodPreset, setPeriodPreset] = useState<PeriodPresetKey | null>('30j')
  const defaultRange = computePresetRange('30j')
  const [periodStart, setPeriodStart] = useState(defaultRange.start)
  const [periodEnd, setPeriodEnd] = useState(defaultRange.end)

  useEffect(() => {
    if (activeTab === 'global' && rules) {
      const changed = markAlertsSeen(computeActiveAlertsSummary(rules))
      if (changed) onDataChanged?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, rules])

  if (!rules || !students || !studentExtras || !teachers || !teacherExtras || !periodes) {
    return (
      <div className="mx-auto max-w-[1800px] p-6">
        <p className="text-sm text-slate-400">Chargement...</p>
      </div>
    )
  }

  const rentreeDate = periodes.reduce<string>((min, p) => (!min || p.dateDebut < min ? p.dateDebut : min), '')

  const handlePeriodPresetChange = (key: PeriodPresetKey) => {
    const range = computePresetRange(key, rentreeDate)
    setPeriodPreset(key)
    setPeriodStart(range.start)
    setPeriodEnd(range.end)
  }

  const handlePeriodDatesChange = (start: string, end: string) => {
    setPeriodPreset(null)
    setPeriodStart(start)
    setPeriodEnd(end)
  }

  const ecoleEffectif = computeEcoleEffectifSummary(students)
  const ecolePeriod = computeEcolePeriodStats(students, studentExtras, periodStart, periodEnd)
  const heuresManqueesProfs = computeEcoleHeuresManqueesProfs(teachers, teacherExtras, periodStart, periodEnd)

  const prevRange = previousPeriodRange(periodStart, periodEnd)
  const ecolePeriodPrev = computeEcolePeriodStats(students, studentExtras, prevRange.start, prevRange.end)
  const heuresManqueesProfsPrev = computeEcoleHeuresManqueesProfs(teachers, teacherExtras, prevRange.start, prevRange.end)

  const tauxDelta = Math.round((ecolePeriod.tauxPresence - ecolePeriodPrev.tauxPresence) * 10) / 10
  const heuresDeltaEleves = Math.round((ecolePeriod.heuresManqueesEleves - ecolePeriodPrev.heuresManqueesEleves) * 10) / 10
  const heuresDeltaProfs = Math.round((heuresManqueesProfs - heuresManqueesProfsPrev) * 10) / 10

  const weeklyTrend = computeEcoleWeeklyTrend(students, studentExtras, teachers, teacherExtras)

  const summary = computeActiveAlertsSummary(rules)
  const moyenneGeneraleByCycle = moyenneEcoleParCycle.map((cm) => ({
    ...cm,
    elevesSousLeSeuil: summary.moyenne.filter((s) => s.cycle === cm.cycle).length,
  }))
  const pointsClimatTotal = summary.climat.reduce((sum, c) => sum + c.value, 0)
  const climatAlert = summary.climat.some((c) => c.alert)

  const sanctionCountsMois = computeSanctionCountsMois()
  const totalSanctionsMois = SANCTION_LEVELS.reduce((sum, s) => sum + sanctionCountsMois[s], 0)
  const SANCTION_SHORT_LABELS: Record<(typeof SANCTION_LEVELS)[number], string> = {
    'Avertissement verbal': 'Avert. verbal',
    'Avertissement écrit': 'Avert. écrit',
    Blâme: 'Blâme',
    Retenue: 'Reten.',
    "Travaux d'intérêt général": 'TIG',
    'Privation d’activités périscolaires/sportives': 'Priv. activ.',
    'Engagement parental': 'Engag.',
    'Exclusion interne': 'Exclu. int.',
    'Exclusion externe': 'Exclu. ext.',
    'Conseil de discipline': 'CD',
    'Exclusion définitive': 'Exclu. déf.',
  }
  const sanctionBreakdownText = SANCTION_LEVELS.map((s) => `${SANCTION_SHORT_LABELS[s]} ${sanctionCountsMois[s]}`).join(' · ')

  const buildAdminReportData = (): AdminReportData => {
    const classeAbsences = computeClasseAbsencesSummary(students, studentExtras, periodStart, periodEnd)
    const classeDiscipline = computeClasseDisciplineSummary(students, studentExtras, periodStart, periodEnd)
    const classesMoyenne = computeClassesMoyenne()

    const remplacementsPeriode = getAllRemplacementsFlat().filter((r) => isWithinPeriod(r.date, periodStart, periodEnd))
    const remplacementsStats = computeRemplacementGlobalStats(remplacementsPeriode)
    const remplacementsParClasse = computeClasseBreakdown(remplacementsPeriode)

    const enrolledCantine = getEnrolledStudents()
    const cantineStats = computeCantineStats(enrolledCantine)
    const cantineServisAujourdhui = enrolledCantine.filter((s) => isPointedToday(getStudentExtraSnapshot(s.id).cantine)).length
    const cantineBesoinsParClasse = computeBesoinsParClasse(enrolledCantine)

    const infirmerie = computeInfirmerieSummary(students, studentExtras, periodStart, periodEnd)
    const reclamations = computeReclamationsSummary(students, studentExtras, periodStart, periodEnd)
    const rendezVous = computeRendezVousSummary(students, studentExtras, periodStart, periodEnd)

    return {
      periodStart,
      periodEnd,
      tauxPresence: ecolePeriod.tauxPresence,
      effectif: ecoleEffectif.effectif,
      nbClasses: ecoleEffectif.nbClasses,
      heuresManqueesEleves: ecolePeriod.heuresManqueesEleves,
      heuresManqueesProfs,
      moyenneGeneraleByCycle,
      pointsClimat: pointsClimatTotal,
      climatAlert,
      weeklyTrend,
      classeAbsences,
      classeDiscipline,
      classesMoyenne,
      teachersCount: teachers.length,
      remplacementsStats,
      remplacementsParClasse,
      cantineInscrits: cantineStats.inscrits,
      cantineServisAujourdhui,
      cantineBesoinsParClasse,
      infirmerie,
      reclamations,
      rendezVous,
    }
  }

  const handleExportExcel = () => {
    const headers = ['Indicateur', 'Valeur', 'Détail']
    const rows: (string | number)[][] = [
      ['Taux de présence', `${ecolePeriod.tauxPresence}%`, "Moyenne de l'établissement sur la période"],
      ['Élèves inscrits', ecoleEffectif.effectif, `Répartis dans ${ecoleEffectif.nbClasses} classes`],
      ['Heures manquées élèves', `${ecolePeriod.heuresManqueesEleves}h`, 'Sur la période sélectionnée'],
      ['Heures manquées profs', `${heuresManqueesProfs}h`, 'Sur la période sélectionnée'],
      ...moyenneGeneraleByCycle.map((cm): (string | number)[] => [
        `Moyenne ${cycleLabel(cm.cycle)}`,
        cm.value !== null ? cm.value.toFixed(1) : '—',
        cm.elevesSousLeSeuil > 0 ? `${cm.elevesSousLeSeuil} élève(s) sous le seuil` : 'Aucun élève sous le seuil',
      ]),
      ['Climat scolaire', `${pointsClimatTotal} pts`, climatAlert ? 'Seuil dépassé' : 'Sous le seuil'],
      [],
      ['Semaine', 'Présence Élèves', 'Présence Enseignants', 'Heures Manquées Élèves', 'Heures Manquées Profs'],
      ...weeklyTrend.map((p) => [p.label, `${p.eleves}%`, `${p.enseignants}%`, `${p.heuresManqueesEleves}h`, `${p.heuresManqueesProfs}h`]),
    ]
    const suffix = periodStart && periodEnd ? `${periodStart}_${periodEnd}` : 'historique-complet'
    downloadCSV(`dashboard-${suffix}.csv`, headers, rows)
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onDataChanged={onDataChanged}
        periodStart={periodStart}
        periodEnd={periodEnd}
        periodPreset={periodPreset}
        onPeriodPresetChange={handlePeriodPresetChange}
        onPeriodDatesChange={handlePeriodDatesChange}
        onDownloadReport={() => setShowPrint(true)}
        onExportExcel={handleExportExcel}
      />

      {activeTab === 'global' && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <KpiCard
              label="Taux de présence"
              value={`${ecolePeriod.tauxPresence}%`}
              trend={tauxDelta >= 0 ? 'up' : 'down'}
              trendValue={`${tauxDelta >= 0 ? '+' : ''}${tauxDelta} pt${Math.abs(tauxDelta) >= 2 ? 's' : ''}`}
              trendLabel="vs période précédente"
              trendPositive={tauxDelta >= 0}
              statusText={formatPeriodLabel(periodStart, periodEnd)}
              icon={Eye}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-500"
            />
            <KpiCard
              label="Élèves inscrits"
              value={String(ecoleEffectif.effectif)}
              unit={`dans ${ecoleEffectif.nbClasses} cls.`}
              statusText="Effectif total de l'établissement"
              icon={GraduationCap}
              iconBg="bg-blue-50"
              iconColor="text-blue-500"
            />
            <KpiCard
              label="Heures manquées élèves"
              value={`${ecolePeriod.heuresManqueesEleves}h`}
              unit="sur la période"
              trend={heuresDeltaEleves >= 0 ? 'up' : 'down'}
              trendValue={`${heuresDeltaEleves >= 0 ? '+' : ''}${heuresDeltaEleves}h`}
              trendLabel="vs période précédente"
              trendPositive={heuresDeltaEleves <= 0}
              statusText={formatPeriodLabel(periodStart, periodEnd)}
              icon={Clock}
              iconBg="bg-orange-50"
              iconColor="text-orange-500"
            />
            <KpiCard
              label="Heures manquées profs"
              value={`${heuresManqueesProfs}h`}
              unit="sur la période"
              trend={heuresDeltaProfs >= 0 ? 'up' : 'down'}
              trendValue={`${heuresDeltaProfs >= 0 ? '+' : ''}${heuresDeltaProfs}h`}
              trendLabel="vs période précédente"
              trendPositive={heuresDeltaProfs <= 0}
              statusText={formatPeriodLabel(periodStart, periodEnd)}
              icon={Users}
              iconBg="bg-violet-50"
              iconColor="text-violet-500"
            />
            {moyenneGeneraleByCycle.map((cm) => (
              <KpiCard
                key={cm.cycle}
                label={`Moyenne ${cycleLabel(cm.cycle)}`}
                value={cm.value !== null ? cm.value.toFixed(1) : '—'}
                unit={`/${cm.scale} moy.`}
                statusText={cm.elevesSousLeSeuil > 0 ? `${cm.elevesSousLeSeuil} élève(s) sous le seuil` : 'Aucun élève sous le seuil'}
                alert={cm.elevesSousLeSeuil > 0}
                icon={Star}
                iconBg="bg-amber-50"
                iconColor="text-amber-500"
              />
            ))}
            <KpiCard
              label="Climat scolaire"
              value={`${totalSanctionsMois}`}
              unit="sanctions ce mois-ci"
              statusText={sanctionBreakdownText}
              alert={climatAlert}
              icon={ShieldAlert}
              iconBg={climatAlert ? 'bg-rose-50' : 'bg-emerald-50'}
              iconColor={climatAlert ? 'text-rose-500' : 'text-emerald-500'}
            />
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TrendChart data={weeklyTrend} />
            </div>
            <div className="space-y-4">
              <CantineCard onManage={onNavigateToLunch} />
              <TransportCard onManage={onNavigateToTransport} />
              <ClubsImpayesCard onManage={onNavigateToClubs} />
              <ImpactedDayCard />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <VigilanceCard onNavigateToStudent={onNavigateToStudent} onNavigateToTeacher={onNavigateToTeacher} />
              <AlertesCentreCard onNavigateToStudent={onNavigateToStudent} />
            </div>
            <GoalCard />
          </div>
        </>
      )}

      {activeTab === 'pedagogie' && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BilanDisciplinaireCard />
            <TopClassesCard onNavigateToClasse={(classe) => onNavigateToClasse?.(classe)} />
          </div>
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HeuresManqueesMatiereCard />
            <RepartitionIncidentsCard />
          </div>
          <VigilanceCard onNavigateToStudent={onNavigateToStudent} onNavigateToTeacher={onNavigateToTeacher} />
        </>
      )}

      {activeTab === 'agenda' && (
        <AgendaRdvCard onNavigateToStudent={onNavigateToStudent} onViewAll={onNavigateToRendezVous} />
      )}

      {showPrint && (
        <Suspense fallback={null}>
          <DashboardPrintPreviewModal data={buildAdminReportData()} onClose={() => setShowPrint(false)} />
        </Suspense>
      )}
    </div>
  )
}
