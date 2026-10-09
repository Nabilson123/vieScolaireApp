import { formatDH, libelleMois, type BilanClub, type BilanMois } from '../../utils/clubsFinance'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import { ACCENT, ACCENT_SOFT, AMBER, EnTeteClubs, Fait, GREEN, HEAD_BG, INK, MUTED, MUTED2, PAGE_STYLE, PiedClubs, RED, RULE, TableauClub, dateCourte } from './clubsPrintKit'

const taux = (t: number | null) => (t === null ? '—' : `${t} %`)
const couleurTaux = (t: number | null) => (t === null ? MUTED2 : t >= 90 ? GREEN : t >= 60 ? AMBER : RED)

function Ligne({ libelle, b, gras = false }: { libelle: string; b: Pick<BilanMois, 'attenduCentimes' | 'encaisseCentimes' | 'resteCentimes' | 'tauxPct'>; gras?: boolean }) {
  return (
    <tr className={gras ? 'border-t-2' : 'border-t'} style={{ borderColor: gras ? ACCENT : RULE, background: gras ? HEAD_BG : undefined }}>
      <td className={`px-3 py-1 ${gras ? 'font-extrabold uppercase' : 'font-semibold'}`} style={{ color: INK }}>
        {libelle}
      </td>
      <td className="px-3 py-1 text-right" style={{ color: INK }}>
        {formatDH(b.attenduCentimes)}
      </td>
      <td className="px-3 py-1 text-right" style={{ color: GREEN }}>
        {formatDH(b.encaisseCentimes)}
      </td>
      <td className="px-3 py-1 text-right font-semibold" style={{ color: b.resteCentimes > 0 ? RED : MUTED2 }}>
        {formatDH(b.resteCentimes)}
      </td>
      <td className="px-3 py-1 text-right font-bold" style={{ color: couleurTaux(b.tauxPct) }}>
        {taux(b.tauxPct)}
      </td>
    </tr>
  )
}

const ENTETES = ['Mois', 'Attendu', 'Encaissé', 'Reste', 'Recouvrement']

function blocsDuClub(c: BilanClub, aujourdhui: string): PaginatedBlock[] {
  return [
    {
      key: 'faits',
      node: (
        <div className="grid grid-cols-4 gap-2">
          <Fait label="Situation au" valeur={dateCourte(aujourdhui)} />
          <Fait label="Attendu sur la période" valeur={formatDH(c.total.attenduCentimes)} />
          <Fait label="Encaissé" valeur={formatDH(c.total.encaisseCentimes)} />
          <Fait label="Taux de recouvrement" valeur={taux(c.total.tauxPct)} />
        </div>
      ),
    },
    {
      key: 'mois',
      node: (
        <TableauClub titre="Bilan par mois de facturation" compteur={`${c.mois.length} mois`} suite={false} head={ENTETES}>
          {c.mois.map((m) => (
            <Ligne key={m.mois} libelle={libelleMois(m.mois)} b={m} />
          ))}
          <Ligne libelle="Total" b={c.total} gras />
        </TableauClub>
      ),
    },
    {
      key: 'mention',
      node: (
        <p className="text-[8.5px] italic" style={{ color: MUTED }}>
          Chaque paiement est compté dans le mois qu'il règle (et non le jour où il a été encaissé). Les mensualités des élèves exonérés sont à 0 et n'entrent pas dans l'attendu.
        </p>
      ),
    },
  ]
}

function PagesDuClub({ club, aujourdhui }: { club: BilanClub; aujourdhui: string }) {
  return (
    <PaginatedPrintDocument
      blocks={blocsDuClub(club, aujourdhui)}
      paddingXPx={44}
      paddingYPx={30}
      gapPx={12}
      pageStyle={PAGE_STYLE}
      renderHeader={(pageIndex) => <EnTeteClubs document="Bilan mensuel du club" objet={club.clubNom} pageIndex={pageIndex} />}
      renderFooter={(pageIndex, pageCount) => <PiedClubs libelle={`Clubs — bilan — ${club.clubNom}`} pageIndex={pageIndex} pageCount={pageCount} />}
    />
  )
}

function PageRecapitulative({ bilans, aujourdhui }: { bilans: BilanClub[]; aujourdhui: string }) {
  const somme = bilans.reduce(
    (t, c) => ({ attenduCentimes: t.attenduCentimes + c.total.attenduCentimes, encaisseCentimes: t.encaisseCentimes + c.total.encaisseCentimes, resteCentimes: t.resteCentimes + c.total.resteCentimes }),
    { attenduCentimes: 0, encaisseCentimes: 0, resteCentimes: 0 },
  )
  const total = { ...somme, tauxPct: somme.attenduCentimes > 0 ? Math.round((somme.encaisseCentimes / somme.attenduCentimes) * 100) : null }
  const blocks: PaginatedBlock[] = [
    {
      key: 'faits',
      node: (
        <div className="grid grid-cols-4 gap-2">
          <Fait label="Situation au" valeur={dateCourte(aujourdhui)} />
          <Fait label="Attendu" valeur={formatDH(total.attenduCentimes)} />
          <Fait label="Encaissé" valeur={formatDH(total.encaisseCentimes)} />
          <Fait label="Taux de recouvrement" valeur={taux(total.tauxPct)} />
        </div>
      ),
    },
    {
      key: 'clubs',
      node: (
        <TableauClub titre="Tous les clubs" compteur={`${bilans.length} club${bilans.length > 1 ? 's' : ''}`} suite={false} head={['Club', 'Attendu', 'Encaissé', 'Reste', 'Recouvrement']} bordure={ACCENT_SOFT}>
          {bilans.map((c) => (
            <Ligne key={c.clubId} libelle={c.clubNom} b={c.total} />
          ))}
          <Ligne libelle="Total" b={total} gras />
        </TableauClub>
      ),
    },
  ]
  return (
    <PaginatedPrintDocument
      blocks={blocks}
      paddingXPx={44}
      paddingYPx={30}
      gapPx={12}
      pageStyle={PAGE_STYLE}
      renderHeader={(pageIndex) => <EnTeteClubs document="Bilan des clubs" objet="Récapitulatif" pageIndex={pageIndex} />}
      renderFooter={(pageIndex, pageCount) => <PiedClubs libelle="Clubs — bilan — récapitulatif" pageIndex={pageIndex} pageCount={pageCount} />}
    />
  )
}

/** Bilan mensuel des clubs : un récapitulatif de tous les clubs, puis une page par club (attendu, encaissé, reste et taux par mois). */
export default function PrintableBilanMensuel({ bilans, aujourdhui }: { bilans: BilanClub[]; aujourdhui: string }) {
  return (
    <>
      {bilans.length > 1 && <PageRecapitulative bilans={bilans} aujourdhui={aujourdhui} />}
      {bilans.map((c) => (
        <PagesDuClub key={c.clubId} club={c} aujourdhui={aujourdhui} />
      ))}
    </>
  )
}
