import { Pencil, Printer } from 'lucide-react'
import type { FilteredNoteRow } from '../../utils/studentAggregation'

export default function NotesTab({ notes }: { notes: FilteredNoteRow[] }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Pencil className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800">Relevé des Notes & Bulletins</h3>
      </div>

      {notes.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucune note enregistrée.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Matière</th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Coef</th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Évaluations (Notes)
              </th>
              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                Moyenne
              </th>
            </tr>
          </thead>
          <tbody>
            {notes.map((row) => (
              <tr key={row.subject} className="border-b border-slate-50 last:border-0">
                <td className="py-4 text-sm font-semibold text-slate-900">{row.subject}</td>
                <td className="py-4 text-sm text-slate-600">{row.coef}</td>
                <td className="py-4 text-sm text-slate-600">
                  {row.values.length ? row.values.map((n) => n.toFixed(1)).join(', ') : '—'}
                </td>
                <td className="py-4 text-right text-sm font-bold text-emerald-600">
                  {row.moyenne === null ? '—' : row.moyenne.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
        >
          <Printer className="h-4 w-4" />
          Télécharger Bulletin PDF A4
        </button>
      </div>
    </div>
  )
}
