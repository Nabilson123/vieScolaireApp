import { useMemo, useState } from 'react'
import { Ban, Banknote, CheckCircle2, FileSpreadsheet, FileText, Receipt, X } from 'lucide-react'
import { MODES_REGLEMENT, MODE_REGLEMENT_LABELS, type ModeReglement, type StatutReglement } from '../../data/clubs'
import { useClubReglements, useAnnulerReglement } from '../../services/clubsPaiementsService'
import { journalEncaissements } from '../../utils/clubsContexte'
import { exportJournalEncaissementsExcel } from '../../utils/clubsExport'
import { formatDH } from '../../utils/clubsFinance'

interface Props {
  /** Droit d'enregistrer et d'annuler un règlement (et année modifiable). */
  canEdit: boolean
  onEncaisser: () => void
  onOuvrirRecu: (reglementId: string) => void
}

const INPUT = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none'

function dateCourte(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** Règlements encaissés : liste, reçu, et annulation avec motif (un règlement n'est jamais supprimé et garde son numéro). */
export default function ReglementsList({ canEdit, onEncaisser, onOuvrirRecu }: Props) {
  const { data: reglements = [] } = useClubReglements()
  const annuler = useAnnulerReglement()

  const [recherche, setRecherche] = useState('')
  const [mode, setMode] = useState<ModeReglement | ''>('')
  const [statut, setStatut] = useState<StatutReglement | ''>('')
  const [annulation, setAnnulation] = useState<{ id: string; motif: string } | null>(null)
  const [notice, setNotice] = useState('')
  const [erreur, setErreur] = useState('')

  const terme = recherche.trim().toLowerCase()
  const visibles = useMemo(
    () =>
      reglements
        .filter((r) => (!mode || r.mode === mode) && (!statut || r.statut === statut) && (!terme || `${r.numero} ${r.familleLibelle} ${r.reference}`.toLowerCase().includes(terme)))
        .sort((a, b) => b.numero.localeCompare(a.numero)),
    [reglements, mode, statut, terme],
  )
  const valides = reglements.filter((r) => r.statut === 'valide')
  const totalEncaisse = valides.reduce((n, r) => n + r.montantCentimes, 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Receipt className="h-5 w-5 text-emerald-500" />
            Règlements
          </h2>
          <p className="text-xs text-slate-500">
            {valides.length} règlement{valides.length > 1 ? 's' : ''} valide{valides.length > 1 ? 's' : ''}, {formatDH(totalEncaisse)} encaissés. Un règlement ne se supprime pas : on l'annule avec un motif, et son numéro reste attribué.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={reglements.length === 0}
            onClick={() => exportJournalEncaissementsExcel(journalEncaissements())}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Journal des encaissements (Excel)
          </button>
          {canEdit && (
            <button type="button" onClick={onEncaisser} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-emerald-500 hover:to-teal-500">
              <Banknote className="h-4 w-4" />
              Enregistrer un règlement
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice('')} aria-label="Fermer" className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {erreur && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          <span>{erreur}</span>
          <button type="button" onClick={() => setErreur('')} aria-label="Fermer" className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Numéro, famille ou référence…" className={`${INPUT} w-60`} />
        <select value={mode} onChange={(e) => setMode(e.target.value as ModeReglement | '')} className={INPUT} aria-label="Filtrer par mode de paiement">
          <option value="">Tous les modes</option>
          {MODES_REGLEMENT.map((m) => (
            <option key={m} value={m}>
              {MODE_REGLEMENT_LABELS[m]}
            </option>
          ))}
        </select>
        <select value={statut} onChange={(e) => setStatut(e.target.value as StatutReglement | '')} className={INPUT} aria-label="Filtrer par statut">
          <option value="">Valides et annulés</option>
          <option value="valide">Valides</option>
          <option value="annule">Annulés</option>
        </select>
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          {reglements.length === 0 ? 'Aucun règlement enregistré pour le moment.' : 'Aucun règlement ne correspond à ces filtres.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {visibles.map((r) => {
            const annule = r.statut === 'annule'
            const enAnnulation = annulation?.id === r.id ? annulation : null
            return (
              <li key={r.id} className={`rounded-xl border bg-white px-4 py-3 shadow-sm ${annule ? 'border-rose-100 bg-rose-50/30' : 'border-slate-100'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                      <span className={annule ? 'text-slate-400 line-through' : ''}>{r.numero}</span>
                      <span className="font-semibold text-slate-700">{r.familleLibelle}</span>
                      {annule && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">Annulé</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {dateCourte(r.dateReglement)} · {MODE_REGLEMENT_LABELS[r.mode]}
                      {r.reference ? ` — ${r.reference}` : ''}
                    </p>
                    {annule && (
                      <p className="mt-0.5 text-[11px] text-rose-600">
                        Annulé le {dateCourte(r.annuleLe?.slice(0, 10) ?? null)} : {r.motifAnnulation || 'sans motif'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-base font-bold ${annule ? 'text-slate-400 line-through' : 'text-emerald-600'}`}>{formatDH(r.montantCentimes)}</span>
                    <button type="button" onClick={() => onOuvrirRecu(r.id)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      <FileText className="h-3.5 w-3.5" />
                      Reçu
                    </button>
                    {canEdit && !annule && (
                      <button type="button" onClick={() => setAnnulation(enAnnulation ? null : { id: r.id, motif: '' })} className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                        <Ban className="h-3.5 w-3.5" />
                        Annuler
                      </button>
                    )}
                  </div>
                </div>

                {enAnnulation && (
                  <div className="mt-3 space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs font-semibold text-rose-700">
                      Annuler le règlement {r.numero} ? Ses mensualités redeviennent à payer ; le reçu reste consultable, marqué « annulé ».
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input value={enAnnulation.motif} onChange={(e) => setAnnulation({ ...enAnnulation, motif: e.target.value })} className={`${INPUT} min-w-[16rem] flex-1`} placeholder="Motif de l'annulation (obligatoire)" />
                      <button
                        type="button"
                        disabled={annuler.isPending || enAnnulation.motif.trim() === ''}
                        onClick={() =>
                          annuler.mutate(
                            { id: r.id, motif: enAnnulation.motif },
                            {
                              onSuccess: () => {
                                setAnnulation(null)
                                setErreur('')
                                setNotice(`Le règlement ${r.numero} est annulé.`)
                              },
                              onError: (e) => setErreur(e instanceof Error ? e.message : 'Annulation impossible.'),
                            },
                          )
                        }
                        className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Confirmer l'annulation
                      </button>
                      <button type="button" onClick={() => setAnnulation(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                        Fermer
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
