import { useMemo, useState } from 'react'
import { Banknote, CalendarClock } from 'lucide-react'
import { libelleClub } from '../../data/clubs'
import { useClubsFinance } from '../../hooks/useClubsFinance'
import { STATUT_ECHEANCE_LABELS, formatDH, libelleMois, soldeDeLignes, type LigneMensualite, type StatutEcheance } from '../../utils/clubsFinance'

interface Props {
  /** Droit d'enregistrer un règlement (et année modifiable). */
  canEdit: boolean
  /** Ouvre l'encaissement, éventuellement pour une famille. */
  onEncaisser: (familleCle?: string) => void
}

const CELLULE: Record<StatutEcheance, string> = {
  payee: 'bg-emerald-50 text-emerald-700',
  exoneree: 'bg-violet-50 text-violet-700',
  en_retard: 'bg-rose-100 text-rose-700',
  partielle: 'bg-amber-100 text-amber-800',
  due: 'bg-sky-50 text-sky-700',
  a_venir: 'bg-slate-50 text-slate-400',
}

const INPUT = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none'

const sansUnite = (centimes: number) => formatDH(centimes).replace(/ DH$/, '')

/** Colonne des frais d'inscription, avant les mois : des frais et la mensualité du même mois ne tiennent pas dans une même case. */
const COLONNE_FRAIS = 'frais'

const cleColonne = (l: LigneMensualite) => (l.type === 'inscription' ? COLONNE_FRAIS : l.mois)

function texteCellule(l: LigneMensualite): string {
  if (l.statut === 'payee') return 'Payée'
  if (l.statut === 'exoneree') return 'Exonérée'
  if (l.statut === 'a_venir') return sansUnite(l.montantCentimes)
  if (l.statut === 'partielle' || (l.statut === 'en_retard' && l.payeCentimes > 0)) return `reste ${sansUnite(l.resteCentimes)}`
  return sansUnite(l.resteCentimes)
}

interface FamilleAffichee {
  cle: string
  libelle: string
  rangees: LigneMensualite[][]
  solde: ReturnType<typeof soldeDeLignes>
}

/** Mensualités de chaque famille : un tableau élève × mois, coloré par statut (payée, partielle, à payer, en retard, exonérée). */
export default function MensualitesPanel({ canEdit, onEncaisser }: Props) {
  const { lignes, clubs, aujourdhui } = useClubsFinance()
  const [club, setClub] = useState('')
  const [statut, setStatut] = useState<StatutEcheance | ''>('')
  const [mois, setMois] = useState('')
  const [recherche, setRecherche] = useState('')

  const terme = recherche.trim().toLowerCase()
  const duClub = useMemo(() => lignes.filter((l) => !club || l.clubId === club), [lignes, club])
  const moisDispos = useMemo(() => [...new Set(duClub.filter((l) => l.type !== 'inscription').map((l) => l.mois))].sort(), [duClub])
  const avecFrais = useMemo(() => duClub.some((l) => l.type === 'inscription'), [duClub])
  const colonnes = useMemo(() => [...(avecFrais ? [COLONNE_FRAIS] : []), ...moisDispos.filter((m) => !mois || m === mois)], [avecFrais, moisDispos, mois])

  const familles = useMemo<FamilleAffichee[]>(() => {
    const visibles = duClub.filter((l) => (!mois || l.mois === mois) && (!terme || `${l.studentNom} ${l.familleLibelle} ${l.classe}`.toLowerCase().includes(terme)))
    const parFamille = new Map<string, { cle: string; libelle: string; lignes: LigneMensualite[] }>()
    for (const l of visibles) {
      const f = parFamille.get(l.familleCle) ?? { cle: l.familleCle, libelle: l.familleLibelle, lignes: [] }
      f.lignes.push(l)
      parFamille.set(l.familleCle, f)
    }
    return [...parFamille.values()]
      .map((f) => {
        const parInscription = new Map<string, LigneMensualite[]>()
        for (const l of f.lignes) parInscription.set(l.inscriptionId, [...(parInscription.get(l.inscriptionId) ?? []), l])
        // Le filtre de statut garde les lignes (élève, club) qui ont au moins une mensualité dans ce statut.
        const rangees = [...parInscription.values()].filter((ls) => !statut || ls.some((l) => l.statut === statut))
        return { cle: f.cle, libelle: f.libelle, rangees, solde: soldeDeLignes(f.lignes, aujourdhui) }
      })
      .filter((f) => f.rangees.length > 0)
      .sort((a, b) => b.solde.resteEchuCentimes - a.solde.resteEchuCentimes || a.libelle.localeCompare(b.libelle, 'fr'))
  }, [duClub, mois, terme, statut, aujourdhui])

  const total = useMemo(() => soldeDeLignes(duClub, aujourdhui), [duClub, aujourdhui])
  const familleEnRetard = new Set(duClub.filter((l) => l.statut === 'en_retard').map((l) => l.familleCle)).size

  const tuiles = [
    { label: 'Attendu', valeur: formatDH(total.attenduCentimes), ton: 'text-slate-900' },
    { label: 'Encaissé', valeur: formatDH(total.payeCentimes), ton: 'text-emerald-600' },
    { label: 'Reste dû (échu)', valeur: formatDH(total.resteEchuCentimes), ton: total.resteEchuCentimes > 0 ? 'text-rose-600' : 'text-slate-900' },
    { label: 'Familles en retard', valeur: String(familleEnRetard), ton: familleEnRetard > 0 ? 'text-rose-600' : 'text-slate-900' },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <CalendarClock className="h-5 w-5 text-amber-500" />
            Mensualités
          </h2>
          <p className="text-xs text-slate-500">Une ligne par élève et par club, une colonne par mois (et une colonne Inscription pour les frais). Les familles qui doivent le plus d'abord.</p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => onEncaisser()} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-emerald-500 hover:to-teal-500">
            <Banknote className="h-4 w-4" />
            Enregistrer un règlement
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tuiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.label}</p>
            <p className={`mt-0.5 text-lg font-bold ${t.ton}`}>{t.valeur}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={club} onChange={(e) => setClub(e.target.value)} className={INPUT} aria-label="Filtrer par club">
          <option value="">Tous les clubs</option>
          {clubs
            .slice()
            .sort((a, b) => libelleClub(a).localeCompare(libelleClub(b), 'fr', { numeric: true }))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {libelleClub(c)}
              </option>
            ))}
        </select>
        <select value={statut} onChange={(e) => setStatut(e.target.value as StatutEcheance | '')} className={INPUT} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {(Object.keys(STATUT_ECHEANCE_LABELS) as StatutEcheance[]).map((s) => (
            <option key={s} value={s}>
              {STATUT_ECHEANCE_LABELS[s]}
            </option>
          ))}
        </select>
        <select value={mois} onChange={(e) => setMois(e.target.value)} className={INPUT} aria-label="Filtrer par mois">
          <option value="">Tous les mois</option>
          {moisDispos.map((m) => (
            <option key={m} value={m}>
              {libelleMois(m)}
            </option>
          ))}
        </select>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un élève ou une famille…" className={`${INPUT} w-60`} />
      </div>

      {familles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          {lignes.length === 0 ? "Aucune mensualité : inscrivez d'abord des élèves à un club." : 'Aucune mensualité ne correspond à ces filtres.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <th className="min-w-[14rem] px-3 py-2">Famille / élève</th>
                {colonnes.map((m) => (
                  <th key={m} className="min-w-[5.5rem] px-2 py-2 text-center">
                    {m === COLONNE_FRAIS ? 'Inscription' : libelleMois(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {familles.map((f) => (
                <FamilleBloc key={f.cle} famille={f} colonnes={colonnes} canEdit={canEdit} onEncaisser={onEncaisser} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {(Object.keys(STATUT_ECHEANCE_LABELS) as StatutEcheance[]).map((s) => (
          <span key={s} className={`rounded-full px-2.5 py-0.5 font-semibold ${CELLULE[s]}`}>
            {STATUT_ECHEANCE_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  )
}

function FamilleBloc({ famille, colonnes, canEdit, onEncaisser }: { famille: FamilleAffichee; colonnes: string[]; canEdit: boolean; onEncaisser: (familleCle?: string) => void }) {
  const resteTotal = famille.solde.resteEchuCentimes + famille.solde.resteAVenirCentimes
  return (
    <>
      <tr className="border-t border-slate-100 bg-slate-50/60">
        <td colSpan={colonnes.length + 1} className="px-3 py-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-800">
              {famille.libelle}
              <span className={`ml-2 text-xs font-semibold ${famille.solde.resteEchuCentimes > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {famille.solde.resteEchuCentimes > 0 ? `${formatDH(famille.solde.resteEchuCentimes)} dus` : 'à jour'}
              </span>
              {famille.solde.resteAVenirCentimes > 0 && <span className="ml-2 text-[11px] font-normal text-slate-400">{formatDH(famille.solde.resteAVenirCentimes)} à venir</span>}
            </span>
            {canEdit && resteTotal > 0 && (
              <button type="button" onClick={() => onEncaisser(famille.cle)} className="flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600">
                <Banknote className="h-3 w-3" />
                Encaisser
              </button>
            )}
          </div>
        </td>
      </tr>
      {famille.rangees.map((ls) => {
        const parMois = new Map(ls.map((l) => [cleColonne(l), l]))
        return (
          <tr key={ls[0].inscriptionId} className="border-t border-slate-50">
            <td className="px-3 py-1.5 text-slate-700">
              <span className="font-medium">{ls[0].studentNom}</span> <span className="text-slate-400">({ls[0].classe})</span>
              <span className="block text-[11px] text-slate-400">{ls[0].clubNom}</span>
            </td>
            {colonnes.map((m) => {
              const l = parMois.get(m)
              return (
                <td key={m} className="px-1.5 py-1 text-center">
                  {l ? (
                    <span title={`${STATUT_ECHEANCE_LABELS[l.statut]} — ${formatDH(l.montantCentimes)}, payé ${formatDH(l.payeCentimes)}`} className={`block rounded-md px-1 py-1 text-[11px] font-semibold ${CELLULE[l.statut]}`}>
                      {texteCellule(l)}
                    </span>
                  ) : (
                    <span className="text-slate-200">·</span>
                  )}
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}
