import SchoolLogo from '../print/SchoolLogo'
import type { BonCommande, BCContext } from '../../data/helpdesk'
import { computeBCTotals } from '../../data/helpdesk'

interface PrintableBonCommandeProps {
  incident: BCContext
  bc: BonCommande
}

const INK = 'oklch(0.24 0.01 260)'
const MUTED = 'oklch(0.55 0.01 260)'
const BLUE = 'oklch(0.42 0.12 250)'

function todayFR(): string {
  return new Date().toLocaleDateString('fr-FR')
}

/** Format marocain : virgule décimale, devise DH (ex. "96,00 DH"). */
function formatDH(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} DH`
}

/** Ni Incident ni Demande n'ont de code de référence lisible (seulement un id UUID) — dérivée du
 * vrai id persistant + année de dateSignalement, pas un compteur fabriqué. Même technique que la
 * référence de Sortie Anticipée (Phase 19). */
function refRattachee(ctx: BCContext): string {
  const year = ctx.dateSignalement?.slice(0, 4) || new Date().getFullYear().toString()
  return `REF-${year}-${ctx.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

/** Dérivée du vrai historique (BCModal.tsx pousse exactement cette action à la validation) — pas
 * un champ stocké séparément. */
function dateValidation(bc: BonCommande, historique: BCContext['historique']): string | null {
  if (bc.statut !== 'VALIDE') return null
  const entry = historique.find((h) => h.action === 'Bon de commande validé par Direction')
  return entry ? new Date(entry.date).toLocaleDateString('fr-FR') : null
}

export default function PrintableBonCommande({ incident, bc }: PrintableBonCommandeProps) {
  const { sousTotalHT, tvaCumulee, totalTTC } = computeBCTotals(bc)
  const filledLignes = bc.lignes.filter((l) => l.designation.trim() !== '')
  const validatedOn = dateValidation(bc, incident.historique)

  const intervention: [string, string][] = [
    ['Type d’intervenant', bc.typeIntervenant || '— non renseigné'],
    ['Prestataire', bc.prestataireNom || '— non renseigné'],
    ['Contact prestataire', bc.prestataireContact || '— non renseigné'],
    ['Demandé par', incident.declarant || '— non renseigné'],
  ]

  const conditions: [string, string, boolean][] = [
    ['Mode de paiement', bc.modePaiement, bc.modePaiement !== 'Non défini'],
    ['Date d’intervention', bc.dateIntervention || '— non renseignée', !!bc.dateIntervention],
    ['Garantie', bc.garantieRemarques || '— non renseignée', !!bc.garantieRemarques],
  ]

  const tracabilite: [string, string][] = [
    ['N° de bon', bc.numero],
    ['Réf. rattachée', refRattachee(incident)],
    ['Imputation', bc.imputation || '— non renseignée'],
    ['Validé le', validatedOn || '— non renseigné'],
  ]

  return (
    <div
      id="printable-bon-commande"
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
          <p className="text-[12.5px] font-bold">Bon de Commande {bc.numero}</p>
          <p className="text-[10px]" style={{ color: MUTED }}>
            Édité le {todayFR()}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-0.5 rounded-[12px] px-3.5 py-2.5" style={{ background: 'oklch(0.96 0.02 250)' }}>
        <div className="text-center text-[8px] font-extrabold uppercase" style={{ letterSpacing: '0.06em', color: BLUE }}>
          Objet de l'intervention
        </div>
        <div className="text-center text-[17px] font-extrabold">{incident.titre}</div>
        <div className="text-center text-[10px]" style={{ color: 'oklch(0.45 0.01 260)' }}>
          {incident.lieu || '— non renseigné'} · intervention du {bc.dateIntervention || '— non renseignée'}
        </div>
      </div>

      <div className="grid overflow-hidden rounded-[12px] border bg-white" style={{ gridTemplateColumns: 'repeat(4, 1fr)', borderColor: 'oklch(0.91 0.005 90)' }}>
        {intervention.map(([label, value], i) => (
          <div key={label} className="px-3 py-2" style={{ borderRight: i < 3 ? '1px solid oklch(0.95 0.005 90)' : 'none' }}>
            <div className="text-center text-[7.5px] font-semibold uppercase" style={{ letterSpacing: '0.05em', color: 'oklch(0.58 0.01 260)' }}>
              {label}
            </div>
            <div className="text-center text-[11.5px] font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
        <div className="px-3.5 py-1.5 text-center text-[11px] font-extrabold" style={{ background: 'oklch(0.97 0.012 250)', color: BLUE }}>
          Articles &amp; prestations
        </div>
        <div
          className="px-3.5 py-1.5 text-[8px] font-extrabold uppercase"
          style={{ display: 'grid', gridTemplateColumns: '96px 1fr 54px 82px 82px 92px', letterSpacing: '0.05em', color: 'oklch(0.45 0.01 260)', borderBottom: '1.3px solid oklch(0.9 0.005 90)' }}
        >
          <span>Catégorie</span>
          <span>Désignation</span>
          <span>Qté</span>
          <span>P.U. HT</span>
          <span>Régime</span>
          <span className="text-right">Montant HT</span>
        </div>
        {filledLignes.length === 0 ? (
          <p className="px-3.5 py-3 text-center text-[10px] italic" style={{ color: MUTED }}>
            Aucun article renseigné.
          </p>
        ) : (
          filledLignes.map((l) => (
            <div
              key={l.id}
              className="items-center px-3.5 text-[11px]"
              style={{ display: 'grid', gridTemplateColumns: '96px 1fr 54px 82px 82px 92px', height: 32, borderBottom: '1px solid oklch(0.94 0.005 90)' }}
            >
              <span style={{ color: 'oklch(0.45 0.01 260)' }}>{l.categorie}</span>
              <span className="font-bold">{l.designation}</span>
              <span>
                {l.quantite} {l.unite}
              </span>
              <span>{formatDH(l.puHT)}</span>
              <span style={{ color: 'oklch(0.5 0.01 260)' }}>{l.regimeTVA}</span>
              <span className="text-right font-extrabold">{formatDH(l.quantite * l.puHT)}</span>
            </div>
          ))
        )}
        <div className="flex justify-end px-3.5 pb-2.5 pt-2" style={{ borderTop: '1px solid oklch(0.94 0.005 90)' }}>
          <div className="flex flex-col gap-1" style={{ width: 286 }}>
            {[
              ['Sous-total HT', formatDH(sousTotalHT)],
              ['TVA cumulée', formatDH(tvaCumulee)],
              ['Transport & manutention', formatDH(bc.transportManutention)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-[10.5px]" style={{ color: 'oklch(0.45 0.01 260)' }}>
                <span>{label}</span>
                <span className="font-bold" style={{ color: 'oklch(0.3 0.01 260)' }}>
                  {value}
                </span>
              </div>
            ))}
            <div className="flex items-baseline justify-between pt-1.5" style={{ borderTop: '1.5px solid ' + INK }}>
              <span className="text-[11.5px] font-extrabold">Total net TTC</span>
              <span className="text-[16px] font-extrabold" style={{ color: BLUE }}>
                {formatDH(totalTTC)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid overflow-hidden rounded-[12px] border bg-white" style={{ gridTemplateColumns: 'repeat(3, 1fr)', borderColor: 'oklch(0.91 0.005 90)' }}>
        {conditions.map(([label, value, isSet], i) => (
          <div key={label} className="px-3 py-2" style={{ borderRight: i < 2 ? '1px solid oklch(0.95 0.005 90)' : 'none' }}>
            <div className="text-center text-[7.5px] font-semibold uppercase" style={{ letterSpacing: '0.05em', color: 'oklch(0.58 0.01 260)' }}>
              {label}
            </div>
            <div className="text-center text-[11.5px] font-bold" style={{ color: isSet ? INK : 'oklch(0.6 0.01 260)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[12px] border" style={{ borderColor: 'oklch(0.93 0.005 90)', background: 'oklch(0.985 0.003 90)' }}>
        <div
          className="px-3.5 py-1.5 text-center text-[9px] font-extrabold uppercase"
          style={{ letterSpacing: '0.06em', color: 'oklch(0.5 0.01 260)', borderBottom: '1px solid oklch(0.94 0.005 90)' }}
        >
          Traçabilité
        </div>
        <div className="grid gap-x-4 gap-y-1 px-3.5 py-2.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {tracabilite.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-2">
              <span className="text-[9px]" style={{ color: 'oklch(0.55 0.01 260)' }}>
                {label}
              </span>
              <span className="text-right text-[10px] font-bold">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <div className="flex flex-1 flex-col overflow-hidden rounded-[12px] border bg-white" style={{ borderColor: 'oklch(0.91 0.005 90)' }}>
          <div className="px-3.5 py-1.5 text-[10.5px] font-extrabold" style={{ background: 'oklch(0.97 0.012 250)', color: BLUE }}>
            Remarques
          </div>
          <div className="flex flex-col px-3.5 pb-2.5 pt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 29, borderBottom: '1px solid oklch(0.93 0.005 90)' }} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 rounded-[10px] border bg-white px-3.5 pb-2.5 pt-2" style={{ width: 290, flexShrink: 0, borderColor: 'oklch(0.91 0.005 90)' }}>
          <div className="text-center text-[10.5px] font-bold">Signature et cachet de l'établissement</div>
          <div className="text-center text-[9px]" style={{ color: 'oklch(0.6 0.01 260)' }}>
            Direction de la Vie Scolaire
          </div>
          <div style={{ height: 84, borderBottom: '1px solid oklch(0.86 0.005 90)' }} />
          <div className="text-[8px]" style={{ color: 'oklch(0.62 0.01 260)' }}>
            Signature · Cachet · Date
          </div>
        </div>
      </div>

      <div className="flex justify-between border-t pt-1.5 text-[8.5px]" style={{ borderColor: 'oklch(0.9 0.005 90)', color: 'oklch(0.62 0.01 260)' }}>
        <span className="font-semibold uppercase" style={{ letterSpacing: '0.08em' }}>
          Direction de la Vie Scolaire
        </span>
        <span>Bon de commande {bc.numero} · Page 1 / 1</span>
      </div>
    </div>
  )
}
