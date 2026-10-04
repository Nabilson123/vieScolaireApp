import { Fragment, type ReactNode } from 'react'
import SchoolLogo from '../print/SchoolLogo'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import { formatPeriodLabel } from '../../utils/period'
import type { WeeklyTrendPoint } from '../../utils/dashboardTrend'
import type { ClasseStatsRow } from '../../utils/reportsBIAggregation'
import { occupancyLevel, occupancyPct } from '../../utils/reportsBIAggregation'
import type { ClasseBreakdownRow } from '../../utils/replacementAggregation'
import type { AnneeEffectifPoint } from '../../utils/multiYearAggregation'
import type { ServicesGlobalCounts, ServiceNiveauPoint } from '../../utils/servicesNiveauAggregation'
import { computeCantineCountsByRefectoire, computeCantinePrescolaireSousSol } from '../../utils/servicesNiveauAggregation'
import type { ServicesCapacite } from '../../services/servicesCapaciteService'
import type { CycleSnapshotTiles, MonthCycleStack } from '../../utils/activiteMensuelleAggregation'
import { cycleOfClasse } from '../../utils/alertEngine'
import type { InfirmerieBilan, RdvBilan, CountRow } from '../../utils/infirmerieRdvBilan'

export interface PrintableReportsBIProps {
  periodStart: string
  periodEnd: string
  effectif: number
  nbClasses: number
  tauxPresence: number
  anneeLibelle: string
  weeklyTrend: WeeklyTrendPoint[]
  remplacementsParClasse: ClasseBreakdownRow[]
  /** Enseignants absents sur la période : séances, heures, séances remplacées. */
  profsAbsents: { name: string; seances: number; heures: number; couvertes: number }[]
  /** Remplaçants mobilisés sur la période. */
  remplacants: { name: string; count: number; heures: number }[]
  rows: ClasseStatsRow[]
  anneeData: AnneeEffectifPoint[]
  servicesGlobalCounts: ServicesGlobalCounts
  servicesParNiveau: ServiceNiveauPoint[]
  capacite: ServicesCapacite
  /** Somme des capacités des 5 lignes de transport — remplace capacite.transportCapacite (obsolète). */
  transportCapaciteTotal: number
  reclamationsParMois: { label: string; value: number }[]
  reclamationsParType: { label: string; value: number }[]
  absencesProfsParMois: { label: string; value: number }[]
  absencesElevesParMois: { label: string; value: number }[]
  retardsElevesParMois: { label: string; value: number }[]
  disciplineElevesParMois: { label: string; value: number }[]
  cycleTiles: CycleSnapshotTiles
  absencesParMoisEtCycle: MonthCycleStack[]
  retardsParMoisEtCycle: MonthCycleStack[]
  disciplineParMoisEtCycle: MonthCycleStack[]
  infirmerieBilan: InfirmerieBilan
  rdvBilan: RdvBilan
}

// Palette partagée avec le Cockpit Opérationnel (Phase 25) — mêmes tokens oklch, IBM Plex Sans/Mono
// déjà chargées dans index.html — plus quelques tokens propres à ce document (band/flagRow...).
const SANS = "'IBM Plex Sans', sans-serif"
const MONO = "'IBM Plex Mono', monospace"

const C = {
  ink: 'oklch(0.25 0.02 255)',
  inkSoft: 'oklch(0.3 0.02 255)',
  inkMuted: 'oklch(0.45 0.015 255)',
  muted: 'oklch(0.58 0.015 255)',
  ruleStrong: 'oklch(0.82 0.01 255)',
  rule: 'oklch(0.88 0.008 255)',
  ruleSoft: 'oklch(0.92 0.006 255)',
  dashGrey: 'oklch(0.65 0.01 255)',
  panel: 'oklch(0.975 0.006 255)',
  paperTint: 'oklch(0.99 0.004 255)',
  accentBlue: 'oklch(0.52 0.13 255)',
  accentBlueDark: 'oklch(0.42 0.1 255)',
  red: 'oklch(0.55 0.17 25)',
  redDark: 'oklch(0.55 0.16 25)',
  amber: 'oklch(0.58 0.14 70)',
  amberDark: 'oklch(0.5 0.13 70)',
  green: 'oklch(0.52 0.13 155)',
  greenText: 'oklch(0.42 0.11 155)',
  band: 'oklch(0.93 0.008 255)',
  bandSoft: 'oklch(0.965 0.006 255)',
  flagRow: 'oklch(0.96 0.025 25)',
  flagBorder: 'oklch(0.78 0.1 25)',
} as const

const OCCUPANCY_COLORS = { ok: C.green, warn: C.amber, over: C.red }

const RECLAMATION_COLORS: Record<string, string> = {
  Notes: C.accentBlue,
  'Absence / Assiduité': C.amber,
  Comportement: C.red,
  Cantine: C.green,
  Transport: 'oklch(0.55 0.12 300)',
}

const CYCLE_DEFS: { key: 'maternelle' | 'primaire' | 'college'; name: string }[] = [
  { key: 'maternelle', name: 'Maternelle' },
  { key: 'primaire', name: 'Primaire' },
  { key: 'college', name: 'Collège' },
]

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR')
}

/** Décimale à la française (virgule). */
function fr1(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

/** Format court "X h MM" — copie exacte de PrintableCockpitReport.tsx (Phase 25), distincte de
 * formatHeures() ("1h 10min") utilisé ailleurs dans l'app. */
function formatDureeCourte(hours: number): string {
  const totalMin = Math.round(hours * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')}`
}

/** Heures décimales agrégées (colonne "Heures manq.", tuiles KPI) — espace insécable avant l'unité. */
function heuresDecimalFR(hours: number): string {
  return `${fr1(hours)} h`
}

function periodeJours(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`).getTime()
  const e = new Date(`${end}T00:00:00`).getTime()
  return Math.max(1, Math.round((e - s) / 86400000) + 1)
}

/** Établit un flow-root autour de chaque bloc paginé : sans ça, la marge basse propre à chaque
 * section (margin-bottom) est exclue de la mesure hors-écran de PaginatedPrintDocument (même
 * pattern que PrintableNoteService.tsx). */
function flowRoot(node: ReactNode) {
  return <div style={{ display: 'flow-root' }}>{node}</div>
}

const emptyPanel = {
  margin: '4px 0 0',
  padding: '9px 12px',
  background: C.panel,
  fontFamily: SANS,
  fontSize: '9pt',
  lineHeight: 1.5,
  color: C.inkMuted,
} as const

/** Bandeau d'ouverture d'une des grandes parties du rapport. */
function PartTitle({ num, title, subtitle }: { num: number; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.ink, color: '#fff', padding: '9px 14px', marginBottom: 2 }}>
      <span style={{ fontFamily: MONO, fontSize: '18pt', fontWeight: 700, lineHeight: 1, color: 'oklch(0.8 0.08 255)' }}>{String(num).padStart(2, '0')}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h2 style={{ margin: 0, fontFamily: SANS, fontSize: '13.5pt', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{title}</h2>
        <span style={{ fontFamily: MONO, fontSize: '7.5pt', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'oklch(0.82 0.02 255)' }}>{subtitle}</span>
      </div>
    </div>
  )
}

/** Sous-partie numérotée (ex. « 2.1 Évolution des absences ») à l'intérieur d'une grande partie. */
function Section({
  num,
  title,
  annotation,
  annotationColor,
  children,
}: {
  num: string
  title: string
  annotation: string
  annotationColor?: string
  children: ReactNode
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, borderBottom: `1.5px solid ${C.ink}`, paddingBottom: 5, marginBottom: 3 }}>
        <span style={{ fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600, color: C.accentBlue }}>{num}</span>
        <h3 style={{ margin: 0, fontFamily: SANS, fontSize: '11pt', fontWeight: 700, letterSpacing: '-0.01em', color: C.ink }}>{title}</h3>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: '8.5pt', color: annotationColor ?? C.muted }}>{annotation}</span>
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  )
}

/** Tableau simple à en-tête sombre (listes profs absents / remplaçants). */
function SimpleTable({ columns, headers, rows }: { columns: string; headers: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 1, background: C.rule, border: `1px solid ${C.rule}`, fontSize: '8.5pt' }}>
      {headers.map((h, i) => (
        <div
          key={h}
          style={{
            padding: '5px 6px',
            textAlign: i === 0 ? 'left' : 'center',
            fontFamily: MONO,
            fontWeight: 600,
            fontSize: '7.5pt',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#fff',
            background: C.ink,
          }}
        >
          {h}
        </div>
      ))}
      {rows.map((cells, r) =>
        cells.map((cell, i) => (
          <div key={`${r}-${i}`} style={{ padding: '4px 6px', background: C.paperTint, textAlign: i === 0 ? 'left' : 'center', fontWeight: i === 0 ? 600 : 400 }}>
            {cell}
          </div>
        ))
      )}
    </div>
  )
}

function KpiTile({ value, color, label, sub }: { value: string; color: string; label: string; sub: string }) {
  return (
    <div style={{ background: C.paperTint, padding: '8px 10px 9px', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontFamily: SANS, fontSize: '17pt', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color }}>{value}</div>
      <div style={{ fontFamily: SANS, fontSize: '8.5pt', lineHeight: 1.3, fontWeight: 600, color: C.inkSoft }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: '7.5pt', color: C.muted }}>{sub}</div>
    </div>
  )
}

interface BarRow {
  label: string
  value: number
}

function LabeledBars({ rows, color, emptyText, labelWidth = 40 }: { rows: BarRow[]; color: string; emptyText: string; labelWidth?: number }) {
  const hasData = rows.some((r) => r.value > 0)
  if (!hasData) {
    return (
      <p style={{ fontSize: '8.5pt', fontStyle: 'italic', color: C.muted, margin: 0 }}>{emptyText}</p>
    )
  }
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: `${labelWidth}px minmax(0,1fr) 24px`, alignItems: 'center', gap: 6, padding: '2px 0' }}>
          <span style={{ fontFamily: MONO, fontSize: '7.5pt' }}>{r.label}</span>
          <div style={{ height: 7, background: C.ruleSoft }}>
            <div style={{ height: '100%', width: `${Math.round((r.value / max) * 100)}%`, background: color }} />
          </div>
          <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: '7.5pt', fontWeight: 600 }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Barres horizontales à libellé libre (motifs saisis à la main) : libellé tronqué à gauche, valeur à droite. */
function CountBars({ rows, color, emptyText, labelWidth = 150 }: { rows: CountRow[]; color: string; emptyText: string; labelWidth?: number }) {
  if (rows.length === 0) {
    return <p style={{ fontSize: '8.5pt', fontStyle: 'italic', color: C.muted, margin: 0 }}>{emptyText}</p>
  }
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: `${labelWidth}px minmax(0,1fr) 24px`, alignItems: 'center', gap: 6, padding: '2px 0' }}>
          <span title={r.label} style={{ fontSize: '8.5pt', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.label}
          </span>
          <div style={{ height: 7, background: C.ruleSoft }}>
            <div style={{ height: '100%', width: `${Math.round((r.value / max) * 100)}%`, background: color }} />
          </div>
          <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: '7.5pt', fontWeight: 600 }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function formatDateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function TitledBars({ title, color, rows, emptyText, labelWidth }: { title: string; color: string; rows: BarRow[]; emptyText: string; labelWidth?: number }) {
  return (
    <div>
      <p style={{ fontFamily: MONO, fontSize: '7.5pt', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color, marginBottom: 4 }}>{title}</p>
      <LabeledBars rows={rows} color={color} emptyText={emptyText} labelWidth={labelWidth} />
    </div>
  )
}

interface GroupedColumnPoint {
  label: string
  a: number
  b: number
}

/** Diagramme en bâtons groupés (une paire de colonnes par catégorie) — même patron visuel que la
 * section 01 "Tendance d'assiduité" (barres verticales, étiquette de valeur au-dessus, légende
 * couleur en dessous), réutilisé ici pour comparer deux séries (ex. Garde Matin vs Soir) niveau par
 * niveau plutôt que semaine par semaine. */
function GroupedColumnsChart({
  title,
  points,
  colorA,
  colorB,
  labelA,
  labelB,
  emptyText,
}: {
  title: string
  points: GroupedColumnPoint[]
  colorA: string
  colorB: string
  labelA: string
  labelB: string
  emptyText: string
}) {
  const hasData = points.some((p) => p.a > 0 || p.b > 0)
  return (
    <div>
      <p style={{ fontFamily: MONO, fontSize: '7.5pt', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.inkSoft, marginBottom: 4 }}>{title}</p>
      {!hasData ? (
        <p style={{ fontSize: '8.5pt', fontStyle: 'italic', color: C.muted, margin: 0 }}>{emptyText}</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90, paddingTop: 10 }}>
            {(() => {
              const max = Math.max(1, ...points.flatMap((p) => [p.a, p.b]))
              return points.map((p) => {
                const hA = Math.max(2, Math.round((p.a / max) * 58))
                const hB = Math.max(2, Math.round((p.b / max) * 58))
                return (
                  <div key={p.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 72 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <span style={{ fontFamily: MONO, fontSize: '6pt', color: colorA, minHeight: 7 }}>{p.a > 0 ? p.a : ''}</span>
                        <div style={{ width: 9, height: hA, background: colorA }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <span style={{ fontFamily: MONO, fontSize: '6pt', color: colorB, minHeight: 7 }}>{p.b > 0 ? p.b : ''}</span>
                        <div style={{ width: 9, height: hB, background: colorB }} />
                      </div>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: '6.5pt', color: C.muted }}>{p.label}</span>
                  </div>
                )
              })
            })()}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: '8pt', color: C.muted }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, background: colorA, display: 'inline-block' }} /> {labelA}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, background: colorB, display: 'inline-block' }} /> {labelB}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

const CLASSE_TABLE_COLUMNS = '1fr 0.7fr 0.8fr 0.8fr 0.7fr 0.9fr 0.8fr 0.8fr'
const CLASSE_TABLE_HEADERS = ['Classe', 'Effectif', 'Présence', 'Absences', 'Retards', 'Heures manq.', 'Sanctions', 'Conduite']

function ClasseTableHeaderCells() {
  return (
    <>
      {CLASSE_TABLE_HEADERS.map((h) => (
        <div
          key={h}
          style={{
            padding: '5px 6px',
            textAlign: 'center',
            fontFamily: MONO,
            fontWeight: 600,
            fontSize: '7.5pt',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#fff',
            background: C.ink,
          }}
        >
          {h}
        </div>
      ))}
    </>
  )
}

interface ClasseGroup {
  name: string
  rows: (ClasseStatsRow & { flagged: boolean })[]
  effectif: number
  absences: number
  retards: number
  heures: number
  sanctions: number
  conduite: number | null
}

/** Une tranche (un cycle) du tableau « Assiduité par classe » — répète l'en-tête de colonnes pour
 * rester lisible si la tranche démarre une nouvelle page. Ce découpage par cycle (au lieu d'un seul
 * bloc de ~19 classes) donne au moteur de pagination la granularité nécessaire pour combler le reste
 * d'une page plutôt que de forcer systématiquement une page quasi vide dès que le tableau entier ne
 * tient pas — même raison que le découpage tête/queue de la section 02. */
function ClasseGroupGrid({ group }: { group: ClasseGroup }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: CLASSE_TABLE_COLUMNS, gap: 1, background: C.rule, border: `1px solid ${C.rule}`, fontSize: '8.5pt' }}>
      <ClasseTableHeaderCells />
      <div
        style={{
          gridColumn: '1 / -1',
          padding: '4px 6px',
          background: C.band,
          fontFamily: MONO,
          fontSize: '7.5pt',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {group.name}
      </div>
      {group.rows.map((r) => {
        const bg = r.flagged ? C.flagRow : C.paperTint
        const retardFlag = r.retardsCount >= 10
        return (
          <Fragment key={r.classe}>
            <div style={{ padding: '4px 6px', background: bg, fontWeight: 600 }}>{r.classe}</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: bg }}>{r.effectif}</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: bg }}>{fr1(r.tauxPresence)}%</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: bg, color: r.flagged ? C.redDark : undefined, fontWeight: r.flagged ? 700 : 400 }}>
              {r.absencesCount}
            </div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: bg, color: retardFlag ? C.amberDark : undefined, fontWeight: retardFlag ? 700 : 400 }}>
              {r.retardsCount}
            </div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: bg }}>{heuresDecimalFR(r.heuresManquees)}</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: bg, color: r.flagged ? C.redDark : undefined, fontWeight: r.flagged ? 700 : 400 }}>
              {r.incidents}
            </div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: bg, fontWeight: 700 }}>{fr1(r.moyenneConduite)}/20</div>
          </Fragment>
        )
      })}
      <div style={{ padding: '3px 6px', background: C.bandSoft, fontSize: '7.5pt', fontWeight: 700 }}>Sous-total {group.name.toLowerCase()}</div>
      <div style={{ padding: '3px 6px', textAlign: 'center', background: C.bandSoft, fontSize: '7.5pt', fontWeight: 700 }}>{group.effectif}</div>
      <div style={{ background: C.bandSoft }} />
      <div style={{ padding: '3px 6px', textAlign: 'center', background: C.bandSoft, fontSize: '7.5pt', fontWeight: 700 }}>{group.absences}</div>
      <div style={{ padding: '3px 6px', textAlign: 'center', background: C.bandSoft, fontSize: '7.5pt', fontWeight: 700 }}>{group.retards}</div>
      <div style={{ padding: '3px 6px', textAlign: 'center', background: C.bandSoft, fontSize: '7.5pt', fontWeight: 700 }}>{heuresDecimalFR(group.heures)}</div>
      <div style={{ padding: '3px 6px', textAlign: 'center', background: C.bandSoft, fontSize: '7.5pt', fontWeight: 700 }}>{group.sanctions}</div>
      <div style={{ padding: '3px 6px', textAlign: 'center', background: C.bandSoft, fontSize: '7.5pt', fontWeight: 700 }}>
        {group.conduite !== null ? `${fr1(group.conduite)}/20` : '—'}
      </div>
    </div>
  )
}

function MonthCycleTable({ title, color, data }: { title: string; color: string; data: MonthCycleStack[] }) {
  const hasData = data.some((d) => d.maternelle + d.primaire + d.college > 0)
  return (
    <div>
      <p style={{ fontFamily: MONO, fontSize: '7.5pt', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color, marginBottom: 4 }}>{title}</p>
      {!hasData ? (
        <p style={{ fontSize: '8.5pt', fontStyle: 'italic', color: C.muted, margin: 0 }}>Aucune donnée sur l'année scolaire.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '3px 4px', borderBottom: `1px solid ${C.ruleStrong}`, color: C.muted, fontWeight: 600 }}>Mois</th>
              <th style={{ textAlign: 'center', padding: '3px 4px', borderBottom: `1px solid ${C.ruleStrong}`, color: C.muted, fontWeight: 600 }}>Mat.</th>
              <th style={{ textAlign: 'center', padding: '3px 4px', borderBottom: `1px solid ${C.ruleStrong}`, color: C.muted, fontWeight: 600 }}>Pri.</th>
              <th style={{ textAlign: 'center', padding: '3px 4px', borderBottom: `1px solid ${C.ruleStrong}`, color: C.muted, fontWeight: 600 }}>Col.</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.label}>
                <td style={{ padding: '2.5px 4px', borderBottom: `1px solid ${C.ruleSoft}` }}>{row.label}</td>
                <td style={{ textAlign: 'center', padding: '2.5px 4px', borderBottom: `1px solid ${C.ruleSoft}` }}>{row.maternelle}</td>
                <td style={{ textAlign: 'center', padding: '2.5px 4px', borderBottom: `1px solid ${C.ruleSoft}` }}>{row.primaire}</td>
                <td style={{ textAlign: 'center', padding: '2.5px 4px', borderBottom: `1px solid ${C.ruleSoft}` }}>{row.college}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function PrintableReportsBI({
  periodStart,
  periodEnd,
  effectif,
  nbClasses,
  tauxPresence,
  anneeLibelle,
  weeklyTrend,
  remplacementsParClasse,
  profsAbsents,
  remplacants,
  rows,
  anneeData,
  servicesGlobalCounts,
  servicesParNiveau,
  capacite,
  transportCapaciteTotal,
  reclamationsParMois,
  reclamationsParType,
  absencesProfsParMois,
  absencesElevesParMois,
  retardsElevesParMois,
  disciplineElevesParMois,
  cycleTiles,
  absencesParMoisEtCycle,
  retardsParMoisEtCycle,
  disciplineParMoisEtCycle,
  infirmerieBilan,
  rdvBilan,
}: PrintableReportsBIProps) {
  const totalHeuresManquees = rows.reduce((s, r) => s + r.heuresManquees, 0)
  const totalPointsSanction = rows.reduce((s, r) => s + r.pointsSanction, 0)
  const totalIncidents = rows.reduce((s, r) => s + r.incidents, 0)

  // --- Section 03 : tableau groupé par cycle, sous-totaux, total établissement -----------------
  const classGroups = CYCLE_DEFS.map((def) => {
    const groupRows = rows.filter((r) => cycleOfClasse(r.classe) === def.key)
    return {
      name: def.name,
      rows: groupRows.map((r) => ({ ...r, flagged: r.incidents > 0 || r.absencesCount >= 10 })),
      effectif: groupRows.reduce((s, r) => s + r.effectif, 0),
      absences: groupRows.reduce((s, r) => s + r.absencesCount, 0),
      retards: groupRows.reduce((s, r) => s + r.retardsCount, 0),
      heures: groupRows.reduce((s, r) => s + r.heuresManquees, 0),
      sanctions: groupRows.reduce((s, r) => s + r.incidents, 0),
      conduite: groupRows.length > 0 ? groupRows.reduce((s, r) => s + r.moyenneConduite, 0) / groupRows.length : null,
    }
  }).filter((g) => g.rows.length > 0)

  const grandTotal = {
    effectif,
    presence: tauxPresence,
    absences: rows.reduce((s, r) => s + r.absencesCount, 0),
    retards: rows.reduce((s, r) => s + r.retardsCount, 0),
    heures: totalHeuresManquees,
    sanctions: totalIncidents,
    conduite: rows.length > 0 ? rows.reduce((s, r) => s + r.moyenneConduite, 0) / rows.length : 0,
  }


  // --- Section 04 : effectifs/démographie -------------------------------------------------------
  const previousAnnee = anneeData.length >= 2 ? anneeData[anneeData.length - 2] : null
  const currentAnnee = anneeData.length >= 1 ? anneeData[anneeData.length - 1] : null
  const effectifDeltaPct = previousAnnee && currentAnnee && previousAnnee.effectif > 0
    ? ((currentAnnee.effectif - previousAnnee.effectif) / previousAnnee.effectif) * 100
    : null

  // --- Section 05 : services périscolaires -------------------------------------------------------
  const cantineCountsByRefectoire = computeCantineCountsByRefectoire(servicesParNiveau)
  const cantinePrescolaireSousSol = computeCantinePrescolaireSousSol(servicesParNiveau)
  const servicesRows = [
    { name: 'Transport', value: servicesGlobalCounts.transport, capacity: transportCapaciteTotal },
    { name: 'Cantine — sous-sol', value: cantineCountsByRefectoire.sousSol, capacity: capacite.cantineCapaciteSousSol },
    { name: 'Cantine — terrasse', value: cantineCountsByRefectoire.terrasse, capacity: capacite.cantineCapaciteTerrasse },
    { name: 'Cantine préscolaire — sous-sol', value: cantinePrescolaireSousSol, capacity: capacite.cantineCapacitePrescolaire },
    { name: 'Garde Matin', value: servicesGlobalCounts.gardeMatin, capacity: capacite.gardeCapacite },
    { name: 'Garde Soir', value: servicesGlobalCounts.gardeApresMidi, capacity: capacite.gardeCapacite },
  ]

  // --- Section 08 : réclamations ------------------------------------------------------------------
  const reclTotal = reclamationsParType.reduce((s, r) => s + r.value, 0)
  const activeMotifs = reclamationsParType.filter((r) => r.value > 0).sort((a, b) => b.value - a.value)
  const zeroMotifs = reclamationsParType.filter((r) => r.value === 0)
  // Les 19 types du référentiel (actifs d'abord, triés par nombre décroissant, puis les types sans
  // réclamation grisés) plutôt que de ne lister que les actifs et de reléguer les autres à une
  // simple phrase — l'utilisateur veut voir tous les types, comme la section 03 liste toutes les
  // classes y compris à 0.
  const allMotifs = [...activeMotifs, ...zeroMotifs]
  const allMotifsHalf = Math.ceil(allMotifs.length / 2)
  const allMotifsCols = [allMotifs.slice(0, allMotifsHalf), allMotifs.slice(allMotifsHalf)]

  // --- "À retenir" : puces générées à partir des agrégats déjà réels, jamais de texte figé -------
  // Les chiffres clés de chaque phrase sont mis en avant via <strong> (pas de texte entier en gras).
  // Ordre des puces = ordre des 5 parties du rapport.
  const bullets: ReactNode[] = []
  // Partie 1 — effectifs
  if (previousAnnee && currentAnnee) {
    const delta = previousAnnee.effectif > 0 ? ((currentAnnee.effectif - previousAnnee.effectif) / previousAnnee.effectif) * 100 : 0
    const direction = delta > 0.05 ? 'hausse' : delta < -0.05 ? 'baisse' : 'stable'
    bullets.push(
      <>
        Effectif en{' '}
        <strong>
          {direction}
          {direction !== 'stable' ? ` de ${fr1(Math.abs(delta))} %` : ''}
        </strong>{' '}
        par rapport à {previousAnnee.label}.
      </>
    )
  }
  // Partie 2 — absences des enseignants
  const totalSeancesProfs = profsAbsents.reduce((s, p) => s + p.seances, 0)
  const totalCouvertes = profsAbsents.reduce((s, p) => s + p.couvertes, 0)
  const totalHeuresProfs = profsAbsents.reduce((s, p) => s + p.heures, 0)
  const totalHeuresRemplacees = remplacants.reduce((s, r) => s + r.heures, 0)
  if (profsAbsents.length > 0) {
    bullets.push(
      <>
        <strong>
          {profsAbsents.length} enseignant{profsAbsents.length > 1 ? 's' : ''} absent{profsAbsents.length > 1 ? 's' : ''}
        </strong>{' '}
        ({totalSeancesProfs} séance{totalSeancesProfs > 1 ? 's' : ''}, {formatDureeCourte(totalHeuresProfs)}), dont{' '}
        <strong>{totalSeancesProfs > 0 ? Math.round((totalCouvertes / totalSeancesProfs) * 100) : 0} % remplacées</strong> par {remplacants.length} remplaçant
        {remplacants.length > 1 ? 's' : ''}.
      </>
    )
  }
  // Partie 3 — assiduité élèves
  const peakWeek = weeklyTrend.reduce<WeeklyTrendPoint | null>((best, w) => (!best || w.elevesAbsentsCount > best.elevesAbsentsCount ? w : best), null)
  if (peakWeek && peakWeek.elevesAbsentsCount > 0) {
    const autresVides = weeklyTrend.filter((w) => w.week !== peakWeek.week).every((w) => w.elevesAbsentsCount === 0 && w.profsAbsentsCount === 0)
    bullets.push(
      <>
        L'essentiel de l'absentéisme de la période se concentre sur la semaine du <strong>{peakWeek.label}</strong> :{' '}
        <strong>
          {peakWeek.elevesAbsentsCount} élève(s) et {peakWeek.profsAbsentsCount} enseignant(s)
        </strong>{' '}
        absent(s){autresVides ? ', aucune absence les autres semaines' : ''}.
      </>
    )
  }
  if (totalHeuresManquees > 0) {
    const sortedByHeures = [...rows].filter((r) => r.heuresManquees > 0).sort((a, b) => b.heuresManquees - a.heuresManquees)
    let cum = 0
    const top: ClasseStatsRow[] = []
    for (const r of sortedByHeures) {
      top.push(r)
      cum += r.heuresManquees
      if (cum / totalHeuresManquees >= 0.4) break
    }
    const pct = Math.round((cum / totalHeuresManquees) * 100)
    const listeStr = top.map((r) => `${r.classe} (${heuresDecimalFR(r.heuresManquees)})`).join(', ')
    bullets.push(
      <>
        {top.length} classe{top.length > 1 ? 's' : ''} concentre{top.length > 1 ? 'nt' : ''} <strong>{pct} %</strong> des heures manquées : <strong>{listeStr}</strong>.
      </>
    )
  }
  // Partie 5 — réclamations
  {
    const neutral = reclTotal === 0 && totalIncidents === 0
    if (bullets.length > 0 || !neutral) {
      const motifsPart = activeMotifs.length > 0 ? `, dont ${activeMotifs.slice(0, 2).map((m) => m.label).join(' et ')} en tête` : ''
      const sanctionPart = totalIncidents === 0 ? 'aucune sanction disciplinaire' : `${totalIncidents} sanction${totalIncidents > 1 ? 's' : ''} disciplinaire${totalIncidents > 1 ? 's' : ''}`
      bullets.push(
        <>
          <strong>
            {reclTotal} réclamation{reclTotal > 1 ? 's' : ''}
          </strong>{' '}
          enregistrée{reclTotal > 1 ? 's' : ''} sur la période{motifsPart}, pour <strong>{sanctionPart}</strong>.
        </>
      )
    }
  }
  // Partie 6 — infirmerie
  if (infirmerieBilan.passages > 0) {
    const topMotif = infirmerieBilan.parMotif.find((m) => m.label !== 'Autres motifs')
    bullets.push(
      <>
        <strong>
          {infirmerieBilan.passages} passage{infirmerieBilan.passages > 1 ? 's' : ''} à l'infirmerie
        </strong>{' '}
        ({infirmerieBilan.eleves} élève{infirmerieBilan.eleves > 1 ? 's' : ''})
        {topMotif ? (
          <>
            , motif le plus fréquent : <strong>{topMotif.label}</strong>
          </>
        ) : null}
        .
      </>
    )
  }
  // Partie 7 — rendez-vous avec les parents
  if (rdvBilan.total > 0) {
    bullets.push(
      <>
        <strong>
          {rdvBilan.total} rendez-vous avec les parents
        </strong>{' '}
        ({rdvBilan.realises} réalisé{rdvBilan.realises > 1 ? 's' : ''}, {rdvBilan.planifies} planifié{rdvBilan.planifies > 1 ? 's' : ''}, {rdvBilan.annules} annulé{rdvBilan.annules > 1 ? 's' : ''})
        {rdvBilan.enAttenteSignature > 0 ? (
          <>
            , dont{' '}
            <strong>
              {rdvBilan.enAttenteSignature} compte{rdvBilan.enAttenteSignature > 1 ? 's' : ''}-rendu{rdvBilan.enAttenteSignature > 1 ? 's' : ''} en attente de signature
            </strong>
          </>
        ) : null}
        .
      </>
    )
  }
  const aRetenirBullets: ReactNode[] = bullets.length > 0 ? bullets : ['Aucun signal particulier à relever sur la période.']

  // --- Blocs paginés : 7 grandes parties, chacune ouverte par un bandeau PartTitle -----------------
  // Les parties s'enchaînent sans saut de page forcé : un saut avant chaque partie laissait des pages
  // à moitié vides (parties courtes comme Infirmerie ou Rendez-vous). Le bandeau d'une partie est dans
  // le même bloc que sa première section, donc jamais isolé en bas de page. Les longues listes restent
  // découpées en plusieurs blocs pour que la pagination remplisse les pages.
  const maxHeuresRemp = Math.max(1, ...remplacementsParClasse.map((r) => r.heures))
  // Paquets de lignes assez fins pour que la pagination comble le bas de chaque page. Un reliquat de
  // moins de 3 lignes est rattaché au paquet précédent : sinon une ou deux lignes se retrouvent seules
  // dans un second tableau, sous un en-tête répété (ex. le 9e enseignant absent sur 9).
  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    if (out.length > 1 && out[out.length - 1].length < 3) {
      const reliquat = out.pop() as T[]
      out[out.length - 1] = [...out[out.length - 1], ...reliquat]
    }
    return out
  }
  // Impact par classe : les classes sont déjà dans l'ordre PS-A → 3APIC ; on coupe par cycle
  // (Maternelle / Primaire / Collège) plutôt que toutes les 5 lignes, pour que les séparations
  // tombent entre les cycles et jamais au milieu d'un niveau (entre CE3-A et CE3-B par exemple).
  const impactChunks = [
    ...CYCLE_DEFS.map((def) => remplacementsParClasse.filter((r) => cycleOfClasse(r.classe) === def.key)),
    remplacementsParClasse.filter((r) => !CYCLE_DEFS.some((def) => def.key === cycleOfClasse(r.classe))),
  ].filter((g) => g.length > 0)
  const remplacantsChunks = chunk(remplacants, 8)

  const impactRow = (r: ClasseBreakdownRow) => (
    <div key={r.classe} style={{ display: 'grid', gridTemplateColumns: '56px minmax(0,1fr) 60px', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      <span style={{ fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600 }}>{r.classe}</span>
      <div style={{ height: 8, background: C.ruleSoft }}>
        <div style={{ height: '100%', width: `${Math.round((r.heures / maxHeuresRemp) * 100)}%`, background: C.green }} />
      </div>
      <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600, color: r.heures > 0 ? C.greenText : C.dashGrey }}>
        {formatDureeCourte(r.heures)}
      </span>
    </div>
  )

  const profsAbsentsChunks = chunk(profsAbsents, 8)
  const remplacantsTable = (rows: typeof remplacants) => (
    <SimpleTable columns="2fr 1fr 1fr" headers={['Remplaçant', 'Remplacements', 'Heures']} rows={rows.map((r) => [r.name, r.count, formatDureeCourte(r.heures)])} />
  )
  const profsAbsentsTable = (chunk: typeof profsAbsents) => (
    <SimpleTable
      columns="2fr 0.8fr 0.9fr 1fr"
      headers={['Enseignant', 'Séances', 'Heures', 'Remplacées']}
      rows={chunk.map((p) => [
        p.name,
        p.seances,
        formatDureeCourte(p.heures),
        <span key="c" style={{ fontWeight: 700, color: p.couvertes === p.seances ? C.greenText : p.couvertes === 0 ? C.redDark : C.amberDark }}>
          {p.couvertes}/{p.seances}
        </span>,
      ])}
    />
  )

  const serviceRow = (s: (typeof servicesRows)[number]) => {
    const pct = occupancyPct(s.value, s.capacity)
    const color = OCCUPANCY_COLORS[occupancyLevel(s.value, s.capacity)]
    return (
      <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr) 134px', alignItems: 'center', gap: 8, padding: '4px 0' }}>
        <span style={{ fontSize: '9.5pt', fontWeight: 600 }}>{s.name}</span>
        <div style={{ height: 9, background: C.ruleSoft }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color }} />
        </div>
        <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600 }}>
          {s.value} / {s.capacity} · {pct}%
        </span>
      </div>
    )
  }
  const servicesChunks = chunk(servicesRows, 3)

  // Motifs de réclamation : les deux colonnes sont découpées par tranches de lignes (même indice dans
  // les deux colonnes) pour que la pagination puisse remplir le bas d'une page ; un reliquat de moins
  // de 3 lignes est rattaché à la tranche précédente.
  const motifRow = (r: (typeof allMotifs)[number]) => (
    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', opacity: r.value > 0 ? 1 : 0.5 }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: r.value > 0 ? (RECLAMATION_COLORS[r.label] ?? C.accentBlue) : C.dashGrey, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '9.5pt', color: r.value > 0 ? C.ink : C.inkMuted }}>{r.label}</span>
      <strong style={{ fontSize: '9.5pt', color: r.value > 0 ? C.ink : C.dashGrey }}>{r.value}</strong>
    </div>
  )
  const maxMotifRows = Math.max(0, ...allMotifsCols.map((c) => c.length))
  const motifBounds: number[] = []
  for (let i = 0; i < maxMotifRows; i += 5) motifBounds.push(i)
  if (motifBounds.length > 1 && maxMotifRows - motifBounds[motifBounds.length - 1] < 3) motifBounds.pop()
  const motifGrids = motifBounds.map((from, i) => (
    <div key={from} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', columnGap: 20 }}>
      {allMotifsCols.map((col, colIdx) => (
        <div key={colIdx}>{col.slice(from, motifBounds[i + 1]).map(motifRow)}</div>
      ))}
    </div>
  ))
  const rdvChunks = chunk(rdvBilan.rows, 10)
  const rdvStatutColor = { Réalisé: C.greenText, Planifié: C.accentBlue, Annulé: C.redDark } as const
  const rdvTable = (rows: typeof rdvBilan.rows) => (
    <SimpleTable
      columns="0.95fr 1.7fr 1.5fr 1.6fr 0.9fr"
      headers={['Date', 'Élève', 'Enseignants', 'Motif', 'Statut']}
      rows={rows.map((r) => [
        `${formatDateCourte(r.date)} ${r.heure}`,
        `${r.studentName} (${r.classe})`,
        r.enseignants.length > 0 ? r.enseignants.join(', ') : 'Administration',
        r.motif,
        <span key="s" style={{ fontWeight: 700, color: rdvStatutColor[r.statut] }}>
          {r.statut}
        </span>,
      ])}
    />
  )

  const maxTrendEleves = Math.max(1, ...weeklyTrend.map((w) => w.elevesAbsentsCount))

  const blocks: PaginatedBlock[] = [
    // ============================ PARTIE 1 — EFFECTIFS & DÉMOGRAPHIE ============================
    {
      key: 'p1-effectifs',
      node: flowRoot(
        <div>
          <PartTitle num={1} title="Effectifs & démographie" subtitle={`${effectif} élèves · ${nbClasses} classes · ${anneeData.length} année(s) comparée(s)`} />
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 1, background: C.rule, border: `1px solid ${C.rule}` }}>
            <div style={{ background: C.paperTint, padding: '10px 12px' }}>
              <p style={{ fontFamily: MONO, fontSize: '8pt', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                Élèves par année
              </p>
              {anneeData.map((a) => {
                const maxEff = Math.max(1, ...anneeData.map((x) => x.effectif))
                return (
                  <div key={a.anneeId} style={{ display: 'grid', gridTemplateColumns: '46px minmax(0,1fr) 30px', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                    <span style={{ fontFamily: MONO, fontSize: '8pt' }}>{a.label}</span>
                    <div style={{ height: 8, background: C.ruleSoft }}>
                      <div style={{ height: '100%', width: `${Math.round((a.effectif / maxEff) * 100)}%`, background: C.accentBlue }} />
                    </div>
                    <span style={{ textAlign: 'right', fontFamily: MONO, fontSize: '8pt', fontWeight: 600 }}>{a.effectif}</span>
                  </div>
                )
              })}
              {effectifDeltaPct !== null && previousAnnee && (
                <p style={{ marginTop: 6, fontFamily: MONO, fontSize: '7.5pt', color: effectifDeltaPct < 0 ? C.red : C.green }}>
                  {effectifDeltaPct >= 0 ? '+' : ''}
                  {fr1(effectifDeltaPct)}
                  {' % par rapport à '}
                  {previousAnnee.label}
                </p>
              )}
            </div>
            <div style={{ background: C.paperTint, padding: '10px 12px' }}>
              <p style={{ fontFamily: MONO, fontSize: '8pt', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                Capacité
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '3px 0' }}>
                <span>Classes ouvertes</span>
                <strong>{nbClasses}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '3px 0' }}>
                <span>Ratio élèves/classe</span>
                <strong>{nbClasses > 0 ? fr1(effectif / nbClasses) : '—'}</strong>
              </div>
            </div>
            <div style={{ background: C.paperTint, padding: '10px 12px' }}>
              <p style={{ fontFamily: MONO, fontSize: '8pt', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>
                Genre par année
              </p>
              {anneeData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {anneeData.map((a) => (
                    <div key={a.anneeId}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: MONO, fontSize: '8pt', fontWeight: 600, width: 34, flexShrink: 0 }}>{a.label}</span>
                        <div style={{ display: 'flex', flex: 1, height: 12, overflow: 'hidden' }}>
                          <div style={{ background: C.accentBlue, width: `${a.pctGarcons}%` }} />
                          <div style={{ background: 'oklch(0.62 0.15 15)', width: `${a.pctFilles}%` }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: C.muted, marginTop: 2, paddingLeft: 42 }}>
                        <span>Garçons {fr1(a.pctGarcons)} %</span>
                        <span>Filles {fr1(a.pctFilles)} %</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '9pt', fontStyle: 'italic', color: C.muted, margin: 0 }}>Aucune donnée.</p>
              )}
            </div>
          </div>
        </div>
      ),
    },

    // ===================== PARTIE 2 — ABSENCES DES ENSEIGNANTS & REMPLACEMENTS =====================
    {
      key: 'p2-titre-evolution',
      node: flowRoot(
        <div>
          <PartTitle
            num={2}
            title="Absences des enseignants & remplacements"
            subtitle={`${profsAbsents.length} enseignant(s) absent(s) · ${totalSeancesProfs} séance(s) · ${formatDureeCourte(totalHeuresRemplacees)} remplacées`}
          />
          <div style={{ marginTop: 10 }}>
            <Section num="2.1" title="Évolution des absences" annotation="enseignants">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 20 }}>
                <TitledBars
                  title={`Par semaine — ${weeklyTrend.length} dernières`}
                  color={C.green}
                  rows={weeklyTrend.map((w) => ({ label: w.week, value: w.profsAbsentsCount }))}
                  emptyText="Aucune absence."
                  labelWidth={48}
                />
                <TitledBars title="Par mois — année scolaire" color={C.green} rows={absencesProfsParMois} emptyText="Aucune absence." labelWidth={26} />
              </div>
            </Section>
          </div>
        </div>
      ),
    },
    ...(profsAbsentsChunks.length === 0
      ? [
          {
            key: 'p2-profs-absents-0',
            node: flowRoot(
              <Section num="2.2" title="Enseignants absents" annotation="période sélectionnée">
                <p style={emptyPanel}>Aucune absence d'enseignant sur la période.</p>
              </Section>
            ),
          },
        ]
      : profsAbsentsChunks.map((chunk, i) => ({
          key: `p2-profs-absents-${i}`,
          node: flowRoot(
            i === 0 ? (
              <Section num="2.2" title="Enseignants absents" annotation={`${profsAbsents.length} enseignant(s) · ${totalCouvertes}/${totalSeancesProfs} séances remplacées`}>
                {profsAbsentsTable(chunk)}
              </Section>
            ) : (
              profsAbsentsTable(chunk)
            )
          ),
        }))),
    {
      key: 'p2-remplacants-0',
      node: flowRoot(
        <Section num="2.3" title="Enseignants remplaçants" annotation={`${remplacants.length} remplaçant(s) · ${formatDureeCourte(totalHeuresRemplacees)}`}>
          {remplacants.length === 0 ? <p style={emptyPanel}>Aucun remplacement enregistré sur la période.</p> : remplacantsTable(remplacantsChunks[0])}
        </Section>
      ),
    },
    ...remplacantsChunks.slice(1).map((c, i) => ({ key: `p2-remplacants-${i + 1}`, node: flowRoot(remplacantsTable(c)) })),
    {
      key: 'p2-impact-0',
      node: flowRoot(
        <Section
          num="2.4"
          title="Impact par classe"
          annotation={
            remplacementsParClasse.length === 0
              ? 'Aucune classe'
              : `${remplacementsParClasse.filter((r) => r.heures > 0).length} classe(s) concernée(s) sur ${remplacementsParClasse.length} · heures remplacées`
          }
        >
          {impactChunks.length === 0 ? <p style={emptyPanel}>Aucune classe active sur cette période.</p> : impactChunks[0].map(impactRow)}
        </Section>
      ),
    },
    ...impactChunks.slice(1).map((c, i) => ({ key: `p2-impact-${i + 1}`, node: flowRoot(<div>{c.map(impactRow)}</div>) })),

    // ============================= PARTIE 3 — ASSIDUITÉ & DISCIPLINE =============================
    {
      key: 'p3-titre-tendance',
      node: flowRoot(
        <div>
          <PartTitle
            num={3}
            title="Assiduité & discipline des élèves"
            subtitle={`Présence ${fr1(tauxPresence)} % · ${cycleTiles.absencesSeances.total} séances manquées · ${cycleTiles.retardsSeances.total} retards · ${totalIncidents} sanction(s)`}
          />
          <div style={{ marginTop: 10 }}>
            <Section num="3.1" title="Tendance d'assiduité" annotation={`élèves absents · ${weeklyTrend.length} dernières semaines`}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 92, paddingTop: 12 }}>
                {weeklyTrend.map((w) => {
                  const h = Math.max(2, Math.round((w.elevesAbsentsCount / maxTrendEleves) * 62))
                  return (
                    <div key={w.week} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 78 }}>
                        <span style={{ fontFamily: MONO, fontSize: '6.5pt', color: C.red, minHeight: 8 }}>{w.elevesAbsentsCount > 0 ? w.elevesAbsentsCount : ''}</span>
                        <div style={{ width: 16, height: h, background: C.red }} />
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: '7pt', color: C.muted }}>{w.week}</span>
                    </div>
                  )
                })}
              </div>
            </Section>
          </div>
        </div>
      ),
    },
    ...(classGroups.length > 0
      ? [
          {
            key: 'p3-table-header',
            node: flowRoot(
              <Section num="3.2" title="Assiduité par classe" annotation={`${nbClasses} classes · ${effectif} élèves comptabilisés`}>
                <ClasseGroupGrid group={classGroups[0]} />
              </Section>
            ),
          },
          ...classGroups.slice(1).map((g) => ({
            key: `p3-table-${g.name}`,
            node: flowRoot(<ClasseGroupGrid group={g} />),
          })),
        ]
      : [
          {
            key: 'p3-table-header',
            node: flowRoot(
              <Section num="3.2" title="Assiduité par classe" annotation={`${nbClasses} classes · ${effectif} élèves comptabilisés`}>
                <p style={emptyPanel}>Aucune classe active sur la période sélectionnée.</p>
              </Section>
            ),
          },
        ]),
    {
      key: 'p3-table-total',
      node: flowRoot(
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: CLASSE_TABLE_COLUMNS, gap: 1, background: C.rule, border: `1px solid ${C.rule}`, fontSize: '8.5pt' }}>
            <div style={{ padding: '4px 6px', background: C.band, fontWeight: 700 }}>Total établissement</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: C.band, fontWeight: 700 }}>{grandTotal.effectif}</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: C.band, fontWeight: 700 }}>{fr1(grandTotal.presence)}%</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: C.band, fontWeight: 700 }}>{grandTotal.absences}</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: C.band, fontWeight: 700 }}>{grandTotal.retards}</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: C.band, fontWeight: 700 }}>{heuresDecimalFR(grandTotal.heures)}</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: C.band, fontWeight: 700 }}>{grandTotal.sanctions}</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', background: C.band, fontWeight: 700 }}>{fr1(grandTotal.conduite)}/20</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '8pt', color: C.muted, marginTop: 6 }}>
            <span style={{ display: 'inline-block', width: 9, height: 9, background: C.flagRow, border: `1px solid ${C.flagBorder}` }} />
            Classe à signaler (≥ 1 sanction ou ≥ 10 absences) sur la période sélectionnée
          </div>
        </div>
      ),
    },
    {
      key: 'p3-cycle',
      node: flowRoot(
        <Section num="3.3" title="Vue par cycle" annotation="période sélectionnée">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
            <thead>
              <tr>
                {['Indicateur', 'Maternelle', 'Primaire', 'Collège', 'Total'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i === 0 ? 'left' : 'center',
                      padding: '4px 8px',
                      borderBottom: `1.5px solid ${C.ink}`,
                      fontFamily: MONO,
                      fontSize: '7.5pt',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: C.muted,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Élèves absents', counts: cycleTiles.absencesEleves },
                { label: 'Séances manquées', counts: cycleTiles.absencesSeances },
                { label: 'Élèves en retard', counts: cycleTiles.retardsEleves },
                { label: 'Séances en retard', counts: cycleTiles.retardsSeances },
                { label: 'Problèmes disciplinaires', counts: cycleTiles.disciplineEleves },
              ].map((row) => (
                <tr key={row.label}>
                  <td style={{ padding: '4px 8px', borderBottom: `1px solid ${C.ruleSoft}`, fontWeight: 600 }}>{row.label}</td>
                  <td style={{ textAlign: 'center', padding: '4px 8px', borderBottom: `1px solid ${C.ruleSoft}` }}>{row.counts.maternelle}</td>
                  <td style={{ textAlign: 'center', padding: '4px 8px', borderBottom: `1px solid ${C.ruleSoft}` }}>{row.counts.primaire}</td>
                  <td style={{ textAlign: 'center', padding: '4px 8px', borderBottom: `1px solid ${C.ruleSoft}` }}>{row.counts.college}</td>
                  <td style={{ textAlign: 'center', padding: '4px 8px', borderBottom: `1px solid ${C.ruleSoft}`, fontWeight: 700 }}>{row.counts.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ),
    },
    {
      key: 'p3-activite',
      node: flowRoot(
        <Section num="3.4" title="Activité mensuelle" annotation={formatPeriodLabel(periodStart, periodEnd)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 1, background: C.rule, border: `1px solid ${C.rule}` }}>
            <KpiTile
              value={String(cycleTiles.absencesSeances.total)}
              color={cycleTiles.absencesSeances.total === 0 ? C.green : C.red}
              label="Séances manquées — élèves"
              sub={formatPeriodLabel(periodStart, periodEnd)}
            />
            <KpiTile
              value={String(cycleTiles.retardsSeances.total)}
              color={cycleTiles.retardsSeances.total === 0 ? C.green : C.amber}
              label="Séances en retard — élèves"
              sub={formatPeriodLabel(periodStart, periodEnd)}
            />
            <KpiTile
              value={String(totalIncidents)}
              color={totalIncidents === 0 ? C.green : C.red}
              label="Incidents disciplinaires"
              sub={formatPeriodLabel(periodStart, periodEnd)}
            />
          </div>
        </Section>
      ),
    },
    {
      key: 'p3-activite-bars',
      node: flowRoot(
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16 }}>
          <TitledBars title="Absences — par mois" color={C.red} rows={absencesElevesParMois} emptyText="Aucune absence." labelWidth={26} />
          <TitledBars title="Retards — par mois" color={C.amber} rows={retardsElevesParMois} emptyText="Aucun retard." labelWidth={26} />
          <TitledBars title="Discipline — par mois" color={C.red} rows={disciplineElevesParMois} emptyText="Aucun incident." labelWidth={26} />
        </div>
      ),
    },
    {
      key: 'p3-activite-tables',
      node: flowRoot(
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16 }}>
          <MonthCycleTable title="Absences par mois et cycle" color={C.accentBlue} data={absencesParMoisEtCycle} />
          <MonthCycleTable title="Retards par mois et cycle" color={C.amber} data={retardsParMoisEtCycle} />
          <MonthCycleTable title="Discipline par mois et cycle" color={C.red} data={disciplineParMoisEtCycle} />
        </div>
      ),
    },

    // ================================ PARTIE 4 — SERVICES PÉRISCOLAIRES ================================
    {
      key: 'p4-services',
      node: flowRoot(
        <div>
          <PartTitle num={4} title="Services périscolaires" subtitle="Transport · cantine · garde — inscrits / capacité" />
          <div style={{ marginTop: 10 }}>
            <Section num="4.1" title="Occupation des services" annotation={`${servicesRows.length} services`}>
              <div>{(servicesChunks[0] ?? []).map(serviceRow)}</div>
            </Section>
          </div>
        </div>
      ),
    },
    // Suite de la liste des services : un bloc séparé pour que la pagination puisse remplir le bas
    // d'une page au lieu de reporter tout le bloc quand il manque quelques pixels.
    ...servicesChunks.slice(1).map((c, i) => ({ key: `p4-services-${i + 1}`, node: flowRoot(<div>{c.map(serviceRow)}</div>) })),
    {
      key: 'p4-services-niveau',
      node: flowRoot(
        <Section num="4.2" title="Répartition par niveau" annotation="élèves inscrits">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 20 }}>
            <TitledBars title="Transport par niveau" color={C.accentBlue} rows={servicesParNiveau.map((p) => ({ label: p.niveau, value: p.transport }))} emptyText="Aucune donnée." labelWidth={34} />
            <TitledBars title="Cantine par niveau" color={C.green} rows={servicesParNiveau.map((p) => ({ label: p.niveau, value: p.cantine }))} emptyText="Aucune donnée." labelWidth={34} />
          </div>
        </Section>
      ),
    },
    {
      key: 'p4-services-niveau-garde',
      node: flowRoot(
        <GroupedColumnsChart
          title="Garde par niveau (matin / soir)"
          points={servicesParNiveau.map((p) => ({ label: p.niveau, a: p.gardeMatin, b: p.gardeApresMidi }))}
          colorA="oklch(0.6 0.11 300)"
          colorB="oklch(0.46 0.14 300)"
          labelA="Garde Matin"
          labelB="Garde Soir"
          emptyText="Aucun élève inscrit en garde sur les niveaux actifs."
        />
      ),
    },

    // ==================================== PARTIE 5 — RÉCLAMATIONS ====================================
    {
      key: 'p5-reclamations',
      node: flowRoot(
        <div>
          <PartTitle num={5} title="Réclamations des parents" subtitle={`${reclTotal} réclamation(s) sur la période · ${activeMotifs.length} motif(s) actif(s) sur ${allMotifs.length}`} />
          <div style={{ marginTop: 10 }}>
            <Section num="5.1" title="Réclamations par motif" annotation="période sélectionnée">
              {reclTotal === 0 ? (
                <p style={emptyPanel}>Aucune réclamation enregistrée sur la période.</p>
              ) : (
                motifGrids[0] ?? null
              )}
            </Section>
          </div>
        </div>
      ),
    },
    ...(reclTotal === 0 ? [] : motifGrids.slice(1).map((g, i) => ({ key: `p5-reclamations-${i + 1}`, node: flowRoot(g) }))),
    {
      key: 'p5-reclamations-mois',
      node: flowRoot(
        <Section num="5.2" title="Évolution mensuelle" annotation="année scolaire">
          <LabeledBars rows={reclamationsParMois} color={C.accentBlue} emptyText="Aucune réclamation sur l'année scolaire." labelWidth={26} />
        </Section>
      ),
    },

    // ==================================== PARTIE 6 — INFIRMERIE ====================================
    {
      key: 'p6-infirmerie',
      node: flowRoot(
        <div>
          <PartTitle
            num={6}
            title="Infirmerie"
            subtitle={`${infirmerieBilan.passages} passage(s) · ${infirmerieBilan.eleves} élève(s) concerné(s)`}
          />
          <div style={{ marginTop: 10 }}>
            <Section num="6.1" title="Vue d'ensemble" annotation="période sélectionnée">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 1, background: C.rule, border: `1px solid ${C.rule}` }}>
                <KpiTile
                  value={String(infirmerieBilan.passages)}
                  color={infirmerieBilan.passages === 0 ? C.green : C.accentBlue}
                  label="Passages à l'infirmerie"
                  sub={`sur ${periodeJours(periodStart, periodEnd)} jour(s)`}
                />
                <KpiTile value={String(infirmerieBilan.eleves)} color={C.ink} label="Élèves concernés" sub={`sur ${effectif} inscrits`} />
                <KpiTile
                  value={infirmerieBilan.eleves > 0 ? fr1(infirmerieBilan.passages / infirmerieBilan.eleves) : '—'}
                  color={C.ink}
                  label="Passages par élève"
                  sub="moyenne sur la période"
                />
              </div>
            </Section>
          </div>
        </div>
      ),
    },
    {
      key: 'p6-infirmerie-classes',
      node: flowRoot(
        <Section num="6.2" title="Passages par classe" annotation={`${infirmerieBilan.parClasse.length} classe(s) concernée(s)`}>
          <CountBars rows={infirmerieBilan.parClasse} color={C.accentBlue} emptyText="Aucun passage à l'infirmerie enregistré sur la période." labelWidth={56} />
        </Section>
      ),
    },
    {
      key: 'p6-infirmerie-motifs',
      node: flowRoot(
        <Section num="6.3" title="Motifs les plus fréquents" annotation="motifs saisis à l'infirmerie">
          <CountBars rows={infirmerieBilan.parMotif} color={C.green} emptyText="Aucun passage à l'infirmerie enregistré sur la période." labelWidth={300} />
        </Section>
      ),
    },

    // ============================ PARTIE 7 — RENDEZ-VOUS AVEC LES PARENTS ============================
    {
      key: 'p7-rdv',
      node: flowRoot(
        <div>
          <PartTitle
            num={7}
            title="Rendez-vous avec les parents"
            subtitle={`${rdvBilan.total} rendez-vous · ${rdvBilan.realises} réalisé(s) · ${rdvBilan.planifies} planifié(s) · ${rdvBilan.annules} annulé(s)`}
          />
          <div style={{ marginTop: 10 }}>
            <Section num="7.1" title="Vue d'ensemble" annotation="période sélectionnée">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 1, background: C.rule, border: `1px solid ${C.rule}` }}>
                <KpiTile value={String(rdvBilan.total)} color={C.ink} label="Rendez-vous" sub="tous statuts confondus" />
                <KpiTile value={String(rdvBilan.realises)} color={C.green} label="Réalisés" sub="entretien tenu" />
                <KpiTile value={String(rdvBilan.planifies)} color={C.accentBlue} label="Planifiés" sub="à venir ou à clôturer" />
                <KpiTile value={String(rdvBilan.annules)} color={rdvBilan.annules === 0 ? C.green : C.amber} label="Annulés" sub="n'ont pas eu lieu" />
                <KpiTile value={String(rdvBilan.comptesRendus)} color={C.ink} label="Comptes-rendus rédigés" sub={`sur ${rdvBilan.realises} réalisé(s)`} />
                <KpiTile
                  value={String(rdvBilan.enAttenteSignature)}
                  color={rdvBilan.enAttenteSignature === 0 ? C.green : C.amber}
                  label="En attente de signature"
                  sub="signature du parent"
                />
              </div>
            </Section>
          </div>
        </div>
      ),
    },
    {
      key: 'p7-rdv-repartition',
      node: flowRoot(
        <Section num="7.2" title="Répartition" annotation="hors rendez-vous annulés">
          <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 20 }}>
            <div>
              <p style={{ fontFamily: MONO, fontSize: '7.5pt', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.accentBlue, marginBottom: 4 }}>Par motif</p>
              <CountBars rows={rdvBilan.parMotif} color={C.accentBlue} emptyText="Aucun rendez-vous sur la période." labelWidth={210} />
            </div>
            <div>
              <p style={{ fontFamily: MONO, fontSize: '7.5pt', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.green, marginBottom: 4 }}>Par classe</p>
              <CountBars rows={rdvBilan.parClasse} color={C.green} emptyText="Aucun rendez-vous sur la période." labelWidth={56} />
            </div>
          </div>
        </Section>
      ),
    },
    {
      key: 'p7-rdv-liste',
      node: flowRoot(
        <Section num="7.3" title="Liste des rendez-vous" annotation={`${rdvBilan.rows.length} rendez-vous · du plus récent au plus ancien`}>
          {rdvChunks.length === 0 ? <p style={emptyPanel}>Aucun rendez-vous avec les parents sur la période.</p> : rdvTable(rdvChunks[0])}
        </Section>
      ),
    },
    ...rdvChunks.slice(1).map((c, i) => ({ key: `p7-rdv-liste-${i + 1}`, node: flowRoot(rdvTable(c)) })),
  ]

  return (
    <PaginatedPrintDocument
      blocks={blocks}
      paddingXPx={48}
      paddingYPx={48}
      gapPx={10}
      pageStyle={{ background: '#fff', color: C.ink, fontFamily: SANS }}
      renderHeader={(pageIndex) => (
        <div style={{ display: 'flow-root' }}>
          <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, paddingBottom: 7, borderBottom: `2.5px solid ${C.ink}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <SchoolLogo size={40} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: '12pt', fontWeight: 700, letterSpacing: '-0.01em', color: C.ink }}>Groupe Scolaire Mondrian</div>
                <div style={{ fontFamily: MONO, fontSize: '7.5pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted }}>École de la bienveillance</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, textAlign: 'right', paddingTop: 2 }}>
              <div style={{ fontFamily: MONO, fontSize: '7.5pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accentBlue }}>Rapports BI — Indicateurs clés</div>
              <div style={{ fontSize: '10.5pt', fontWeight: 600, color: C.ink }}>Période du {formatPeriodLabel(periodStart, periodEnd)}</div>
              <div style={{ fontFamily: MONO, fontSize: '8.5pt', color: C.muted }}>
                Édité le {todayFR()} · {periodeJours(periodStart, periodEnd)} jour(s)
              </div>
            </div>
          </header>

          {pageIndex === 0 && (
            <>
              <h1 style={{ margin: '10px 0 10px', fontSize: '16pt', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, textAlign: 'center' }}>
                Pilotage de l'établissement — rentrée {anneeLibelle}
              </h1>
              <section style={{ margin: '0 0 10px' }}>
                <div style={{ fontFamily: MONO, fontSize: '8pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, paddingBottom: 7 }}>
                  Synthèse de la période
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 1, background: C.rule, border: `1px solid ${C.rule}` }}>
                  <KpiTile
                    value={String(effectif)}
                    color={C.ink}
                    label="Élèves inscrits"
                    sub={`${nbClasses} classes · ${nbClasses > 0 ? fr1(effectif / nbClasses) : '—'} él./classe`}
                  />
                  <KpiTile value={`${fr1(tauxPresence)} %`} color={C.accentBlue} label="Taux de présence" sub="moyenne établissement" />
                  <KpiTile
                    value={String(cycleTiles.absencesSeances.total)}
                    color={C.red}
                    label="Séances manquées"
                    sub={`${cycleTiles.absencesEleves.total} élèves · ${heuresDecimalFR(totalHeuresManquees)}`}
                  />
                  <KpiTile
                    value={String(cycleTiles.retardsSeances.total)}
                    color={C.amber}
                    label="Séances en retard"
                    sub={`${cycleTiles.retardsEleves.total} élèves concernés`}
                  />
                  <KpiTile
                    value={String(Math.abs(totalPointsSanction))}
                    color={totalPointsSanction === 0 ? C.green : C.red}
                    label="Sanction disciplinaire"
                    sub={`${Math.abs(totalPointsSanction)} pt sur ${nbClasses} classes`}
                  />
                </div>
              </section>
              <section style={{ margin: '0 0 10px', background: C.panel, borderLeft: `3px solid ${C.accentBlue}`, padding: '10px 14px 11px' }}>
                <div style={{ fontFamily: MONO, fontSize: '8pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accentBlueDark, paddingBottom: 6 }}>
                  À retenir
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {aRetenirBullets.map((b, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                      <span style={{ width: 3, minHeight: 12, background: C.accentBlue, borderRadius: 2, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontFamily: SANS, fontSize: '8.5pt', lineHeight: 1.4, color: C.inkSoft }}>{b}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
      renderFooter={(pageIndex, pageCount) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 8, borderTop: `1px solid ${C.rule}` }}>
          <span style={{ fontFamily: MONO, fontSize: '8.5pt', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Direction de la vie scolaire</span>
          <span style={{ fontFamily: MONO, fontSize: '8.5pt', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>
            Rapports BI · {formatPeriodLabel(periodStart, periodEnd)}
          </span>
          <span style={{ fontFamily: MONO, fontSize: '8.5pt', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>
            Page {pageIndex + 1}/{pageCount}
          </span>
        </div>
      )}
    />
  )
}
