import { HeartPulse, Info, Clock, Pill, AlertTriangle } from 'lucide-react'
import type { SanteInfo } from '../../data/studentDetails'

export default function SanteTab({ sante }: { sante: SanteInfo }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <HeartPulse className="h-4 w-4 text-rose-400" />
        <h3 className="text-sm font-semibold text-slate-800">Dossier Médical & Passages Infirmerie</h3>
      </div>

      {!sante.pai ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5 text-sm text-sky-700">
          <Info className="h-4 w-4 shrink-0" />
          Aucun Projet d'Accueil Individualisé (PAI) répertorié pour cet élève.
        </div>
      ) : (
        <div
          className={`mb-4 rounded-lg border p-3 ${
            sante.pai.niveau === 'CRITIQUE' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div className="mb-1 flex items-center justify-between">
            <span
              className={`flex items-center gap-1.5 text-sm font-bold ${
                sante.pai.niveau === 'CRITIQUE' ? 'text-rose-700' : 'text-amber-700'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              {sante.pai.condition}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                sante.pai.niveau === 'CRITIQUE' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {sante.pai.niveau}
            </span>
          </div>
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Protocole d'urgence :</span> {sante.pai.protocole}
          </p>
        </div>
      )}

      <p className="mb-3 text-sm font-semibold text-slate-700">
        Registre des Passages à l'Infirmerie ({sante.visits.length})
      </p>

      {sante.visits.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucun passage enregistré.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Date & Heure</th>
              <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Motif de la visite
              </th>
              <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Action / Soin apporté
              </th>
              <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Auteur</th>
            </tr>
          </thead>
          <tbody>
            {sante.visits.map((visit, idx) => (
              <tr key={idx} className="border-b border-slate-50 last:border-0">
                <td className="py-3 text-sm text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {visit.heure}
                  </span>
                  <span className="text-xs text-slate-400">{visit.date}</span>
                </td>
                <td className="py-3">
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
                    {visit.motif}
                  </span>
                </td>
                <td className="py-3">
                  <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700">
                    <Pill className="h-3.5 w-3.5 shrink-0" />
                    {visit.action}
                  </span>
                </td>
                <td className="py-3 text-sm text-slate-500">{visit.auteur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
