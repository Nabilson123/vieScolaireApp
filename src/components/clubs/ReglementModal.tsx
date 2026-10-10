import { useMemo, useState } from 'react'
import { Banknote, TriangleAlert, X } from 'lucide-react'
import { MODES_REGLEMENT, MODE_REGLEMENT_LABELS, type ModeReglement } from '../../data/clubs'
import { useClubsFinance } from '../../hooks/useClubsFinance'
import { useEnregistrerReglement } from '../../services/clubsPaiementsService'
import { dhVersCentimes, formatDH, imputerReglement, libelleEcheance, mensualitesOuvertes, soldeDeLignes } from '../../utils/clubsFinance'
import { aujourdhuiLocalISO } from '../../utils/soutienSeances'

interface Props {
  /** Famille présélectionnée (encaissement depuis une ligne du tableau des mensualités). */
  familleCle?: string
  onClose: () => void
  /** Appelé après l'enregistrement : message à afficher et identifiant du règlement (pour ouvrir son reçu). */
  onDone: (message: string, reglementId: string) => void
}

const INPUT = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none'

function dhEnTexte(centimes: number): string {
  return (centimes / 100).toFixed(2).replace(/\.00$/, '').replace('.', ',')
}

/**
 * Encaisse un règlement pour une famille. Le montant paie les mois cochés (du plus ancien au plus récent) ; sans coche,
 * il est réparti automatiquement sur les mensualités les plus anciennes, puis sur les mois à venir.
 */
export default function ReglementModal({ familleCle: familleInitiale, onClose, onDone }: Props) {
  const { lignes, aujourdhui } = useClubsFinance()
  const enregistrer = useEnregistrerReglement()

  const familles = useMemo(() => {
    const parCle = new Map<string, { cle: string; libelle: string; lignes: typeof lignes }>()
    for (const l of lignes) {
      if (l.resteCentimes <= 0) continue
      const f = parCle.get(l.familleCle) ?? { cle: l.familleCle, libelle: l.familleLibelle, lignes: [] }
      f.lignes.push(l)
      parCle.set(l.familleCle, f)
    }
    return [...parCle.values()]
      .map((f) => ({ ...f, solde: soldeDeLignes(f.lignes, aujourdhui) }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
  }, [lignes, aujourdhui])

  const [familleCle, setFamilleCle] = useState(familleInitiale ?? '')
  const [montant, setMontant] = useState('')
  const [mode, setMode] = useState<ModeReglement>('especes')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(aujourdhuiLocalISO())
  const [erreur, setErreur] = useState('')

  /** Mensualités cochées par l'utilisateur : le règlement ne paie que celles-là. Aucune coche = répartition automatique sur toutes. */
  const [choisies, setChoisies] = useState<string[]>([])

  const famille = familles.find((f) => f.cle === familleCle)
  const ouvertes = useMemo(() => (famille ? mensualitesOuvertes(lignes, famille.cle) : []), [famille, lignes])
  const retenues = useMemo(() => ouvertes.filter((o) => choisies.includes(o.echeanceId)), [ouvertes, choisies])
  const selectionActive = retenues.length > 0
  const cibles = selectionActive ? retenues : ouvertes
  const totalOuvert = ouvertes.reduce((n, o) => n + o.resteCentimes, 0)
  const totalCible = cibles.reduce((n, o) => n + o.resteCentimes, 0)
  const centimes = dhVersCentimes(montant)
  const repartition = useMemo(() => (centimes && centimes > 0 ? imputerReglement(centimes, cibles) : null), [centimes, cibles])
  const ligneParId = new Map(ouvertes.map((o) => [o.echeanceId, o.ligne]))

  const basculer = (echeanceId: string) => setChoisies((prev) => (prev.includes(echeanceId) ? prev.filter((x) => x !== echeanceId) : [...prev, echeanceId]))

  const referenceRequise = mode !== 'especes'
  const montantValide = centimes !== null && centimes > 0
  const depasse = !!repartition && repartition.nonImputeCentimes > 0
  const canSubmit = !!famille && montantValide && !depasse && !!date && (!referenceRequise || reference.trim() !== '') && !enregistrer.isPending

  const handleSubmit = async () => {
    if (!canSubmit || !famille || !repartition || centimes === null) return
    setErreur('')
    try {
      const r = await enregistrer.mutateAsync({
        familleCle: famille.cle,
        familleLibelle: famille.libelle,
        dateReglement: date,
        mode,
        reference,
        montantCentimes: centimes,
        imputations: repartition.imputations,
      })
      onDone(`Règlement de ${formatDH(centimes)} enregistré pour ${famille.libelle} (reçu ${r.numero}).`, r.id)
      onClose()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Banknote className="h-5 w-5 text-emerald-500" />
            Enregistrer un règlement
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Famille*</label>
            <select
              value={familleCle}
              onChange={(e) => {
                setFamilleCle(e.target.value)
                setChoisies([])
                setMontant('')
              }}
              className={INPUT}
              disabled={!!familleInitiale}
            >
              <option value="">Choisissez une famille…</option>
              {familles.map((f) => (
                <option key={f.cle} value={f.cle}>
                  {f.libelle} — {f.solde.resteEchuCentimes > 0 ? `${formatDH(f.solde.resteEchuCentimes)} dus` : 'rien d’échu'} ({formatDH(f.solde.resteEchuCentimes + f.solde.resteAVenirCentimes)} au total)
                </option>
              ))}
            </select>
            {familles.length === 0 && <p className="mt-1 text-[11px] text-slate-400">Aucune famille n'a de mensualité à payer.</p>}
          </div>

          {famille && (
            <>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Sommes à payer ({ouvertes.length}){selectionActive && <span className="ml-1 normal-case text-emerald-700">· {retenues.length} choisie{retenues.length > 1 ? 's' : ''}</span>}
                  </p>
                  <div className="flex shrink-0 gap-3 text-[11px] font-medium">
                    <button type="button" onClick={() => setChoisies(ouvertes.map((o) => o.echeanceId))} className="text-slate-500 hover:text-slate-700 hover:underline">
                      Tout cocher
                    </button>
                    {selectionActive && (
                      <button type="button" onClick={() => setChoisies([])} className="text-slate-500 hover:text-slate-700 hover:underline">
                        Tout décocher
                      </button>
                    )}
                  </div>
                </div>
                <p className="mb-2 text-[11px] text-slate-400">
                  {selectionActive ? 'Le règlement ne paiera que les mois cochés (du plus ancien au plus récent).' : 'Cochez les mois que ce règlement paie. Sans coche, le montant est réparti sur les mois les plus anciens.'}
                </p>
                <ul className="max-h-44 space-y-1 overflow-y-auto text-xs">
                  {ouvertes.map((o) => {
                    const coche = choisies.includes(o.echeanceId)
                    return (
                      <li key={o.echeanceId}>
                        <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 ${coche ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-white hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={coche} onChange={() => basculer(o.echeanceId)} className="shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-slate-700">
                            {o.ligne.studentNom} <span className="text-slate-400">({o.ligne.clubNom})</span> — {libelleEcheance(o.ligne)}
                          </span>
                          <span className={`shrink-0 font-semibold ${o.ligne.statut === 'en_retard' ? 'text-rose-600' : 'text-slate-600'}`}>
                            {formatDH(o.resteCentimes)}
                            {o.ligne.statut === 'en_retard' && ' · en retard'}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Montant reçu (DH)*</label>
                  <input value={montant} onChange={(e) => setMontant(e.target.value)} inputMode="decimal" className={INPUT} placeholder="Ex. 300" />
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                    {selectionActive ? (
                      <button type="button" onClick={() => setMontant(dhEnTexte(totalCible))} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-100">
                        {retenues.length > 1 ? `Solder les ${retenues.length} mois choisis` : 'Solder le mois choisi'} ({formatDH(totalCible)})
                      </button>
                    ) : (
                      <>
                        {famille.solde.resteEchuCentimes > 0 && (
                          <button type="button" onClick={() => setMontant(dhEnTexte(famille.solde.resteEchuCentimes))} className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 hover:bg-slate-50">
                            Solder ce qui est échu ({formatDH(famille.solde.resteEchuCentimes)})
                          </button>
                        )}
                        <button type="button" onClick={() => setMontant(dhEnTexte(totalOuvert))} className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 hover:bg-slate-50">
                          Tout solder ({formatDH(totalOuvert)})
                        </button>
                      </>
                    )}
                  </div>
                  {montant.trim() !== '' && !montantValide && <p className="mt-1 text-[11px] text-amber-600">Montant illisible ou nul (ex. 300 ou 300,50).</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date*</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mode de paiement*</label>
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Mode de paiement">
                  {MODES_REGLEMENT.map((m) => (
                    <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === m ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>
                      {MODE_REGLEMENT_LABELS[m]}
                    </button>
                  ))}
                </div>
                {referenceRequise && (
                  <input value={reference} onChange={(e) => setReference(e.target.value)} className={`${INPUT} mt-2`} placeholder={mode === 'cheque' ? 'N° du chèque et banque (obligatoire)' : 'Référence du virement (obligatoire)'} />
                )}
              </div>

              {repartition && (
                <div className={`rounded-xl border p-3 ${depasse ? 'border-rose-200 bg-rose-50' : 'border-emerald-100 bg-emerald-50/50'}`}>
                  <p className={`mb-1.5 text-xs font-bold uppercase tracking-wide ${depasse ? 'text-rose-700' : 'text-emerald-700'}`}>Répartition prévue</p>
                  {repartition.imputations.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {repartition.imputations.map((i) => {
                        const l = ligneParId.get(i.echeanceId)
                        const complete = !!l && i.montantCentimes >= l.resteCentimes
                        return (
                          <li key={i.echeanceId} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-slate-700">{l ? `${l.studentNom} (${l.clubNom}) — ${libelleEcheance(l)}` : 'Mensualité'}</span>
                            <span className="shrink-0 font-semibold text-slate-700">
                              {formatDH(i.montantCentimes)} <span className="font-normal text-slate-400">{complete ? 'soldée' : 'partiel'}</span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {depasse && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-rose-700">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Le montant dépasse de {formatDH(repartition.nonImputeCentimes)} ce qui reste à payer {selectionActive ? 'sur les mois choisis' : ''} ({formatDH(totalCible)} au maximum). {selectionActive ? 'Cochez d’autres mois ou réduisez le montant.' : 'Aucun trop-perçu n’est accepté.'}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {erreur && <p className="text-sm text-rose-600">{erreur}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer et voir le reçu'}
          </button>
        </div>
      </div>
    </div>
  )
}
