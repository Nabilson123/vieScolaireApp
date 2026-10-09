import { useMemo, useState } from 'react'
import { BarChart3, Printer } from 'lucide-react'
import { useClubsFinance } from '../../hooks/useClubsFinance'
import { bilanParClub, formatDH, libelleMois } from '../../utils/clubsFinance'
import ClubsFinancePrintPreviewModal, { type DocumentFinance } from '../clubs-print/ClubsFinancePrintPreviewModal'

const INPUT = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none'

function couleurTaux(t: number | null): string {
  if (t === null) return 'bg-slate-300'
  return t >= 90 ? 'bg-emerald-500' : t >= 60 ? 'bg-amber-500' : 'bg-rose-500'
}

/** Bilan des clubs : ce qui était attendu, ce qui est encaissé et le taux de recouvrement, par mois et par club. */
export default function BilanPanel() {
  const { lignes, clubs, aujourdhui } = useClubsFinance()
  const [club, setClub] = useState('')
  const [document, setDocument] = useState<DocumentFinance | null>(null)

  const bilans = useMemo(() => bilanParClub(lignes.filter((l) => !club || l.clubId === club)), [lignes, club])
  const attendu = bilans.reduce((n, b) => n + b.total.attenduCentimes, 0)
  const encaisse = bilans.reduce((n, b) => n + b.total.encaisseCentimes, 0)
  const taux = attendu > 0 ? Math.round((encaisse / attendu) * 100) : null

  const tuiles = [
    { label: 'Attendu', valeur: formatDH(attendu), ton: 'text-slate-900' },
    { label: 'Encaissé', valeur: formatDH(encaisse), ton: 'text-emerald-600' },
    { label: 'Reste', valeur: formatDH(attendu - encaisse), ton: attendu - encaisse > 0 ? 'text-rose-600' : 'text-slate-900' },
    { label: 'Taux de recouvrement', valeur: taux === null ? '—' : `${taux} %`, ton: 'text-slate-900' },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <BarChart3 className="h-5 w-5 text-amber-500" />
            Bilan
          </h2>
          <p className="text-xs text-slate-500">Chaque paiement est compté dans le mois qu'il règle. Les élèves exonérés n'entrent pas dans l'attendu.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={club} onChange={(e) => setClub(e.target.value)} className={INPUT} aria-label="Filtrer par club">
            <option value="">Tous les clubs</option>
            {clubs
              .slice()
              .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={bilans.length === 0}
            onClick={() => setDocument({ type: 'bilan', bilans, aujourdhui })}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Bilan mensuel (PDF)
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tuiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.label}</p>
            <p className={`mt-0.5 text-lg font-bold ${t.ton}`}>{t.valeur}</p>
          </div>
        ))}
      </div>

      {bilans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">Aucune mensualité pour le moment : inscrivez d'abord des élèves à un club.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {bilans.map((b) => (
            <section key={b.clubId} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900">{b.clubNom}</h3>
                <span className="text-sm font-bold text-slate-700">{b.total.tauxPct === null ? '—' : `${b.total.tauxPct} %`}</span>
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="py-1">Mois</th>
                    <th className="py-1 text-right">Attendu</th>
                    <th className="py-1 text-right">Encaissé</th>
                    <th className="py-1 text-right">Reste</th>
                    <th className="w-20 py-1 pl-3" />
                  </tr>
                </thead>
                <tbody>
                  {b.mois.map((m) => (
                    <tr key={m.mois} className="border-t border-slate-50">
                      <td className="py-1 font-medium text-slate-700">{libelleMois(m.mois)}</td>
                      <td className="py-1 text-right text-slate-700">{formatDH(m.attenduCentimes)}</td>
                      <td className="py-1 text-right text-emerald-600">{formatDH(m.encaisseCentimes)}</td>
                      <td className={`py-1 text-right font-semibold ${m.resteCentimes > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{formatDH(m.resteCentimes)}</td>
                      <td className="py-1 pl-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${couleurTaux(m.tauxPct)}`} style={{ width: `${m.tauxPct ?? 0}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-amber-200 font-bold">
                    <td className="py-1.5 text-slate-900">Total</td>
                    <td className="py-1.5 text-right text-slate-900">{formatDH(b.total.attenduCentimes)}</td>
                    <td className="py-1.5 text-right text-emerald-600">{formatDH(b.total.encaisseCentimes)}</td>
                    <td className={`py-1.5 text-right ${b.total.resteCentimes > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{formatDH(b.total.resteCentimes)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      {document && <ClubsFinancePrintPreviewModal document={document} onClose={() => setDocument(null)} />}
    </div>
  )
}
