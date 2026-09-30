import SchoolLogo from '../print/SchoolLogo'
import { formatHeures } from '../../utils/teacherAggregation'
import { formatPeriodLabel } from '../../utils/period'
import type { WeeklyTrendPoint } from '../../utils/dashboardTrend'
import type { ClasseAbsencesRow, ClasseDisciplineRow, InfirmerieSummary, ReclamationsSummary, RendezVousSummary } from '../../utils/adminReportAggregation'
import type { ClasseMoyenneRow } from '../../utils/pedagogieDisciplineAggregation'
import type { RemplacementGlobalStats, ClasseBreakdownRow } from '../../utils/replacementAggregation'
import type { ClasseNeedRow } from '../../utils/cantineAggregation'
import type { CycleMoyenne } from '../../utils/alertEngine'
import { moyenneScaleForClasse } from '../../utils/alertEngine'
import { cycleLabel } from '../../data/alertRules'
import { TendanceBarsChart, ClasseHorizontalBars, ClasseDivergingChart } from './PrintableCharts'
import { INK, MUTED, PAGE_BG, BORDER, INDIGO, TEAL, RED, PAGE_FONT } from '../print/reportTheme'
import ReportSectionTitle from '../print/ReportSectionTitle'
import ReportKpiCard from '../print/ReportKpiCard'
import ReportEmptyStateBox from '../print/ReportEmptyStateBox'
import ReportPageFooter from '../print/ReportPageFooter'

export type ReportSectionKey =
  | 'tendance'
  | 'absences'
  | 'discipline'
  | 'notes'
  | 'remplacements'
  | 'cantine'
  | 'infirmerie'
  | 'reclamations'

export const REPORT_SECTIONS: { key: ReportSectionKey; label: string }[] = [
  { key: 'tendance', label: "Tendance d'Assiduité" },
  { key: 'absences', label: 'Absences & Retards par Classe' },
  { key: 'discipline', label: 'Discipline & Sanctions' },
  { key: 'notes', label: 'Résultats Pédagogiques' },
  { key: 'remplacements', label: 'Corps Professoral & Remplacements' },
  { key: 'cantine', label: 'Cantine & Restauration' },
  { key: 'infirmerie', label: 'Infirmerie' },
  { key: 'reclamations', label: 'Réclamations & Rendez-vous' },
]

export const ALL_SECTIONS_VISIBLE: Record<ReportSectionKey, boolean> = {
  tendance: true,
  absences: true,
  discipline: true,
  notes: true,
  remplacements: true,
  cantine: true,
  infirmerie: true,
  reclamations: true,
}

export interface AdminReportData {
  periodStart: string
  periodEnd: string
  tauxPresence: number
  effectif: number
  nbClasses: number
  heuresManqueesEleves: number
  heuresManqueesProfs: number
  moyenneGeneraleByCycle: (CycleMoyenne & { elevesSousLeSeuil: number })[]
  pointsClimat: number
  climatAlert: boolean
  weeklyTrend: WeeklyTrendPoint[]
  classeAbsences: ClasseAbsencesRow[]
  classeDiscipline: ClasseDisciplineRow[]
  classesMoyenne: ClasseMoyenneRow[]
  teachersCount: number
  remplacementsStats: RemplacementGlobalStats
  remplacementsParClasse: ClasseBreakdownRow[]
  cantineInscrits: number
  cantineServisAujourdhui: number
  cantineBesoinsParClasse: ClasseNeedRow[]
  infirmerie: InfirmerieSummary
  reclamations: ReclamationsSummary
  rendezVous: RendezVousSummary
}

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

interface PrintableDashboardBilanProps extends AdminReportData {
  visibleSections?: Record<ReportSectionKey, boolean>
}

export default function PrintableDashboardBilan(props: PrintableDashboardBilanProps) {
  const visibleSections = props.visibleSections ?? ALL_SECTIONS_VISIBLE
  const {
    periodStart,
    periodEnd,
    tauxPresence,
    effectif,
    nbClasses,
    heuresManqueesEleves,
    heuresManqueesProfs,
    moyenneGeneraleByCycle,
    pointsClimat,
    climatAlert,
    weeklyTrend,
    classeAbsences,
    classeDiscipline,
    classesMoyenne,
    teachersCount,
    remplacementsStats,
    remplacementsParClasse,
    cantineInscrits,
    cantineServisAujourdhui,
    infirmerie,
    reclamations,
    rendezVous,
  } = props

  const kpis = [
    { label: 'Taux de présence', value: `${tauxPresence}%`, detail: "Moyenne de l'établissement sur la période" },
    { label: 'Élèves inscrits', value: String(effectif), detail: `Répartis dans ${nbClasses} classes` },
    { label: 'Heures manquées élèves', value: formatHeures(heuresManqueesEleves), detail: 'Sur la période sélectionnée' },
    { label: 'Heures manquées profs', value: formatHeures(heuresManqueesProfs), detail: 'Sur la période sélectionnée' },
    ...moyenneGeneraleByCycle.map((cm) => ({
      label: `Moyenne ${cycleLabel(cm.cycle)}`,
      value: cm.value !== null ? `${cm.value.toFixed(1)}/${cm.scale}` : '—',
      detail: cm.elevesSousLeSeuil > 0 ? `${cm.elevesSousLeSeuil} élève(s) sous le seuil` : 'Aucun élève sous le seuil',
    })),
    {
      label: 'Climat scolaire',
      value: `${pointsClimat} pts ce mois-ci`,
      detail: climatAlert ? 'Seuil dépassé dans au moins un cycle' : 'Sous le seuil, tous cycles',
    },
  ]

  const absencesWithHours = classeAbsences.filter((r) => r.heuresManquees > 0).sort((a, b) => b.heuresManquees - a.heuresManquees)
  const absencesNoHours = classeAbsences.filter((r) => r.heuresManquees === 0)

  const disciplineNonZero = classeDiscipline.filter((r) => r.pointsValeur !== 0 || r.pointsSanction !== 0)
  const disciplineHasData = disciplineNonZero.length > 0

  const showCantine = visibleSections.cantine
  const showInfirmerie = visibleSections.infirmerie
  const showCantineInfirmerieGrid = showCantine && showInfirmerie

  return (
    <>
      <div
        className="print-page flex flex-col gap-5 px-12 py-10"
        style={{ background: PAGE_BG, color: INK, fontFamily: PAGE_FONT }}
      >
        <header className="relative flex items-start justify-between border-b-2 pb-3.5" style={{ borderColor: INK }}>
          <div className="flex flex-col gap-0.5">
            <p className="text-[21px] font-bold tracking-tight">Groupe Scolaire Mondrian</p>
            <p className="text-[10.5px] uppercase tracking-[0.08em]" style={{ color: MUTED }}>
              École de la Bienveillance
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-right">
            <p className="text-[13.5px] font-bold">Bilan Général de la Vie Scolaire</p>
            <p className="text-[10.5px]" style={{ color: MUTED }}>
              Édité le {todayFR()}
            </p>
          </div>
          <div className="absolute left-1/2 -top-[29px] -translate-x-1/2">
            <SchoolLogo size={80} />
          </div>
        </header>

        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.03em]" style={{ color: MUTED }}>
          Période : {formatPeriodLabel(periodStart, periodEnd)}
        </p>

        <div>
          <ReportSectionTitle size="11.5px" color={INDIGO}>Indicateurs Clés</ReportSectionTitle>
          <div className="mt-2.5 grid grid-cols-3 gap-px" style={{ background: BORDER, border: `1px solid ${BORDER}` }}>
            {kpis.map((k) => (
              <ReportKpiCard key={k.label} {...k} />
            ))}
            {/* La grille est à 3 colonnes fixes, mais kpis.length varie selon les cycles actifs (Phase
                4) — sans ces cases de remplissage, une dernière ligne incomplète laisse 1 ou 2 cases
                de grille inoccupées où le fond gris du conteneur (utilisé pour l'effet de trait fin
                entre les cartes) reste visible tel quel, comme un grand rectangle vide. */}
            {Array.from({ length: (3 - (kpis.length % 3)) % 3 }).map((_, i) => (
              <div key={`filler-${i}`} style={{ background: PAGE_BG }} />
            ))}
          </div>
        </div>

        {visibleSections.tendance && (
          <div>
            <ReportSectionTitle size="11.5px" color={TEAL}>Tendance d'Assiduité — 7 Dernières Semaines</ReportSectionTitle>
            {weeklyTrend.length > 0 ? (
              <TendanceBarsChart data={weeklyTrend} />
            ) : (
              <p className="text-[10px] italic" style={{ color: MUTED }}>
                Aucune donnée disponible.
              </p>
            )}
          </div>
        )}

        {visibleSections.absences && (
          <div>
            <ReportSectionTitle size="11.5px" color={RED}>Absences & Retards par Classe</ReportSectionTitle>
            <div className="mt-2.5">
              {absencesWithHours.length > 0 ? (
                <>
                  <ClasseHorizontalBars
                    rows={absencesWithHours.map((r) => ({ label: r.classe, value: r.heuresManquees, displayValue: formatHeures(r.heuresManquees) }))}
                    color={RED}
                    trackColor="#F2DFDD"
                    valueColWidth="40px"
                  />
                  {absencesNoHours.length > 0 && (
                    <p className="mt-2.5 border-t pt-2 text-[9.5px] leading-relaxed" style={{ borderColor: BORDER, color: '#94969B' }}>
                      <strong style={{ color: '#6E7075' }}>Aucune absence : </strong>
                      {absencesNoHours.map((r) => r.classe).join(', ')}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[10px] italic" style={{ color: MUTED }}>
                  Aucune absence enregistrée sur cette période.
                </p>
              )}
            </div>
          </div>
        )}

        {visibleSections.discipline && (
          <div>
            <ReportSectionTitle size="11.5px" color={INDIGO}>Discipline & Sanctions par Classe</ReportSectionTitle>
            <div className="mt-2.5">
              {disciplineHasData ? (
                <ClasseDivergingChart data={disciplineNonZero} />
              ) : (
                <ReportEmptyStateBox>Aucune sanction enregistrée sur la période — 0 pts pour les {nbClasses} classes.</ReportEmptyStateBox>
              )}
            </div>
          </div>
        )}

        <div className="flex-1" />
        <ReportPageFooter label="Groupe Scolaire Mondrian — Rapport généré automatiquement" page="Page 1 / 2" />
      </div>

      <div
        className="print-page flex flex-col gap-[18px] px-12 py-10"
        style={{ background: PAGE_BG, color: INK, fontFamily: PAGE_FONT }}
      >
        <header className="flex items-baseline justify-between border-b pb-2.5" style={{ borderColor: '#D9D8D6' }}>
          <p className="text-[15px] font-bold">
            Groupe Scolaire Mondrian <span className="font-normal" style={{ color: MUTED }}>— suite</span>
          </p>
          <p className="text-[10px]" style={{ color: MUTED }}>
            Édité le {todayFR()}
          </p>
        </header>

        {visibleSections.notes && (
          <div>
            <ReportSectionTitle size="11.5px" color={INDIGO}>Résultats Pédagogiques par Classe</ReportSectionTitle>
            <div className="mt-2.5">
              {classesMoyenne.length === 0 ? (
                <ReportEmptyStateBox>Aucune note enregistrée sur la période.</ReportEmptyStateBox>
              ) : (
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="border-b text-left" style={{ borderColor: BORDER, color: MUTED }}>
                      <th className="py-1 pr-2 font-semibold">Classe</th>
                      <th className="py-1 text-center font-semibold">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classesMoyenne.map((row) => (
                      <tr key={row.classe} className="border-b" style={{ borderColor: '#EFEEED' }}>
                        <td className="py-1 pr-2 font-medium">{row.classe}</td>
                        <td className="py-1 text-center">{row.moyenne.toFixed(1)}/{moyenneScaleForClasse(row.classe) ?? 20}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {visibleSections.remplacements && (
          <div>
            <ReportSectionTitle size="11.5px" color={TEAL}>Corps Professoral & Remplacements</ReportSectionTitle>
            <div className="mt-2.5 mb-3 grid grid-cols-4 gap-px" style={{ background: BORDER, border: `1px solid ${BORDER}` }}>
              {[
                { label: 'Enseignants', value: String(teachersCount) },
                { label: 'Remplacements assurés', value: String(remplacementsStats.totalRemplacements) },
                { label: 'Volume horaire', value: formatHeures(remplacementsStats.totalHeures) },
                { label: 'Professeurs mobilisés', value: String(remplacementsStats.profsMobilises) },
              ].map((s) => (
                <div key={s.label} className="flex flex-col gap-1 px-3 py-2.5" style={{ background: PAGE_BG }}>
                  <div className="text-[16px] font-bold">{s.value}</div>
                  <div className="text-[9px]" style={{ color: MUTED }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            {remplacementsParClasse.length === 0 ? (
              <p className="text-[10px] italic" style={{ color: MUTED }}>
                Aucun remplacement sur cette période.
              </p>
            ) : (
              <ClasseHorizontalBars
                rows={remplacementsParClasse.map((r) => ({ label: r.classe, value: r.heures, displayValue: `${formatHeures(r.heures)} · ${r.count}x` }))}
                color={TEAL}
                trackColor="#DCEEEC"
                valueColWidth="70px"
              />
            )}
          </div>
        )}

        {(showCantine || showInfirmerie) && (
          <div
            className={showCantineInfirmerieGrid ? 'grid grid-cols-2 gap-px' : 'flex flex-col gap-px'}
            style={{ background: BORDER, border: `1px solid ${BORDER}` }}
          >
            {showCantine && (
              <div className="px-3.5 py-3" style={{ background: PAGE_BG }}>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: '#6E7075' }}>
                  Cantine & Restauration
                </div>
                <p className="text-[10.5px] leading-[1.7]" style={{ color: '#4B4D53' }}>
                  Inscrits à la cantine : <strong>{cantineInscrits}</strong>
                  <br />
                  Repas servis aujourd'hui : <strong>{cantineServisAujourdhui}</strong>
                </p>
              </div>
            )}
            {showInfirmerie && (
              <div className="px-3.5 py-3" style={{ background: PAGE_BG }}>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: '#6E7075' }}>
                  Infirmerie
                </div>
                <p className="text-[10.5px] leading-[1.7]" style={{ color: '#4B4D53' }}>
                  Passages sur la période : <strong>{infirmerie.passagesPeriode}</strong>
                  <br />
                  Élèves avec PAI : <strong>{infirmerie.elevesAvecPai}</strong> ({infirmerie.paiCritique} critique(s), {infirmerie.paiModere}{' '}
                  modéré(s))
                </p>
              </div>
            )}
          </div>
        )}

        {visibleSections.reclamations && (
          <div>
            <ReportSectionTitle size="11.5px" color={MUTED}>Réclamations Parents & Rendez-vous</ReportSectionTitle>
            <p className="mt-2.5 text-[10.5px] leading-[1.8]" style={{ color: '#4B4D53' }}>
              Réclamations sur la période : <strong>{reclamations.total}</strong> ({reclamations.enCours} en cours, {reclamations.resolues}{' '}
              résolue(s), {reclamations.enAttente} en attente)
              <br />
              Rendez-vous sur la période : <strong>{rendezVous.total}</strong> ({rendezVous.planifies} planifié(s), {rendezVous.realises}{' '}
              réalisé(s), {rendezVous.annules} annulé(s))
            </p>
          </div>
        )}

        <div className="flex flex-1 items-end justify-end">
          <div
            className="flex h-[130px] w-[130px] items-center justify-center rounded-full border-2 text-center text-[9px] uppercase tracking-[0.05em]"
            style={{ borderColor: '#A6A8AC', color: '#94969B' }}
          >
            Cachet de
            <br />
            l'établissement
          </div>
        </div>

        <ReportPageFooter label="Groupe Scolaire Mondrian — Rapport généré automatiquement" page="Page 2 / 2" />
      </div>
    </>
  )
}
