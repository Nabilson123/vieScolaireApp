import { formatDH, joursEntre, libelleMois, type ImpayeFamille } from '../../utils/clubsFinance'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import { ACCENT, ACCENT_SOFT, EnTeteClubs, Fait, GREEN, HEAD_BG, INK, LIGNES_PAR_BLOC, MUTED, MUTED2, PAGE_STYLE, PiedClubs, RED, RULE, TableauClub, dateCourte, morceaux } from './clubsPrintKit'

function blocsImpayes(impayes: ImpayeFamille[], aujourdhui: string): PaginatedBlock[] {
  const total = impayes.reduce((n, f) => n + f.resteCentimes, 0)
  const plusAncien = impayes.reduce((min, f) => (min === '' || f.plusAncienneEcheance < min ? f.plusAncienneEcheance : min), '')
  const blocks: PaginatedBlock[] = [
    {
      key: 'faits',
      node: (
        <div className="grid grid-cols-4 gap-2">
          <Fait label="Situation au" valeur={dateCourte(aujourdhui)} />
          <Fait label="Familles en retard" valeur={String(impayes.length)} />
          <Fait label="Total dû en retard" valeur={formatDH(total)} />
          <Fait label="Plus ancien retard" valeur={plusAncien ? `${joursEntre(plusAncien, aujourdhui)} jours (${dateCourte(plusAncien)})` : '—'} />
        </div>
      ),
    },
  ]
  if (impayes.length === 0) {
    blocks.push({
      key: 'vide',
      node: (
        <div className="rounded-[10px] border px-3.5 py-3 text-[10px] font-semibold" style={{ borderColor: ACCENT_SOFT, color: GREEN }}>
          Aucune mensualité n'est en retard : toutes les familles sont à jour.
        </div>
      ),
    })
    return blocks
  }
  impayes.forEach((f) => {
    morceaux(f.lignes, LIGNES_PAR_BLOC).forEach((chunk, i) => {
      blocks.push({
        key: `${f.familleCle}-${i}`,
        node: (
          <TableauClub titre={f.familleLibelle} compteur={`${formatDH(f.resteCentimes)} · ${f.joursRetardMax} j de retard`} suite={i > 0} head={['Élève', 'Classe', 'Club', 'Mois', 'Échéance', 'Reste dû']} couleur={RED} bordure={RULE}>
            {chunk.map((l) => (
              <tr key={l.echeanceId} className="border-t" style={{ borderColor: RULE }}>
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
                <td className="px-3 py-1" style={{ color: MUTED2 }}>
                  {dateCourte(l.dateEcheance)}
                </td>
                <td className="px-3 py-1 text-right font-semibold" style={{ color: RED }}>
                  {formatDH(l.resteCentimes)}
                </td>
              </tr>
            ))}
          </TableauClub>
        ),
      })
    })
  })
  blocks.push({
    key: 'total',
    node: (
      <div className="flex items-center justify-between rounded-[10px] border-2 px-3.5 py-2" style={{ borderColor: ACCENT, background: HEAD_BG }}>
        <span className="text-[10px] font-bold uppercase tracking-[0.04em]" style={{ color: INK }}>
          Total général dû en retard ({impayes.length} famille{impayes.length > 1 ? 's' : ''})
        </span>
        <span className="text-[13px] font-extrabold" style={{ color: RED }}>
          {formatDH(total)}
        </span>
      </div>
    ),
  })
  blocks.push({
    key: 'mention',
    node: (
      <p className="text-[8.5px] italic" style={{ color: MUTED }}>
        Document interne à la vie scolaire. Une mensualité est en retard lorsque son échéance et le délai de grâce du club sont dépassés.
      </p>
    ),
  })
  return blocks
}

/** État des impayés des clubs : les familles en retard, leurs mensualités (élève, club, mois) et le total dû. */
export default function PrintableEtatImpayes({ impayes, aujourdhui, portee }: { impayes: ImpayeFamille[]; aujourdhui: string; portee: string }) {
  return (
    <PaginatedPrintDocument
      blocks={blocsImpayes(impayes, aujourdhui)}
      paddingXPx={44}
      paddingYPx={30}
      gapPx={10}
      pageStyle={PAGE_STYLE}
      renderHeader={(pageIndex) => <EnTeteClubs document="État des impayés — Clubs" objet={portee} pageIndex={pageIndex} />}
      renderFooter={(pageIndex, pageCount) => <PiedClubs libelle={`Clubs — impayés — ${portee}`} pageIndex={pageIndex} pageCount={pageCount} />}
    />
  )
}
