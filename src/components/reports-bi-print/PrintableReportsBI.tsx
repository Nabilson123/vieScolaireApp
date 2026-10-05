import { Fragment, type CSSProperties, type ReactNode } from 'react'
import SchoolLogo from '../print/SchoolLogo'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import { formatPeriodLabel } from '../../utils/period'
import type { WeeklyTrendPoint } from '../../utils/dashboardTrend'
import type { ClasseStatsRow } from '../../utils/reportsBIAggregation'
import type { ClasseBreakdownRow } from '../../utils/replacementAggregation'
import type { AnneeEffectifPoint } from '../../utils/multiYearAggregation'
import type { ServicesGlobalCounts, ServiceNiveauPoint } from '../../utils/servicesNiveauAggregation'
import { computeCantineCountsByRefectoire, computeCantinePrescolaireSousSol } from '../../utils/servicesNiveauAggregation'
import type { ServicesCapacite } from '../../services/servicesCapaciteService'
import { useSchoolIdentity } from '../../services/schoolIdentityService'
import type { CycleSnapshotTiles, MonthCycleStack } from '../../utils/activiteMensuelleAggregation'
import { cycleOfClasse, niveauFromClasse } from '../../utils/alertEngine'
import { NIVEAUX } from '../../data/referentiel'
import type { InfirmerieBilan, RdvBilan } from '../../utils/infirmerieRdvBilan'

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
  cycleTiles: CycleSnapshotTiles
  absencesParMoisEtCycle: MonthCycleStack[]
  retardsParMoisEtCycle: MonthCycleStack[]
  disciplineParMoisEtCycle: MonthCycleStack[]
  infirmerieBilan: InfirmerieBilan
  rdvBilan: RdvBilan
}

// Maquette « Rapport BI — Indicateurs clés (A4, 4 pages) » : tokens, tailles et marges repris tels quels
// (hex, px pour le texte, mm pour les espacements). IBM Plex Sans/Mono sont chargées dans index.html.
const SANS = "'IBM Plex Sans', sans-serif"
const MONO = "'IBM Plex Mono', monospace"

const T = {
  ink: '#1d232b',
  muted: '#6b7280',
  nul: '#9aa1ab',
  border: '#d5d9df',
  sep: '#e3e6ea',
  track: '#e6e8ec',
  blue: '#2b62b0',
  blueLight: '#8fb4e8',
  green: '#0d7a45',
  red: '#c8373e',
  amber: '#b06d00',
  purple: '#6d4bb0',
  purpleLight: '#9b85d1',
  rose: '#d65b66',
  alertBg: '#fdecec',
  alertBorder: '#f0b9bc',
  callout: '#f3f6fa',
  groupBg: '#eef1f5',
  subBg: '#f4f6f9',
  totalBg: '#e3e8ef',
  subline: '#c3cad3',
  zeroDot: '#c4c9d0',
} as const

/** Type de base de la maquette (10 px, interligne normal) — appliqué à chaque bloc paginé pour que la
 * mesure hors écran et le rendu final partent du même texte, quel que soit le CSS global de l'app. */
const BASE: CSSProperties = { fontFamily: SANS, color: T.ink, fontSize: '10px', lineHeight: 'normal' }

const CYCLE_DEFS: { key: 'maternelle' | 'primaire' | 'college'; name: string }[] = [
  { key: 'maternelle', name: 'Maternelle' },
  { key: 'primaire', name: 'Primaire' },
  { key: 'college', name: 'Collège' },
]

const RECLAMATION_COLORS: Record<string, string> = {
  Comportement: T.red,
  Cantine: T.green,
  Transport: T.purple,
  'Absence / Assiduité': T.amber,
}

const MM_TO_PX = 96 / 25.4

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR')
}

/** Décimale à la française (virgule). */
function fr1(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

/** Pourcentage « 97,9 % » avec espace insécable avant le signe. */
function frPct(n: number): string {
  return `${fr1(n)} %`
}

/** Format court « X h MM » ; zéro affiché « 0 h » (valeurs nulles toujours visibles). */
function formatDureeCourte(hours: number): string {
  const totalMin = Math.round(hours * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (totalMin === 0) return '0 h'
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')}`
}

/** Heures décimales agrégées (colonne « H. manq. ») — « 120,6 h ». */
function heuresDecimalFR(hours: number): string {
  return `${fr1(hours)} h`
}

function periodeJours(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`).getTime()
  const e = new Date(`${end}T00:00:00`).getTime()
  return Math.max(1, Math.round((e - s) / 86400000) + 1)
}

function formatDateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/** « 21 sept. 2026 au 27 sept. 2026 » → « 21 au 27 sept. 2026 » (même mois), « 28 sept. au 4 oct. 2026 » (même année). */
function compactWeekLabel(label: string): string {
  const [from, to] = label.split(' au ')
  if (!from || !to) return label
  const f = from.trim().split(/\s+/)
  const t = to.trim().split(/\s+/)
  if (f.length === 3 && t.length === 3 && f[2] === t[2]) {
    return f[1] === t[1] ? `${f[0]} au ${to.trim()}` : `${f[0]} ${f[1]} au ${to.trim()}`
  }
  return label
}

/** Valeur nulle toujours affichée, en gris ; sinon la couleur demandée. */
function nulOr(value: number, color: string): string {
  return value === 0 ? T.nul : color
}

/** Wrapper de bloc paginé : flow-root pour que la marge propre au bloc soit comptée dans sa hauteur. */
function flowRoot(node: ReactNode) {
  return <div style={{ display: 'flow-root', ...BASE }}>{node}</div>
}

/** Même découpage que la maquette pour les longues listes, mais un reliquat de moins de 3 lignes est
 * rattaché au paquet précédent (jamais une ou deux lignes seules sous un en-tête répété). */
function chunk<T2>(arr: T2[], size: number): T2[][] {
  const out: T2[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  if (out.length > 1 && out[out.length - 1].length < 3) {
    const reliquat = out.pop() as T2[]
    out[out.length - 1] = [...out[out.length - 1], ...reliquat]
  }
  return out
}

const emptyNote: CSSProperties = { margin: '2mm 0 0', padding: '2mm 3mm', background: T.callout, fontSize: '10px', color: T.muted }

/** Bandeau de domaine « 01 … 07 ». */
function PartTitle({ num, title, subtitle, marginTop }: { num: number; title: string; subtitle: string; marginTop: string }) {
  return (
    <div style={{ background: T.ink, color: '#fff', display: 'flex', alignItems: 'center', gap: '3.5mm', padding: '2mm 4mm', marginTop }}>
      <span style={{ fontFamily: MONO, fontSize: '20px', color: T.blueLight }}>{String(num).padStart(2, '0')}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '.1em', color: T.subline, textTransform: 'uppercase' }}>{subtitle}</div>
      </div>
    </div>
  )
}

/** Titre de sous-section « 2.1 Évolution des absences … note ». */
function SectionHead({ num, title, note, margin }: { num?: string; title: string; note?: string; margin: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '2mm', borderBottom: `1px solid ${T.ink}`, paddingBottom: '1mm', margin }}>
      {num ? <span style={{ fontFamily: MONO, color: T.blue }}>{num}</span> : null}
      <b style={{ fontSize: '12px' }}>{title}</b>
      <span style={{ flex: 1 }} />
      {note ? <span style={{ fontFamily: MONO, fontSize: '8.5px', color: T.muted }}>{note}</span> : null}
    </div>
  )
}

const monoLabel: CSSProperties = { fontFamily: MONO, fontSize: '8.5px', letterSpacing: '.1em', color: T.muted }

/** Barre horizontale : [libellé fixe] [piste 1fr] [valeur], remplissage = valeur / max de la série. */
function BarLine({
  label,
  value,
  max,
  color,
  labelWidth,
  valueWidth,
  trackHeight,
  valueColor = T.ink,
}: {
  label: string
  value: number
  max: number
  color: string
  labelWidth: string
  valueWidth: string
  trackHeight: string
  valueColor?: string
}) {
  const w = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${labelWidth} minmax(0,1fr) ${valueWidth}`, alignItems: 'center', gap: '2mm', fontFamily: MONO, fontSize: '9px' }}>
      <span>{label}</span>
      <span style={{ height: trackHeight, background: T.track, display: 'flex' }}>
        <span style={{ background: color, width: `${w}%` }} />
      </span>
      <b style={{ textAlign: 'right', color: nulOr(value, valueColor) }}>{value}</b>
    </div>
  )
}

/** Tableau à en-tête sombre (grille CSS) — enseignants absents, remplaçants, rendez-vous. */
function DataGrid({
  columns,
  headers,
  headSize = '8.5px',
  headerStyle,
  rows,
  colStyle,
  fontSize = '10px',
}: {
  columns: string
  headers: string[]
  headSize?: string
  headerStyle: (col: number) => CSSProperties
  rows: ReactNode[][]
  colStyle: (col: number) => CSSProperties
  fontSize?: string
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, fontSize }}>
      {headers.map((h, i) => (
        <div key={`${h}-${i}`} style={{ background: T.ink, color: '#fff', fontFamily: MONO, fontSize: headSize, ...headerStyle(i) }}>
          {h}
        </div>
      ))}
      {rows.map((cells, r) =>
        cells.map((cell, c) => (
          <div key={`${r}-${c}`} style={{ borderBottom: `1px solid ${T.sep}`, ...colStyle(c) }}>
            {cell}
          </div>
        ))
      )}
    </div>
  )
}

interface ClasseGroup {
  name: string
  rows: ClasseStatsRow[]
  effectif: number
  presence: number | null
  absences: number
  retards: number
  heures: number
  sanctions: number
  conduite: number | null
}

const CLASSE_COLUMNS = 'minmax(0,2fr) repeat(7,minmax(0,1fr))'
const CLASSE_HEADERS = ['CLASSE', 'EFFECTIF', 'PRÉSENCE', 'ABSENCES', 'RETARDS', 'H. MANQ.', 'SANCTIONS', 'CONDUITE']

/** Tableau « Assiduité par classe » : groupes Maternelle / Primaire / Collège, sous-totaux, total. */
function ClasseTable({ groups, total }: { groups: ClasseGroup[]; total: Omit<ClasseGroup, 'name' | 'rows'> }) {
  const cell = (bg: string, extra: CSSProperties = {}): CSSProperties => ({ padding: '1mm', borderBottom: `1px solid ${T.sep}`, background: bg, ...extra })
  const first = (bg: string, extra: CSSProperties = {}): CSSProperties => cell(bg, { padding: '1mm 2mm', textAlign: 'left', ...extra })
  const conduite = (v: number | null) => (v === null ? '—' : `${fr1(v)}/20`)
  const summaryRow = (key: string, label: string, g: Omit<ClasseGroup, 'name' | 'rows'>, bg: string) => {
    const s: CSSProperties = { fontWeight: 700, fontSize: '9px' }
    return (
      <Fragment key={key}>
        <div style={first(bg, s)}>{label}</div>
        <div style={cell(bg, s)}>{g.effectif}</div>
        <div style={cell(bg, s)}>{g.presence === null ? '' : frPct(g.presence)}</div>
        <div style={cell(bg, s)}>{g.absences}</div>
        <div style={cell(bg, s)}>{g.retards}</div>
        <div style={cell(bg, s)}>{heuresDecimalFR(g.heures)}</div>
        <div style={cell(bg, s)}>{g.sanctions}</div>
        <div style={cell(bg, s)}>{conduite(g.conduite)}</div>
      </Fragment>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: CLASSE_COLUMNS, fontSize: '9.5px', textAlign: 'center' }}>
      {CLASSE_HEADERS.map((h) => (
        <div key={h} style={{ background: T.ink, color: '#fff', fontFamily: MONO, fontSize: '8px', padding: '1.3mm 1mm' }}>
          {h}
        </div>
      ))}
      {groups.map((g) => (
        <Fragment key={g.name}>
          <div style={first(T.groupBg, { fontWeight: 600, fontSize: '8.5px', textTransform: 'uppercase' })}>{g.name}</div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} style={cell(T.groupBg)} />
          ))}
          {g.rows.map((r) => {
            const flagged = r.absencesCount >= 10 || r.incidents >= 1
            const bg = flagged ? T.alertBg : '#fff'
            return (
              <Fragment key={r.classe}>
                <div style={first(bg, { fontWeight: 600 })}>{r.classe}</div>
                <div style={cell(bg, { fontWeight: 600 })}>{r.effectif}</div>
                <div style={cell(bg, { fontWeight: 600 })}>{frPct(r.tauxPresence)}</div>
                <div style={cell(bg, r.absencesCount >= 10 ? { color: T.red, fontWeight: 700 } : {})}>{r.absencesCount}</div>
                <div style={cell(bg, r.retardsCount >= 10 ? { color: T.amber, fontWeight: 700 } : {})}>{r.retardsCount}</div>
                <div style={cell(bg, { fontWeight: 600 })}>{heuresDecimalFR(r.heuresManquees)}</div>
                <div style={cell(bg, r.incidents >= 1 ? { color: T.red, fontWeight: 700 } : {})}>{r.incidents}</div>
                <div style={cell(bg, { fontWeight: 700 })}>{fr1(r.moyenneConduite)}/20</div>
              </Fragment>
            )
          })}
          {summaryRow(`sub-${g.name}`, `Sous-total ${g.name.toLowerCase()}`, g, T.subBg)}
        </Fragment>
      ))}
      {summaryRow('total', 'Total établissement', total, T.totalBg)}
    </div>
  )
}

/** Couleur d'une jauge d'occupation : rouge au-delà de 100 %, ambre de 90 à 100 %, vert sinon. */
function occupancyColor(value: number, capacity: number): string {
  if (capacity <= 0) return T.green
  const pct = (value / capacity) * 100
  if (pct > 100) return T.red
  if (pct >= 90) return T.amber
  return T.green
}

export default function PrintableReportsBI({
  periodStart,
  periodEnd,
  effectif,
  nbClasses,
  tauxPresence,
  anneeLibelle,
  weeklyTrend: allWeeklyTrend,
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
  cycleTiles,
  absencesParMoisEtCycle,
  retardsParMoisEtCycle,
  disciplineParMoisEtCycle,
  infirmerieBilan,
  rdvBilan,
}: PrintableReportsBIProps) {
  const { data: schoolIdentity } = useSchoolIdentity()
  const periodLabel = formatPeriodLabel(periodStart, periodEnd)
  // Semaines de la période : celles dont le lundi tombe dans la période (la maquette n'affiche pas les
  // semaines antérieures au début de la période, vides ou non). Repli : la dernière semaine connue.
  const weeklyTrend = (() => {
    const inPeriod = allWeeklyTrend.filter((w) => w.mondayISO >= periodStart && w.mondayISO <= periodEnd)
    return inPeriod.length > 0 ? inPeriod : allWeeklyTrend.slice(-1)
  })()
  const totalHeuresManquees = rows.reduce((s, r) => s + r.heuresManquees, 0)
  const totalPointsSanction = rows.reduce((s, r) => s + r.pointsSanction, 0)
  const totalIncidents = rows.reduce((s, r) => s + r.incidents, 0)

  // --- 01 Effectifs & démographie ---------------------------------------------------------------
  const previousAnnee = anneeData.length >= 2 ? anneeData[anneeData.length - 2] : null
  const currentAnnee = anneeData.length >= 1 ? anneeData[anneeData.length - 1] : null
  const effectifDeltaPct =
    previousAnnee && currentAnnee && previousAnnee.effectif > 0 ? ((currentAnnee.effectif - previousAnnee.effectif) / previousAnnee.effectif) * 100 : null
  const maxEffectifAnnee = Math.max(1, ...anneeData.map((a) => a.effectif))

  // --- 02 Absences des enseignants & remplacements ----------------------------------------------
  const totalSeancesProfs = profsAbsents.reduce((s, p) => s + p.seances, 0)
  const totalCouvertes = profsAbsents.reduce((s, p) => s + p.couvertes, 0)
  const totalHeuresProfs = profsAbsents.reduce((s, p) => s + p.heures, 0)
  const totalHeuresRemplacees = remplacants.reduce((s, r) => s + r.heures, 0)
  const maxWeekProfs = Math.max(...weeklyTrend.map((w) => w.profsAbsentsCount), 0)
  const maxMonthProfs = Math.max(...absencesProfsParMois.map((m) => m.value), 0)
  const profsAbsentsChunks = chunk(profsAbsents, 12)
  const remplacantsChunks = chunk(remplacants, 16)

  // Impact par classe : lecture en 2 colonnes (première moitié à gauche, seconde à droite), les
  // lignes sont entrelacées pour que la grille les remplisse dans cet ordre.
  const maxHeuresRemp = Math.max(...remplacementsParClasse.map((r) => r.heures), 0)
  const impactHalf = Math.ceil(remplacementsParClasse.length / 2)
  const impactOrder: ClasseBreakdownRow[] = []
  for (let i = 0; i < impactHalf; i++) {
    impactOrder.push(remplacementsParClasse[i])
    if (i + impactHalf < remplacementsParClasse.length) impactOrder.push(remplacementsParClasse[i + impactHalf])
  }
  const heuresMaternelle = remplacementsParClasse.filter((r) => cycleOfClasse(r.classe) === 'maternelle').reduce((s, r) => s + r.heures, 0)
  const hasMaternelle = remplacementsParClasse.some((r) => cycleOfClasse(r.classe) === 'maternelle')

  // --- 03 Assiduité & discipline ----------------------------------------------------------------
  const maxWeekEleves = Math.max(...weeklyTrend.map((w) => w.elevesAbsentsCount), 0)
  const monthGroups = [absencesParMoisEtCycle, retardsParMoisEtCycle, disciplineParMoisEtCycle]
  const monthRows = absencesParMoisEtCycle.map((m, i) => ({
    label: m.label,
    values: monthGroups.flatMap((g) => {
      const x = g[i] ?? { maternelle: 0, primaire: 0, college: 0 }
      return [x.maternelle, x.primaire, x.college, x.maternelle + x.primaire + x.college]
    }),
  }))
  const monthTotals = Array.from({ length: 12 }, (_, c) => monthRows.reduce((s, r) => s + r.values[c], 0))
  const GROUP_COLORS = [T.red, T.amber, T.purple]

  // Classes dans l'ordre pédagogique (PS-A → 3APIC-A), pas dans l'ordre de tri de l'écran.
  const niveauRank = (classe: string) => {
    const idx = NIVEAUX.indexOf(niveauFromClasse(classe))
    return idx === -1 ? NIVEAUX.length : idx
  }
  const orderedRows = [...rows].sort((a, b) => niveauRank(a.classe) - niveauRank(b.classe) || a.classe.localeCompare(b.classe))
  const classGroups: ClasseGroup[] = CYCLE_DEFS.map((def) => {
    const groupRows = orderedRows.filter((r) => cycleOfClasse(r.classe) === def.key)
    const eff = groupRows.reduce((s, r) => s + r.effectif, 0)
    return {
      name: def.name,
      rows: groupRows,
      effectif: eff,
      presence: eff > 0 ? groupRows.reduce((s, r) => s + r.tauxPresence * r.effectif, 0) / eff : null,
      absences: groupRows.reduce((s, r) => s + r.absencesCount, 0),
      retards: groupRows.reduce((s, r) => s + r.retardsCount, 0),
      heures: groupRows.reduce((s, r) => s + r.heuresManquees, 0),
      sanctions: groupRows.reduce((s, r) => s + r.incidents, 0),
      conduite: groupRows.length > 0 ? groupRows.reduce((s, r) => s + r.moyenneConduite, 0) / groupRows.length : null,
    }
  }).filter((g) => g.rows.length > 0)
  const classTotal = {
    effectif,
    presence: tauxPresence,
    absences: rows.reduce((s, r) => s + r.absencesCount, 0),
    retards: rows.reduce((s, r) => s + r.retardsCount, 0),
    heures: totalHeuresManquees,
    sanctions: totalIncidents,
    conduite: rows.length > 0 ? rows.reduce((s, r) => s + r.moyenneConduite, 0) / rows.length : null,
  }

  // --- 04 Services périscolaires ----------------------------------------------------------------
  const cantineCountsByRefectoire = computeCantineCountsByRefectoire(servicesParNiveau)
  const cantinePrescolaireSousSol = computeCantinePrescolaireSousSol(servicesParNiveau)
  const services = [
    { name: 'Transport', value: servicesGlobalCounts.transport, capacity: transportCapaciteTotal },
    { name: 'Cantine préscolaire', value: cantinePrescolaireSousSol, capacity: capacite.cantineCapacitePrescolaire },
    { name: 'Cantine sous-sol', value: cantineCountsByRefectoire.sousSol, capacity: capacite.cantineCapaciteSousSol },
    { name: 'Garde matin', value: servicesGlobalCounts.gardeMatin, capacity: capacite.gardeCapacite },
    { name: 'Cantine terrasse', value: cantineCountsByRefectoire.terrasse, capacity: capacite.cantineCapaciteTerrasse },
    { name: 'Garde soir', value: servicesGlobalCounts.gardeApresMidi, capacity: capacite.gardeCapacite },
  ]
  const servicesOver = services.filter((s) => s.capacity > 0 && s.value > s.capacity).map((s) => s.name)
  // « Transport et cantine sous-sol au-delà de leur capacité. » — premier nom en capitale, les autres en minuscules.
  const overNames = servicesOver.map((n, i) => (i === 0 ? n : n.toLowerCase()))
  const servicesOverText =
    overNames.length === 0
      ? null
      : `${overNames.length === 1 ? overNames[0] : `${overNames.slice(0, -1).join(', ')} et ${overNames[overNames.length - 1]}`} ${overNames.length > 1 ? 'au-delà de leur capacité' : 'au-delà de sa capacité'}.`

  const byNiveau = new Map(servicesParNiveau.map((p) => [p.niveau, p]))
  const niveauRows = [
    { label: 'Transport', swatch: T.blue, tint: T.blue, values: NIVEAUX.map((n) => byNiveau.get(n)?.transport ?? 0) },
    { label: 'Cantine', swatch: T.green, tint: T.green, values: NIVEAUX.map((n) => byNiveau.get(n)?.cantine ?? 0) },
    { label: 'Garde matin', swatch: T.purpleLight, tint: T.purple, values: NIVEAUX.map((n) => byNiveau.get(n)?.gardeMatin ?? 0) },
    { label: 'Garde soir', swatch: T.purple, tint: T.purple, values: NIVEAUX.map((n) => byNiveau.get(n)?.gardeApresMidi ?? 0) },
  ]

  // --- 05 Réclamations ---------------------------------------------------------------------------
  const reclTotal = reclamationsParType.reduce((s, r) => s + r.value, 0)
  const activeMotifs = reclamationsParType.filter((r) => r.value > 0).sort((a, b) => b.value - a.value)
  const zeroMotifs = reclamationsParType.filter((r) => r.value === 0)
  const allMotifs = [...activeMotifs, ...zeroMotifs]
  const maxMotif = Math.max(...allMotifs.map((m) => m.value), 0)
  const maxReclMois = Math.max(...reclamationsParMois.map((m) => m.value), 0)

  // --- « À retenir » : phrases générées depuis les agrégats réels, chiffres clés en gras ----------
  const bullets: ReactNode[] = []
  if (previousAnnee && currentAnnee && effectifDeltaPct !== null) {
    const direction = effectifDeltaPct > 0.05 ? 'hausse' : effectifDeltaPct < -0.05 ? 'baisse' : 'stable'
    bullets.push(
      direction === 'stable' ? (
        <>
          Effectif <b>stable</b> par rapport à {previousAnnee.label}.
        </>
      ) : (
        <>
          Effectif en{' '}
          <b>
            {direction} de {fr1(Math.abs(effectifDeltaPct))} %
          </b>{' '}
          par rapport à {previousAnnee.label}.
        </>
      )
    )
  }
  if (profsAbsents.length > 0) {
    bullets.push(
      <>
        <b>
          {profsAbsents.length} enseignant{profsAbsents.length > 1 ? 's' : ''} absent{profsAbsents.length > 1 ? 's' : ''}
        </b>{' '}
        ({totalSeancesProfs} séance{totalSeancesProfs > 1 ? 's' : ''}, {formatDureeCourte(totalHeuresProfs)}), dont{' '}
        <b>{totalSeancesProfs > 0 ? Math.round((totalCouvertes / totalSeancesProfs) * 100) : 0} % remplacées</b> par {remplacants.length} remplaçant
        {remplacants.length > 1 ? 's' : ''}.
      </>
    )
  }
  const peakWeek = weeklyTrend.reduce<WeeklyTrendPoint | null>((best, w) => (!best || w.elevesAbsentsCount > best.elevesAbsentsCount ? w : best), null)
  if (peakWeek && peakWeek.elevesAbsentsCount > 0) {
    bullets.push(
      <>
        Pic d'absentéisme la semaine du <b>{compactWeekLabel(peakWeek.label)}</b> : {peakWeek.elevesAbsentsCount} élève(s) et {peakWeek.profsAbsentsCount} enseignant(s) absent(s).
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
    bullets.push(
      <>
        {top.length} classe{top.length > 1 ? 's' : ''} concentre{top.length > 1 ? 'nt' : ''} <b>{pct} %</b> des heures manquées :{' '}
        <b>{top.map((r) => `${r.classe} (${heuresDecimalFR(r.heuresManquees)})`).join(', ')}</b>.
      </>
    )
  }
  if (bullets.length > 0 || reclTotal > 0 || totalIncidents > 0) {
    const motifsPart = activeMotifs.length > 0 ? ` (${activeMotifs.slice(0, 2).map((m) => m.label.split(' / ')[0]).join(' et ')} en tête)` : ''
    bullets.push(
      <>
        {reclTotal > 0 ? (
          <>
            <b>
              {reclTotal} réclamation{reclTotal > 1 ? 's' : ''}
            </b>{' '}
            sur la période{motifsPart}
          </>
        ) : (
          <>Aucune réclamation sur la période</>
        )}{' '}
        ·{' '}
        {totalIncidents > 0 ? (
          <b>
            {totalIncidents} sanction{totalIncidents > 1 ? 's' : ''} disciplinaire{totalIncidents > 1 ? 's' : ''}
          </b>
        ) : (
          <>aucune sanction disciplinaire</>
        )}
        .
      </>
    )
  }
  if (infirmerieBilan.passages > 0 || rdvBilan.total > 0) {
    const topMotif = infirmerieBilan.parMotif.find((m) => m.label !== 'Autres motifs')
    bullets.push(
      <>
        {infirmerieBilan.passages > 0 ? (
          <>
            <b>
              {infirmerieBilan.passages} passage{infirmerieBilan.passages > 1 ? 's' : ''} à l'infirmerie
            </b>
            {topMotif ? ` (${topMotif.label.toLowerCase()})` : ''}
          </>
        ) : null}
        {infirmerieBilan.passages > 0 && rdvBilan.total > 0 ? ' · ' : null}
        {rdvBilan.total > 0 ? (
          <>
            <b>{rdvBilan.total} rendez-vous parents</b>
            {rdvBilan.enAttenteSignature > 0
              ? ` dont ${rdvBilan.enAttenteSignature} compte${rdvBilan.enAttenteSignature > 1 ? 's' : ''}-rendu${rdvBilan.enAttenteSignature > 1 ? 's' : ''} en attente de signature`
              : ''}
          </>
        ) : null}
        .
      </>
    )
  }
  const aRetenirBullets: ReactNode[] = bullets.length > 0 ? bullets : ['Aucun signal particulier à relever sur la période.']

  // --- 06 / 07 -----------------------------------------------------------------------------------
  const rdvStatutColor = { Réalisé: T.green, Planifié: T.blue, Annulé: T.red } as const
  const rdvChunks = chunk(rdvBilan.rows, 4)
  const rdvTable = (list: typeof rdvBilan.rows) => (
    <DataGrid
      columns="24mm minmax(0,1.3fr) minmax(0,1fr) minmax(0,2.2fr) 20mm"
      headers={['DATE', 'ÉLÈVE', 'ENSEIGNANT', 'MOTIF', 'STATUT']}
      headSize="8px"
      headerStyle={() => ({ padding: '1.3mm 2mm' })}
      fontSize="9.5px"
      colStyle={(c) => ({ padding: '1.5mm 2mm', ...(c === 0 ? { fontWeight: 700 } : {}), ...(c === 3 ? { lineHeight: 1.35 } : {}) })}
      rows={list.map((r) => [
        `${formatDateCourte(r.date)} · ${r.heure}`,
        `${r.studentName} (${r.classe})`,
        r.enseignants.length > 0 ? r.enseignants.join(', ') : 'Administration',
        r.motif,
        <span key="s" style={{ fontWeight: 700, color: rdvStatutColor[r.statut] }}>
          {r.statut}
        </span>,
      ])}
    />
  )
  const topInfirmerieClasses = infirmerieBilan.parClasse.slice(0, 3)
  const topInfirmerieMotifs = infirmerieBilan.parMotif.slice(0, 3)
  const infirmerieDetailLine = (kind: string, showKind: boolean, label: string, value: number) => (
    <div key={`${kind}-${label}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '3mm' }}>
      <span>
        <span style={{ ...monoLabel, letterSpacing: 0, display: 'inline-block', width: '13mm' }}>{showKind ? kind : ''}</span>
        <b>{label}</b>
      </span>
      <b>{value}</b>
    </div>
  )

  const rdvKpis = [
    { v: rdvBilan.total, l: 'Rendez-vous', s: 'tous statuts', c: T.ink },
    { v: rdvBilan.realises, l: 'Réalisés', s: 'entretien tenu', c: T.green },
    { v: rdvBilan.planifies, l: 'Planifiés', s: 'à venir / clôturer', c: T.blue },
    { v: rdvBilan.annules, l: 'Annulés', s: "n'ont pas eu lieu", c: rdvBilan.annules === 0 ? T.green : T.amber },
    { v: rdvBilan.comptesRendus, l: 'Comptes-rendus', s: `sur ${rdvBilan.realises} réalisé${rdvBilan.realises > 1 ? 's' : ''}`, c: T.ink },
    { v: rdvBilan.enAttenteSignature, l: 'À signer', s: 'signature parent', c: rdvBilan.enAttenteSignature === 0 ? T.green : T.amber },
  ]

  const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)

  const blocks: PaginatedBlock[] = [
    // ================================ 01 EFFECTIFS & DÉMOGRAPHIE ================================
    {
      key: 'p1-effectifs',
      node: flowRoot(
        <div>
          <PartTitle
            num={1}
            title="Effectifs & démographie"
            subtitle={`${effectif} élèves · ${nbClasses} classes · ${anneeData.length} ${plural(anneeData.length, 'année comparée', 'années comparées')}`}
            marginTop="4mm"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', border: `1px solid ${T.border}`, borderTop: 'none' }}>
            <div style={{ padding: '2.5mm 3mm', display: 'flex', flexDirection: 'column', gap: '1.5mm' }}>
              <div style={monoLabel}>ÉLÈVES PAR ANNÉE</div>
              {anneeData.map((a) => {
                const w = (a.effectif / maxEffectifAnnee) * 100
                return (
                  <div key={a.anneeId} style={{ display: 'grid', gridTemplateColumns: '10mm minmax(0,1fr) 8mm', alignItems: 'center', gap: '2mm' }}>
                    <span style={{ fontFamily: MONO }}>{a.label}</span>
                    <span style={{ height: '2.2mm', background: `linear-gradient(90deg,${T.blue} ${w}%,${T.track} ${w}%)` }} />
                    <b style={{ textAlign: 'right' }}>{a.effectif}</b>
                  </div>
                )
              })}
              {effectifDeltaPct !== null && previousAnnee ? (
                <div style={{ fontFamily: MONO, fontSize: '8.5px', color: effectifDeltaPct < 0 ? T.red : T.green }}>
                  {effectifDeltaPct < 0 ? '−' : '+'}
                  {fr1(Math.abs(effectifDeltaPct))} % par rapport à {previousAnnee.label}
                </div>
              ) : null}
            </div>
            <div style={{ padding: '2.5mm 3mm', borderLeft: `1px solid ${T.sep}`, display: 'flex', flexDirection: 'column', gap: '1.3mm' }}>
              <div style={monoLabel}>CAPACITÉ</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Classes ouvertes</span>
                <b>{nbClasses}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Ratio élèves/classe</span>
                <b>{nbClasses > 0 ? fr1(effectif / nbClasses) : '—'}</b>
              </div>
            </div>
            <div style={{ padding: '2.5mm 3mm', borderLeft: `1px solid ${T.sep}`, display: 'flex', flexDirection: 'column', gap: '1.2mm' }}>
              <div style={monoLabel}>GENRE PAR ANNÉE</div>
              {anneeData.length === 0 ? <span style={{ color: T.muted }}>Aucune donnée.</span> : null}
              {anneeData.map((a) => (
                <Fragment key={a.anneeId}>
                  <div style={{ display: 'grid', gridTemplateColumns: '9mm minmax(0,1fr)', alignItems: 'center', gap: '2mm' }}>
                    <b>{a.label}</b>
                    <span style={{ height: '2.6mm', background: `linear-gradient(90deg,${T.blue} ${a.pctGarcons}%,${T.rose} ${a.pctGarcons}%)` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: T.muted, paddingLeft: '11mm' }}>
                    <span>Garçons {fr1(a.pctGarcons)} %</span>
                    <span>Filles {fr1(a.pctFilles)} %</span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      ),
    },

    // ========================= 02 ABSENCES DES ENSEIGNANTS & REMPLACEMENTS =========================
    {
      key: 'p2-titre-evolution',
      node: flowRoot(
        <div>
          <PartTitle
            num={2}
            title="Absences des enseignants & remplacements"
            subtitle={`${profsAbsents.length} ${plural(profsAbsents.length, 'enseignant absent', 'enseignants absents')} · ${totalSeancesProfs} ${plural(totalSeancesProfs, 'séance', 'séances')} · ${formatDureeCourte(totalHeuresRemplacees)} remplacées`}
            marginTop="4mm"
          />
          <SectionHead num="2.1" title="Évolution des absences" note="enseignants absents" margin="3mm 0 1.8mm" />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: '8mm' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1mm' }}>
              <div style={{ ...monoLabel, color: T.green, fontWeight: 600 }}>PAR SEMAINE</div>
              {weeklyTrend.map((w) => (
                <BarLine key={w.week} label={w.week} value={w.profsAbsentsCount} max={maxWeekProfs} color={T.green} labelWidth="15mm" valueWidth="6mm" trackHeight="2.2mm" />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1mm' }}>
              <div style={{ ...monoLabel, color: T.green, fontWeight: 600 }}>PAR MOIS</div>
              {absencesProfsParMois.map((m) => (
                <BarLine key={m.label} label={m.label} value={m.value} max={maxMonthProfs} color={T.green} labelWidth="9mm" valueWidth="6mm" trackHeight="2.2mm" />
              ))}
            </div>
          </div>
        </div>
      ),
    },
    ...(profsAbsentsChunks.length === 0
      ? [
          {
            key: 'p2-profs-absents-0',
            node: flowRoot(
              <div>
                <SectionHead num="2.2" title="Enseignants absents" note="période sélectionnée" margin="3.5mm 0 0" />
                <p style={emptyNote}>Aucune absence d'enseignant sur la période.</p>
              </div>
            ),
          },
        ]
      : profsAbsentsChunks.map((list, i) => ({
          key: `p2-profs-absents-${i}`,
          node: flowRoot(
            <div>
              {i === 0 ? (
                <SectionHead
                  num="2.2"
                  title="Enseignants absents"
                  note={`${profsAbsents.length} enseignant(s) · ${totalCouvertes}/${totalSeancesProfs} séances remplacées`}
                  margin="3.5mm 0 0"
                />
              ) : (
                <div style={{ height: '1.5mm' }} />
              )}
              <DataGrid
                columns="minmax(0,2.4fr) repeat(3,minmax(0,1fr))"
                headers={['ENSEIGNANT', 'SÉANCES', 'HEURES', 'REMPLACÉES']}
                headerStyle={(c) => ({ padding: '1.3mm 2mm', textAlign: c === 0 ? 'left' : 'center' })}
                colStyle={(c) => ({ padding: '1.1mm 2mm', textAlign: c === 0 ? 'left' : 'center', ...(c === 0 ? { fontWeight: 600 } : {}) })}
                rows={list.map((p) => [
                  p.name,
                  p.seances,
                  formatDureeCourte(p.heures),
                  <span key="c" style={{ fontWeight: 700, color: p.couvertes === p.seances ? T.green : p.couvertes === 0 ? T.red : T.amber }}>
                    {p.couvertes}/{p.seances}
                  </span>,
                ])}
              />
            </div>
          ),
        }))),

    // 2.3 ouvre la page 2 de la maquette.
    ...(remplacantsChunks.length === 0
      ? [
          {
            key: 'p2-remplacants-0',
            breakBefore: true,
            node: flowRoot(
              <div>
                <SectionHead num="2.3" title="Enseignants remplaçants" note="période sélectionnée" margin="3mm 0 0" />
                <p style={emptyNote}>Aucun remplacement enregistré sur la période.</p>
              </div>
            ),
          },
        ]
      : remplacantsChunks.map((list, i) => {
          const half = Math.ceil(list.length / 2)
          return {
            key: `p2-remplacants-${i}`,
            breakBefore: i === 0,
            node: flowRoot(
              <div>
                {i === 0 ? (
                  <SectionHead num="2.3" title="Enseignants remplaçants" note={`${remplacants.length} remplaçant(s) · ${formatDureeCourte(totalHeuresRemplacees)}`} margin="3mm 0 0" />
                ) : (
                  <div style={{ height: '1.5mm' }} />
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '5mm' }}>
                  {[list.slice(0, half), list.slice(half)].map((col, k) => (
                    <DataGrid
                      key={k}
                      columns="minmax(0,2.6fr) minmax(0,1fr) minmax(0,1fr)"
                      headers={['REMPLAÇANT', 'NB', 'HEURES']}
                      headerStyle={(c) => ({ padding: c === 0 ? '1.3mm 2mm' : '1.3mm 1mm', textAlign: c === 0 ? 'left' : 'center' })}
                      colStyle={(c) =>
                        c === 0
                          ? { padding: '1.1mm 2mm', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
                          : { padding: '1.1mm 1mm', textAlign: 'center' }
                      }
                      rows={col.map((r) => [r.name, r.count, formatDureeCourte(r.heures)])}
                    />
                  ))}
                </div>
              </div>
            ),
          }
        })),
    {
      key: 'p2-impact',
      node: flowRoot(
        <div>
          <SectionHead
            num="2.4"
            title="Impact par classe"
            note={
              remplacementsParClasse.length === 0
                ? 'aucune classe'
                : `heures remplacées · ${remplacementsParClasse.filter((r) => r.heures > 0).length} classes concernées sur ${remplacementsParClasse.length}${hasMaternelle ? ` (maternelle : ${formatDureeCourte(heuresMaternelle)})` : ''}`
            }
            margin="3.5mm 0 1.8mm"
          />
          {remplacementsParClasse.length === 0 ? (
            <p style={emptyNote}>Aucune classe active sur cette période.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', columnGap: '8mm', rowGap: '1.2mm' }}>
              {impactOrder.map((r) => {
                const col = r.heures > 0 ? T.green : T.nul
                const w = maxHeuresRemp > 0 ? (r.heures / maxHeuresRemp) * 100 : 0
                return (
                  <div key={r.classe} style={{ display: 'grid', gridTemplateColumns: '17mm minmax(0,1fr) 11mm', alignItems: 'center', gap: '2mm', fontFamily: MONO, fontSize: '9px' }}>
                    <b style={{ color: col }}>{r.classe}</b>
                    <span style={{ height: '2.2mm', background: T.track, display: 'flex' }}>
                      <span style={{ background: T.green, width: `${w}%` }} />
                    </span>
                    <b style={{ textAlign: 'right', color: col }}>{formatDureeCourte(r.heures)}</b>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ),
    },

    // ================================ 03 ASSIDUITÉ & DISCIPLINE DES ÉLÈVES ================================
    {
      key: 'p3-assiduite',
      node: flowRoot(
        <div>
          <PartTitle
            num={3}
            title="Assiduité & discipline des élèves"
            subtitle={`Présence ${fr1(tauxPresence)} % · ${cycleTiles.absencesSeances.total} séances manquées · ${cycleTiles.retardsSeances.total} retards · ${totalIncidents} ${plural(totalIncidents, 'sanction', 'sanctions')}`}
            marginTop="4.5mm"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.35fr)', gap: '7mm' }}>
            <div>
              <SectionHead num="3.1" title="Tendance d'assiduité" margin="3mm 0 1.8mm" />
              <div style={{ fontFamily: MONO, fontSize: '8.5px', color: T.muted, marginBottom: '1.5mm' }}>Élèves absents par semaine</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4mm' }}>
                {weeklyTrend.map((w) => (
                  <BarLine key={w.week} label={w.week} value={w.elevesAbsentsCount} max={maxWeekEleves} color={T.red} labelWidth="15mm" valueWidth="7mm" trackHeight="3mm" valueColor={T.red} />
                ))}
              </div>
            </div>
            <div>
              <SectionHead num="3.2" title="Vue par cycle" margin="3mm 0 0" />
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) repeat(4,minmax(0,1fr))', fontSize: '9.5px' }}>
                {['INDICATEUR', 'MAT.', 'PRI.', 'COL.', 'TOTAL'].map((h, i) => (
                  <div key={h} style={{ fontFamily: MONO, fontSize: '8px', color: T.muted, padding: i === 0 ? '1.2mm 1.5mm' : '1.2mm 1mm', borderBottom: `1px solid ${T.ink}`, textAlign: i === 0 ? 'left' : 'center' }}>
                    {h}
                  </div>
                ))}
                {[
                  { label: 'Élèves absents', counts: cycleTiles.absencesEleves },
                  { label: 'Séances manquées', counts: cycleTiles.absencesSeances },
                  { label: 'Élèves en retard', counts: cycleTiles.retardsEleves },
                  { label: 'Séances en retard', counts: cycleTiles.retardsSeances },
                  { label: 'Problèmes disciplinaires', counts: cycleTiles.disciplineEleves },
                ].map((r) => (
                  <Fragment key={r.label}>
                    <div style={{ padding: '1.1mm 1.5mm', borderBottom: `1px solid ${T.sep}`, fontWeight: 600 }}>{r.label}</div>
                    {[r.counts.maternelle, r.counts.primaire, r.counts.college].map((v, i) => (
                      <div key={i} style={{ padding: '1.1mm 1mm', borderBottom: `1px solid ${T.sep}`, textAlign: 'center', color: nulOr(v, T.ink) }}>
                        {v}
                      </div>
                    ))}
                    <div style={{ padding: '1.1mm 1mm', borderBottom: `1px solid ${T.sep}`, textAlign: 'center', fontWeight: 700, color: nulOr(r.counts.total, T.ink) }}>{r.counts.total}</div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'p3-activite',
      node: flowRoot(
        <div>
          <SectionHead num="3.3" title="Activité mensuelle par cycle" note={`année scolaire ${anneeLibelle}`} margin="4mm 0 0" />
          <div style={{ display: 'grid', gridTemplateColumns: '14mm repeat(12,minmax(0,1fr))', fontSize: '9.5px', textAlign: 'center' }}>
            <div style={{ padding: '1.2mm 0', borderBottom: `1px solid ${T.sep}` }} />
            {[
              { l: 'ABSENCES', c: T.red, ml: 0 },
              { l: 'RETARDS', c: T.amber, ml: 2 },
              { l: 'DISCIPLINE', c: T.purple, ml: 2 },
            ].map((g) => (
              <div
                key={g.l}
                style={{ gridColumn: 'span 4', fontFamily: MONO, fontSize: '8.5px', fontWeight: 600, color: g.c, padding: '1.2mm 0', borderBottom: `2px solid ${g.c}`, marginLeft: g.ml ? `${g.ml}mm` : undefined }}
              >
                {g.l}
              </div>
            ))}
            <div style={{ fontFamily: MONO, fontSize: '8px', color: T.muted, padding: '1mm 0', textAlign: 'left' }}>Mois</div>
            {['Mat', 'Pri', 'Col', 'Tot', 'Mat', 'Pri', 'Col', 'Tot', 'Mat', 'Pri', 'Col', 'Tot'].map((h, i) => (
              <div key={i} style={{ fontFamily: MONO, fontSize: '8px', color: T.muted, padding: '1mm 0' }}>
                {h}
              </div>
            ))}
            {[...monthRows, { label: 'Total', values: monthTotals, bold: true }].map((r) => (
              <Fragment key={r.label}>
                <div style={{ padding: '1.1mm 0', borderTop: `1px solid ${T.sep}`, textAlign: 'left', fontWeight: 600 }}>{r.label}</div>
                {r.values.map((v, i) => {
                  const isTot = i % 4 === 3
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '1.1mm 0',
                        borderTop: `1px solid ${T.sep}`,
                        fontWeight: isTot || ('bold' in r && r.bold) ? 700 : 400,
                        color: v === 0 ? T.nul : isTot ? GROUP_COLORS[Math.floor(i / 4)] : T.ink,
                      }}
                    >
                      {v}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      ),
    },

    // 3.4 ouvre la page 3 de la maquette.
    {
      key: 'p3-classes',
      breakBefore: true,
      node: flowRoot(
        <div>
          <SectionHead num="3.4" title="Assiduité par classe" note={`${nbClasses} classes · ${effectif} élèves comptabilisés`} margin="3mm 0 0" />
          {classGroups.length === 0 ? <p style={emptyNote}>Aucune classe active sur la période sélectionnée.</p> : <ClasseTable groups={classGroups} total={classTotal} />}
          <div style={{ display: 'flex', gap: '2mm', alignItems: 'center', fontSize: '8.5px', color: T.muted, marginTop: '1.5mm' }}>
            <span style={{ width: '3mm', height: '3mm', background: T.alertBg, border: `1px solid ${T.alertBorder}`, display: 'inline-block' }} />
            <span>
              Classe à signaler (≥ 1 sanction ou ≥ 10 absences) · <b style={{ color: T.red }}>rouge</b> : absences ≥ 10 / sanction · <b style={{ color: T.amber }}>ambre</b> : retards ≥ 10
            </span>
          </div>
        </div>
      ),
    },

    // ================================ 04 SERVICES PÉRISCOLAIRES ================================
    {
      key: 'p4-services',
      node: flowRoot(
        <div>
          <PartTitle num={4} title="Services périscolaires" subtitle="Transport · cantine · garde — inscrits / capacité" marginTop="4.5mm" />
          <SectionHead num="4.1" title="Occupation des services" note={`${services.length} services`} margin="3mm 0 2mm" />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', columnGap: '8mm', rowGap: '2mm' }}>
            {services.map((s) => {
              const color = occupancyColor(s.value, s.capacity)
              const pct = s.capacity > 0 ? Math.round((s.value / s.capacity) * 100) : 0
              return (
                <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '30mm minmax(0,1fr) 25mm', alignItems: 'center', gap: '2mm' }}>
                  <b style={{ fontSize: '9.5px' }}>{s.name}</b>
                  <span style={{ height: '2.6mm', background: T.track, display: 'flex' }}>
                    <span style={{ background: color, width: `${Math.min(100, pct)}%` }} />
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: '9px', textAlign: 'right' }}>
                    <b>
                      {s.value} / {s.capacity}
                    </b>{' '}
                    · <b style={{ color }}>{pct} %</b>
                  </span>
                </div>
              )
            })}
          </div>
          {servicesOverText ? <div style={{ fontSize: '8.5px', color: T.red, marginTop: '1.5mm' }}>{servicesOverText}</div> : null}
        </div>
      ),
    },
    {
      key: 'p4-niveau',
      node: flowRoot(
        <div>
          <SectionHead num="4.2" title="Répartition par niveau" note="élèves inscrits" margin="3.5mm 0 0" />
          <div style={{ display: 'grid', gridTemplateColumns: `22mm repeat(${NIVEAUX.length},minmax(0,1fr)) 12mm`, fontSize: '9.5px', textAlign: 'center' }}>
            {['SERVICE', ...NIVEAUX, 'TOTAL'].map((h) => (
              <div key={h} style={{ fontFamily: MONO, fontSize: '8px', color: T.muted, padding: '1.2mm 0', borderBottom: `1px solid ${T.ink}` }}>
                {h}
              </div>
            ))}
            {niveauRows.map((r) => {
              const max = Math.max(...r.values, 0)
              return (
                <Fragment key={r.label}>
                  <div style={{ padding: '1.2mm 0', borderBottom: `1px solid ${T.sep}`, textAlign: 'left', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
                    <span style={{ width: '2.2mm', height: '2.2mm', background: r.swatch, display: 'inline-block', flexShrink: 0 }} />
                    {r.label}
                  </div>
                  {r.values.map((v, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '1.2mm 0',
                        borderBottom: `1px solid ${T.sep}`,
                        color: v === 0 ? T.nul : T.ink,
                        background: v === 0 || max === 0 ? 'transparent' : `color-mix(in oklab, ${r.tint} ${Math.round((v / max) * 32)}%, white)`,
                      }}
                    >
                      {v}
                    </div>
                  ))}
                  <div style={{ padding: '1.2mm 0', borderBottom: `1px solid ${T.sep}`, fontWeight: 700 }}>{r.values.reduce((s, v) => s + v, 0)}</div>
                </Fragment>
              )
            })}
          </div>
        </div>
      ),
    },

    // ================================ 05 RÉCLAMATIONS (ouvre la page 4) ================================
    {
      key: 'p5-reclamations',
      breakBefore: true,
      node: flowRoot(
        <div>
          <PartTitle
            num={5}
            title="Réclamations des parents"
            subtitle={`${reclTotal} ${plural(reclTotal, 'réclamation', 'réclamations')} sur la période · ${activeMotifs.length} ${plural(activeMotifs.length, 'motif actif', 'motifs actifs')} sur ${allMotifs.length}`}
            marginTop="3mm"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', gap: '8mm' }}>
            <div>
              <SectionHead num="5.1" title="Réclamations par motif" margin="3mm 0 1.8mm" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.7mm' }}>
                {allMotifs.map((m) => {
                  const color = m.value > 0 ? (RECLAMATION_COLORS[m.label] ?? T.blue) : T.zeroDot
                  const w = maxMotif > 0 ? (m.value / maxMotif) * 100 : 0
                  return (
                    <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '46mm minmax(0,1fr) 6mm', alignItems: 'center', gap: '2mm', color: m.value > 0 ? T.ink : T.nul }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
                        <span style={{ width: '2.2mm', height: '2.2mm', borderRadius: '50%', background: color, flexShrink: 0 }} />
                        {m.label}
                      </span>
                      <span style={{ height: '2.2mm', background: T.track, display: 'flex' }}>
                        <span style={{ background: color, width: `${w}%` }} />
                      </span>
                      <b style={{ textAlign: 'right' }}>{m.value}</b>
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <SectionHead num="5.2" title="Évolution mensuelle" margin="3mm 0 1.8mm" />
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, reclamationsParMois.length)},minmax(0,1fr))`, columnGap: '1.2mm', alignItems: 'end', height: '48mm', borderBottom: `1px solid ${T.ink}` }}>
                {reclamationsParMois.map((m) => (
                  <div key={m.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '.8mm' }}>
                    <b style={{ fontFamily: MONO, fontSize: '9px', color: m.value > 0 ? T.blue : T.nul }}>{m.value}</b>
                    <span style={{ width: '100%', height: `${maxReclMois > 0 ? (m.value / maxReclMois) * 85 : 0}%`, background: T.blue, minHeight: '.5mm', opacity: m.value > 0 ? 1 : 0.25 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, reclamationsParMois.length)},minmax(0,1fr))`, columnGap: '1.2mm', marginTop: '1mm' }}>
                {reclamationsParMois.map((m) => (
                  <span key={m.label} style={{ fontFamily: MONO, fontSize: '7.5px', color: T.muted, textAlign: 'center' }}>
                    {m.label}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '8.5px', color: T.muted, marginTop: '1.5mm' }}>Nombre de réclamations par mois · année {anneeLibelle}.</div>
            </div>
          </div>
        </div>
      ),
    },

    // ================================ 06 INFIRMERIE ================================
    {
      key: 'p6-infirmerie',
      node: flowRoot(
        <div>
          <PartTitle
            num={6}
            title="Infirmerie"
            subtitle={`${infirmerieBilan.passages} ${plural(infirmerieBilan.passages, 'passage', 'passages')} · ${infirmerieBilan.eleves} ${plural(infirmerieBilan.eleves, 'élève concerné', 'élèves concernés')}`}
            marginTop="4.5mm"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr)) minmax(0,2.2fr)', border: `1px solid ${T.border}`, borderTop: 'none' }}>
            {[
              { v: String(infirmerieBilan.passages), n: infirmerieBilan.passages, c: T.blue, l: plural(infirmerieBilan.passages, 'Passage', 'Passages'), s: `sur ${periodeJours(periodStart, periodEnd)} jours` },
              { v: String(infirmerieBilan.eleves), n: infirmerieBilan.eleves, c: T.ink, l: plural(infirmerieBilan.eleves, 'Élève concerné', 'Élèves concernés'), s: `sur ${effectif} inscrits` },
              {
                v: infirmerieBilan.eleves > 0 ? fr1(infirmerieBilan.passages / infirmerieBilan.eleves) : '—',
                n: infirmerieBilan.eleves,
                c: T.ink,
                l: 'Passage / élève',
                s: 'moyenne',
              },
            ].map((k, i) => (
              <div key={k.l} style={{ padding: '2.5mm 2mm', textAlign: 'center', borderLeft: i === 0 ? undefined : `1px solid ${T.sep}` }}>
                <div style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.1, color: nulOr(k.n, k.c) }}>{k.v}</div>
                <div style={{ fontWeight: 600 }}>{k.l}</div>
                <div style={{ fontFamily: MONO, fontSize: '8.5px', color: T.muted }}>{k.s}</div>
              </div>
            ))}
            <div style={{ padding: '2.5mm 4mm', borderLeft: `1px solid ${T.sep}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2mm' }}>
              {infirmerieBilan.passages === 0 ? (
                <span style={{ color: T.muted }}>Aucun passage enregistré sur la période.</span>
              ) : (
                <>
                  {topInfirmerieClasses.map((c, i) => infirmerieDetailLine('CLASSE', i === 0, c.label, c.value))}
                  {infirmerieBilan.parClasse.length > topInfirmerieClasses.length ? (
                    <span style={{ ...monoLabel, letterSpacing: 0 }}>+ {infirmerieBilan.parClasse.length - topInfirmerieClasses.length} autre(s) classe(s)</span>
                  ) : null}
                  {topInfirmerieMotifs.map((m, i) => infirmerieDetailLine('MOTIF', i === 0, m.label, m.value))}
                  {infirmerieBilan.parMotif.length > topInfirmerieMotifs.length ? (
                    <span style={{ ...monoLabel, letterSpacing: 0 }}>+ {infirmerieBilan.parMotif.length - topInfirmerieMotifs.length} autre(s) motif(s)</span>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ),
    },

    // ================================ 07 RENDEZ-VOUS AVEC LES PARENTS ================================
    {
      key: 'p7-rdv',
      node: flowRoot(
        <div>
          <PartTitle
            num={7}
            title="Rendez-vous avec les parents"
            subtitle={`${rdvBilan.total} ${plural(rdvBilan.total, 'rendez-vous', 'rendez-vous')} · ${rdvBilan.realises} ${plural(rdvBilan.realises, 'réalisé', 'réalisés')} · ${rdvBilan.planifies} ${plural(rdvBilan.planifies, 'planifié', 'planifiés')} · ${rdvBilan.annules} ${plural(rdvBilan.annules, 'annulé', 'annulés')}`}
            marginTop="4.5mm"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', border: `1px solid ${T.border}`, borderTop: 'none' }}>
            {rdvKpis.map((k, i) => (
              <div key={k.l} style={{ padding: '2.2mm 1.5mm', textAlign: 'center', borderLeft: i === 0 ? undefined : `1px solid ${T.sep}` }}>
                <div style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.1, color: k.c }}>{k.v}</div>
                <div style={{ fontWeight: 600, fontSize: '9.5px' }}>{k.l}</div>
                <div style={{ fontFamily: MONO, fontSize: '8px', color: T.muted }}>{k.s}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    // La liste est coupée en paquets : si elle dépasse la page 4, la suite passe sur une page de
    // continuation (en-tête compact) au lieu de laisser un grand vide en bas de la page 4.
    {
      key: 'p7-rdv-liste-0',
      node: flowRoot(
        <div>
          <SectionHead num="7.1" title="Liste des rendez-vous" note="du plus récent au plus ancien" margin="3.5mm 0 0" />
          {rdvChunks.length === 0 ? <p style={emptyNote}>Aucun rendez-vous avec les parents sur la période.</p> : rdvTable(rdvChunks[0])}
        </div>
      ),
    },
    ...rdvChunks.slice(1).map((list, i) => ({ key: `p7-rdv-liste-${i + 1}`, node: flowRoot(<div style={{ marginTop: '1.5mm' }}>{rdvTable(list)}</div>) })),
    {
      key: 'p7-visa',
      node: flowRoot(
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2mm', borderBottom: `1px solid ${T.ink}`, paddingBottom: '1mm', margin: '5mm 0 2mm' }}>
            <b style={{ fontSize: '12px' }}>Observations de la direction</b>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ borderBottom: `1px dotted ${T.nul}`, height: '7mm' }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '8mm', marginTop: '4mm' }}>
            {[
              { label: 'DIRECTION DE LA VIE SCOLAIRE — VISA', withCachet: true },
              { label: 'DIRECTION — VISA & CACHET', withCachet: false },
            ].map((box) => (
              <div
                key={box.label}
                style={{
                  border: `1px solid ${T.border}`,
                  height: '20mm',
                  padding: '2mm 3mm',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1mm',
                  fontFamily: MONO,
                  fontSize: '8.5px',
                  color: T.muted,
                  textAlign: 'center',
                }}
              >
                <span>{box.label}</span>
                {box.withCachet && schoolIdentity?.cachet ? (
                  <img src={schoolIdentity.cachet} alt="Cachet" style={{ maxHeight: '12.5mm', maxWidth: '100%', minHeight: 0, objectFit: 'contain' }} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ]

  return (
    <PaginatedPrintDocument
      blocks={blocks}
      paddingXPx={12 * MM_TO_PX}
      paddingYPx={9 * MM_TO_PX}
      paddingTopPx={9 * MM_TO_PX}
      paddingBottomPx={7 * MM_TO_PX}
      gapPx={0}
      pageStyle={{ background: '#fff', ...BASE }}
      renderHeader={(pageIndex) =>
        pageIndex === 0 ? (
          <div style={{ display: 'flow-root', ...BASE }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6mm', paddingBottom: '2.5mm', borderBottom: `1.5px solid ${T.ink}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
                <SchoolLogo size={Math.round(11 * MM_TO_PX)} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>Groupe Scolaire Mondrian</div>
                  <div style={{ fontFamily: MONO, fontSize: '8.5px', letterSpacing: '.12em', color: T.muted, textTransform: 'uppercase' }}>École de la bienveillance</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: MONO, fontSize: '8.5px', letterSpacing: '.12em', color: T.blue, textTransform: 'uppercase' }}>Rapports BI — Indicateurs clés</div>
                <div style={{ fontWeight: 700, fontSize: '12.5px' }}>Période du {periodLabel}</div>
                <div style={{ fontFamily: MONO, fontSize: '8.5px', color: T.muted }}>
                  Édité le {todayFR()} · {periodeJours(periodStart, periodEnd)} jour(s)
                </div>
              </div>
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, textAlign: 'center', margin: '3mm 0 2.5mm' }}>Pilotage de l'établissement — rentrée {anneeLibelle}</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', border: `1px solid ${T.border}` }}>
              {[
                { v: String(effectif), n: effectif, c: T.ink, l: 'Élèves inscrits', s: `${nbClasses} classes · ${nbClasses > 0 ? fr1(effectif / nbClasses) : '—'} él./classe` },
                { v: frPct(tauxPresence), n: 1, c: T.blue, l: 'Taux de présence', s: 'moyenne établissement' },
                {
                  v: String(cycleTiles.absencesSeances.total),
                  n: cycleTiles.absencesSeances.total,
                  c: T.red,
                  l: 'Séances manquées',
                  s: `${cycleTiles.absencesEleves.total} élèves · ${heuresDecimalFR(totalHeuresManquees)}`,
                },
                { v: String(cycleTiles.retardsSeances.total), n: cycleTiles.retardsSeances.total, c: T.amber, l: 'Séances en retard', s: `${cycleTiles.retardsEleves.total} élèves concernés` },
                {
                  v: String(Math.abs(totalPointsSanction)),
                  n: Math.abs(totalPointsSanction),
                  c: T.red,
                  l: 'Sanctions',
                  s: `${Math.abs(totalPointsSanction)} pt sur ${nbClasses} classes`,
                },
              ].map((k, i) => (
                <div key={k.l} style={{ padding: '2.2mm 2mm', textAlign: 'center', borderLeft: i === 0 ? undefined : `1px solid ${T.sep}` }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.1, color: nulOr(k.n, k.c) }}>{k.v}</div>
                  <div style={{ fontWeight: 600, fontSize: '10px', marginTop: '.6mm' }}>{k.l}</div>
                  <div style={{ fontFamily: MONO, fontSize: '8.5px', color: T.muted }}>{k.s}</div>
                </div>
              ))}
            </div>
            <div style={{ background: T.callout, borderLeft: `3px solid ${T.blue}`, padding: '2.5mm 4mm', marginTop: '3mm', display: 'flex', flexDirection: 'column', gap: '1.2mm', fontSize: '10px', lineHeight: 1.4 }}>
              <div style={{ fontFamily: MONO, fontSize: '8.5px', letterSpacing: '.12em', color: T.blue }}>À RETENIR</div>
              {aRetenirBullets.map((b, idx) => (
                <div key={idx}>{b}</div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flow-root', ...BASE }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6mm', paddingBottom: '2mm', borderBottom: `1.5px solid ${T.ink}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
                <SchoolLogo size={Math.round(8 * MM_TO_PX)} />
                <div style={{ fontWeight: 700, fontSize: '12px' }}>Groupe Scolaire Mondrian</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: '8.5px', color: T.muted }}>Rapports BI · {periodLabel}</div>
            </div>
          </div>
        )
      }
      renderFooter={(pageIndex, pageCount) => (
        <div style={{ display: 'flow-root', ...BASE }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: `1px solid ${T.border}`,
              paddingTop: '2mm',
              marginTop: '2mm',
              fontFamily: MONO,
              fontSize: '8px',
              letterSpacing: '.08em',
              color: T.muted,
              textTransform: 'uppercase',
            }}
          >
            <span>Direction de la vie scolaire</span>
            <span>Rapports BI · {periodLabel}</span>
            <span>
              Page {pageIndex + 1}/{pageCount}
            </span>
          </div>
        </div>
      )}
    />
  )
}
