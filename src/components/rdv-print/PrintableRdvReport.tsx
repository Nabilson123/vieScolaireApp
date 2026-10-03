import SchoolLogo from '../print/SchoolLogo'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import type { RendezVousRecord } from '../../data/studentDetails'
import { ROLE_LABELS } from '../../data/profiles'
import { useCurrentProfile } from '../../services/permissions'
import { useSchoolIdentity } from '../../services/schoolIdentityService'

export interface FlatRdv extends RendezVousRecord {
  studentName: string
  classe: string
}

interface PrintableRdvReportProps {
  records: FlatRdv[]
}

type StatutKey = 'planifie' | 'realise' | 'annule'

const STATUT_KEY: Record<RendezVousRecord['statut'], StatutKey> = {
  Planifié: 'planifie',
  Réalisé: 'realise',
  Annulé: 'annule',
}

const STATUT_STYLE: Record<StatutKey, { color: string; soft: string }> = {
  planifie: { color: 'oklch(0.5 0.14 250)', soft: 'oklch(0.97 0.015 250)' },
  realise: { color: 'oklch(0.55 0.15 160)', soft: 'oklch(0.96 0.02 165)' },
  annule: { color: 'oklch(0.55 0.19 25)', soft: 'oklch(0.97 0.02 25)' },
}

// Le modèle de données n'a que 2 modes réels (contrairement aux 3 du handoff, "Téléphone" n'existe
// pas) — mapping appliqué partout où le mode est affiché dans ce document, pas seulement la synthèse.
const MODE_LABEL: Record<RendezVousRecord['mode'], string> = {
  Présentiel: 'Présentiel',
  Virtuel: 'Visioconférence',
}
const MODE_ICON: Record<RendezVousRecord['mode'], string> = {
  Présentiel: '🏫',
  Virtuel: '💻',
}

const INK = 'oklch(0.24 0.01 260)'
const MUTED = 'oklch(0.55 0.01 260)'

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR')
}

function jourCourt(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const s = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function dateLongue(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Aucune formule dans le handoff source (contrairement à joursOuverts des réclamations) — dérivé
 * du triplet réel statut × présence de compteRendu × signeParent. Le texte de la branche
 * "Réalisé + signé" reprend le fixture littéral du prototype (seule branche vérifiable contre le
 * vrai enregistrement de référence de l'app). */
function deriveSuite(r: RendezVousRecord): { suite: string; suiteMeta: string } {
  if (r.statut === 'Planifié') {
    return { suite: 'Rendez-vous à venir', suiteMeta: "Compte-rendu à rédiger après l'entretien" }
  }
  if (r.statut === 'Annulé') {
    return { suite: 'Rendez-vous annulé', suiteMeta: 'Aucune suite requise' }
  }
  if (r.compteRendu?.signeParent) {
    return { suite: 'Aucune suite programmée', suiteMeta: 'Rendez-vous clôturé' }
  }
  if (r.compteRendu) {
    return { suite: 'En attente de signature', suiteMeta: 'Compte-rendu rédigé, signature du parent non recueillie' }
  }
  return { suite: 'Compte-rendu à rédiger', suiteMeta: '' }
}

interface EnrichedRdv extends FlatRdv {
  statutKey: StatutKey
  suite: string
  suiteMeta: string
}

function BandeauIndicateurs({ total, counts }: { total: number; counts: Record<StatutKey, number> }) {
  const tuiles: { key: StatutKey; label: string }[] = [
    { key: 'planifie', label: 'Planifiés' },
    { key: 'realise', label: 'Réalisés' },
    { key: 'annule', label: 'Annulés' },
  ]
  return (
    <div className="flex items-center gap-2 rounded-[12px] px-3 py-2" style={{ background: 'oklch(0.96 0.02 250)' }}>
      <div className="flex shrink-0 items-center gap-2 rounded-[10px] bg-white px-3 py-[5px]">
        <div className="text-[24px] font-extrabold leading-none">{total}</div>
        <div className="text-[7.5px] font-semibold uppercase" style={{ letterSpacing: '0.05em', color: MUTED, lineHeight: 1.3 }}>
          Rendez-vous
          <br />
          sur la période
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

function SyntheseMotifs({ topMotifs, maxMotif, overflowCount }: { topMotifs: [string, number][]; maxMotif: number; overflowCount: number }) {
  return (
    <div className="flex-1 overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
      <div className="px-3 py-1.5 text-[10.5px] font-extrabold" style={{ background: 'oklch(0.97 0.012 250)', color: 'oklch(0.42 0.12 250)' }}>
        Répartition par motif
      </div>
      {topMotifs.length === 0 ? (
        <p className="px-3 pb-2.5 pt-2 text-[9px]" style={{ color: MUTED }}>
          Aucun motif enregistré sur la période.
        </p>
      ) : (
        <div className="grid grid-cols-2 px-3 pb-2.5 pt-2" style={{ columnGap: 14, rowGap: 3 }}>
          {topMotifs.map(([label, value]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-[8px] font-bold" style={{ color: INK }}>
                {label}
              </span>
              <div className="h-[5px] w-[46px] shrink-0 overflow-hidden rounded-full" style={{ background: 'oklch(0.94 0.005 250)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.round((value / maxMotif) * 100)}%`, background: 'oklch(0.5 0.14 250)' }} />
              </div>
              <span className="w-3 text-right text-[9px] font-extrabold" style={{ color: 'oklch(0.42 0.12 250)' }}>
                {value}
              </span>
            </div>
          ))}
          {overflowCount > 0 && (
            <p className="text-[8px]" style={{ gridColumn: 'span 2', color: MUTED }}>
              + {overflowCount} autre{overflowCount > 1 ? 's' : ''} motif{overflowCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function SyntheseModes({ counts }: { counts: Record<RendezVousRecord['mode'], number> }) {
  const modes: RendezVousRecord['mode'][] = ['Présentiel', 'Virtuel']
  return (
    <div className="shrink-0 overflow-hidden rounded-[12px] border bg-white" style={{ width: 266, borderColor: 'oklch(0.91 0.005 90)' }}>
      <div className="px-3 py-1.5 text-[10.5px] font-extrabold" style={{ background: 'oklch(0.96 0.02 165)', color: 'oklch(0.45 0.13 160)' }}>
        Mode de rencontre
      </div>
      <div className="flex flex-col gap-1.5 px-3 pb-2.5 pt-2">
        {modes.map((m) => {
          const value = counts[m]
          return (
            <div key={m} className="flex items-center gap-2">
              <span style={{ fontSize: 11 }}>{MODE_ICON[m]}</span>
              <span className="flex-1 text-[9.5px]" style={{ color: value ? INK : 'oklch(0.68 0.01 260)' }}>
                {MODE_LABEL[m]}
              </span>
              <span className="text-[10.5px] font-extrabold" style={{ color: value ? 'oklch(0.45 0.13 160)' : 'oklch(0.75 0.01 260)' }}>
                {value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FicheCard({ r }: { r: EnrichedRdv }) {
  const style = STATUT_STYLE[r.statutKey]
  const champs: [string, string][] = [
    ['Mode', MODE_LABEL[r.mode]],
    ['Lieu · Durée', `${r.lieu?.trim() ? r.lieu : '— non renseigné'} · ${r.duree} min`],
    ['Motif', r.motif],
    r.enseignants.length > 0 ? [r.enseignants.length > 1 ? 'Enseignants' : 'Enseignant', r.enseignants.join(', ')] : ['Interlocuteur', 'Administration seulement'],
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
        <div className="shrink-0 rounded-[9px] px-[9px] py-[3px] text-center" style={{ background: style.soft }}>
          <div className="text-[8px] uppercase" style={{ letterSpacing: '0.04em', color: 'oklch(0.5 0.01 260)' }}>
            {jourCourt(r.date)}
          </div>
          <div className="text-[12px] font-extrabold leading-tight" style={{ color: style.color }}>
            {r.heure}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-[1px]">
          <div className="flex items-center gap-[7px]">
            <span className="text-[11.5px] font-extrabold">{r.studentName}</span>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ background: 'oklch(0.95 0.01 250)', color: 'oklch(0.45 0.12 250)' }}>
              {r.classe}
            </span>
          </div>
          <div className="text-[9px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
            {dateLongue(r.date)}
          </div>
        </div>
        <div className="flex-1" />
        <span className="rounded-full px-2.5 py-0.5 text-[9px] font-extrabold text-white" style={{ background: style.color }}>
          {r.statut}
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {champs.map(([label, value], i) => (
          <div key={label} className="px-3 py-[7px]" style={{ borderRight: i < 3 ? '1px solid oklch(0.95 0.005 90)' : 'none' }}>
            <div className="text-[7.5px] font-semibold uppercase" style={{ letterSpacing: '0.05em', color: 'oklch(0.58 0.01 260)' }}>
              {label}
            </div>
            <div className="text-[10.5px] font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 px-3 pb-2.5 pt-2" style={{ borderTop: '1px solid oklch(0.95 0.005 90)' }}>
        {r.compteRendu && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[7.5px] font-extrabold uppercase" style={{ letterSpacing: '0.05em', color: 'oklch(0.45 0.01 260)' }}>
                Compte rendu du rendez-vous
              </span>
              <div className="flex-1" />
              <span className="rounded-full px-[9px] py-0.5 text-[8.5px] font-bold" style={{ background: 'oklch(0.96 0.02 165)', color: 'oklch(0.45 0.13 160)' }}>
                Rédigé par {r.compteRendu.redacteur}
              </span>
              <span
                className="rounded-full px-[9px] py-0.5 text-[8.5px] font-bold"
                style={{
                  background: r.compteRendu.signeParent ? 'oklch(0.97 0.03 80)' : 'oklch(0.96 0.005 90)',
                  color: r.compteRendu.signeParent ? 'oklch(0.55 0.14 65)' : 'oklch(0.6 0.01 260)',
                }}
              >
                {r.compteRendu.signeParent ? 'Signé par le parent' : 'Non signé par le parent'}
              </span>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${r.enseignants.length > 0 ? 3 : 2}, 1fr)` }}>
              {[
                { role: 'Administration', texte: r.compteRendu.administration, color: 'oklch(0.48 0.15 300)', soft: 'oklch(0.97 0.02 305)' },
                { role: 'Parents', texte: r.compteRendu.parents, color: 'oklch(0.52 0.17 5)', soft: 'oklch(0.97 0.02 10)' },
                ...(r.enseignants.length > 0
                  ? [{ role: r.enseignants.length > 1 ? 'Enseignants' : 'Enseignant', texte: r.compteRendu.enseignant, color: 'oklch(0.45 0.13 160)', soft: 'oklch(0.96 0.02 165)' }]
                  : []),
              ].map((a) => (
                <div key={a.role} className="rounded-[9px] px-2.5 py-[7px]" style={{ background: a.soft }}>
                  <div className="text-[8px] font-extrabold uppercase" style={{ letterSpacing: '0.05em', color: a.color }}>
                    {a.role}
                  </div>
                  <div className="text-[9.5px]" style={{ lineHeight: 1.45, color: 'oklch(0.32 0.01 260)' }}>
                    {a.texte?.trim() ? a.texte : '— non renseigné'}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex items-center gap-2 rounded-[9px] px-2.5 py-[5px]" style={{ background: style.soft }}>
          <span className="text-[7.5px] uppercase" style={{ letterSpacing: '0.05em', color: 'oklch(0.58 0.01 260)' }}>
            Suite
          </span>
          <span className="text-[9.5px] font-bold" style={{ color: style.color }}>
            {r.suite}
          </span>
          <div className="flex-1" />
          <span className="text-[8.5px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
            {r.suiteMeta}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function PrintableRdvReport({ records }: PrintableRdvReportProps) {
  const profile = useCurrentProfile()
  const { data: schoolIdentity } = useSchoolIdentity()
  const enriched: EnrichedRdv[] = records.map((r) => {
    const statutKey = STATUT_KEY[r.statut]
    const { suite, suiteMeta } = deriveSuite(r)
    return { ...r, statutKey, suite, suiteMeta }
  })

  const total = enriched.length
  const count = (k: StatutKey) => enriched.filter((r) => r.statutKey === k).length
  const counts: Record<StatutKey, number> = { planifie: count('planifie'), realise: count('realise'), annule: count('annule') }

  const parMotif = enriched.reduce<Record<string, number>>((acc, r) => {
    acc[r.motif] = (acc[r.motif] ?? 0) + 1
    return acc
  }, {})
  const motifEntries = Object.entries(parMotif).sort((a, b) => b[1] - a[1])
  const topMotifs = motifEntries.slice(0, 7)
  const overflowMotifCount = motifEntries.length - topMotifs.length
  const maxMotif = topMotifs[0]?.[1] ?? 1

  const parMode = enriched.reduce<Record<RendezVousRecord['mode'], number>>(
    (acc, r) => {
      acc[r.mode] = (acc[r.mode] ?? 0) + 1
      return acc
    },
    { Présentiel: 0, Virtuel: 0 }
  )

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
                Aucun rendez-vous enregistré sur la période.
              </div>
            ),
          },
        ]
      : enriched.map((r, i) => ({ key: `${r.studentName}-${r.date}-${r.heure}-${i}`, node: <FicheCard r={r} /> }))

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
              <p className="text-[12.5px] font-bold">Rapport des Rendez-vous Parents</p>
              <p className="text-[10px]" style={{ color: MUTED }}>
                Édité le {todayFR()}
              </p>
            </div>
          </header>

          {pageIndex === 0 && (
            <div className="mt-2.5 flex flex-col gap-2.5">
              <BandeauIndicateurs total={total} counts={counts} />
              <div className="flex gap-2.5">
                <SyntheseMotifs topMotifs={topMotifs} maxMotif={maxMotif} overflowCount={overflowMotifCount} />
                <SyntheseModes counts={parMode} />
              </div>
            </div>
          )}

          <div className="mb-1.5 mt-2.5 flex items-baseline gap-2">
            <span className="text-[11.5px] font-extrabold">Rendez-vous enregistrés{pageIndex > 0 ? ' (suite)' : ''}</span>
            <span className="text-[9px]" style={{ color: MUTED }}>
              Du plus récent au plus ancien
            </span>
          </div>
        </>
      )}
      renderFooter={(pageIndex, pageCount) => (
        <>
          <div className="flex items-end justify-between gap-5">
            <p className="max-w-[320px] text-[9px] leading-relaxed" style={{ color: 'oklch(0.6 0.01 260)' }}>
              Document généré par l'application de vie scolaire. Les comptes rendus d'entretien sont saisis par l'enseignant ou la
              direction à l'issue du rendez-vous.
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
          <div className="mt-1 border-t pt-1.5 text-[8.5px]" style={{ borderColor: 'oklch(0.9 0.005 90)', color: 'oklch(0.62 0.01 260)' }}>
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
