import SchoolLogo from '../print/SchoolLogo'
import type { RendezVousRecord } from '../../data/studentDetails'

interface PrintableCompteRenduRdvProps {
  record: RendezVousRecord
  studentName: string
  classe: string
}

const MODE_LABEL: Record<RendezVousRecord['mode'], string> = {
  Présentiel: 'Présentiel',
  Virtuel: 'Visioconférence',
}

const STATUT_COLOR: Record<RendezVousRecord['statut'], string> = {
  Planifié: 'oklch(0.5 0.14 250)',
  Réalisé: 'oklch(0.55 0.15 160)',
  Annulé: 'oklch(0.55 0.19 25)',
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

/** Toujours en majuscules dans les fiches élèves de cette appli (ex. "Ahmed hatim MAAMOURI") — le
 * dernier segment est donc fiable pour dériver une désignation "Famille X" en l'absence d'un champ
 * nom de famille dédié dans le modèle. */
function familleDe(studentName: string): string {
  const tokens = studentName.trim().split(/\s+/)
  return `Famille ${tokens[tokens.length - 1] ?? studentName}`
}

const FALLBACK_DECISION = {
  texte: "Aucune décision enregistrée dans l'application à l'issue de l'entretien.",
  echeance: '—',
}

export default function PrintableCompteRenduRdv({ record, studentName, classe }: PrintableCompteRenduRdvProps) {
  const cr = record.compteRendu
  const champs: [string, string][] = [
    ['Mode', MODE_LABEL[record.mode]],
    ['Lieu · Durée', `${record.lieu?.trim() ? record.lieu : '— non renseigné'} · ${record.duree} min`],
    ['Motif', record.motif],
    record.enseignant ? ['Enseignant', record.enseignant] : ['Interlocuteur', 'Administration seulement'],
  ]
  const avis = [
    { role: 'Administration', icon: '🏛️', auteur: cr?.redacteur ?? '—', texte: cr?.administration, color: 'oklch(0.48 0.15 300)', soft: 'oklch(0.97 0.02 305)' },
    { role: 'Parents', icon: '👪', auteur: familleDe(studentName), texte: cr?.parents, color: 'oklch(0.52 0.17 5)', soft: 'oklch(0.97 0.02 10)' },
    ...(record.enseignant
      ? [{ role: 'Enseignant', icon: '🧑‍🏫', auteur: record.enseignant, texte: cr?.enseignant, color: 'oklch(0.45 0.13 160)', soft: 'oklch(0.96 0.02 165)' }]
      : []),
  ]
  const decisions = cr?.decisions?.length ? cr.decisions : [FALLBACK_DECISION]
  const signataires = [
    { role: 'Direction / Administration', nom: cr?.redacteur ?? '—' },
    ...(record.enseignant ? [{ role: 'Enseignant', nom: record.enseignant }] : []),
    { role: 'Parent', nom: familleDe(studentName) },
  ]

  return (
    <div
      id="printable-compte-rendu-rdv"
      className="print-page flex flex-col gap-2.5"
      style={{ padding: '26px 40px 22px', background: 'oklch(0.99 0.003 90)', color: INK, fontFamily: 'Helvetica, Arial, sans-serif' }}
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
          <p className="text-[12.5px] font-bold">Compte-rendu de Rendez-vous</p>
          <p className="text-[10px]" style={{ color: MUTED }}>
            Édité le {todayFR()}
          </p>
        </div>
      </header>

      <div className="flex items-center gap-3 rounded-[12px] px-3.5 py-2.5" style={{ background: 'oklch(0.96 0.02 250)' }}>
        <div className="shrink-0 rounded-[10px] bg-white px-3 py-1.5 text-center">
          <div className="text-[8px] uppercase" style={{ letterSpacing: '0.05em', color: 'oklch(0.5 0.01 260)' }}>
            {jourCourt(record.date)}
          </div>
          <div className="text-[17px] font-extrabold leading-[1.05]" style={{ color: 'oklch(0.42 0.12 250)' }}>
            {record.heure}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-extrabold">{studentName}</span>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[9.5px] font-extrabold" style={{ color: 'oklch(0.45 0.12 250)' }}>
              {classe}
            </span>
          </div>
          <div className="text-[10px]" style={{ color: 'oklch(0.45 0.01 260)' }}>
            {dateLongue(record.date)} · {record.duree} min · {MODE_LABEL[record.mode]}
          </div>
        </div>
        <span className="shrink-0 rounded-full px-3 py-[3px] text-[10px] font-extrabold text-white" style={{ background: STATUT_COLOR[record.statut] }}>
          {record.statut}
        </span>
      </div>

      <div className="grid overflow-hidden rounded-[12px] border bg-white" style={{ gridTemplateColumns: 'repeat(4, 1fr)', borderColor: 'oklch(0.91 0.005 90)' }}>
        {champs.map(([label, value], i) => (
          <div key={label} className="px-3 py-2" style={{ borderRight: i < 3 ? '1px solid oklch(0.95 0.005 90)' : 'none' }}>
            <div className="text-[7.5px] font-semibold uppercase" style={{ letterSpacing: '0.05em', color: 'oklch(0.58 0.01 260)' }}>
              {label}
            </div>
            <div className="text-[11px] font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11.5px] font-extrabold">Compte rendu de l'entretien</span>
        <div className="flex-1" />
        <span className="rounded-full px-2.5 py-0.5 text-[9px] font-bold" style={{ background: 'oklch(0.96 0.02 165)', color: 'oklch(0.45 0.13 160)' }}>
          Rédigé par {cr?.redacteur ?? '—'}
        </span>
        <span
          className="rounded-full px-2.5 py-0.5 text-[9px] font-bold"
          style={{
            background: cr?.signeParent ? 'oklch(0.97 0.03 80)' : 'oklch(0.96 0.005 90)',
            color: cr?.signeParent ? 'oklch(0.55 0.14 65)' : 'oklch(0.6 0.01 260)',
          }}
        >
          {cr?.signeParent ? 'Signé par le parent' : 'Non signé par le parent'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-[9px]" style={{ minHeight: 0 }}>
        {avis.map((a) => (
          <div key={a.role} className="flex flex-1 overflow-hidden rounded-[12px]" style={{ minHeight: 0, background: a.soft }}>
            <div className="shrink-0" style={{ width: 6, background: a.color }} />
            <div className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13 }}>{a.icon}</span>
                <span className="text-[10px] font-extrabold uppercase" style={{ letterSpacing: '0.06em', color: a.color }}>
                  {a.role}
                </span>
                <div className="flex-1" />
                <span className="text-[8.5px]" style={{ color: MUTED }}>
                  {a.auteur}
                </span>
              </div>
              <div className="text-[10.5px]" style={{ lineHeight: 1.55, color: 'oklch(0.3 0.01 260)' }}>
                {a.texte?.trim() ? a.texte : '— non renseigné'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
        <div className="px-3.5 py-1.5 text-[10.5px] font-extrabold" style={{ background: 'oklch(0.97 0.02 80)', color: 'oklch(0.5 0.13 65)' }}>
          Décisions &amp; engagements
        </div>
        <div className="flex flex-col gap-[5px] px-3.5 pb-2.5 pt-2">
          {decisions.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: 'oklch(0.6 0.13 65)' }} />
              <span className="flex-1 text-[10px]" style={{ lineHeight: 1.45 }}>
                {d.texte}
              </span>
              <span className="shrink-0 text-[9px] font-bold" style={{ color: 'oklch(0.5 0.01 260)' }}>
                {d.echeance}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-[5px]">
        <div className="text-[9px] font-extrabold uppercase" style={{ letterSpacing: '0.08em', color: 'oklch(0.5 0.01 260)' }}>
          Signatures
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${signataires.length}, 1fr)` }}>
          {signataires.map((sg) => (
            <div
              key={sg.role}
              className="flex flex-col gap-1 rounded-[10px] border bg-white px-3 pb-2 pt-1.5"
              style={{ borderColor: 'oklch(0.91 0.005 90)' }}
            >
              <div className="text-[9.5px] font-bold">{sg.role}</div>
              <div className="text-[8.5px]" style={{ color: 'oklch(0.6 0.01 260)' }}>
                {sg.nom}
              </div>
              <div style={{ height: 26, borderBottom: '1px solid oklch(0.86 0.005 90)' }} />
              <div className="text-[7.5px]" style={{ color: 'oklch(0.62 0.01 260)' }}>
                Signature · Date
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="border-t pt-1.5 text-center text-[8.5px] font-semibold uppercase"
        style={{ borderColor: 'oklch(0.9 0.005 90)', letterSpacing: '0.08em', color: 'oklch(0.62 0.01 260)' }}
      >
        Direction de la Vie Scolaire
      </div>
    </div>
  )
}
