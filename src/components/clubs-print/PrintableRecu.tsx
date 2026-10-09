import { MODE_REGLEMENT_LABELS } from '../../data/clubs'
import type { DonneesRecu } from '../../utils/clubsContexte'
import { formatDH, libelleMois } from '../../utils/clubsFinance'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import { ACCENT, ACCENT_SOFT, AMBER, EnTeteClubs, Fait, GREEN, HEAD_BG, INK, MUTED, MUTED2, PAGE_STYLE, PiedClubs, RED, RULE, TableauClub, dateCourte } from './clubsPrintKit'

const capitaliser = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

function blocsDuRecu(d: DonneesRecu): PaginatedBlock[] {
  const { reglement: r } = d
  const annule = r.statut === 'annule'
  // Une mensualité supprimée après l'annulation du règlement (mois d'après l'arrêt de l'élève) n'a plus de ligne : on garde le total cohérent.
  const ecart = r.montantCentimes - d.lignes.reduce((n, l) => n + l.montantCentimes, 0)
  const blocks: PaginatedBlock[] = []

  if (annule) {
    blocks.push({
      key: 'annule',
      node: (
        <div className="rounded-[10px] border-2 px-3.5 py-2.5 text-center" style={{ borderColor: RED, color: RED }}>
          <p className="text-[15px] font-extrabold uppercase tracking-[0.12em]">Reçu annulé{r.annuleLe ? ` le ${dateCourte(r.annuleLe.slice(0, 10))}` : ''}</p>
          {r.motifAnnulation && <p className="mt-0.5 text-[10px] font-semibold">Motif : {r.motifAnnulation}</p>}
          <p className="mt-0.5 text-[9px]">Ce reçu n'a plus de valeur : les mensualités ci-dessous ne sont plus considérées comme payées.</p>
        </div>
      ),
    })
  }

  blocks.push({
    key: 'faits',
    node: (
      <div className="grid grid-cols-4 gap-2">
        <Fait label="Famille" valeur={r.familleLibelle} />
        <Fait label="Date du règlement" valeur={dateCourte(r.dateReglement)} />
        <Fait label="Mode de paiement" valeur={`${MODE_REGLEMENT_LABELS[r.mode]}${r.reference ? ` — ${r.reference}` : ''}`} />
        <Fait label="Montant reçu" valeur={formatDH(r.montantCentimes)} />
      </div>
    ),
  })

  blocks.push({
    key: 'detail',
    node: (
      <TableauClub titre="Détail du règlement" compteur={`${d.lignes.length} mensualité${d.lignes.length !== 1 ? 's' : ''}`} suite={false} head={['Élève', 'Classe', 'Club', 'Mois', 'Montant']}>
        {d.lignes.map((l, i) => (
          <tr key={i} className="border-t" style={{ borderColor: RULE, textDecoration: annule ? 'line-through' : undefined, opacity: annule ? 0.6 : 1 }}>
            <td className="px-3 py-1 font-semibold" style={{ color: INK }}>
              {l.studentNom}
            </td>
            <td className="px-3 py-1" style={{ color: MUTED2 }}>
              {l.classe}
            </td>
            <td className="px-3 py-1" style={{ color: INK }}>
              {l.clubNom}
            </td>
            <td className="px-3 py-1" style={{ color: MUTED2 }}>
              {libelleMois(l.mois)}
            </td>
            <td className="px-3 py-1 text-right font-semibold" style={{ color: INK }}>
              {formatDH(l.montantCentimes)}
            </td>
          </tr>
        ))}
        {annule && ecart > 0 && (
          <tr className="border-t" style={{ borderColor: RULE, textDecoration: 'line-through', opacity: 0.6 }}>
            <td colSpan={4} className="px-3 py-1 italic" style={{ color: MUTED2 }}>
              Mensualité(s) supprimée(s) depuis (mois suivant l'arrêt de l'élève)
            </td>
            <td className="px-3 py-1 text-right font-semibold" style={{ color: INK }}>
              {formatDH(ecart)}
            </td>
          </tr>
        )}
        <tr className="border-t-2" style={{ borderColor: ACCENT, background: HEAD_BG }}>
          <td colSpan={4} className="px-3 py-1.5 text-right text-[10px] font-bold uppercase tracking-[0.04em]" style={{ color: INK }}>
            Total
          </td>
          <td className="px-3 py-1.5 text-right text-[11px] font-extrabold" style={{ color: INK }}>
            {formatDH(r.montantCentimes)}
          </td>
        </tr>
      </TableauClub>
    ),
  })

  blocks.push({
    key: 'lettres',
    node: (
      <div className="rounded-[10px] border px-3.5 py-2.5" style={{ borderColor: ACCENT_SOFT }}>
        <p className="text-[8px] font-bold uppercase tracking-[0.05em]" style={{ color: MUTED }}>
          Arrêté le présent reçu à la somme de
        </p>
        <p className="mt-0.5 text-[12px] font-bold" style={{ color: INK }}>
          {capitaliser(d.enLettres)}
        </p>
      </div>
    ),
  })

  if (!annule) {
    blocks.push({
      key: 'solde',
      node: (
        <div>
          <div className="flex items-center gap-2 rounded-t-lg px-3.5 py-[5px] text-white" style={{ background: d.resteEchuTotalCentimes > 0 ? AMBER : GREEN }}>
            <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.04em]">Solde restant après ce règlement</span>
            <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: 'rgba(255,255,255,0.25)' }}>
              {d.resteEchuTotalCentimes > 0 ? `${formatDH(d.resteEchuTotalCentimes)} à ce jour` : 'Rien à ce jour'}
            </span>
          </div>
          <div className="overflow-hidden rounded-b-[10px] border" style={{ borderColor: RULE }}>
            {d.soldeParClub.length === 0 ? (
              <p className="px-3.5 py-2 text-[9.5px]" style={{ color: MUTED }}>
                Aucune autre mensualité n'est enregistrée pour cette famille.
              </p>
            ) : (
              <table className="w-full border-collapse text-[9.5px]">
                <thead>
                  <tr className="text-left font-bold uppercase tracking-[0.03em]" style={{ background: HEAD_BG, color: 'oklch(0.5 0.01 260)' }}>
                    <th className="px-3 py-1 text-[8px] font-bold">Club</th>
                    <th className="px-3 py-1 text-right text-[8px] font-bold">Reste dû à ce jour</th>
                    <th className="px-3 py-1 text-right text-[8px] font-bold">Mensualités à venir</th>
                  </tr>
                </thead>
                <tbody>
                  {d.soldeParClub.map((s) => (
                    <tr key={s.clubNom} className="border-t" style={{ borderColor: RULE }}>
                      <td className="px-3 py-1 font-semibold" style={{ color: INK }}>
                        {s.clubNom}
                      </td>
                      <td className="px-3 py-1 text-right font-semibold" style={{ color: s.resteEchuCentimes > 0 ? AMBER : GREEN }}>
                        {formatDH(s.resteEchuCentimes)}
                      </td>
                      <td className="px-3 py-1 text-right" style={{ color: MUTED2 }}>
                        {formatDH(s.resteAVenirCentimes)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2" style={{ borderColor: ACCENT, background: HEAD_BG }}>
                    <td className="px-3 py-1 text-[10px] font-bold uppercase" style={{ color: INK }}>
                      Total
                    </td>
                    <td className="px-3 py-1 text-right font-extrabold" style={{ color: INK }}>
                      {formatDH(d.resteEchuTotalCentimes)}
                    </td>
                    <td className="px-3 py-1 text-right font-bold" style={{ color: MUTED2 }}>
                      {formatDH(d.resteAVenirTotalCentimes)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      ),
    })
  }

  blocks.push({
    key: 'mention',
    node: (
      <p className="text-[8.5px] italic" style={{ color: MUTED }}>
        Reçu à conserver. Les mensualités des clubs sont dues le jour d'échéance de chaque mois ; un règlement paie d'abord les mois les plus anciens.
      </p>
    ),
  })
  return blocks
}

/** Reçu de paiement des clubs : numéro, détail par élève, club et mois, montant en lettres et solde restant. */
export default function PrintableRecu({ recu }: { recu: DonneesRecu }) {
  return (
    <PaginatedPrintDocument
      blocks={blocsDuRecu(recu)}
      paddingXPx={44}
      paddingYPx={30}
      gapPx={12}
      pageStyle={PAGE_STYLE}
      renderHeader={(pageIndex) => <EnTeteClubs document="Reçu de paiement — Clubs" objet={recu.reglement.numero} pageIndex={pageIndex} />}
      renderFooter={(pageIndex, pageCount) => <PiedClubs libelle={`Reçu ${recu.reglement.numero}`} pageIndex={pageIndex} pageCount={pageCount} />}
    />
  )
}
