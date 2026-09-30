import type { CSSProperties, ReactNode } from 'react'
import SchoolLogo from '../print/SchoolLogo'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'

interface PalmaresRow {
  id: string
  name: string
  classe: string
  conduite: number
  statutLabel: string
}

interface JournalRow {
  id: string
  studentId: string
  date: string
  studentName: string
  classe: string
  points: number
  title: string
  description: string
  author: string
  typeCode?: string
}

interface PrintableDisciplineReportProps {
  classe: string
  dateStart: string
  dateEnd: string
  palmares: PalmaresRow[]
  entries: JournalRow[]
}

const SANS = "'IBM Plex Sans', sans-serif"
const MONO = "'IBM Plex Mono', monospace"
const MINUS = '−'
const ROWS_PER_CHUNK = 14

const C = {
  ink: 'oklch(0.25 0.02 255)',
  inkSoft: 'oklch(0.3 0.02 255)',
  inkMuted: 'oklch(0.45 0.015 255)',
  muted: 'oklch(0.58 0.015 255)',
  ruleStrong: 'oklch(0.82 0.01 255)',
  rule: 'oklch(0.88 0.008 255)',
  ruleSoft: 'oklch(0.92 0.006 255)',
  panel: 'oklch(0.975 0.006 255)',
  paperTint: 'oklch(0.99 0.004 255)',
  accentBlue: 'oklch(0.52 0.13 255)',
  accentBlueDark: 'oklch(0.42 0.1 255)',
  red: 'oklch(0.55 0.17 25)',
  redDark: 'oklch(0.55 0.16 25)',
  green: 'oklch(0.52 0.13 155)',
  greenText: 'oklch(0.42 0.11 155)',
  greyMuted: 'oklch(0.6 0.01 255)',
  badgeBonBg: 'oklch(0.95 0.035 155)',
  badgeBonText: 'oklch(0.4 0.11 155)',
  badgeMoyenBg: 'oklch(0.95 0.04 70)',
  badgeMoyenText: 'oklch(0.45 0.12 70)',
  badgeInsuffisantBg: 'oklch(0.95 0.035 25)',
  badgeInsuffisantText: 'oklch(0.48 0.16 25)',
} as const

const STATUT_BADGE: Record<string, { bg: string; text: string }> = {
  Bon: { bg: C.badgeBonBg, text: C.badgeBonText },
  Moyen: { bg: C.badgeMoyenBg, text: C.badgeMoyenText },
  Insuffisant: { bg: C.badgeInsuffisantBg, text: C.badgeInsuffisantText },
}

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR')
}

function dateSansJourFR(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDDMMYYYY(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function periodeLabel(dateStart: string, dateEnd: string): string {
  if (!dateStart && !dateEnd) return 'Historique complet'
  if (dateStart && dateEnd) return `Du ${formatDDMMYYYY(dateStart)} au ${formatDDMMYYYY(dateEnd)}`
  if (dateStart) return `À partir du ${formatDDMMYYYY(dateStart)}`
  return `Jusqu'au ${formatDDMMYYYY(dateEnd)}`
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function sectionBlocks<T>(
  keyPrefix: string,
  header: ReactNode,
  rows: T[],
  renderChunk: (rowsChunk: T[]) => ReactNode,
  emptyState: ReactNode,
  footnote?: ReactNode
): PaginatedBlock[] {
  if (rows.length === 0) return [{ key: `${keyPrefix}-empty`, node: <>{header}{emptyState}</> }]
  const chunks = chunk(rows, ROWS_PER_CHUNK)
  return chunks.map((rowsChunk, i) => ({
    key: `${keyPrefix}-${i}`,
    node: (
      <>
        {i === 0 && header}
        {renderChunk(rowsChunk)}
        {i === chunks.length - 1 && footnote}
      </>
    ),
  }))
}

const thBase: CSSProperties = {
  textAlign: 'left',
  padding: '4px 10px',
  borderBottom: `1px solid ${C.ruleStrong}`,
  fontFamily: MONO,
  fontSize: '7.5pt',
  fontWeight: 500,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: C.muted,
}
const tdBase: CSSProperties = { padding: '4px 10px', borderBottom: `1px solid ${C.ruleSoft}`, verticalAlign: 'top', color: C.inkSoft }
const emptyPanel: CSSProperties = { margin: '7px 0 0', padding: '9px 12px', background: C.panel, fontFamily: SANS, fontSize: '9pt', lineHeight: 1.5, color: C.inkMuted }
const footnoteStyle: CSSProperties = { margin: '5px 0 0', fontFamily: SANS, fontSize: '7.5pt', color: C.muted }

function SectionHeader({ num, title, annotation, annotationColor }: { num: string; title: string; annotation: string; annotationColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, borderBottom: `1.5px solid ${C.ink}`, paddingBottom: 6 }}>
      <span style={{ fontFamily: MONO, fontSize: '9pt', fontWeight: 600, color: C.accentBlue }}>{num}</span>
      <h2 style={{ margin: 0, fontFamily: SANS, fontSize: '12pt', fontWeight: 700, letterSpacing: '-0.01em', color: C.ink }}>{title}</h2>
      <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: '8pt', color: annotationColor ?? C.muted }}>{annotation}</span>
    </div>
  )
}

function KpiTile({ value, color, label, sub }: { value: string; color: string; label: string; sub: string }) {
  return (
    <div style={{ background: C.paperTint, padding: '8px 10px 9px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontFamily: SANS, fontSize: '16pt', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color }}>{value}</div>
      <div style={{ fontFamily: SANS, fontSize: '8.5pt', fontWeight: 600, color: C.inkSoft }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: '7.5pt', color: C.muted }}>{sub}</div>
    </div>
  )
}

function StatutBadge({ label }: { label: string }) {
  const badge = STATUT_BADGE[label] ?? STATUT_BADGE.Bon
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        background: badge.bg,
        fontFamily: MONO,
        fontSize: '7.5pt',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: badge.text,
      }}
    >
      {label}
    </span>
  )
}

function StudentsTableChunk({ rows }: { rows: (PalmaresRow & { avert: number })[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: '9pt', marginTop: 7 }}>
      <thead>
        <tr>
          <th style={{ ...thBase, paddingLeft: 0 }}>Élève</th>
          <th style={thBase}>Classe</th>
          <th style={{ ...thBase, color: C.redDark }}>Avert.</th>
          <th style={thBase}>Conduite</th>
          <th style={{ ...thBase, paddingRight: 0 }}>Statut</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id}>
            <td style={{ ...tdBase, paddingLeft: 0, fontWeight: 600, color: C.ink }}>{s.name}</td>
            <td style={{ ...tdBase, fontFamily: MONO, fontSize: '8.5pt' }}>{s.classe}</td>
            <td style={{ ...tdBase, fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600, color: C.red }}>{s.avert}</td>
            <td style={{ ...tdBase, fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600, color: C.ink }}>{s.conduite}/20</td>
            <td style={{ ...tdBase, paddingRight: 0 }}>
              <StatutBadge label={s.statutLabel} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function JournalTableChunk({ rows, hasComments }: { rows: JournalRow[]; hasComments: boolean }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: '9pt', marginTop: 7, tableLayout: 'fixed' }}>
      <thead>
        <tr>
          <th style={{ ...thBase, paddingLeft: 0, width: '13%' }}>Date</th>
          <th style={{ ...thBase, width: '22%' }}>Élève</th>
          <th style={{ ...thBase, width: '6%', color: C.redDark }}>Pts</th>
          <th style={thBase}>Fait / catégorie</th>
          <th style={{ ...thBase, width: '15%' }}>Signalé par</th>
          {hasComments && <th style={{ ...thBase, paddingRight: 0, width: '17%' }}>Commentaire</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id}>
            <td style={{ ...tdBase, paddingLeft: 0, fontFamily: MONO, fontSize: '8.5pt', whiteSpace: 'nowrap' }}>{formatDDMMYYYY(e.date)}</td>
            <td style={tdBase}>
              <div style={{ fontWeight: 600, color: C.ink }}>{e.studentName}</div>
              <div style={{ fontFamily: MONO, fontSize: '7.5pt', color: C.muted }}>{e.classe}</div>
            </td>
            <td style={{ ...tdBase, fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600, color: C.redDark }}>
              {e.points >= 0 ? '+' : MINUS}
              {Math.abs(e.points)}
            </td>
            <td style={{ ...tdBase, lineHeight: 1.4 }}>
              {e.typeCode && <span style={{ marginRight: 5, fontFamily: MONO, fontSize: '7.5pt', color: C.muted }}>{e.typeCode}</span>}
              {e.title}
            </td>
            <td style={tdBase}>{e.author}</td>
            {hasComments && <td style={{ ...tdBase, paddingRight: 0 }}>{e.description?.trim() || '—'}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RecompensesTableChunk({ rows }: { rows: JournalRow[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: '9pt', marginTop: 7 }}>
      <thead>
        <tr>
          <th style={{ ...thBase, paddingLeft: 0 }}>Date</th>
          <th style={thBase}>Élève</th>
          <th style={{ ...thBase, color: C.greenText }}>Pts</th>
          <th style={thBase}>Motif</th>
          <th style={{ ...thBase, paddingRight: 0 }}>Attribué par</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id}>
            <td style={{ ...tdBase, paddingLeft: 0, fontFamily: MONO, fontSize: '8.5pt', whiteSpace: 'nowrap' }}>{formatDDMMYYYY(e.date)}</td>
            <td style={tdBase}>
              <div style={{ fontWeight: 600, color: C.ink }}>{e.studentName}</div>
              <div style={{ fontFamily: MONO, fontSize: '7.5pt', color: C.muted }}>{e.classe}</div>
            </td>
            <td style={{ ...tdBase, fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600, color: C.greenText }}>+{e.points}</td>
            <td style={tdBase}>{e.title}</td>
            <td style={{ ...tdBase, paddingRight: 0 }}>{e.author}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RepartitionCard({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, n]) => n))
  return (
    <div style={{ background: C.paperTint, padding: '9px 12px 11px' }}>
      <div style={{ fontFamily: MONO, fontSize: '7.5pt', textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, paddingBottom: 7 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.length === 0 && <span style={{ fontFamily: SANS, fontSize: '8.5pt', color: C.muted }}>—</span>}
        {rows.map(([label, count]) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: SANS, fontSize: '8.5pt' }}>
              <span style={{ minWidth: 0, flex: 1, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
              <span style={{ fontFamily: MONO, fontWeight: 600, color: C.red }}>{count}</span>
            </div>
            <div style={{ marginTop: 2, height: 6, background: C.ruleSoft }}>
              <div style={{ height: '100%', width: `${Math.round((count / max) * 100)}%`, background: C.red }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function topGroups(items: JournalRow[], keyFn: (e: JournalRow) => string, limit = 8): [string, number][] {
  const map = new Map<string, number>()
  items.forEach((e) => {
    const k = keyFn(e)
    map.set(k, (map.get(k) ?? 0) + 1)
  })
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

export default function PrintableDisciplineReport({ classe, dateStart, dateEnd, palmares, entries }: PrintableDisciplineReportProps) {
  const avertissementEntries = entries.filter((e) => e.points < 0)
  const recompenseEntries = entries.filter((e) => e.points > 0)
  const totalAvertissements = avertissementEntries.length
  const totalRecompenses = recompenseEntries.length
  const totalPointsRetires = avertissementEntries.reduce((sum, e) => sum + e.points, 0)
  const elevesConcernes = palmares.length
  const classesConcernees = new Set(palmares.map((p) => p.classe)).size
  const conduiteMoyenne = elevesConcernes ? Math.round((palmares.reduce((sum, p) => sum + p.conduite, 0) / elevesConcernes) * 10) / 10 : null

  const avertDatesUniques = [...new Set(avertissementEntries.map((e) => e.date))].sort()
  const avertSubline =
    totalAvertissements === 0
      ? 'aucun signalement'
      : avertDatesUniques.length === 1
        ? `tous le ${formatDDMMYYYY(avertDatesUniques[0])}`
        : `du ${formatDDMMYYYY(avertDatesUniques[0])} au ${formatDDMMYYYY(avertDatesUniques[avertDatesUniques.length - 1])}`
  const pointsSubline =
    totalAvertissements === 0
      ? 'aucun point retiré'
      : avertissementEntries.every((e) => e.points === -1)
        ? `${MINUS}1 pt par avertissement`
        : `sur ${totalAvertissements} avertissement${totalAvertissements > 1 ? 's' : ''}`

  const avertCountByStudent = new Map<string, number>()
  avertissementEntries.forEach((e) => avertCountByStudent.set(e.studentId, (avertCountByStudent.get(e.studentId) ?? 0) + 1))
  const studentRows = palmares.map((s) => ({ ...s, avert: avertCountByStudent.get(s.id) ?? 0 }))

  const hasComments = entries.some((e) => e.description?.trim())

  const parClasse = topGroups(avertissementEntries, (e) => e.classe)
  const parEnseignant = topGroups(avertissementEntries, (e) => e.author)
  const parMotif = topGroups(avertissementEntries, (e) => e.title)

  // "À retenir" : puces générées à partir des agrégats, pas de texte figé.
  const bullets: string[] = []
  if (totalAvertissements > 0) {
    const sameDate = avertDatesUniques.length === 1
    const sameMotif = new Set(avertissementEntries.map((e) => e.title)).size === 1
    if (sameDate && sameMotif) {
      bullets.push(
        `Les ${totalAvertissements} avertissement${totalAvertissements > 1 ? 's' : ''} ont tous été signalés le ${formatDDMMYYYY(avertDatesUniques[0])}, pour le même motif : « ${avertissementEntries[0].title} ».`
      )
    } else if (sameDate) {
      bullets.push(`Les ${totalAvertissements} avertissements ont tous été signalés le ${formatDDMMYYYY(avertDatesUniques[0])}.`)
    }
  }
  if (elevesConcernes > 1 && parClasse.length > 0) {
    const [topClasse, topCount] = parClasse.reduce<[string, number]>(
      (best, [c]) => {
        const n = studentRows.filter((s) => s.classe === c).length
        return n > best[1] ? [c, n] : best
      },
      ['', 0]
    )
    if (topCount / elevesConcernes >= 0.5) {
      bullets.push(`${topCount} des ${elevesConcernes} élèves concernés appartiennent à la classe ${topClasse}.`)
    }
  }
  {
    const statuts = new Set(studentRows.map((s) => s.statutLabel))
    const recompensesPart =
      totalRecompenses === 0
        ? 'aucune récompense attribuée sur la période'
        : `${totalRecompenses} récompense${totalRecompenses > 1 ? 's' : ''} attribuée${totalRecompenses > 1 ? 's' : ''} sur la période`
    if (elevesConcernes > 0 && statuts.size === 1) {
      const statutLabel = [...statuts][0].toLowerCase()
      bullets.push(`Tous les élèves concernés restent à un niveau de conduite ${statutLabel} ; ${recompensesPart}.`)
    } else if (elevesConcernes > 0) {
      bullets.push(`${recompensesPart.charAt(0).toUpperCase()}${recompensesPart.slice(1)}.`)
    }
  }
  const aRetenirBullets = bullets.length > 0 ? bullets : ['Aucun signalement à relever sur la période.']

  const classeLabel = classe === 'Toutes les classes' ? 'Toutes les classes' : classe
  const periodeText = periodeLabel(dateStart, dateEnd)

  const section01Header = (
    <SectionHeader
      num="01"
      title="Élèves ayant reçu un avertissement"
      annotation={`${elevesConcernes} élève${elevesConcernes > 1 ? 's' : ''}`}
      annotationColor={elevesConcernes === 0 ? C.green : undefined}
    />
  )
  const section01Blocks = sectionBlocks(
    's01',
    section01Header,
    studentRows,
    (rows) => <StudentsTableChunk rows={rows} />,
    <p style={emptyPanel}>Aucun élève n'a eu d'avertissement sur la période sélectionnée.</p>,
    <p style={footnoteStyle}>
      La note de conduite est recalculée sur la période sélectionnée ; seuls les élèves ayant eu au moins un avertissement figurent dans ce tableau.
    </p>
  )

  const section02Header = (
    <SectionHeader
      num="02"
      title="Journal disciplinaire"
      annotation={`${entries.length} entrée${entries.length > 1 ? 's' : ''}`}
      annotationColor={entries.length === 0 ? C.green : undefined}
    />
  )
  const section02Blocks = sectionBlocks(
    's02',
    section02Header,
    entries,
    (rows) => <JournalTableChunk rows={rows} hasComments={hasComments} />,
    <p style={emptyPanel}>Aucun fait disciplinaire ne correspond aux filtres sélectionnés.</p>,
    !hasComments && entries.length > 0 ? <p style={footnoteStyle}>Aucun commentaire saisi sur ces entrées — colonne masquée.</p> : undefined
  )

  const section03Block: PaginatedBlock = {
    key: 's03',
    node: (
      <>
        <SectionHeader num="03" title="Répartition" annotation="avertissements" annotationColor={totalAvertissements === 0 ? C.green : undefined} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 1, background: C.rule, marginTop: 7 }}>
          <RepartitionCard title="Par classe" rows={parClasse} />
          <RepartitionCard title="Par enseignant" rows={parEnseignant} />
          <RepartitionCard title="Par motif" rows={parMotif} />
        </div>
      </>
    ),
  }

  const section04Header = (
    <SectionHeader
      num="04"
      title="Récompenses"
      annotation={totalRecompenses === 0 ? 'aucune' : `${totalRecompenses} récompense${totalRecompenses > 1 ? 's' : ''}`}
      annotationColor={totalRecompenses === 0 ? C.green : undefined}
    />
  )
  const section04Blocks = sectionBlocks(
    's04',
    section04Header,
    recompenseEntries,
    (rows) => <RecompensesTableChunk rows={rows} />,
    <p style={emptyPanel}>Aucune récompense n'a été attribuée sur la période.</p>
  )

  const blocks: PaginatedBlock[] = [...section01Blocks, ...section02Blocks, section03Block, ...section04Blocks]

  return (
    <PaginatedPrintDocument
      blocks={blocks}
      paddingXPx={48}
      paddingYPx={48}
      gapPx={12}
      pageStyle={{ background: '#fff', color: C.ink, fontFamily: SANS }}
      renderHeader={(pageIndex) => (
        <>
          <header style={{ display: 'flex', justifyContent: 'space-between', gap: 24, paddingBottom: 7, borderBottom: `2.5px solid ${C.ink}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <SchoolLogo size={40} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: '12pt', fontWeight: 700, letterSpacing: '-0.01em', color: C.ink }}>Groupe Scolaire Mondrian</div>
                <div style={{ fontFamily: MONO, fontSize: '7.5pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted }}>École de la bienveillance</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, textAlign: 'right', paddingTop: 2 }}>
              <div style={{ fontFamily: MONO, fontSize: '7.5pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accentBlue }}>Rapport disciplinaire</div>
              <div style={{ fontSize: '10.5pt', fontWeight: 600, color: C.ink }}>
                {classeLabel} · {periodeText}
              </div>
              <div style={{ fontFamily: MONO, fontSize: '8pt', color: C.muted }}>Édité le {todayFR()}</div>
            </div>
          </header>

          {pageIndex === 0 && (
            <>
              <h1 style={{ margin: '10px 0 10px', fontSize: '16pt', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, textAlign: 'center' }}>
                Suivi disciplinaire — état au {dateSansJourFR(new Date().toISOString().slice(0, 10))}
              </h1>

              <section style={{ margin: '0 0 10px' }}>
                <div style={{ fontFamily: MONO, fontSize: '8pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, paddingBottom: 7 }}>Synthèse</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 1, background: C.rule }}>
                  <KpiTile value={String(totalAvertissements)} color={totalAvertissements === 0 ? C.green : C.red} label="Avertissements" sub={avertSubline} />
                  <KpiTile
                    value={String(elevesConcernes)}
                    color={C.ink}
                    label="Élèves concernés"
                    sub={elevesConcernes === 0 ? 'aucun élève concerné' : `sur ${classesConcernees} classe${classesConcernees > 1 ? 's' : ''}`}
                  />
                  <KpiTile
                    value={totalPointsRetires === 0 ? '0' : `${MINUS}${Math.abs(totalPointsRetires)}`}
                    color={totalPointsRetires === 0 ? C.green : C.red}
                    label="Points retirés"
                    sub={pointsSubline}
                  />
                  <KpiTile value={conduiteMoyenne === null ? '—' : `${conduiteMoyenne}/20`} color={C.accentBlue} label="Conduite moyenne" sub="élèves concernés" />
                  <KpiTile
                    value={String(totalRecompenses)}
                    color={totalRecompenses === 0 ? C.greyMuted : C.green}
                    label="Récompenses"
                    sub={totalRecompenses === 0 ? 'aucune attribuée' : `${totalRecompenses} attribuée${totalRecompenses > 1 ? 's' : ''}`}
                  />
                </div>
              </section>

              <section style={{ margin: '0 0 12px', background: C.panel, borderLeft: `3px solid ${C.accentBlue}`, padding: '8px 14px 9px' }}>
                <div style={{ fontFamily: MONO, fontSize: '8pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accentBlueDark, paddingBottom: 6 }}>À retenir</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontFamily: SANS, fontSize: '8.5pt', lineHeight: 1.45, color: C.inkSoft }}>
                  {aRetenirBullets.map((b, idx) => (
                    <li key={idx} style={{ marginBottom: idx < aRetenirBullets.length - 1 ? 4 : 0 }}>
                      {b}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}
      renderFooter={(pageIndex, pageCount) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 7, borderTop: `1px solid ${C.rule}` }}>
          <span style={{ fontFamily: MONO, fontSize: '8pt', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Direction de la vie scolaire</span>
          <span style={{ fontFamily: MONO, fontSize: '8pt', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Rapport disciplinaire · {todayFR()}</span>
          <span style={{ fontFamily: MONO, fontSize: '8pt', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'oklch(0.42 0.015 255)' }}>
            Page {pageIndex + 1}/{pageCount}
          </span>
        </div>
      )}
    />
  )
}
