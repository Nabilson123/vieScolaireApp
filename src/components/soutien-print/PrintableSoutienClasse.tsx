import type { ReactNode } from 'react'
import { JOUR_LABELS, statutSoutienLabel, type StatutSoutien } from '../../data/soutien'
import type { RapportClasse, RapportSoutienLigne, RapportSortieLigne, RapportTransportLigne } from '../../utils/soutien'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import SchoolLogo from '../print/SchoolLogo'

const INK = 'oklch(0.24 0.01 260)'
const MUTED = 'oklch(0.55 0.01 260)'
const MUTED2 = 'oklch(0.45 0.01 260)'
const RULE = 'oklch(0.93 0.005 90)'
const HEAD_BG = 'oklch(0.96 0.005 264)'

const TRANSPORT = { color: 'oklch(0.5 0.15 255)', soft: 'oklch(0.9 0.04 255)' }
const SORTIE = { color: 'oklch(0.5 0.12 160)', soft: 'oklch(0.9 0.05 160)' }
const SOUTIEN = { color: 'oklch(0.5 0.2 295)', soft: 'oklch(0.9 0.05 295)' }
const RED = 'oklch(0.55 0.2 25)'
const AMBER = 'oklch(0.5 0.14 60)'
const GREEN = 'oklch(0.45 0.14 160)'

/** Nombre de lignes d'un tableau avant de le continuer (avec son titre répété) sur la page suivante. */
const LIGNES_PAR_BLOC = 14

const STATUT_COULEUR: Record<StatutSoutien, string> = { a_confirmer: AMBER, reste: GREEN, ne_reste_pas: MUTED2 }

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

function morceaux<T>(liste: T[], taille: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille))
  return out
}

function SectionTable({ titre, theme, count, suite, head, children }: { titre: string; theme: { color: string; soft: string }; count: number; suite: boolean; head: string[]; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 rounded-t-lg px-3.5 py-[5px] text-white" style={{ background: theme.color }}>
        <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.04em]">
          {titre}
          {suite ? ' (suite)' : ''}
        </span>
        <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: 'rgba(255,255,255,0.25)' }}>
          {count} élève{count !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="overflow-hidden rounded-b-[10px] border" style={{ borderColor: theme.soft }}>
        <table className="w-full border-collapse text-[9.5px]">
          <thead>
            <tr className="text-left font-bold uppercase tracking-[0.03em]" style={{ background: HEAD_BG, color: 'oklch(0.5 0.01 260)' }}>
              {head.map((h) => (
                <th key={h} className="px-3 py-1 text-[8px] font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

function Vide({ titre, theme, texte }: { titre: string; theme: { color: string; soft: string }; texte: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 rounded-t-lg px-3.5 py-[5px] text-white" style={{ background: theme.color }}>
        <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.04em]">{titre}</span>
        <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: 'rgba(255,255,255,0.25)' }}>
          0 élève
        </span>
      </div>
      <div className="rounded-b-[10px] border px-3.5 py-2 text-[9.5px]" style={{ borderColor: theme.soft, color: MUTED }}>
        {texte}
      </div>
    </div>
  )
}

const td = 'px-3 py-1'

function ligneTransport(r: RapportTransportLigne) {
  return (
    <tr key={r.studentId} className="border-t" style={{ borderColor: RULE }}>
      <td className={`${td} font-semibold`} style={{ color: INK }}>
        {r.name}
      </td>
      <td className={td} style={{ color: INK }}>
        {r.matin}
      </td>
      <td className={td} style={{ color: INK }}>
        {r.soir}
      </td>
      <td className={td} style={{ color: r.depart ? INK : MUTED }}>
        {r.depart || '—'}
      </td>
    </tr>
  )
}

function ligneSortie(r: RapportSortieLigne) {
  return (
    <tr key={r.studentId} className="border-t" style={{ borderColor: RULE }}>
      <td className={`${td} font-semibold`} style={{ color: INK }}>
        {r.name}
      </td>
      <td className={`${td} font-semibold`} style={{ color: r.accordSigne ? GREEN : RED }}>
        {r.accordSigne ? `Accord signé${r.dateAccord ? ` le ${r.dateAccord}` : ''}` : 'ACCORD NON SIGNÉ'}
      </td>
    </tr>
  )
}

function ligneSoutien(r: RapportSoutienLigne) {
  // Un élève au car du soir qui reste au soutien n'est plus pris en charge par le service transport ce jour-là.
  const remarque = r.aTransportSoir
    ? r.statut === 'ne_reste_pas'
      ? 'Prend le car du soir'
      : r.statut === 'reste'
        ? 'Reste : transport du soir non assuré'
        : 'S’il reste : transport du soir non assuré'
    : ''
  return (
    <tr key={`${r.studentId}-${r.seanceId}`} className="border-t" style={{ borderColor: RULE }}>
      <td className={`${td} font-semibold`} style={{ color: INK }}>
        {r.name}
      </td>
      <td className={td} style={{ color: INK }}>
        {r.matiere} — {JOUR_LABELS[r.jour]} {r.heureDebut}–{r.heureFin}
      </td>
      <td className={`${td} font-semibold`} style={{ color: STATUT_COULEUR[r.statut] }}>
        {statutSoutienLabel(r.statut, r.aTransportSoir)}
      </td>
      <td className={td} style={{ color: remarque && r.statut !== 'ne_reste_pas' ? AMBER : MUTED2 }}>
        {remarque || '—'}
      </td>
    </tr>
  )
}

/** Une classe : ses trois tableaux (transport, sortie seul(e), soutien) en blocs que la pagination peut répartir sur plusieurs pages. */
function blocsDeLaClasse(r: RapportClasse): PaginatedBlock[] {
  const blocks: PaginatedBlock[] = []
  const section = <T,>(cle: string, titre: string, theme: { color: string; soft: string }, vide: string, lignes: T[], head: string[], rendu: (l: T) => ReactNode) => {
    if (lignes.length === 0) {
      blocks.push({ key: `${r.classe}-${cle}`, node: <Vide titre={titre} theme={theme} texte={vide} /> })
      return
    }
    morceaux(lignes, LIGNES_PAR_BLOC).forEach((chunk, i) => {
      blocks.push({
        key: `${r.classe}-${cle}-${i}`,
        node: (
          <SectionTable titre={titre} theme={theme} count={lignes.length} suite={i > 0} head={head}>
            {chunk.map(rendu)}
          </SectionTable>
        ),
      })
    })
  }
  section('transport', 'Transport scolaire', TRANSPORT, 'Aucun élève de cette classe n’a le transport.', r.transport, ['Élève', 'Ligne du matin', 'Ligne du soir', 'Départ du car du soir'], ligneTransport)
  section('sortie', 'Sortie seul(e)', SORTIE, 'Aucun élève de cette classe ne sort seul(e).', r.sortieSeul, ['Élève', 'Accord des parents'], ligneSortie)
  section('soutien', 'Soutien scolaire', SOUTIEN, 'Aucun élève de cette classe n’est inscrit au soutien.', r.soutien, ['Élève', 'Séance', 'Réponse des parents', 'Remarque'], ligneSoutien)
  return blocks
}

/** Une instance de `PaginatedPrintDocument` par classe : chaque classe commence sur sa propre page, et son en-tête (le nom de la classe) se répète sur ses pages de suite. */
function PagesDeLaClasse({ rapport }: { rapport: RapportClasse }) {
  return (
    <PaginatedPrintDocument
      blocks={blocsDeLaClasse(rapport)}
      paddingXPx={44}
      paddingYPx={30}
      gapPx={10}
      pageStyle={{ background: 'oklch(0.99 0.003 90)', color: INK, fontFamily: 'Helvetica, Arial, sans-serif' }}
      renderHeader={(pageIndex) => (
        <header className="grid grid-cols-3 items-start border-b-2 pb-3" style={{ borderColor: INK }}>
          <div className="flex flex-col gap-0.5">
            <p className="text-[19px] font-bold tracking-tight" style={{ color: INK }}>
              Groupe Scolaire Mondrian
            </p>
            <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: MUTED }}>
              École de la Bienveillance
            </p>
          </div>
          <SchoolLogo size={70} />
          <div className="flex flex-col items-end gap-0.5 text-right">
            <p className="text-[12.5px] font-bold" style={{ color: INK }}>
              Transport, sorties et soutien{pageIndex > 0 ? ' (suite)' : ''}
            </p>
            <p className="text-[22px] font-extrabold leading-none" style={{ color: SOUTIEN.color }}>
              Classe {rapport.classe}
            </p>
            <p className="text-[10px]" style={{ color: MUTED }}>
              Édité le {todayFR()}
            </p>
          </div>
        </header>
      )}
      renderFooter={(pageIndex, pageCount) => (
        <div className="border-t pt-1.5 text-[8px]" style={{ borderColor: 'oklch(0.92 0.005 90)', color: 'oklch(0.65 0.01 260)' }}>
          <div className="flex justify-between">
            <span>
              Groupe Scolaire Mondrian — Transport, sorties et soutien — {rapport.classe}
            </span>
            <span>
              Page {pageIndex + 1} / {pageCount}
            </span>
          </div>
          <div className="mt-0.5 text-center font-semibold uppercase tracking-wide">Direction de la Vie Scolaire</div>
        </div>
      )}
    />
  )
}

/** PDF de la vie scolaire : une page (ou plus si la classe est grande) par classe, avec les élèves au transport, ceux qui sortent seul(e) et ceux qui suivent le soutien. */
export default function PrintableSoutienClasse({ rapports }: { rapports: RapportClasse[] }) {
  return (
    <>
      {rapports.map((r) => (
        <PagesDeLaClasse key={r.classe} rapport={r} />
      ))}
    </>
  )
}
