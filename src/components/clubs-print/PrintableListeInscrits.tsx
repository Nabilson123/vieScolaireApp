import { libelleClub } from '../../data/clubs'
import { libelleSeances } from '../../utils/clubs'
import type { FeuilleClub } from '../../utils/clubsContexte'
import { formatDH, libelleMois } from '../../utils/clubsFinance'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import { ACCENT_SOFT, EnTeteClubs, Fait, HEAD_BG, INK, LIGNES_PAR_BLOC, MUTED, MUTED2, PAGE_STYLE, PiedClubs, RULE, TableauClub, dateCourte, morceaux } from './clubsPrintKit'

function blocsDuClub(f: FeuilleClub): PaginatedBlock[] {
  const { club } = f
  const blocks: PaginatedBlock[] = [
    {
      key: 'faits',
      node: (
        <div className="grid grid-cols-4 gap-2">
          <Fait label={club.seances.length > 1 ? 'Séances' : 'Jour et heures'} valeur={libelleSeances(club)} />
          <Fait label="Encadrant" valeur={f.encadrant} />
          <Fait label="Salle" valeur={f.salle} />
          <Fait label="Places" valeur={club.placesMax === null ? `${f.inscrits.length} inscrits (illimité)` : `${f.inscrits.length} / ${club.placesMax}`} />
          <div className="col-span-4 text-[9.5px]" style={{ color: MUTED2 }}>
            Période : de {libelleMois(club.moisDebut)} à {libelleMois(club.moisFin)} · Mensualité : {formatDH(club.mensualiteCentimes)}
            {club.niveaux.length > 0 && <> · Niveaux : {club.niveaux.join(', ')}</>}
          </div>
          {club.description && (
            <div className="col-span-4 rounded-lg px-3 py-1.5 text-[9.5px]" style={{ background: HEAD_BG, color: INK }}>
              {club.description}
            </div>
          )}
        </div>
      ),
    },
  ]

  if (f.inscrits.length === 0) {
    blocks.push({
      key: 'vide',
      node: (
        <div className="rounded-[10px] border px-3.5 py-3 text-[10px]" style={{ borderColor: ACCENT_SOFT, color: MUTED }}>
          Aucun élève n'est inscrit à ce club pour le moment.
        </div>
      ),
    })
  }
  morceaux(f.inscrits, LIGNES_PAR_BLOC).forEach((chunk, i) => {
    blocks.push({
      key: `inscrits-${i}`,
      node: (
        <TableauClub titre="Élèves inscrits" compteur={`${f.inscrits.length} élève${f.inscrits.length !== 1 ? 's' : ''}`} suite={i > 0} head={['N°', 'Élève', 'Classe', 'Inscrit le']}>
          {chunk.map((l, j) => (
            <tr key={l.studentId} className="border-t" style={{ borderColor: RULE }}>
              <td className="w-8 px-3 py-1" style={{ color: MUTED }}>
                {i * LIGNES_PAR_BLOC + j + 1}
              </td>
              <td className="px-3 py-1 font-semibold" style={{ color: INK }}>
                {l.name}
              </td>
              <td className="px-3 py-1" style={{ color: MUTED2 }}>
                {l.classe}
              </td>
              <td className="px-3 py-1" style={{ color: MUTED2 }}>
                {dateCourte(l.dateInscription)}
              </td>
            </tr>
          ))}
        </TableauClub>
      ),
    })
  })

  morceaux(f.attente, LIGNES_PAR_BLOC).forEach((chunk, i) => {
    blocks.push({
      key: `attente-${i}`,
      node: (
        <TableauClub titre="Liste d'attente" compteur={`${f.attente.length} élève${f.attente.length !== 1 ? 's' : ''}`} suite={i > 0} head={['Rang', 'Élève', 'Classe', 'Demande du']} couleur={MUTED2} bordure={RULE}>
          {chunk.map((l, j) => (
            <tr key={l.studentId} className="border-t" style={{ borderColor: RULE }}>
              <td className="w-8 px-3 py-1" style={{ color: MUTED }}>
                {i * LIGNES_PAR_BLOC + j + 1}
              </td>
              <td className="px-3 py-1 font-semibold" style={{ color: INK }}>
                {l.name}
              </td>
              <td className="px-3 py-1" style={{ color: MUTED2 }}>
                {l.classe}
              </td>
              <td className="px-3 py-1" style={{ color: MUTED2 }}>
                {dateCourte(l.dateInscription)}
              </td>
            </tr>
          ))}
        </TableauClub>
      ),
    })
  })
  return blocks
}

/** Une instance de `PaginatedPrintDocument` par club : chaque club commence sur sa propre page et garde son en-tête sur ses pages de suite. */
function PagesDuClub({ feuille }: { feuille: FeuilleClub }) {
  return (
    <PaginatedPrintDocument
      blocks={blocsDuClub(feuille)}
      paddingXPx={44}
      paddingYPx={30}
      gapPx={10}
      pageStyle={PAGE_STYLE}
      renderHeader={(pageIndex) => <EnTeteClubs document="Liste des inscrits" objet={libelleClub(feuille.club)} pageIndex={pageIndex} />}
      renderFooter={(pageIndex, pageCount) => <PiedClubs libelle={`Clubs — ${libelleClub(feuille.club)}`} pageIndex={pageIndex} pageCount={pageCount} />}
    />
  )
}

/** Liste des élèves inscrits à chaque club (et de ceux qui attendent une place) : une page, ou plus, par club. */
export default function PrintableListeInscrits({ feuilles }: { feuilles: FeuilleClub[] }) {
  return (
    <>
      {feuilles.map((f) => (
        <PagesDuClub key={f.club.id} feuille={f} />
      ))}
    </>
  )
}
