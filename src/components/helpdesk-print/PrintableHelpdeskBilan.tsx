import SchoolLogo from '../print/SchoolLogo'
import type { Incident } from '../../data/helpdesk'
import { PANNE_CATEGORIES, computeBCTotals } from '../../data/helpdesk'
import { computeBilanParCategorie, computeBilanParPrestataire } from '../../utils/helpdeskAggregation'
import { ROLE_LABELS } from '../../data/profiles'
import { useCurrentProfile } from '../../services/permissions'
import { useSchoolIdentity } from '../../services/schoolIdentityService'

interface PrintableHelpdeskBilanProps {
  start: string
  end: string
  incidents: Incident[]
}

const INK = 'oklch(0.24 0.01 260)'
const MUTED = 'oklch(0.55 0.01 260)'
const BLUE = 'oklch(0.42 0.12 250)'
const VERT = 'oklch(0.5 0.15 160)'
const AMBRE = 'oklch(0.6 0.15 65)'
const ROUGE = 'oklch(0.52 0.19 25)'
const GRIS = 'oklch(0.7 0.01 260)'

const REFERENTIEL = PANNE_CATEGORIES.map((c) => c.categorie)

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR')
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR')
}

function periodeLabel(start: string, end: string): string {
  if (start && end) return `Période du ${fmtDate(start)} au ${fmtDate(end)}`
  if (start) return `Depuis le ${fmtDate(start)}`
  if (end) return `Jusqu'au ${fmtDate(end)}`
  return 'Historique complet'
}

function periodeCourte(start: string, end: string): string {
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`
  if (start) return `Depuis le ${fmtDate(start)}`
  if (end) return `Jusqu'au ${fmtDate(end)}`
  return 'Historique complet'
}

/** Format marocain : virgule décimale, devise DH, "—" si nul. Dupliqué localement par convention
 * (même utilitaire que PrintableBonCommande.tsx, fichiers d'impression indépendants). */
function formatDH(n: number): string {
  if (n === 0) return '—'
  return `${n.toFixed(2).replace('.', ',')} DH`
}

function tauxColor(taux: number): string {
  if (taux >= 70) return VERT
  if (taux >= 40) return AMBRE
  return ROUGE
}

export default function PrintableHelpdeskBilan({ start, end, incidents }: PrintableHelpdeskBilanProps) {
  const profile = useCurrentProfile()
  const { data: schoolIdentity } = useSchoolIdentity()
  const total = incidents.length
  const resolus = incidents.filter((i) => i.statut === 'RESOLU').length
  const enCours = incidents.filter((i) => i.statut === 'EN_COURS').length
  const aTraiter = incidents.filter((i) => i.statut === 'A_TRAITER').length
  const taux = total > 0 ? Math.round((resolus / total) * 100) : 0
  const seuil = tauxColor(taux)

  const totalTTC = incidents.reduce((sum, inc) => sum + computeBCTotals(inc.bc).totalTTC, 0)
  const coutMoyen = total > 0 ? totalTTC / total : 0

  const parCategorie = computeBilanParCategorie(incidents, REFERENTIEL)
  const maxCategorie = Math.max(1, ...parCategorie.map((c) => c.count))

  const parPrestataireRaw = computeBilanParPrestataire(incidents)
  const parPrestataire = parPrestataireRaw.map((p) => ({
    ...p,
    part: total > 0 ? Math.round((p.count / total) * 100) : 0,
  }))

  const interne = parPrestataireRaw.find((p) => p.label === 'Personnel Interne')
  const interneCount = interne?.count ?? 0
  const externeCount = total - interneCount

  const alertes: { texte: string; color: string }[] = []
  if (total > 0 && taux < 70) {
    alertes.push({
      texte: `Taux de résolution de ${taux} % sur la période : ${total - resolus} incident(s) sur ${total} restent ouverts.`,
      color: taux < 40 ? ROUGE : AMBRE,
    })
  }
  const categorieConcentree = parCategorie
    .filter((c) => c.count >= 2 && c.totalTTC === 0)
    .sort((a, b) => b.count - a.count)[0]
  if (categorieConcentree) {
    alertes.push({
      texte: `${categorieConcentree.label} concentre ${categorieConcentree.count} incidents sans travaux facturés — vérifier le suivi des interventions internes.`,
      color: AMBRE,
    })
  }
  if (total > 0 && interneCount > 0 && externeCount > 0) {
    const internePartTTC = totalTTC > 0 ? Math.round(((interne?.totalTTC ?? 0) / totalTTC) * 100) : 0
    alertes.push({
      texte: `Le personnel interne assure ${interneCount} intervention(s) sur ${total} pour ${internePartTTC} % du montant total facturé.`,
      color: BLUE,
    })
  }

  const statuts = [
    { label: 'Résolus', value: resolus, color: VERT, valueColor: 'oklch(0.45 0.13 160)' },
    { label: 'En cours', value: enCours, color: BLUE, valueColor: BLUE },
    { label: 'À Traiter', value: aTraiter, color: AMBRE, valueColor: 'oklch(0.5 0.13 60)' },
    { label: 'Annulés', value: 0, color: GRIS, valueColor: 'oklch(0.5 0.01 260)' },
  ]

  return (
    <div
      id="printable-helpdesk-bilan"
      className="print-page flex flex-col"
      style={{ padding: '26px 40px 22px', background: 'oklch(0.99 0.003 90)', color: INK, fontFamily: 'Helvetica, Arial, sans-serif', justifyContent: 'space-between', gap: 11 }}
    >
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
          <p className="text-[12.5px] font-bold">Bilan Helpdesk &amp; Maintenance</p>
          <p className="text-[10px]" style={{ color: MUTED }}>
            {periodeLabel(start, end)} · édité le {todayFR()}
          </p>
        </div>
      </header>

      <div className="flex items-center gap-2.5 rounded-[12px] px-3.5 py-2.5" style={{ background: 'oklch(0.96 0.02 250)' }}>
        <div className="min-w-0 flex-1">
          <div className="text-[8px] font-extrabold uppercase" style={{ letterSpacing: '0.06em', color: BLUE }}>
            Taux de résolution
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-extrabold leading-none" style={{ color: seuil }}>
              {taux}%
            </span>
            <span className="text-[11px] font-bold" style={{ color: 'oklch(0.42 0.01 260)' }}>
              {resolus} incident(s) clôturé(s) sur {total}
            </span>
          </div>
          <div className="mt-0.5 overflow-hidden rounded-full bg-white" style={{ height: 6 }}>
            <div style={{ height: '100%', width: `${taux}%`, background: seuil, borderRadius: 99 }} />
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {[
            { label: 'Incidents', value: String(total), color: INK },
            { label: 'Travaux TTC', value: formatDH(totalTTC), color: BLUE },
            { label: 'Coût moyen', value: formatDH(coutMoyen), color: BLUE },
          ].map((k) => (
            <div key={k.label} className="rounded-[9px] bg-white px-2.5 py-1.5 text-center" style={{ minWidth: 82 }}>
              <div className="text-[7.5px] uppercase" style={{ letterSpacing: '0.04em', color: 'oklch(0.5 0.01 260)' }}>
                {k.label}
              </div>
              <div className="text-[15px] font-extrabold leading-[1.15]" style={{ color: k.color }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {statuts.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5 rounded-[11px] border bg-white px-3 py-1.5" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
            <span className="shrink-0 rounded-full" style={{ width: 9, height: 9, background: s.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-[8px] uppercase" style={{ letterSpacing: '0.04em', color: MUTED }}>
                {s.label}
              </div>
              <div className="text-[14px] font-extrabold leading-[1.15]" style={{ color: s.valueColor }}>
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
        <div className="flex items-baseline gap-2" style={{ padding: '7px 14px', background: 'oklch(0.97 0.012 250)' }}>
          <span className="text-[11px] font-extrabold" style={{ color: BLUE }}>
            Répartition par catégorie
          </span>
          <span className="text-[9px]" style={{ color: 'oklch(0.5 0.01 260)' }}>
            Toutes les catégories du référentiel
          </span>
        </div>
        <div className="grid gap-x-4" style={{ gridTemplateColumns: '1fr 1fr', padding: '8px 14px 10px' }}>
          {parCategorie.map((c) => (
            <div key={c.label} className="flex items-center gap-2" style={{ height: 22 }}>
              <span
                className="min-w-0 flex-1 overflow-hidden text-[9px] font-bold"
                style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: c.count ? INK : 'oklch(0.62 0.01 260)' }}
              >
                {c.label}
              </span>
              <div className="shrink-0 overflow-hidden rounded-full" style={{ width: 52, height: 5, background: 'oklch(0.94 0.005 250)' }}>
                <div style={{ height: '100%', width: `${Math.round((c.count / maxCategorie) * 100)}%`, background: BLUE, borderRadius: 99 }} />
              </div>
              <span className="text-right text-[9.5px] font-extrabold" style={{ width: 13, color: c.count ? BLUE : 'oklch(0.62 0.01 260)' }}>
                {c.count}
              </span>
              <span className="text-right text-[9px] font-bold" style={{ width: 66, color: c.totalTTC ? 'oklch(0.3 0.01 260)' : 'oklch(0.62 0.01 260)' }}>
                {formatDH(c.totalTTC)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
        <div className="px-3.5 py-1.5 text-[11px] font-extrabold" style={{ background: 'oklch(0.96 0.02 165)', color: 'oklch(0.45 0.13 160)' }}>
          Répartition par prestataire
        </div>
        <div
          className="px-3.5 py-1.5 text-[8px] font-extrabold uppercase"
          style={{ display: 'grid', gridTemplateColumns: '1fr 84px 90px 96px', letterSpacing: '0.05em', color: 'oklch(0.45 0.01 260)', borderBottom: '1.3px solid oklch(0.9 0.005 90)' }}
        >
          <span>Prestataire</span>
          <span className="text-right">Interventions</span>
          <span className="text-right">Part</span>
          <span className="text-right">Total TTC</span>
        </div>
        {parPrestataire.length === 0 ? (
          <p className="px-3.5 py-3 text-center text-[10px] italic" style={{ color: MUTED }}>
            Aucune intervention sur la période.
          </p>
        ) : (
          parPrestataire.map((p) => (
            <div
              key={p.label}
              className="items-center px-3.5 text-[10.5px]"
              style={{ display: 'grid', gridTemplateColumns: '1fr 84px 90px 96px', height: 30, borderBottom: '1px solid oklch(0.94 0.005 90)' }}
            >
              <span className="overflow-hidden font-bold" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {p.label}
              </span>
              <span className="text-right">{p.count}</span>
              <span className="text-right" style={{ color: 'oklch(0.5 0.01 260)' }}>
                {p.part} %
              </span>
              <span className="text-right font-extrabold">{formatDH(p.totalTTC)}</span>
            </div>
          ))
        )}
        {parPrestataire.length > 0 && (
          <div
            className="items-center px-3.5 text-[11px]"
            style={{ display: 'grid', gridTemplateColumns: '1fr 84px 90px 96px', height: 32, background: 'oklch(0.985 0.003 90)' }}
          >
            <span className="font-extrabold">Total</span>
            <span className="text-right font-extrabold">{total}</span>
            <span className="text-right" style={{ color: 'oklch(0.5 0.01 260)' }}>
              100 %
            </span>
            <span className="text-right font-extrabold" style={{ color: BLUE }}>
              {formatDH(totalTTC)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1 overflow-hidden rounded-[12px] border" style={{ borderColor: 'oklch(0.93 0.005 90)', background: 'oklch(0.985 0.003 90)' }}>
          <div
            className="px-3.5 py-1.5 text-[9px] font-extrabold uppercase"
            style={{ letterSpacing: '0.06em', color: 'oklch(0.5 0.01 260)', borderBottom: '1px solid oklch(0.94 0.005 90)' }}
          >
            Points d'attention
          </div>
          <div className="flex flex-col gap-1.5 px-3.5 py-2.5">
            {alertes.length === 0 ? (
              <p className="text-[9.5px] italic" style={{ color: MUTED }}>
                Aucun point d'attention notable sur la période.
              </p>
            ) : (
              alertes.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-[4px] shrink-0 rounded-full" style={{ width: 6, height: 6, background: a.color }} />
                  <span className="flex-1 text-[9.5px]" style={{ lineHeight: 1.45 }}>
                    {a.texte}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border bg-white px-3.5 pb-2.5 pt-2" style={{ width: 250, flexShrink: 0, borderColor: 'oklch(0.91 0.005 90)' }}>
          <div className="text-[10.5px] font-bold">Visa de la direction</div>
          <div className="text-[9px]" style={{ color: 'oklch(0.6 0.01 260)' }}>
            {profile?.signatureImage ? `${profile.nomComplet} — ${ROLE_LABELS[profile.role]}` : 'Direction de la Vie Scolaire'}
          </div>
          <div
            className="flex items-center justify-center gap-2"
            style={{ height: 78, borderBottom: '1px solid oklch(0.86 0.005 90)' }}
          >
            {profile?.signatureImage && (
              <>
                {schoolIdentity?.cachet && <img src={schoolIdentity.cachet} alt="Cachet" style={{ maxHeight: 72, maxWidth: 76, objectFit: 'contain' }} />}
                <img src={profile.signatureImage} alt="Signature" style={{ maxHeight: 56, maxWidth: 110, objectFit: 'contain' }} />
              </>
            )}
          </div>
          <div className="text-[8px]" style={{ color: 'oklch(0.62 0.01 260)' }}>
            {profile?.signatureImage ? `Signature · Cachet · ${todayFR()}` : 'Signature · Cachet · Date'}
          </div>
        </div>
      </div>

      <div className="flex justify-between border-t pt-1.5 text-[8.5px]" style={{ borderColor: 'oklch(0.9 0.005 90)', color: 'oklch(0.62 0.01 260)' }}>
        <span className="font-semibold uppercase" style={{ letterSpacing: '0.08em' }}>
          Direction de la Vie Scolaire
        </span>
        <span>Bilan Helpdesk &amp; Maintenance · {periodeCourte(start, end)}</span>
      </div>
    </div>
  )
}
