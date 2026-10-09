import { JOUR_LABELS } from '../../data/soutien'
import type { FeuilleClub } from '../../utils/clubsContexte'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import { ACCENT_SOFT, EnTeteClubs, Fait, INK, LIGNES_PAR_BLOC, MUTED, MUTED2, PAGE_STYLE, PiedClubs, RULE, TableauClub, dateLongue, morceaux } from './clubsPrintKit'

const LIGNES_LIBRES = 3
// Les lignes d'une feuille de présence sont plus hautes (on y écrit) : moins de lignes par bloc.
const LIGNES_PAR_PAGE = LIGNES_PAR_BLOC - 4

function Case() {
  return <span className="inline-block h-[13px] w-[13px] rounded-[3px] border-[1.5px] align-middle" style={{ borderColor: MUTED2 }} />
}

function blocsDeLaSeance(f: FeuilleClub, date: string): PaginatedBlock[] {
  const { club } = f
  const blocks: PaginatedBlock[] = [
    {
      key: 'faits',
      node: (
        <div className="grid grid-cols-4 gap-2">
          <Fait label="Séance du" valeur={dateLongue(date)} />
          <Fait label="Heures" valeur={`${club.heureDebut} – ${club.heureFin}`} />
          <Fait label="Encadrant" valeur={f.encadrant} />
          <Fait label="Salle" valeur={f.salle} />
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
    return blocks
  }
  const lignes: ({ type: 'eleve'; studentId: string; name: string; classe: string; numero: number } | { type: 'libre'; numero: number })[] = [
    ...f.inscrits.map((l, i) => ({ type: 'eleve' as const, studentId: l.studentId, name: l.name, classe: l.classe, numero: i + 1 })),
    ...Array.from({ length: LIGNES_LIBRES }, (_, i) => ({ type: 'libre' as const, numero: f.inscrits.length + i + 1 })),
  ]
  morceaux(lignes, LIGNES_PAR_PAGE).forEach((chunk, i) => {
    blocks.push({
      key: `presence-${i}`,
      node: (
        <TableauClub titre="Présence" compteur={`${f.inscrits.length} inscrit${f.inscrits.length !== 1 ? 's' : ''}`} suite={i > 0} head={['N°', 'Élève', 'Classe', 'Présent', 'Absent', 'Observation']}>
          {chunk.map((l) => (
            <tr key={l.type === 'eleve' ? l.studentId : `libre-${l.numero}`} className="border-t" style={{ borderColor: RULE, height: 26 }}>
              <td className="w-8 px-3" style={{ color: MUTED }}>
                {l.numero}
              </td>
              <td className="px-3 font-semibold" style={{ color: l.type === 'eleve' ? INK : MUTED }}>
                {l.type === 'eleve' ? l.name : <span className="font-normal italic">Élève non inscrit présent : ______________________</span>}
              </td>
              <td className="px-3" style={{ color: MUTED2 }}>
                {l.type === 'eleve' ? l.classe : ''}
              </td>
              <td className="w-14 px-3 text-center">
                <Case />
              </td>
              <td className="w-14 px-3 text-center">
                <Case />
              </td>
              <td className="px-3" style={{ borderLeft: `1px solid ${RULE}` }} />
            </tr>
          ))}
        </TableauClub>
      ),
    })
  })
  blocks.push({
    key: 'signature',
    node: (
      <div className="flex items-end justify-between gap-6 pt-2 text-[9.5px]" style={{ color: MUTED2 }}>
        <span>
          Durée réelle de la séance : ____ h ____ min · {JOUR_LABELS[club.jour]} {club.heureDebut} – {club.heureFin} prévu
        </span>
        <span className="w-56 border-t pt-1 text-center" style={{ borderColor: MUTED }}>
          Signature de l'encadrant
        </span>
      </div>
    ),
  })
  return blocks
}

/** Une instance par séance : chaque date commence sur sa propre page. */
function PagesDeLaSeance({ feuille, date }: { feuille: FeuilleClub; date: string }) {
  return (
    <PaginatedPrintDocument
      blocks={blocsDeLaSeance(feuille, date)}
      paddingXPx={44}
      paddingYPx={30}
      gapPx={10}
      pageStyle={PAGE_STYLE}
      renderHeader={(pageIndex) => <EnTeteClubs document="Feuille de présence" objet={feuille.club.nom} pageIndex={pageIndex} />}
      renderFooter={(pageIndex, pageCount) => <PiedClubs libelle={`Clubs — ${feuille.club.nom} — ${date.split('-').reverse().join('/')}`} pageIndex={pageIndex} pageCount={pageCount} />}
    />
  )
}

/** Feuille de présence d'un club : une feuille par séance, avec une colonne de présence à cocher à la main. */
export default function PrintablePresenceSeance({ feuille, dates }: { feuille: FeuilleClub; dates: string[] }) {
  return (
    <>
      {dates.map((d) => (
        <PagesDeLaSeance key={d} feuille={feuille} date={d} />
      ))}
    </>
  )
}
