import type { CSSProperties } from 'react'
import SchoolLogo from '../print/SchoolLogo'
import { teacherName } from '../../data/teachers'
import type { TeacherAbsenceDetail } from '../../utils/replacementAggregation'
import type { DisciplineIncident, InfirmerieAccidentRow, StudentAbsenceRow } from '../../utils/liveCockpitAggregation'
import { parseAnyDate } from '../../utils/period'

interface PrintableCockpitReportProps {
  periodLabel: string
  periodStart: string
  periodEnd: string
  absentTeachers: TeacherAbsenceDetail[]
  absentStudents: StudentAbsenceRow[]
  incidents: DisciplineIncident[]
  infirmerieAccidents: InfirmerieAccidentRow[]
}

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
} as const

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
}

function longDateFR(iso: string): string {
  const d = parseAnyDate(iso)
  if (!d) return iso
  return capitalize(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
}

function dateSansJourFR(iso: string): string {
  const d = parseAnyDate(iso)
  return d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : iso
}

function shortDateFR(iso: string): string {
  const d = parseAnyDate(iso)
  return d ? d.toLocaleDateString('fr-FR') : iso
}

/** Format court "X h MM" (ex. "1 h 10", "6 h") propre à ce document — distinct de formatHeures()
 * ("1h 10min") utilisé ailleurs dans l'app ; espaces insécables pour éviter qu'un nombre ne
 * s'isole en fin de ligne à l'impression (défaut réel corrigé par le handoff design source). */
function formatDureeCourte(hours: number): string {
  const totalMin = Math.round(hours * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')}`
}

function joinSubjects(subjects: string[]): string {
  if (subjects.length <= 1) return subjects[0] ?? ''
  if (subjects.length === 2) return `${subjects[0]} & ${subjects[1]}`
  return `${subjects.slice(0, -1).join(', ')} & ${subjects[subjects.length - 1]}`
}

const thBase: CSSProperties = {
  textAlign: 'left',
  padding: '3.5px 10px',
  borderBottom: `1px solid ${C.ruleStrong}`,
  fontFamily: MONO,
  fontSize: '7.5pt',
  fontWeight: 500,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: C.muted,
}
const tdBase: CSSProperties = { padding: '3.5px 10px', borderBottom: `1px solid ${C.ruleSoft}`, color: C.inkSoft }
const emptyPanel: CSSProperties = {
  margin: '8px 0 0',
  padding: '8px 12px',
  background: C.panel,
  fontFamily: SANS,
  fontSize: '9pt',
  lineHeight: 1.5,
  color: C.inkMuted,
}

function SectionHeader({ num, title, annotation, annotationColor }: { num: string; title: string; annotation: string; annotationColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, borderBottom: `1.5px solid ${C.ink}`, paddingBottom: 6, marginBottom: 3 }}>
      <span style={{ fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600, color: C.accentBlue }}>{num}</span>
      <h2 style={{ margin: 0, fontFamily: SANS, fontSize: '12pt', fontWeight: 700, letterSpacing: '-0.01em', color: C.ink }}>{title}</h2>
      <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: '8.5pt', color: annotationColor ?? C.muted }}>{annotation}</span>
    </div>
  )
}

function KpiTile({ value, color, label, sub }: { value: string; color: string; label: string; sub: string }) {
  return (
    <div style={{ background: C.paperTint, padding: '7px 10px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontFamily: SANS, fontSize: '16pt', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color }}>{value}</div>
      <div style={{ fontFamily: SANS, fontSize: '8.5pt', lineHeight: 1.3, fontWeight: 600, color: C.inkSoft }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: '7.5pt', color: C.muted }}>{sub}</div>
    </div>
  )
}

export default function PrintableCockpitReport({
  periodStart,
  periodEnd,
  absentTeachers,
  absentStudents,
  incidents,
  infirmerieAccidents,
}: PrintableCockpitReportProps) {
  const isSingleDay = periodStart === periodEnd

  // --- Section 01 : absences enseignantes groupées par professeur ---------------------------
  interface TeacherGroup {
    key: string
    name: string
    subjects: string[]
    rows: TeacherAbsenceDetail[]
  }
  const teacherGroups: TeacherGroup[] = []
  absentTeachers.forEach((p) => {
    let group = teacherGroups.find((g) => g.key === p.teacher.id)
    if (!group) {
      group = { key: p.teacher.id, name: teacherName(p.teacher), subjects: [], rows: [] }
      teacherGroups.push(group)
    }
    if (!group.subjects.includes(p.subject)) group.subjects.push(p.subject)
    group.rows.push(p)
  })
  const totalSlots = absentTeachers.length
  const totalDuration = absentTeachers.reduce((sum, p) => sum + p.hours, 0)
  const coveredSlots = absentTeachers.filter((p) => p.remplacants.length > 0).length
  const coveragePct = totalSlots > 0 ? Math.round((coveredSlots / totalSlots) * 100) : 100

  // --- Section 02 : élèves absents/en retard, pivot classe × statut -------------------------
  interface ClasseRow {
    classe: string
    absents: string[]
    retards: string[]
  }
  const classeRows: ClasseRow[] = []
  absentStudents.forEach((r) => {
    let row = classeRows.find((c) => c.classe === r.classe)
    if (!row) {
      row = { classe: r.classe, absents: [], retards: [] }
      classeRows.push(row)
    }
    if (r.types.includes('ABSENCE')) row.absents.push(r.studentName)
    if (r.types.includes('RETARD')) row.retards.push(r.studentName)
  })
  const totalAbsences = classeRows.reduce((sum, c) => sum + c.absents.length, 0)
  const totalRetards = classeRows.reduce((sum, c) => sum + c.retards.length, 0)
  const classesAbsents = new Set(absentStudents.filter((r) => r.types.includes('ABSENCE')).map((r) => r.classe)).size
  const classesRetards = new Set(absentStudents.filter((r) => r.types.includes('RETARD')).map((r) => r.classe)).size

  // --- Tuile 4/5 : sous-lignes calculées ------------------------------------------------------
  const elevesIncidents = new Set(incidents.map((i) => i.studentId)).size
  const elevesInfirmerie = new Set(infirmerieAccidents.map((a) => a.studentId)).size

  // --- "À retenir" : puces générées à partir des agrégats, pas de texte figé ------------------
  const bullets: string[] = []
  if (totalSlots > 0) {
    const who = teacherGroups.length === 1 ? `un seul professeur, ${teacherGroups[0].name}` : `${teacherGroups.length} professeurs`
    const uncovered = totalSlots - coveredSlots
    const couverture =
      uncovered === 0
        ? 'tous les créneaux ont été couverts'
        : `${uncovered} créneau${uncovered > 1 ? 'x' : ''} sur ${totalSlots} reste${uncovered > 1 ? 'nt' : ''} non remplacé${uncovered > 1 ? 's' : ''}`
    bullets.push(`Les ${totalSlots} signalement${totalSlots > 1 ? 's' : ''} enseignant${totalSlots > 1 ? 's' : ''} concernent ${who} — ${couverture}.`)
  }
  if (classeRows.length > 0) {
    const totalSignalements = totalAbsences + totalRetards
    const ranked = classeRows
      .map((c) => ({ classe: c.classe, count: c.absents.length + c.retards.length }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
    const top = ranked.slice(0, 2)
    const topSum = top.reduce((sum, c) => sum + c.count, 0)
    const classesLabel = top.length === 2 ? `${top[0].classe} et ${top[1].classe}` : top[0].classe
    bullets.push(`${classesLabel} concentre${top.length > 1 ? 'nt' : ''} ${topSum} des ${totalSignalements} signalements d'élèves.`)
  }
  {
    // Toujours calculé : si les 2 points précédents sont déjà réels, ce 3e point complète le
    // tableau même à 0/0 (confirme que discipline/infirmerie ont bien été vérifiés, pas ignorés).
    // Seule une journée neutre sur les 3 axes bascule sur le message de repli "Journée calme".
    const incidentPart = incidents.length === 0 ? 'Aucun incident disciplinaire' : `${incidents.length} incident${incidents.length > 1 ? 's' : ''} disciplinaire${incidents.length > 1 ? 's' : ''}`
    const infirmeriePart =
      infirmerieAccidents.length === 0
        ? "aucun passage à l'infirmerie"
        : infirmerieAccidents.length === 1
          ? "un seul passage à l'infirmerie, sans suite"
          : `${infirmerieAccidents.length} passages à l'infirmerie`
    const bullet3Neutral = incidents.length === 0 && infirmerieAccidents.length === 0
    if (bullets.length > 0 || !bullet3Neutral) {
      bullets.push(`${incidentPart} ; ${infirmeriePart}.`)
    }
  }
  const aRetenirBullets = bullets.length > 0 ? bullets : ['Journée calme : aucun signalement à relever.']

  const h1Text = isSingleDay
    ? `Vie scolaire — état des lieux du ${dateSansJourFR(periodEnd)}`
    : `Vie scolaire — état des lieux de la semaine du ${shortDateFR(periodStart)} au ${shortDateFR(periodEnd)}`
  const rapportLabel = isSingleDay ? 'Rapport du jour' : 'Rapport de la semaine'
  const mastheadDate = isSingleDay ? longDateFR(periodEnd) : `Semaine du ${shortDateFR(periodStart)} au ${shortDateFR(periodEnd)}`

  return (
    <div id="printable-cockpit-report" className="print-page bg-white" style={{ padding: '26px 32px', color: C.ink, fontFamily: SANS }}>
      {/* En-tête */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, paddingBottom: 7, borderBottom: `2.5px solid ${C.ink}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SchoolLogo size={40} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: '12pt', fontWeight: 700, letterSpacing: '-0.01em', color: C.ink }}>Groupe Scolaire Mondrian</div>
            <div style={{ fontFamily: MONO, fontSize: '7.5pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted }}>École de la bienveillance</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, textAlign: 'right', paddingTop: 2 }}>
          <div style={{ fontFamily: MONO, fontSize: '7.5pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accentBlue }}>Cockpit opérationnel</div>
          <div style={{ fontSize: '10.5pt', fontWeight: 600, color: C.ink }}>{rapportLabel}</div>
          <div style={{ fontFamily: MONO, fontSize: '8.5pt', color: C.muted }}>{mastheadDate}</div>
        </div>
      </header>

      <h1 style={{ margin: '8px 0 8px', fontSize: '16pt', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink, textAlign: 'center' }}>{h1Text}</h1>

      {/* Synthèse du jour */}
      <section style={{ margin: '0 0 14px' }}>
        <div style={{ fontFamily: MONO, fontSize: '8pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted, paddingBottom: 7 }}>Synthèse du jour</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 1, background: C.rule, border: `1px solid ${C.rule}` }}>
          <KpiTile
            value={String(totalSlots)}
            color={totalSlots === 0 ? C.green : C.red}
            label="Créneaux enseignants non assurés"
            sub={`${teacherGroups.length} ${teacherGroups.length > 1 ? 'professeurs' : 'professeur'} · ${formatDureeCourte(totalDuration)}`}
          />
          <KpiTile
            value={String(totalAbsences)}
            color={totalAbsences === 0 ? C.green : C.red}
            label="Élèves absents"
            sub={`sur ${classesAbsents} classe${classesAbsents > 1 ? 's' : ''}`}
          />
          <KpiTile
            value={String(totalRetards)}
            color={totalRetards === 0 ? C.green : C.amber}
            label="Retards"
            sub={`sur ${classesRetards} classe${classesRetards > 1 ? 's' : ''}`}
          />
          <KpiTile
            value={String(incidents.length)}
            color={incidents.length === 0 ? C.green : C.red}
            label={`Incident${incidents.length > 1 ? 's' : ''} disciplinaire${incidents.length > 1 ? 's' : ''}`}
            sub={incidents.length === 0 ? 'aucun signalement' : `sur ${elevesIncidents} élève${elevesIncidents > 1 ? 's' : ''}`}
          />
          <KpiTile
            value={String(infirmerieAccidents.length)}
            color={C.accentBlue}
            label={`Passage${infirmerieAccidents.length > 1 ? 's' : ''} à l'infirmerie`}
            sub={infirmerieAccidents.length === 0 ? 'aucun passage' : `sur ${elevesInfirmerie} élève${elevesInfirmerie > 1 ? 's' : ''}`}
          />
        </div>
      </section>

      {/* À retenir */}
      <section style={{ margin: '0 0 8px', background: C.panel, borderLeft: `3px solid ${C.accentBlue}`, padding: '10px 14px 11px' }}>
        <div style={{ fontFamily: MONO, fontSize: '8pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: C.accentBlueDark, paddingBottom: 6 }}>À retenir</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontFamily: SANS, fontSize: '8.5pt', lineHeight: 1.4, color: C.inkSoft }}>
          {aRetenirBullets.map((b, idx) => (
            <li key={idx} style={{ marginBottom: idx < aRetenirBullets.length - 1 ? 4 : 0 }}>
              {b}
            </li>
          ))}
        </ul>
      </section>

      {/* Section 01 — Absences enseignantes */}
      <section style={{ margin: '0 0 8px' }}>
        <SectionHeader
          num="01"
          title="Absences enseignantes"
          annotation={totalSlots === 0 ? 'Aucun signalement' : `${totalSlots} créneau${totalSlots > 1 ? 'x' : ''} · ${formatDureeCourte(totalDuration)} · ${coveragePct} % remplacés`}
          annotationColor={totalSlots === 0 ? C.green : undefined}
        />
        {teacherGroups.map((g) => (
          <div key={g.key}>
            <div style={{ fontSize: '9.5pt', fontWeight: 600, color: C.inkSoft, padding: '10px 0 4px' }}>
              {g.name} <span style={{ fontWeight: 400, color: C.muted }}>— {joinSubjects(g.subjects)}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: '9pt' }}>
              <thead>
                <tr>
                  <th style={{ ...thBase, paddingLeft: 0 }}>Matière</th>
                  <th style={thBase}>Classe</th>
                  <th style={thBase}>Durée</th>
                  <th style={{ ...thBase, paddingRight: 0 }}>Remplaçant(s)</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((p, idx) => (
                  <tr key={idx}>
                    <td style={{ ...tdBase, paddingLeft: 0 }}>{p.subject}</td>
                    <td style={{ ...tdBase, fontFamily: MONO, fontSize: '8.5pt' }}>{p.classe}</td>
                    <td style={{ ...tdBase, fontFamily: MONO, fontSize: '8.5pt' }}>{formatDureeCourte(p.hours)}</td>
                    <td style={{ ...tdBase, paddingRight: 0, color: p.remplacants.length === 0 ? C.dashGrey : C.greenText }}>
                      {p.remplacants.length === 0 ? '—' : p.remplacants.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {totalSlots === 0 && <p style={emptyPanel}>Aucune absence enseignante consignée pour {isSingleDay ? 'la journée' : 'la période'} du {dateSansJourFR(periodEnd)}.</p>}
      </section>

      {/* Section 02 — Absences et retards d'élèves */}
      <section style={{ margin: '0 0 8px' }}>
        <SectionHeader
          num="02"
          title="Absences et retards d'élèves"
          annotation={classeRows.length === 0 ? 'Aucun signalement' : `${totalAbsences + totalRetards} signalements · ${classeRows.length} classes`}
          annotationColor={classeRows.length === 0 ? C.green : undefined}
        />
        {classeRows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: '9pt', marginTop: 7 }}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: '14%', paddingLeft: 0 }}>Classe</th>
                <th style={{ ...thBase, width: '43%', color: C.redDark }}>Absents</th>
                <th style={{ ...thBase, width: '43%', paddingRight: 0, color: C.amberDark }}>Retards</th>
              </tr>
            </thead>
            <tbody>
              {classeRows.map((c) => (
                <tr key={c.classe}>
                  <td style={{ ...tdBase, paddingLeft: 0, fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600, color: C.ink, verticalAlign: 'top' }}>{c.classe}</td>
                  <td style={{ ...tdBase, verticalAlign: 'top', color: c.absents.length === 0 ? C.dashGrey : C.inkSoft }}>{c.absents.length === 0 ? '—' : c.absents.join(', ')}</td>
                  <td style={{ ...tdBase, paddingRight: 0, verticalAlign: 'top', color: c.retards.length === 0 ? C.dashGrey : C.inkSoft }}>
                    {c.retards.length === 0 ? '—' : c.retards.join(', ')}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '3.5px 10px 3.5px 0', fontFamily: MONO, fontSize: '8pt', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted }}>Total</td>
                <td style={{ padding: '3.5px 10px', fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600, color: C.redDark }}>
                  {totalAbsences} absence{totalAbsences > 1 ? 's' : ''}
                </td>
                <td style={{ padding: '3.5px 0 3.5px 10px', fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600, color: C.amberDark }}>
                  {totalRetards} retard{totalRetards > 1 ? 's' : ''}
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {classeRows.length === 0 && <p style={emptyPanel}>Aucun élève absent ou en retard pour {isSingleDay ? 'la journée' : 'la période'} du {dateSansJourFR(periodEnd)}.</p>}
      </section>

      {/* Section 03 — Incidents disciplinaires */}
      <section style={{ margin: '0 0 8px' }}>
        <SectionHeader num="03" title="Incidents disciplinaires" annotation={incidents.length === 0 ? 'Aucun signalement' : `${incidents.length} signalement${incidents.length > 1 ? 's' : ''}`} annotationColor={incidents.length === 0 ? C.green : undefined} />
        {incidents.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: '9pt', marginTop: 7 }}>
            <thead>
              <tr>
                <th style={{ ...thBase, paddingLeft: 0 }}>Date</th>
                <th style={thBase}>Élève</th>
                <th style={thBase}>Pts</th>
                <th style={thBase}>Fait</th>
                <th style={{ ...thBase, paddingRight: 0 }}>Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc, idx) => (
                <tr key={idx}>
                  <td style={{ ...tdBase, paddingLeft: 0, fontFamily: MONO, fontSize: '8.5pt', whiteSpace: 'nowrap' }}>{inc.date}</td>
                  <td style={tdBase}>
                    {inc.studentName} <span style={{ color: C.muted }}>({inc.classe})</span>
                  </td>
                  <td style={{ ...tdBase, fontFamily: MONO, fontSize: '8.5pt', fontWeight: 600, color: C.redDark }}>{inc.points}</td>
                  <td style={tdBase}>{inc.title}</td>
                  <td style={{ ...tdBase, paddingRight: 0 }}>{inc.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={emptyPanel}>Aucun incident disciplinaire consigné pour {isSingleDay ? 'la journée' : 'la période'} du {dateSansJourFR(periodEnd)}.</p>
        )}
      </section>

      {/* Section 04 — Passages à l'infirmerie */}
      <section style={{ margin: '0 0 8px' }}>
        <SectionHeader
          num="04"
          title="Passages à l'infirmerie"
          annotation={infirmerieAccidents.length === 0 ? 'Aucun passage' : `${infirmerieAccidents.length} passage${infirmerieAccidents.length > 1 ? 's' : ''}`}
          annotationColor={infirmerieAccidents.length === 0 ? C.green : undefined}
        />
        {infirmerieAccidents.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: '9pt', marginTop: 7 }}>
            <thead>
              <tr>
                <th style={{ ...thBase, paddingLeft: 0 }}>Heure</th>
                <th style={thBase}>Élève</th>
                <th style={thBase}>Classe</th>
                <th style={{ ...thBase, paddingRight: 0 }}>Soin apporté</th>
              </tr>
            </thead>
            <tbody>
              {infirmerieAccidents.map((a, idx) => (
                <tr key={idx}>
                  <td style={{ ...tdBase, paddingLeft: 0, fontFamily: MONO, fontSize: '8.5pt' }}>{a.heure}</td>
                  <td style={tdBase}>{a.studentName}</td>
                  <td style={{ ...tdBase, fontFamily: MONO, fontSize: '8.5pt' }}>{a.classe}</td>
                  <td style={{ ...tdBase, paddingRight: 0 }}>{a.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={emptyPanel}>Aucun passage à l'infirmerie consigné pour {isSingleDay ? 'la journée' : 'la période'} du {dateSansJourFR(periodEnd)}.</p>
        )}
      </section>

      {/* Pied de page */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 8, borderTop: `1px solid ${C.rule}` }}>
        <span style={{ fontFamily: MONO, fontSize: '8.5pt', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Direction de la vie scolaire</span>
        <span style={{ fontFamily: MONO, fontSize: '8.5pt', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Groupe Scolaire Mondrian</span>
      </div>
    </div>
  )
}
