import SchoolLogo from '../print/SchoolLogo'
import type { CycleSummaryRow } from '../../utils/absencesCycleSummary'
import { classeScopeLabel, TOUTE_ETABLISSEMENT } from '../../utils/absencesScope'

export interface BilanPrintRow {
  studentName: string
  classe: string
  totalMinutes: number
  motifs: string[]
  justified: boolean
  /** Heure du premier événement du créneau (ex. "08:45") — colonne "Motif / Heure". */
  heure?: string
}

export interface SortiePrintRow {
  studentName: string
  classe: string
  heure: string
  recuperePar: string
  motif: string
}

interface PrintableAbsencesBilanProps {
  classe: string
  date: string
  /** Une page = un cycle : synthèse, effectif et bloc classes portent déjà les chiffres propres à
   * ce seul cycle (calculés en amont par buildCycleSummaries/AbsencesRetards.tsx). */
  cycle: CycleSummaryRow
  absMatin: BilanPrintRow[]
  absApresMidi: BilanPrintRow[]
  retMatin: BilanPrintRow[]
  retApresMidi: BilanPrintRow[]
  sorties: SortiePrintRow[]
  heureDebutMatin: string
  heureFinMatin: string
  heureDebutApresMidi: string
  heureFinApresMidi: string
  pageIndex: number
  pageCount: number
}

interface CycleStyle {
  icon: string
  color: string
  soft: string
}

// Jetons visuels propres à l'impression (émoji + couleurs oklch) — pas ajoutés à CYCLES/
// data/referentiel.ts, référentiel partagé consommé par du code non-impression (barèmes de
// notation, résolution de niveau). Même précédent que SUBJECT_STYLES dans PrintableScheduleLudique.tsx.
const CYCLE_STYLES: Record<string, CycleStyle> = {
  maternelle: { icon: '🧸', color: 'oklch(0.58 0.15 25)', soft: 'oklch(0.96 0.03 40)' },
  primaire: { icon: '✏️', color: 'oklch(0.5 0.14 250)', soft: 'oklch(0.96 0.025 250)' },
  college: { icon: '🎓', color: 'oklch(0.48 0.15 300)', soft: 'oklch(0.96 0.025 305)' },
}
const CYCLE_STYLE_FALLBACK: CycleStyle = { icon: '📘', color: 'oklch(0.45 0.01 260)', soft: 'oklch(0.96 0.005 260)' }
function styleForCycle(key: string): CycleStyle {
  return CYCLE_STYLES[key] ?? CYCLE_STYLE_FALLBACK
}

const GREEN = 'oklch(0.62 0.16 160)'
const GREEN_TEXT = 'oklch(0.55 0.15 160)'
const AMBER_ALERT = 'oklch(0.68 0.17 55)'

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR')
}

function longDateFR(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

/** "08:30" → "08H30", convention déjà utilisée sur ce document. */
function toHeureUpper(t: string): string {
  return t.replace(':', 'H')
}

function BandeauCompteur({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="min-w-[58px] rounded-[9px] bg-white px-2.5 py-1 text-center">
      <div className="text-[7px] font-semibold uppercase" style={{ letterSpacing: '0.04em', color: 'oklch(0.55 0.01 260)' }}>
        {label}
      </div>
      <div className="text-[14px] font-extrabold leading-tight" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function CycleBlock({ cycle }: { cycle: CycleSummaryRow }) {
  const style = styleForCycle(cycle.key)
  const taux = cycle.effectif === 0 ? 100 : Math.round(((cycle.effectif - cycle.absences) / cycle.effectif) * 100)
  return (
    <div className="overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: style.soft }}>
        <span style={{ fontSize: 13 }}>{style.icon}</span>
        <span className="text-[11.5px] font-extrabold" style={{ color: style.color }}>
          {cycle.label}
        </span>
        <span className="text-[9px]" style={{ color: 'oklch(0.45 0.01 260)' }}>
          {cycle.classes.length} classe{cycle.classes.length > 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold">{cycle.effectif} élèves</span>
        <span className="rounded-full px-2 py-0.5 text-[9px] font-extrabold text-white" style={{ background: style.color }}>
          {taux}% présents
        </span>
      </div>
      <div className="flex flex-wrap gap-1 px-2.5 pb-1.5 pt-1.5">
        {cycle.classes.map((c) => {
          const barColor = c.absences || c.retards ? AMBER_ALERT : GREEN
          const detail = c.absences || c.retards ? `${c.absences} abs · ${c.retards} ret` : 'Complet'
          const present = c.effectif - c.absences
          return (
            <div
              key={c.classe}
              title={detail}
              className="flex items-center gap-1.5 rounded-full border px-2 py-0.5"
              style={{ borderColor: 'oklch(0.93 0.005 90)', background: 'oklch(0.995 0.002 90)' }}
            >
              <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: barColor }} />
              <span className="text-[8.5px] font-extrabold" style={{ letterSpacing: '0.02em', color: style.color }}>
                {c.classe}
              </span>
              <span className="text-[10.5px] font-extrabold leading-none">
                {present}/{c.effectif}
              </span>
              <span className="text-[7px]" style={{ color: 'oklch(0.55 0.01 260)' }}>
                présents
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CreneauBlock({ icon, label, rows, accentColor }: { icon: string; label: string; rows: BilanPrintRow[]; accentColor: string }) {
  const etat = rows.length === 0 ? 'Aucun signalement ✓' : `${rows.length} signalement${rows.length > 1 ? 's' : ''}`
  const etatColor = rows.length === 0 ? GREEN_TEXT : accentColor

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span className="text-[9.5px] font-extrabold">{label}</span>
        <div className="flex-1" />
        <span className="text-[8.5px] font-bold" style={{ color: etatColor }}>
          {etat}
        </span>
      </div>
      {rows.length > 0 && (
        <>
          <div
            className="grid text-[7.5px] font-semibold uppercase"
            style={{ gridTemplateColumns: 'minmax(0,1.3fr) 40px minmax(0,1fr) 42px', columnGap: 8, letterSpacing: '0.05em', color: 'oklch(0.6 0.01 260)' }}
          >
            <span>Nom de l'élève</span>
            <span>Classe</span>
            <span>Motif</span>
            <span>Heure</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid items-start"
              style={{ gridTemplateColumns: 'minmax(0,1.3fr) 40px minmax(0,1fr) 42px', columnGap: 8, minHeight: 20, borderBottom: '1px solid oklch(0.88 0.005 90)' }}
            >
              <span className="break-words text-[9px] font-semibold">{r.studentName}</span>
              <span className="text-[9px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
                {r.classe}
              </span>
              <span className="break-words text-[8.5px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
                {r.motifs.length ? r.motifs.join(', ') : '—'}
              </span>
              <span className="text-[8.5px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
                {r.heure ?? ''}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function RecordCard({
  title,
  icon,
  color,
  soft,
  matin,
  apresMidi,
  heureDebutMatin,
  heureFinMatin,
  heureDebutApresMidi,
  heureFinApresMidi,
}: {
  title: string
  icon: string
  color: string
  soft: string
  matin: BilanPrintRow[]
  apresMidi: BilanPrintRow[]
  heureDebutMatin: string
  heureFinMatin: string
  heureDebutApresMidi: string
  heureFinApresMidi: string
}) {
  const total = matin.length + apresMidi.length
  const totalLabel = total === 0 ? (title.startsWith('Absences') ? 'Aucune' : 'Aucun') : total

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
      <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: soft }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span className="text-[12px] font-extrabold" style={{ color }}>
          {title}
        </span>
        <div className="flex-1" />
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-extrabold" style={{ color }}>
          {totalLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-3 pb-3 pt-2.5">
        <CreneauBlock icon="☀️" label={`Matin · ${toHeureUpper(heureDebutMatin)} – ${toHeureUpper(heureFinMatin)}`} rows={matin} accentColor={color} />
        <CreneauBlock
          icon="🌤️"
          label={`Après-midi · ${toHeureUpper(heureDebutApresMidi)} – ${toHeureUpper(heureFinApresMidi)}`}
          rows={apresMidi}
          accentColor={color}
        />
      </div>
    </div>
  )
}

const SORTIE_COLOR = 'oklch(0.48 0.15 230)'
const SORTIE_SOFT = 'oklch(0.96 0.03 225)'

function SortiesCard({ rows }: { rows: SortiePrintRow[] }) {
  return (
    <div className="overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
      <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: SORTIE_SOFT }}>
        <span style={{ fontSize: 14 }}>🚪</span>
        <span className="text-[12px] font-extrabold" style={{ color: SORTIE_COLOR }}>
          Sorties anticipées
        </span>
        <div className="flex-1" />
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-extrabold" style={{ color: SORTIE_COLOR }}>
          {rows.length === 0 ? 'Aucune' : rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-2.5 text-[9px] font-semibold" style={{ color: GREEN_TEXT }}>
          Aucune sortie anticipée ✓
        </p>
      ) : (
        <div className="px-3 pb-2.5 pt-2">
          <div
            className="grid text-[7.5px] font-semibold uppercase"
            style={{ gridTemplateColumns: '1fr 52px 44px 1fr 1fr', columnGap: 8, letterSpacing: '0.05em', color: 'oklch(0.6 0.01 260)' }}
          >
            <span>Nom de l'élève</span>
            <span>Classe</span>
            <span>Heure</span>
            <span>Récupéré par</span>
            <span>Motif</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid items-center"
              style={{ gridTemplateColumns: '1fr 52px 44px 1fr 1fr', columnGap: 8, minHeight: 20, borderBottom: '1px solid oklch(0.88 0.005 90)' }}
            >
              <span className="truncate text-[9px] font-semibold">{r.studentName}</span>
              <span className="text-[9px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
                {r.classe}
              </span>
              <span className="text-[9px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
                {r.heure}
              </span>
              <span className="truncate text-[9px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
                {r.recuperePar}
              </span>
              <span className="truncate text-[8.5px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
                {r.motif || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PrintableAbsencesBilan({
  classe,
  date,
  cycle,
  absMatin,
  absApresMidi,
  retMatin,
  retApresMidi,
  sorties,
  heureDebutMatin,
  heureFinMatin,
  heureDebutApresMidi,
  heureFinApresMidi,
  pageIndex,
  pageCount,
}: PrintableAbsencesBilanProps) {
  const style = styleForCycle(cycle.key)
  const effectif = cycle.effectif
  const absencesSignalees = new Set([...absMatin, ...absApresMidi].map((r) => r.studentName)).size
  const retardsSignales = new Set([...retMatin, ...retApresMidi].map((r) => r.studentName)).size
  const presents = effectif - absencesSignalees
  const tauxGlobal = effectif === 0 ? 100 : Math.round((presents / effectif) * 100)
  const absColor = absencesSignalees > 0 ? 'oklch(0.55 0.19 25)' : GREEN_TEXT
  const retColor = retardsSignales > 0 ? 'oklch(0.58 0.15 60)' : GREEN_TEXT
  const scopeLabel = classe === TOUTE_ETABLISSEMENT ? cycle.label : classeScopeLabel(classe)

  return (
    <div
      id="printable-absences-bilan"
      className="print-page flex flex-col gap-2.5"
      style={{ padding: '26px 40px 22px', background: 'oklch(0.99 0.003 90)', color: 'oklch(0.24 0.01 260)' }}
    >
      <header className="relative flex items-start justify-between border-b-2 pb-3" style={{ borderColor: 'oklch(0.24 0.01 260)' }}>
        <div className="flex flex-col gap-0.5">
          <p className="text-[19px] font-bold leading-none" style={{ letterSpacing: '-0.01em' }}>
            Groupe Scolaire Mondrian
          </p>
          <p className="text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: 'oklch(0.55 0.01 260)' }}>
            École de la Bienveillance
          </p>
        </div>
        <div className="absolute" style={{ left: 357, top: -24, transform: 'translateX(-50%)' }}>
          <SchoolLogo size={72} />
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <p className="text-[12.5px] font-bold">
            Bilan Journalier d'Assiduité <span style={{ color: style.color }}>— {cycle.label}</span>
          </p>
          <p className="text-[10px]" style={{ color: 'oklch(0.55 0.01 260)' }}>
            Édité le {todayFR()} · {scopeLabel}
          </p>
        </div>
      </header>

      <div className="flex items-center gap-2.5 rounded-[12px] px-3 py-2" style={{ background: 'oklch(0.96 0.03 165)' }}>
        <div className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-white px-2.5 py-1.5">
          <div className="text-[24px] font-extrabold leading-none" style={{ color: GREEN_TEXT }}>
            {tauxGlobal}%
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-[7px] font-semibold uppercase" style={{ letterSpacing: '0.05em', color: 'oklch(0.55 0.01 260)' }}>
              Taux de présence
            </div>
            <div className="h-1 w-12 overflow-hidden rounded-full" style={{ background: 'oklch(0.9 0.02 165)' }}>
              <div className="h-full rounded-full" style={{ width: `${tauxGlobal}%`, background: GREEN }} />
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-hidden">
          <span className="whitespace-nowrap text-[11px] font-extrabold">{longDateFR(date)}</span>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <BandeauCompteur label="Présents" value={`${presents}/${effectif}`} color={GREEN_TEXT} />
          <BandeauCompteur label="Absences" value={absencesSignalees} color={absColor} />
          <BandeauCompteur label="Retards" value={retardsSignales} color={retColor} />
        </div>
      </div>

      <CycleBlock cycle={cycle} />

      <div className="flex flex-1 gap-2.5" style={{ minHeight: 0 }}>
        <RecordCard
          title="Absences du jour"
          icon="🛌"
          color="oklch(0.55 0.19 25)"
          soft="oklch(0.96 0.03 30)"
          matin={absMatin}
          apresMidi={absApresMidi}
          heureDebutMatin={heureDebutMatin}
          heureFinMatin={heureFinMatin}
          heureDebutApresMidi={heureDebutApresMidi}
          heureFinApresMidi={heureFinApresMidi}
        />
        <RecordCard
          title="Retards du jour"
          icon="⏱️"
          color="oklch(0.58 0.15 60)"
          soft="oklch(0.96 0.03 70)"
          matin={retMatin}
          apresMidi={retApresMidi}
          heureDebutMatin={heureDebutMatin}
          heureFinMatin={heureFinMatin}
          heureDebutApresMidi={heureDebutApresMidi}
          heureFinApresMidi={heureFinApresMidi}
        />
      </div>

      <SortiesCard rows={sorties} />

      <div className="flex items-end justify-between gap-5">
        <p className="max-w-[300px] text-[9px] leading-relaxed" style={{ color: 'oklch(0.6 0.01 260)' }}>
          Document généré automatiquement à partir des pointages du jour. Un signalement corrigé après édition n'apparaît pas sur
          cette version.
        </p>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="text-[10px]" style={{ color: 'oklch(0.45 0.01 260)' }}>
            Cachet de l'établissement
          </p>
          <div className="h-12 w-[180px] rounded-[10px]" style={{ border: '1.3px dashed oklch(0.82 0.01 260)' }} />
        </div>
      </div>

      <div
        className="flex items-center justify-center gap-2 border-t pt-1.5 text-center text-[8.5px] font-semibold uppercase"
        style={{ borderColor: 'oklch(0.9 0.005 90)', letterSpacing: '0.08em', color: 'oklch(0.62 0.01 260)' }}
      >
        <span>Direction de la Vie Scolaire</span>
        {pageCount > 1 && (
          <>
            <span style={{ color: 'oklch(0.85 0.005 90)' }}>·</span>
            <span>
              Page {pageIndex + 1}/{pageCount}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
