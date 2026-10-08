import type { ReactNode } from 'react'
import { JOUR_LABELS } from '../../data/soutien'
import type { SortiesDuJour } from '../../utils/soutien'
import { jourDeDate } from '../../utils/soutienSeances'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import SchoolLogo from '../print/SchoolLogo'

const INK = 'oklch(0.24 0.01 260)'
const MUTED = 'oklch(0.55 0.01 260)'
const MUTED2 = 'oklch(0.45 0.01 260)'
const RULE = 'oklch(0.93 0.005 90)'
const HEAD_BG = 'oklch(0.96 0.005 264)'
const RED = 'oklch(0.55 0.2 25)'
const AMBER = 'oklch(0.5 0.14 60)'
const GREEN = 'oklch(0.45 0.14 160)'

const TRANSPORT = { color: 'oklch(0.5 0.15 255)', soft: 'oklch(0.9 0.04 255)' }
const SOUTIEN = { color: 'oklch(0.5 0.2 295)', soft: 'oklch(0.9 0.05 295)' }
const SORTIE = { color: 'oklch(0.5 0.12 160)', soft: 'oklch(0.9 0.05 160)' }

const LIGNES_PAR_BLOC = 18

function morceaux<T>(liste: T[], taille: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille))
  return out
}

function dateLongue(iso: string): string {
  const j = jourDeDate(iso)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return `${j ? `${JOUR_LABELS[j]} ` : ''}${m ? `${m[3]}/${m[2]}/${m[1]}` : iso}`
}

function Section({ titre, theme, badge, suite, head, children }: { titre: string; theme: { color: string; soft: string }; badge: string; suite?: boolean; head: string[]; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 rounded-t-lg px-3.5 py-[5px] text-white" style={{ background: theme.color }}>
        <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.04em]">
          {titre}
          {suite ? ' (suite)' : ''}
        </span>
        <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: 'rgba(255,255,255,0.25)' }}>
          {badge}
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

const td = 'px-3 py-1'
const row = { borderColor: RULE }

/**
 * Feuille de sortie du jour pour le portail : combien d'élèves attendus à chaque car du soir et qui n'y sera pas (soutien),
 * les séances de soutien avec le départ de chaque élève confirmé, et les élèves qui sortent seul(e).
 */
export default function PrintableSortiesDuJour({ data }: { data: SortiesDuJour }) {
  const blocks: PaginatedBlock[] = []

  if (data.cars.length > 0) {
    const restent = data.cars.reduce((n, c) => n + c.restent, 0)
    blocks.push({
      key: 'cars',
      node: (
        <Section titre="Cars du soir" theme={TRANSPORT} badge={`${data.cars.reduce((n, c) => n + c.attendus, 0)} élèves attendus`} head={['Ligne', 'Départ', 'Habituels', 'Restent au soutien', 'Attendus']}>
          {data.cars.map((c) => (
            <tr key={`${c.depart}-${c.ligne}`} className="border-t" style={row}>
              <td className={`${td} font-bold`} style={{ color: INK }}>
                Ligne {c.ligne}
              </td>
              <td className={td} style={{ color: INK }}>
                {c.depart}
              </td>
              <td className={td} style={{ color: MUTED2 }}>
                {c.habituels}
              </td>
              <td className={`${td} font-semibold`} style={{ color: c.restent > 0 ? AMBER : MUTED }}>
                {c.restent > 0 ? `${c.restent} (soutien)` : '—'}
              </td>
              <td className={`${td} font-extrabold`} style={{ color: INK }}>
                {c.attendus}
              </td>
            </tr>
          ))}
          {restent === 0 && (
            <tr className="border-t" style={row}>
              <td colSpan={5} className={td} style={{ color: MUTED }}>
                Aucun élève du car ne reste au soutien ce soir.
              </td>
            </tr>
          )}
        </Section>
      ),
    })

    const restants = data.cars.flatMap((c) => c.restants.map((r) => ({ ...r, ligne: c.ligne, depart: c.depart })))
    morceaux(restants, LIGNES_PAR_BLOC).forEach((chunk, i) => {
      blocks.push({
        key: `restants-${i}`,
        node: (
          <Section titre="Ne prennent pas le car ce soir" theme={TRANSPORT} badge={`${restants.length} élève${restants.length > 1 ? 's' : ''}`} suite={i > 0} head={['Élève', 'Classe', 'Car habituel', 'Soutien jusqu’à']}>
            {chunk.map((r) => (
              <tr key={r.studentId} className="border-t" style={row}>
                <td className={`${td} font-semibold`} style={{ color: INK }}>
                  {r.name}
                </td>
                <td className={td} style={{ color: MUTED2 }}>
                  {r.classe}
                </td>
                <td className={td} style={{ color: INK }}>
                  Ligne {r.ligne} · {r.depart}
                </td>
                <td className={td} style={{ color: AMBER }}>
                  {r.matiere} — {r.heureFin}
                </td>
              </tr>
            ))}
          </Section>
        ),
      })
    })

    const enAttente = data.cars.flatMap((c) => c.enAttente.map((e) => ({ ...e, ligne: c.ligne })))
    if (enAttente.length > 0) {
      blocks.push({
        key: 'cars-attente',
        node: (
          <div className="rounded-[10px] border px-3.5 py-2 text-[9.5px]" style={{ borderColor: RULE, color: MUTED2 }}>
            <span className="font-bold" style={{ color: AMBER }}>
              Réponse attendue ({enAttente.length}) — comptés au car tant que les parents n’ont pas répondu :
            </span>{' '}
            {enAttente.map((e) => `${e.name} (${e.classe}, ligne ${e.ligne})`).join(', ')}.
          </div>
        ),
      })
    }
  }

  data.soutien.forEach((s) => {
    const vide = s.confirmes.length === 0
    if (vide) {
      blocks.push({
        key: `soutien-${s.seanceId}-vide`,
        node: (
          <Section titre={`Soutien ${s.matiere} — fin à ${s.heureFin}`} theme={SOUTIEN} badge="0 élève" head={['Élève', 'Classe', 'À la fin de la séance']}>
            <tr className="border-t" style={row}>
              <td colSpan={3} className={td} style={{ color: MUTED }}>
                Aucun élève n’a confirmé sa présence{s.enAttente.length > 0 ? ` (${s.enAttente.length} réponse${s.enAttente.length > 1 ? 's' : ''} attendue${s.enAttente.length > 1 ? 's' : ''})` : ''}.
              </td>
            </tr>
          </Section>
        ),
      })
      return
    }
    morceaux(s.confirmes, LIGNES_PAR_BLOC).forEach((chunk, i) => {
      blocks.push({
        key: `soutien-${s.seanceId}-${i}`,
        node: (
          <Section
            titre={`Soutien ${s.matiere} ${s.heureDebut}–${s.heureFin}${s.enseignant ? ` · ${s.enseignant}` : ''}`}
            theme={SOUTIEN}
            badge={`${s.confirmes.length} élève${s.confirmes.length > 1 ? 's' : ''}`}
            suite={i > 0}
            head={['Élève', 'Classe', 'À la fin de la séance']}
          >
            {chunk.map((c) => (
              <tr key={c.studentId} className="border-t" style={row}>
                <td className={`${td} font-semibold`} style={{ color: INK }}>
                  {c.name}
                </td>
                <td className={td} style={{ color: MUTED2 }}>
                  {c.classe}
                </td>
                <td className={td} style={{ color: c.sortie.startsWith('Habituellement') ? AMBER : INK }}>
                  {c.sortie}
                </td>
              </tr>
            ))}
          </Section>
        ),
      })
    })
    if (s.enAttente.length > 0) {
      blocks.push({
        key: `soutien-${s.seanceId}-attente`,
        node: (
          <div className="rounded-[10px] border px-3.5 py-2 text-[9.5px]" style={{ borderColor: RULE, color: MUTED2 }}>
            <span className="font-bold" style={{ color: AMBER }}>
              {s.matiere} — réponse attendue ({s.enAttente.length}) :
            </span>{' '}
            {s.enAttente.map((e) => `${e.name} (${e.classe})`).join(', ')}.
          </div>
        ),
      })
    }
  })

  if (data.sortieSeul.length > 0) {
    morceaux(data.sortieSeul, LIGNES_PAR_BLOC).forEach((chunk, i) => {
      blocks.push({
        key: `seul-${i}`,
        node: (
          <Section titre="Sortent seul(e)" theme={SORTIE} badge={`${data.sortieSeul.length} élève${data.sortieSeul.length > 1 ? 's' : ''}`} suite={i > 0} head={['Élève', 'Classe', 'Accord des parents', 'Remarque']}>
            {chunk.map((s) => (
              <tr key={s.studentId} className="border-t" style={row}>
                <td className={`${td} font-semibold`} style={{ color: INK }}>
                  {s.name}
                </td>
                <td className={td} style={{ color: MUTED2 }}>
                  {s.classe}
                </td>
                <td className={`${td} font-semibold`} style={{ color: s.accordSigne ? GREEN : RED }}>
                  {s.accordSigne ? `Signé${s.dateAccord ? ` le ${s.dateAccord}` : ''}` : 'NON SIGNÉ'}
                </td>
                <td className={td} style={{ color: s.resteJusqua ? AMBER : MUTED }}>
                  {s.resteJusqua ? `Reste au soutien : sort à ${s.resteJusqua}` : '—'}
                </td>
              </tr>
            ))}
          </Section>
        ),
      })
    })
  }

  if (blocks.length === 0) {
    blocks.push({
      key: 'rien',
      node: (
        <div className="rounded-[10px] border px-3.5 py-3 text-[10px]" style={{ borderColor: RULE, color: MUTED }}>
          Rien à signaler pour cette journée : aucun car du soir, aucune séance de soutien et aucun élève en sortie seul(e).
        </div>
      ),
    })
  }

  return (
    <PaginatedPrintDocument
      blocks={blocks}
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
              Sorties du soir{pageIndex > 0 ? ' (suite)' : ''}
            </p>
            <p className="text-[17px] font-extrabold leading-none" style={{ color: SOUTIEN.color }}>
              {dateLongue(data.date)}
            </p>
            <p className="text-[10px]" style={{ color: MUTED }}>
              Édité le {new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>
        </header>
      )}
      renderFooter={(pageIndex, pageCount) => (
        <div className="border-t pt-1.5 text-[8px]" style={{ borderColor: 'oklch(0.92 0.005 90)', color: 'oklch(0.65 0.01 260)' }}>
          <div className="flex justify-between">
            <span>Groupe Scolaire Mondrian — Sorties du soir — {dateLongue(data.date)}</span>
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
