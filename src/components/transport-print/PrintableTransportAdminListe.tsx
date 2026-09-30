import SchoolLogo from '../print/SchoolLogo'
import PaginatedPrintDocument, { type PaginatedBlock } from '../print/PaginatedPrintDocument'
import { getLigneColors } from '../../utils/transportRoutePagination'
import { TRANSPORT_PARENTS } from '../../data/studentIdentity'

function ligneLabel(ligne: string | null): string {
  if (!ligne) return '—'
  if (ligne === TRANSPORT_PARENTS) return 'Parents'
  return `Ligne ${ligne}`
}

export interface TransportAdminRow {
  name: string
  ligneMatin: string | null
  ligneSoir: string | null
  sortie17h: boolean
  motif: string | null
}

export interface TransportAdminClasseGroup {
  classe: string
  rows: TransportAdminRow[]
}

export interface TransportAdminLigneInfo {
  ligneNom: string
  chauffeurNom: string | null
  chauffeurTel: string | null
  aideNom: string | null
  aideTel: string | null
}

export interface TransportAdminNonAffecteRow {
  name: string
  classe: string
}

interface PrintableTransportAdminListeProps {
  groups: TransportAdminClasseGroup[]
  lignesInfo: TransportAdminLigneInfo[]
  nonAffectes: TransportAdminNonAffecteRow[]
  total: number
}

// Même palette que la feuille de route (bleu de la Ligne A) pour une identité visuelle cohérente
// entre les deux documents — pas de couleur par classe ici, une seule teinte d'accent suffit.
const { color: ACCENT, bgSoft: ACCENT_SOFT } = getLigneColors('A')
const MUTED = 'oklch(0.55 0.01 260)'
const MUTED2 = 'oklch(0.45 0.01 260)'
const INK = 'oklch(0.24 0.01 260)'

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

const AMBER = 'oklch(0.6 0.17 55)'
const AMBER_SOFT = 'oklch(0.96 0.04 70)'

export default function PrintableTransportAdminListe({ groups, lignesInfo, nonAffectes, total }: PrintableTransportAdminListeProps) {
  const recapBlock: PaginatedBlock = {
    key: '__recap__',
    node: (
      <div>
        <div className="rounded-t-lg px-3.5 py-[5px] text-white" style={{ background: ACCENT }}>
          <span className="text-[11px] font-bold uppercase tracking-[0.04em]">Récapitulatif des lignes</span>
        </div>
        <div className="overflow-hidden rounded-b-[10px] border" style={{ borderColor: ACCENT_SOFT }}>
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr
                className="text-left font-bold uppercase tracking-[0.03em]"
                style={{ background: 'oklch(0.96 0.005 264)', color: 'oklch(0.5 0.01 260)' }}
              >
                <th className="px-3 py-1 text-[8px] font-bold">Ligne</th>
                <th className="px-3 py-1 text-[8px] font-bold">Chauffeur</th>
                <th className="px-3 py-1 text-[8px] font-bold">Aide-maîtresse</th>
              </tr>
            </thead>
            <tbody>
              {lignesInfo.map((l) => {
                const { color } = getLigneColors(l.ligneNom)
                return (
                  <tr key={l.ligneNom} className="border-t" style={{ borderColor: 'oklch(0.93 0.005 90)' }}>
                    <td className="px-3 py-1">
                      <span
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
                        style={{ background: color }}
                      >
                        {l.ligneNom}
                      </span>
                    </td>
                    <td className="px-3 py-1" style={{ color: INK }}>
                      {l.chauffeurNom ? `${l.chauffeurNom}${l.chauffeurTel ? ' · ' + l.chauffeurTel : ''}` : '—'}
                    </td>
                    <td className="px-3 py-1" style={{ color: INK }}>
                      {l.aideNom ? `${l.aideNom}${l.aideTel ? ' · ' + l.aideTel : ''}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    ),
  }

  // Élèves ayant le transport activé mais jamais affectés à une ligne du matin — même critère que
  // le bandeau d'alerte de l'onglet Élèves de l'écran (nbNonAffecte). Regroupé en tête de document
  // pour servir de vraie checklist actionnable, plutôt que de les laisser dilués sans signalement
  // particulier au milieu des tableaux par classe (où ils n'affichent qu'un simple "—"). Omis si
  // aucun élève concerné, même principe que le bandeau écran (`nbNonAffecte > 0 &&`).
  const nonAffectesBlock: PaginatedBlock | null =
    nonAffectes.length === 0
      ? null
      : {
          key: '__non_affectes__',
          node: (
            <div>
              <div className="flex items-center gap-2 rounded-t-lg px-3.5 py-[5px] text-white" style={{ background: AMBER }}>
                <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.04em]">⚠ Élèves non affectés à une ligne de transport</span>
                <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: 'rgba(255,255,255,0.3)' }}>
                  {nonAffectes.length} élève{nonAffectes.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-hidden rounded-b-[10px] border" style={{ borderColor: AMBER_SOFT }}>
                <table className="w-full border-collapse text-[8.5px]">
                  <thead>
                    <tr className="text-left font-bold uppercase tracking-[0.03em]" style={{ background: AMBER_SOFT, color: 'oklch(0.5 0.12 60)' }}>
                      <th className="px-3 py-1 text-[8px] font-bold">Élève</th>
                      <th className="px-3 py-1 text-[8px] font-bold">Classe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nonAffectes.map((r) => (
                      <tr key={r.name} className="border-t" style={{ borderColor: 'oklch(0.93 0.005 90)' }}>
                        <td className="px-3 py-1 text-[8.5px] font-semibold" style={{ color: INK }}>
                          {r.name}
                        </td>
                        <td className="px-3 py-1" style={{ color: MUTED2 }}>
                          {r.classe}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        }

  const blocks: PaginatedBlock[] = [recapBlock, ...(nonAffectesBlock ? [nonAffectesBlock] : []), ...groups.map((g) => ({
    key: g.classe,
    node: (
      <div>
        <div className="flex items-center gap-2 rounded-t-lg px-3.5 py-[5px] text-white" style={{ background: ACCENT }}>
          <span className="flex-1 text-[11px] font-bold uppercase tracking-[0.04em]">Classe {g.classe}</span>
          <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: 'rgba(255,255,255,0.25)' }}>
            {g.rows.length} élève{g.rows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-hidden rounded-b-[10px] border" style={{ borderColor: ACCENT_SOFT }}>
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr
                className="text-left font-bold uppercase tracking-[0.03em]"
                style={{ background: 'oklch(0.96 0.005 264)', color: 'oklch(0.5 0.01 260)' }}
              >
                <th className="px-3 py-1 text-[8px] font-bold">Élève</th>
                <th className="px-3 py-1 text-[8px] font-bold">Ligne matin</th>
                <th className="px-3 py-1 text-[8px] font-bold">Ligne soir</th>
                <th className="px-3 py-1 text-[8px] font-bold">Sortie 17h</th>
                <th className="px-3 py-1 text-[8px] font-bold">Motif</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.name} className="border-t" style={{ borderColor: 'oklch(0.93 0.005 90)' }}>
                  <td className="px-3 py-1 text-[8.5px] font-semibold" style={{ color: INK }}>
                    {r.name}
                  </td>
                  <td className="px-3 py-1" style={{ color: INK }}>
                    {ligneLabel(r.ligneMatin)}
                  </td>
                  <td className="px-3 py-1" style={{ color: INK }}>
                    {ligneLabel(r.ligneSoir)}
                  </td>
                  <td className="px-3 py-1" style={{ color: INK }}>
                    {r.sortie17h ? 'Oui' : '—'}
                  </td>
                  <td className="px-3 py-1" style={{ color: MUTED2 }}>
                    {r.motif || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  }))]

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
              Liste Administrative — Transport{pageIndex > 0 ? ' (suite)' : ''}
            </p>
            <p className="text-[10px]" style={{ color: MUTED }}>
              Édité le {todayFR()} · {total} élève{total !== 1 ? 's' : ''}
            </p>
          </div>
        </header>
      )}
      renderFooter={(pageIndex, pageCount) => (
        <div className="border-t pt-1.5 text-[8px]" style={{ borderColor: 'oklch(0.92 0.005 90)', color: 'oklch(0.65 0.01 260)' }}>
          <div className="flex justify-between">
            <span>Groupe Scolaire Mondrian — Liste administrative du transport</span>
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
