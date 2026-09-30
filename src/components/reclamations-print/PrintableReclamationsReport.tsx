import SchoolLogo from '../print/SchoolLogo'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import { RECLAMATION_CATEGORIES, type ReclamationRecord } from '../../data/studentDetails'
import { ROLE_LABELS } from '../../data/profiles'
import { useCurrentProfile } from '../../services/permissions'
import { useSchoolIdentity } from '../../services/schoolIdentityService'

export interface FlatReclamation extends ReclamationRecord {
  studentName: string
  classe: string
}

interface PrintableReclamationsReportProps {
  records: FlatReclamation[]
}

type StatutKey = 'attente' | 'cours' | 'resolue'

const STATUT_KEY: Record<ReclamationRecord['statut'], StatutKey> = {
  'En attente': 'attente',
  'En cours': 'cours',
  Résolue: 'resolue',
}

const STATUT_STYLE: Record<StatutKey, { color: string; soft: string }> = {
  attente: { color: 'oklch(0.6 0.15 65)', soft: 'oklch(0.97 0.02 70)' },
  cours: { color: 'oklch(0.5 0.14 250)', soft: 'oklch(0.97 0.015 250)' },
  resolue: { color: 'oklch(0.58 0.15 160)', soft: 'oklch(0.96 0.02 165)' },
}

const INK = 'oklch(0.24 0.01 260)'
const MUTED = 'oklch(0.55 0.01 260)'

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR')
}

function formatDDMMYYYY(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

interface EnrichedReclamation extends FlatReclamation {
  ref: string
  statutKey: StatutKey
  joursOuverts: number
  horsDelai: boolean
}

function BandeauIndicateurs({ total, counts }: { total: number; counts: Record<StatutKey, number> }) {
  const tuiles: { key: StatutKey; label: string }[] = [
    { key: 'attente', label: 'En attente' },
    { key: 'cours', label: 'En cours' },
    { key: 'resolue', label: 'Résolues' },
  ]
  return (
    <div className="flex items-center gap-2 rounded-[12px] px-3 py-2" style={{ background: 'oklch(0.96 0.02 250)' }}>
      <div className="flex shrink-0 items-center gap-2 rounded-[10px] bg-white px-3 py-[5px]">
        <div className="text-[24px] font-extrabold leading-none">{total}</div>
        <div className="text-[7.5px] font-semibold uppercase" style={{ letterSpacing: '0.05em', color: MUTED, lineHeight: 1.3 }}>
          Réclamations
          <br />
          reçues
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {tuiles.map((t) => (
          <div key={t.key} className="flex flex-1 items-center gap-2 rounded-[9px] bg-white px-2.5 py-[5px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUT_STYLE[t.key].color }} />
            <div className="min-w-0 flex-1">
              <div className="text-[7.5px] font-semibold uppercase" style={{ letterSpacing: '0.04em', color: MUTED }}>
                {t.label}
              </div>
              <div className="text-center text-[14px] font-extrabold leading-tight" style={{ color: STATUT_STYLE[t.key].color }}>
                {counts[t.key]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SyntheseCategories({ categories }: { categories: { label: string; value: number; widthPct: number; labelColor: string; valueColor: string }[] }) {
  return (
    <div className="flex-1 overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
      <div className="px-3 py-1.5 text-[10.5px] font-extrabold" style={{ background: 'oklch(0.97 0.012 250)', color: 'oklch(0.42 0.12 250)' }}>
        Répartition par catégorie
      </div>
      <div className="grid grid-cols-2 px-3 pb-2.5 pt-2" style={{ columnGap: 14, rowGap: 3 }}>
        {categories.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[8px] font-bold" style={{ color: c.labelColor }}>
              {c.label}
            </span>
            <div className="h-[5px] w-[46px] shrink-0 overflow-hidden rounded-full" style={{ background: 'oklch(0.94 0.005 250)' }}>
              <div className="h-full rounded-full" style={{ width: `${c.widthPct}%`, background: 'oklch(0.5 0.14 250)' }} />
            </div>
            <span className="w-3 text-right text-[9px] font-extrabold" style={{ color: c.valueColor }}>
              {c.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SyntheseDelais({ delais }: { delais: { label: string; value: number; color: string }[] }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-[12px] border bg-white" style={{ width: 266, borderColor: 'oklch(0.91 0.005 90)' }}>
      <div className="px-3 py-1.5 text-[10.5px] font-extrabold" style={{ background: 'oklch(0.96 0.03 70)', color: 'oklch(0.5 0.13 60)' }}>
        Délais de traitement
      </div>
      <div className="flex flex-col gap-1.5 px-3 pb-2.5 pt-2">
        {delais.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 text-[9.5px]">{d.label}</span>
            <span className="text-[10.5px] font-extrabold" style={{ color: d.color }}>
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FicheCard({ r }: { r: EnrichedReclamation }) {
  const style = STATUT_STYLE[r.statutKey]
  const suivi = r.statutKey === 'resolue' && r.resolution.trim() ? r.resolution.trim() : 'Aucune action enregistrée'
  const suiviMeta =
    r.statutKey === 'resolue'
      ? `Résolue après ${r.joursOuverts} jour${r.joursOuverts > 1 ? 's' : ''} de traitement`
      : `Ouverte depuis ${r.joursOuverts} jour${r.joursOuverts > 1 ? 's' : ''}${r.horsDelai ? ' · au-delà du délai de 72 h' : ''}`
  const attrs: [string, string][] = [
    ['Catégorie', r.type],
    ['Objet', r.objet],
    ['Parent déclarant', r.parentNom],
    ['Concernant', r.enseignant],
  ]

  return (
    <div
      className="overflow-hidden rounded-[12px] border bg-white"
      style={{ borderColor: 'oklch(0.91 0.005 90)', borderLeft: `4px solid ${style.color}` }}
    >
      <div
        className="flex items-center gap-2 px-3 py-[7px]"
        style={{ background: 'oklch(0.98 0.003 90)', borderBottom: '1px solid oklch(0.94 0.005 90)' }}
      >
        <span className="rounded-[7px] px-[7px] py-0.5 text-[9px] font-extrabold text-white" style={{ background: INK, letterSpacing: '0.03em' }}>
          {r.ref}
        </span>
        <span className="text-[11.5px] font-extrabold">{r.studentName}</span>
        <span className="rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ background: 'oklch(0.95 0.01 250)', color: 'oklch(0.45 0.12 250)' }}>
          {r.classe}
        </span>
        <div className="flex-1" />
        <span className="text-[9px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
          Reçue le {formatDDMMYYYY(r.date)}
        </span>
        <span className="rounded-full px-2.5 py-0.5 text-[9px] font-extrabold text-white" style={{ background: style.color }}>
          {r.statut}
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {attrs.map(([label, value], i) => (
          <div key={label} className="px-3 py-[7px]" style={{ borderRight: i < 3 ? '1px solid oklch(0.95 0.005 90)' : 'none' }}>
            <div className="text-[7.5px] font-semibold uppercase" style={{ letterSpacing: '0.05em', color: 'oklch(0.58 0.01 260)' }}>
              {label}
            </div>
            <div className="text-[10.5px] font-bold">{value?.trim() ? value : '— non renseigné'}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 px-3 pb-2.5 pt-2" style={{ borderTop: '1px solid oklch(0.95 0.005 90)' }}>
        <div className="min-w-0 flex-1">
          <div className="text-[7.5px] font-semibold uppercase" style={{ letterSpacing: '0.05em', color: 'oklch(0.58 0.01 260)' }}>
            Description transmise par le parent
          </div>
          <p className="text-[10px]" style={{ lineHeight: 1.45, color: 'oklch(0.35 0.01 260)' }}>
            {r.description}
          </p>
        </div>
        <div className="shrink-0 rounded-[9px] px-2.5 py-1.5" style={{ width: 196, background: style.soft }}>
          <div className="text-[7.5px] font-semibold uppercase" style={{ letterSpacing: '0.05em', color: 'oklch(0.58 0.01 260)' }}>
            Suivi
          </div>
          <div className="text-[10px] font-bold" style={{ color: style.color }}>
            {suivi}
          </div>
          <div className="text-[8.5px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
            {suiviMeta}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PrintableReclamationsReport({ records }: PrintableReclamationsReportProps) {
  const profile = useCurrentProfile()
  const { data: schoolIdentity } = useSchoolIdentity()
  const now = Date.now()
  const enriched: EnrichedReclamation[] = records.map((r, i) => {
    const statutKey = STATUT_KEY[r.statut]
    const joursOuverts = Math.max(0, Math.floor((now - Date.parse(r.date + 'T00:00:00')) / 86400000))
    const horsDelai = statutKey !== 'resolue' && joursOuverts > 3
    return { ...r, ref: `RC-${String(i + 1).padStart(2, '0')}`, statutKey, joursOuverts, horsDelai }
  })

  const total = enriched.length
  const count = (k: StatutKey) => enriched.filter((r) => r.statutKey === k).length
  const counts: Record<StatutKey, number> = { attente: count('attente'), cours: count('cours'), resolue: count('resolue') }
  const horsDelaiCount = enriched.filter((r) => r.horsDelai).length

  const parCat = enriched.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1
    return acc
  }, {})
  const maxCat = Math.max(1, ...Object.values(parCat))
  const categories = RECLAMATION_CATEGORIES.map((label) => {
    const value = parCat[label] ?? 0
    return {
      label,
      value,
      widthPct: Math.round((value / maxCat) * 100),
      labelColor: value ? INK : 'oklch(0.68 0.01 260)',
      valueColor: value ? 'oklch(0.42 0.12 250)' : 'oklch(0.75 0.01 260)',
    }
  })
  const delais = [
    { label: 'Traitées sous 72h', value: counts.resolue, color: STATUT_STYLE.resolue.color },
    { label: 'En cours dans les délais', value: counts.cours, color: STATUT_STYLE.cours.color },
    { label: 'Hors délai (>72h)', value: horsDelaiCount, color: 'oklch(0.55 0.19 25)' },
  ]

  const blocks: PaginatedBlock[] =
    enriched.length === 0
      ? [
          {
            key: '__empty__',
            node: (
              <div
                className="rounded-[12px] px-[22px] py-[22px] text-center text-[11px]"
                style={{ border: '1px dashed oklch(0.85 0.005 90)', color: MUTED }}
              >
                Aucune réclamation enregistrée sur la période. ✓
              </div>
            ),
          },
        ]
      : enriched.map((r) => ({ key: r.ref, node: <FicheCard r={r} /> }))

  return (
    <PaginatedPrintDocument
      blocks={blocks}
      paddingXPx={40}
      paddingYPx={26}
      gapPx={11}
      pageStyle={{ background: 'oklch(0.99 0.003 90)', color: INK, fontFamily: 'Helvetica, Arial, sans-serif' }}
      renderHeader={(pageIndex) => (
        <>
          <header className="relative flex items-start justify-between border-b-2 pb-3" style={{ borderColor: INK }}>
            <div className="flex flex-col gap-0.5">
              <p className="text-[19px] font-bold leading-none" style={{ letterSpacing: '-0.01em' }}>
                Groupe Scolaire Mondrian
              </p>
              <p className="text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: MUTED }}>
                École de la Bienveillance
              </p>
            </div>
            <div className="absolute" style={{ left: 357, top: -24, transform: 'translateX(-50%)' }}>
              <SchoolLogo size={72} />
            </div>
            <div className="text-right">
              <p className="text-[12.5px] font-bold">Rapport des Réclamations Parents</p>
              <p className="text-[10px]" style={{ color: MUTED }}>
                Édité le {todayFR()}
              </p>
            </div>
          </header>

          {pageIndex === 0 && (
            <div className="mt-2.5 flex flex-col gap-2.5">
              <BandeauIndicateurs total={total} counts={counts} />
              <div className="flex gap-2.5">
                <SyntheseCategories categories={categories} />
                <SyntheseDelais delais={delais} />
              </div>
            </div>
          )}

          <div className="mb-1.5 mt-2.5 flex items-baseline gap-2">
            <span className="text-[11.5px] font-extrabold">Réclamations enregistrées{pageIndex > 0 ? ' (suite)' : ''}</span>
            <span className="text-[9px]" style={{ color: MUTED }}>
              Classées de la plus récente à la plus ancienne
            </span>
          </div>
        </>
      )}
      renderFooter={(pageIndex, pageCount) => (
        <>
          <div className="flex items-end justify-between gap-5">
            <p className="max-w-[320px] text-[9px] leading-relaxed" style={{ color: 'oklch(0.6 0.01 260)' }}>
              Document confidentiel — réservé à l'équipe de direction. Toute réclamation doit être traitée sous 72 heures et son
              suivi consigné dans l'application.
            </p>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-[10px]" style={{ color: 'oklch(0.45 0.01 260)' }}>
                Visa de la direction
              </p>
              {profile?.signatureImage ? (
                <>
                  <div className="flex h-[76px] w-[200px] items-center justify-center gap-2">
                    {schoolIdentity?.cachet && <img src={schoolIdentity.cachet} alt="Cachet" style={{ maxHeight: 72, maxWidth: 76, objectFit: 'contain' }} />}
                    <img src={profile.signatureImage} alt="Signature" style={{ maxHeight: 48, maxWidth: 100, objectFit: 'contain' }} />
                  </div>
                  <p className="text-[8px]" style={{ color: 'oklch(0.55 0.01 260)' }}>
                    {profile.nomComplet} — {ROLE_LABELS[profile.role]}
                  </p>
                </>
              ) : (
                <div className="h-12 w-[180px] rounded-[10px]" style={{ border: '1.3px dashed oklch(0.82 0.01 260)' }} />
              )}
            </div>
          </div>
          <div
            className="mt-1 border-t pt-1.5 text-[8.5px]"
            style={{ borderColor: 'oklch(0.9 0.005 90)', color: 'oklch(0.62 0.01 260)' }}
          >
            {pageCount > 1 && (
              <div className="mb-0.5 flex justify-end text-[8px] normal-case" style={{ letterSpacing: 0, color: 'oklch(0.65 0.01 260)' }}>
                Page {pageIndex + 1} / {pageCount}
              </div>
            )}
            <div className="text-center font-semibold uppercase" style={{ letterSpacing: '0.08em' }}>
              Direction de la Vie Scolaire
            </div>
          </div>
        </>
      )}
    />
  )
}
