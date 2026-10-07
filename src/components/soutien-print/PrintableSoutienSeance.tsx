import { JOUR_LABELS } from '../../data/soutien'
import { occurrencesAnnulees, prochaineOccurrence, aujourdhuiLocalISO } from '../../utils/soutienSeances'
import type { FeuilleSeance } from '../../utils/soutienContexte'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import SchoolLogo from '../print/SchoolLogo'

const INK = 'oklch(0.24 0.01 260)'
const MUTED = 'oklch(0.55 0.01 260)'
const MUTED2 = 'oklch(0.45 0.01 260)'
const RULE = 'oklch(0.93 0.005 90)'
const HEAD_BG = 'oklch(0.96 0.005 264)'
const ACCENT = 'oklch(0.5 0.2 295)'
const ACCENT_SOFT = 'oklch(0.9 0.05 295)'
const AMBER = 'oklch(0.5 0.14 60)'

const LIGNES_PAR_BLOC = 22

function dateCourte(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function morceaux<T>(liste: T[], taille: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille))
  return out
}

function Fait({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: ACCENT_SOFT }}>
      <p className="text-[8px] font-bold uppercase tracking-[0.05em]" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold" style={{ color: INK }}>
        {valeur || '—'}
      </p>
    </div>
  )
}

/** Feuille d'une séance de soutien : créneau, enseignant, salle, et les élèves dont les parents ont confirmé avec leur mode de départ. */
export default function PrintableSoutienSeance({ feuille }: { feuille: FeuilleSeance }) {
  const { seance, confirmes, enAttente } = feuille
  const prochaine = prochaineOccurrence(seance, aujourdhuiLocalISO())
  const annulees = occurrencesAnnulees(seance)

  const blocks: PaginatedBlock[] = [
    {
      key: 'faits',
      node: (
        <div className="grid grid-cols-4 gap-2">
          <Fait label="Jour et heures" valeur={`${JOUR_LABELS[seance.jour]} ${seance.heureDebut} – ${seance.heureFin}`} />
          <Fait label="Enseignant" valeur={feuille.enseignant} />
          <Fait label="Salle" valeur={feuille.salle} />
          <Fait label="Prochaine séance" valeur={prochaine ? dateCourte(prochaine) : 'Aucune'} />
          <div className="col-span-4 text-[9.5px]" style={{ color: MUTED2 }}>
            Période : {seance.dateFin ? `du ${dateCourte(seance.dateDebut)} au ${dateCourte(seance.dateFin)}` : `depuis le ${dateCourte(seance.dateDebut)}, jusqu'à la fin de l'année`}
            {seance.classes.length > 0 && <> · Classes visées : {seance.classes.join(', ')}</>}
            {annulees.length > 0 && <> · Pas de séance le {annulees.map(dateCourte).join(', ')}</>}
          </div>
          {seance.note && (
            <div className="col-span-4 rounded-lg px-3 py-1.5 text-[9.5px]" style={{ background: HEAD_BG, color: INK }}>
              {seance.note}
            </div>
          )}
        </div>
      ),
    },
    ...(confirmes.length === 0
      ? [
          {
            key: 'vide',
            node: (
              <div className="rounded-[10px] border px-3.5 py-3 text-[10px]" style={{ borderColor: ACCENT_SOFT, color: MUTED }}>
                Aucun élève n'a encore confirmé sa présence à cette séance.
              </div>
            ),
          },
        ]
      : morceaux(confirmes, LIGNES_PAR_BLOC).map((chunk, i) => ({
          key: `confirmes-${i}`,
          node: (
            <div>
              <div className="flex items-center gap-2 rounded-t-lg px-3.5 py-[5px] text-white" style={{ background: ACCENT }}>
                <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.04em]">Élèves présents{i > 0 ? ' (suite)' : ''}</span>
                <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: 'rgba(255,255,255,0.25)' }}>
                  {confirmes.length} élève{confirmes.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-hidden rounded-b-[10px] border" style={{ borderColor: ACCENT_SOFT }}>
                <table className="w-full border-collapse text-[9.5px]">
                  <thead>
                    <tr className="text-left font-bold uppercase tracking-[0.03em]" style={{ background: HEAD_BG, color: 'oklch(0.5 0.01 260)' }}>
                      <th className="px-3 py-1 text-[8px] font-bold">Élève</th>
                      <th className="px-3 py-1 text-[8px] font-bold">Classe</th>
                      <th className="px-3 py-1 text-[8px] font-bold">À la fin de la séance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunk.map((c) => (
                      <tr key={c.studentId} className="border-t" style={{ borderColor: RULE }}>
                        <td className="px-3 py-1 font-semibold" style={{ color: INK }}>
                          {c.name}
                        </td>
                        <td className="px-3 py-1" style={{ color: MUTED2 }}>
                          {c.classe}
                        </td>
                        <td className="px-3 py-1" style={{ color: c.sortie.startsWith('Habituellement') ? AMBER : INK }}>
                          {c.sortie}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        }))),
    ...(enAttente.length > 0 || feuille.nePasRestent > 0
      ? [
          {
            key: 'attente',
            node: (
              <div className="rounded-[10px] border px-3.5 py-2 text-[9.5px]" style={{ borderColor: RULE, color: MUTED2 }}>
                {enAttente.length > 0 && (
                  <p>
                    <span className="font-bold" style={{ color: AMBER }}>
                      En attente de réponse ({enAttente.length}) :
                    </span>{' '}
                    {enAttente.map((e) => `${e.name} (${e.classe})`).join(', ')}.
                  </p>
                )}
                {feuille.nePasRestent > 0 && (
                  <p>
                    {feuille.nePasRestent} élève{feuille.nePasRestent > 1 ? 's' : ''} inscrit{feuille.nePasRestent > 1 ? 's' : ''} ne reste{feuille.nePasRestent > 1 ? 'nt' : ''} pas.
                  </p>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

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
              Feuille de soutien scolaire{pageIndex > 0 ? ' (suite)' : ''}
            </p>
            <p className="text-[20px] font-extrabold leading-none" style={{ color: ACCENT }}>
              {seance.matiere}
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
            <span>Groupe Scolaire Mondrian — Soutien scolaire — {seance.matiere}</span>
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
