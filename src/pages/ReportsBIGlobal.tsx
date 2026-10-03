import { useState, lazy, Suspense } from 'react'
import { BarChart4, Download, Printer, Eye, GraduationCap, Star, Users2, CalendarRange, ClipboardList, GitCompareArrows } from 'lucide-react'
import KpiCard from '../components/KpiCard'
import TrendChart from '../components/TrendChart'
import PeriodRangeFilter from '../components/PeriodRangeFilter'
import ClasseStatsTable from '../components/reports-bi/ClasseStatsTable'
import SanctionsRepartitionChart from '../components/reports-bi/SanctionsRepartitionChart'
import GroupeComparisonPanel from '../components/reports-bi/GroupeComparisonPanel'
import EffectifsDemographieSection from '../components/reports-bi/EffectifsDemographieSection'
import ServicesParNiveauSection from '../components/reports-bi/ServicesParNiveauSection'
import ActiviteMensuelleSection from '../components/reports-bi/ActiviteMensuelleSection'
import CycleSnapshotSection from '../components/reports-bi/CycleSnapshotSection'
import ClasseImpactChart from '../components/replacements/ClasseImpactChart'
import ComparatifsPanel from '../components/reports-bi/ComparatifsPanel'
import { useStudents } from '../services/studentsService'
import { useStudentExtras } from '../services/studentDetailsService'
import { useStudentIdentities } from '../services/studentIdentityService'
import { useTeachers } from '../services/teachersService'
import { useTeacherExtras } from '../services/teacherExtrasService'
import { useViewedYearId } from '../services/viewedYear'
import { getAnneesScolairesSnapshot } from '../services/anneesScolairesService'
import { useMultiYearEffectifStats } from '../services/multiYearStatsService'
import { useServicesCapacite } from '../services/servicesCapaciteService'
import { useTransportLignes } from '../services/transportLignesService'
import { computeEcoleEffectifSummary, computeEcolePeriodStats } from '../data/students'
import { computeSchoolMoyenneGeneraleByCycle, moyenneScaleForClasse } from '../utils/alertEngine'
import { cycleLabel } from '../data/alertRules'
import { computeEcoleWeeklyTrend } from '../utils/dashboardTrend'
import { computeSanctionCountsForPeriod } from '../utils/pedagogieDisciplineAggregation'
import {
  computeClasseStatsRows,
  sortClasseStatsRows,
  computeNiveauGroupComparisons,
  computeClassesCapaciteTotale,
  type ClasseStatsSortKey,
} from '../utils/reportsBIAggregation'
import { computeEffectifParAnnee } from '../utils/multiYearAggregation'
import { computeServicesGlobalCounts, computeServicesParNiveau, computeCantineCountsByRefectoire, computeCantinePrescolaireSousSol } from '../utils/servicesNiveauAggregation'
import { computeSchoolYearMonthBuckets } from '../utils/monthlyBuckets'
import {
  computeReclamationsParMois,
  computeReclamationsParType,
  computeReclamationsParTypeForPeriod,
  computeAbsencesProfsParMois,
  computeAbsencesElevesParMois,
  computeRetardsElevesParMois,
  computeDisciplineElevesParMois,
  computeCycleSnapshotTiles,
  computeAbsencesElevesParMoisEtCycle,
  computeRetardsElevesParMoisEtCycle,
  computeDisciplineElevesParMoisEtCycle,
  computeCurrentMonthActivityTiles,
} from '../utils/activiteMensuelleAggregation'
import { computeInfirmerieBilan, computeRdvBilan } from '../utils/infirmerieRdvBilan'
import {
  getAllRemplacementsFlat,
  computeClasseBreakdown,
  computeClasseBreakdownAllClasses,
  computeEquiteStats,
  getAllTeacherAbsenceDetails,
} from '../utils/replacementAggregation'
import { teacherName } from '../data/teachers'
import { computePresetRange, formatPeriodLabel, isWithinPeriod, type PeriodPresetKey } from '../utils/period'
import { downloadCSV } from '../utils/csvExport'

const ReportsBIPrintPreviewModal = lazy(() => import('../components/reports-bi-print/ReportsBIPrintPreviewModal'))

interface ReportsBIGlobalProps {
  onNavigateToClasse?: (classe: string) => void
}

const TABS = [
  { key: 'general', label: 'Vue Générale', icon: BarChart4 },
  { key: 'effectifs', label: 'Effectifs & Services', icon: Users2 },
  { key: 'activite', label: 'Activité Mensuelle', icon: CalendarRange },
  { key: 'cycle', label: 'Vue par Cycle', icon: ClipboardList },
  { key: 'comparatifs', label: 'Comparatifs', icon: GitCompareArrows },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ReportsBIGlobal({ onNavigateToClasse }: ReportsBIGlobalProps) {
  const { data: students } = useStudents()
  const { data: studentExtras } = useStudentExtras()
  const { data: teachers } = useTeachers()
  const { data: teacherExtras } = useTeacherExtras()
  const { data: identities } = useStudentIdentities()
  const { data: multiYear } = useMultiYearEffectifStats()
  const { data: capacite } = useServicesCapacite()
  const { data: transportLignes } = useTransportLignes()
  const viewedYearId = useViewedYearId()

  const [activeTab, setActiveTab] = useState<TabKey>('general')
  const [periodPreset, setPeriodPreset] = useState<PeriodPresetKey | null>('30j')
  const defaultRange = computePresetRange('30j')
  const [periodStart, setPeriodStart] = useState(defaultRange.start)
  const [periodEnd, setPeriodEnd] = useState(defaultRange.end)
  const [sortKey, setSortKey] = useState<ClasseStatsSortKey>('classe')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showPrint, setShowPrint] = useState(false)

  if (!students || !studentExtras || !teachers || !teacherExtras || !identities || !multiYear || !capacite || !transportLignes) {
    return (
      <div className="mx-auto max-w-[1800px] p-6">
        <p className="text-sm text-slate-400">Chargement...</p>
      </div>
    )
  }

  const handlePeriodPresetChange = (key: PeriodPresetKey) => {
    const range = computePresetRange(key)
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
  const moyenneEcoleParCycle = computeSchoolMoyenneGeneraleByCycle()

  const rows = computeClasseStatsRows(students, studentExtras, periodStart, periodEnd)
  const sortedRows = sortClasseStatsRows(rows, sortKey, sortDir)
  const weeklyTrend = computeEcoleWeeklyTrend(students, studentExtras, teachers, teacherExtras)
  const sanctionCounts = computeSanctionCountsForPeriod(periodStart, periodEnd)
  const totalSanctions = sortedRows.reduce((sum, r) => sum + r.incidents, 0)
  const historiquePeriode = getAllRemplacementsFlat().filter((r) => isWithinPeriod(r.date, periodStart, periodEnd))
  const remplacementsParClasse = computeClasseBreakdown(historiquePeriode)
  // Variante imprimée uniquement : le rapport BI exige que chaque classe apparaisse, y compris à
  // 0h — le graphe écran (ClasseImpactChart) garde son comportement actuel (classes touchées
  // seulement) via remplacementsParClasse ci-dessus, inchangé.
  const remplacementsParClasseImprime = computeClasseBreakdownAllClasses(historiquePeriode)
  // Partie 2 du rapport imprimé : absences par enseignant et remplaçants mobilisés sur la période.
  const profsAbsentsPeriode = (() => {
    const byTeacher = new Map<string, { name: string; seances: number; heures: number; couvertes: number }>()
    getAllTeacherAbsenceDetails()
      .filter((a) => isWithinPeriod(a.date, periodStart, periodEnd))
      .forEach((a) => {
        const row = byTeacher.get(a.teacher.id) ?? { name: teacherName(a.teacher), seances: 0, heures: 0, couvertes: 0 }
        row.seances += 1
        row.heures += a.hours
        if (a.remplacants.length > 0) row.couvertes += 1
        byTeacher.set(a.teacher.id, row)
      })
    return Array.from(byTeacher.values()).sort((a, b) => b.heures - a.heures || a.name.localeCompare(b.name))
  })()
  const remplacantsPeriode = computeEquiteStats(historiquePeriode).map((r) => ({ name: teacherName(r.teacher), count: r.count, heures: r.heures }))
  const niveauGroups = computeNiveauGroupComparisons(rows)

  const anneeData = computeEffectifParAnnee(getAnneesScolairesSnapshot(), multiYear.students, multiYear.classes)
  const servicesGlobalCounts = computeServicesGlobalCounts(students, identities)
  const servicesParNiveau = computeServicesParNiveau(students, identities)
  const cantineCountsByRefectoire = computeCantineCountsByRefectoire(servicesParNiveau)
  const cantinePrescolaireSousSol = computeCantinePrescolaireSousSol(servicesParNiveau)
  const capaciteClasses = computeClassesCapaciteTotale()
  const transportCapaciteTotal = transportLignes.reduce((sum, l) => sum + l.capacite, 0)

  const anneeDebut = getAnneesScolairesSnapshot().find((a) => a.id === viewedYearId)?.anneeDebut ?? new Date().getFullYear()
  const monthBuckets = computeSchoolYearMonthBuckets(anneeDebut)
  const reclamationsParMois = computeReclamationsParMois(students, studentExtras, monthBuckets)
  const reclamationsParType = computeReclamationsParType(students, studentExtras)
  // Variante imprimée uniquement : le reste du rapport BI est scopé à periodStart/periodEnd,
  // contrairement à l'onglet écran "Activité Mensuelle" qui reste volontairement sur l'année
  // scolaire complète (reclamationsParType ci-dessus, inchangé).
  const reclamationsParTypePeriode = computeReclamationsParTypeForPeriod(students, studentExtras, periodStart, periodEnd)
  const currentMonthActivity = computeCurrentMonthActivityTiles(students, studentExtras, teachers, teacherExtras)
  const infirmerieBilan = computeInfirmerieBilan(students, studentExtras, periodStart, periodEnd)
  const rdvBilan = computeRdvBilan(students, studentExtras, periodStart, periodEnd)
  const anneeLibelle = getAnneesScolairesSnapshot().find((a) => a.id === viewedYearId)?.libelle ?? `${anneeDebut}/${anneeDebut + 1}`
  const absencesProfsParMois = computeAbsencesProfsParMois(teachers, teacherExtras, monthBuckets)
  const absencesElevesParMois = computeAbsencesElevesParMois(students, studentExtras, monthBuckets)
  const retardsElevesParMois = computeRetardsElevesParMois(students, studentExtras, monthBuckets)
  const disciplineElevesParMois = computeDisciplineElevesParMois(students, studentExtras, monthBuckets)

  const cycleTiles = computeCycleSnapshotTiles(students, studentExtras, periodStart, periodEnd)
  const absencesParMoisEtCycle = computeAbsencesElevesParMoisEtCycle(students, studentExtras, monthBuckets)
  const retardsParMoisEtCycle = computeRetardsElevesParMoisEtCycle(students, studentExtras, monthBuckets)
  const disciplineParMoisEtCycle = computeDisciplineElevesParMoisEtCycle(students, studentExtras, monthBuckets)

  const handleSort = (key: ClasseStatsSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleExportCSV = () => {
    const headers = [
      'Classe', 'Effectif', 'Taux présence', 'Absences', 'Retards', 'Heures manquées', 'Moyenne générale', 'Sanctions', 'Points sanction', 'Conduite',
    ]
    const csvRows = sortedRows.map((r) => [
      r.classe, r.effectif, `${r.tauxPresence}%`, r.absencesCount, r.retardsCount, `${r.heuresManquees}h`,
      r.moyenneGenerale !== null ? `${r.moyenneGenerale.toFixed(1)}/${moyenneScaleForClasse(r.classe) ?? 20}` : '—', r.incidents, r.pointsSanction, `${r.moyenneConduite}/20`,
    ])
    downloadCSV(`rapports-bi_${periodStart}_${periodEnd}.csv`, headers, csvRows)
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <BarChart4 className="h-6 w-6 text-indigo-500" />
            Rapports BI
          </h1>
          <p className="text-sm text-slate-500">Tableaux et graphiques statistiques croisant assiduité, discipline et résultats par classe.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PeriodRangeFilter
            periodStart={periodStart}
            periodEnd={periodEnd}
            onDatesChange={handlePeriodDatesChange}
            presetKey={periodPreset}
            onPresetChange={handlePeriodPresetChange}
          />
          <button
            type="button"
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Télécharger le Rapport (PDF)
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
          >
            <Download className="h-4 w-4" />
            Exporter CSV
          </button>
        </div>
      </div>

      <div className="mb-5 inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'general' && (
        <>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          label="Taux de présence"
          value={`${ecolePeriod.tauxPresence}%`}
          statusText={formatPeriodLabel(periodStart, periodEnd)}
          icon={Eye}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-500"
        />
        {moyenneEcoleParCycle.map((cm) => (
          <KpiCard
            key={cm.cycle}
            label={`Moyenne ${cycleLabel(cm.cycle)}`}
            value={cm.value !== null ? cm.value.toFixed(1) : '—'}
            unit={`/${cm.scale} moy.`}
            statusText="Instantané, toutes classes notées"
            icon={Star}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
          />
        ))}
        <KpiCard
          label="Sanctions"
          value={String(totalSanctions)}
          statusText={formatPeriodLabel(periodStart, periodEnd)}
          alert={totalSanctions > 0}
          icon={BarChart4}
          iconBg={totalSanctions > 0 ? 'bg-rose-50' : 'bg-emerald-50'}
          iconColor={totalSanctions > 0 ? 'text-rose-500' : 'text-emerald-500'}
        />
      </div>

      <div className="mb-4">
        <TrendChart data={weeklyTrend} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SanctionsRepartitionChart counts={sanctionCounts} />
        <ClasseImpactChart data={remplacementsParClasse} />
      </div>

      <GroupeComparisonPanel niveauGroups={niveauGroups} />

      <ClasseStatsTable rows={sortedRows} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onNavigateToClasse={onNavigateToClasse} />
        </>
      )}

      {activeTab === 'effectifs' && (
        <div className="space-y-4">
          <EffectifsDemographieSection anneeData={anneeData} />
          <ServicesParNiveauSection
            globalCounts={servicesGlobalCounts}
            parNiveau={servicesParNiveau}
            effectif={ecoleEffectif.effectif}
            nbClasses={ecoleEffectif.nbClasses}
            capacite={capacite}
            capaciteClasses={capaciteClasses}
            transportCapaciteTotal={transportCapaciteTotal}
            cantineCountsByRefectoire={cantineCountsByRefectoire}
            cantinePrescolaireSousSol={cantinePrescolaireSousSol}
          />
        </div>
      )}

      {activeTab === 'activite' && (
        <ActiviteMensuelleSection
          reclamationsParMois={reclamationsParMois}
          reclamationsParType={reclamationsParType}
          absencesProfsParMois={absencesProfsParMois}
          absencesElevesParMois={absencesElevesParMois}
          retardsElevesParMois={retardsElevesParMois}
          disciplineElevesParMois={disciplineElevesParMois}
        />
      )}

      {activeTab === 'cycle' && (
        <CycleSnapshotSection students={students} studentExtras={studentExtras} monthBuckets={monthBuckets} />
      )}

      {activeTab === 'comparatifs' && <ComparatifsPanel />}

      {showPrint && (
        <Suspense fallback={null}>
          <ReportsBIPrintPreviewModal
            periodStart={periodStart}
            periodEnd={periodEnd}
            effectif={ecoleEffectif.effectif}
            nbClasses={ecoleEffectif.nbClasses}
            tauxPresence={ecolePeriod.tauxPresence}
            anneeLibelle={anneeLibelle}
            weeklyTrend={weeklyTrend}
            remplacementsParClasse={remplacementsParClasseImprime}
            profsAbsents={profsAbsentsPeriode}
            remplacants={remplacantsPeriode}
            rows={sortedRows}
            anneeData={anneeData}
            servicesGlobalCounts={servicesGlobalCounts}
            servicesParNiveau={servicesParNiveau}
            capacite={capacite}
            capaciteClasses={capaciteClasses}
            transportCapaciteTotal={transportCapaciteTotal}
            reclamationsParMois={reclamationsParMois}
            reclamationsParType={reclamationsParTypePeriode}
            absencesProfsParMois={absencesProfsParMois}
            absencesElevesParMois={absencesElevesParMois}
            retardsElevesParMois={retardsElevesParMois}
            disciplineElevesParMois={disciplineElevesParMois}
            cycleTiles={cycleTiles}
            absencesParMoisEtCycle={absencesParMoisEtCycle}
            retardsParMoisEtCycle={retardsParMoisEtCycle}
            disciplineParMoisEtCycle={disciplineParMoisEtCycle}
            currentMonthActivity={currentMonthActivity}
            infirmerieBilan={infirmerieBilan}
            rdvBilan={rdvBilan}
            onClose={() => setShowPrint(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
