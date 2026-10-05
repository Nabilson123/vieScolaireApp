import { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'

interface ResolveReclamationModalProps {
  title: string
  onClose: () => void
  onSubmit: (resolution: string) => void
}

/** Saisie de la solution quand une réclamation est glissée vers « Résolues » : jamais de résolution sans texte. */
export default function ResolveReclamationModal({ title, onClose, onSubmit }: ResolveReclamationModalProps) {
  const [draft, setDraft] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Résoudre la réclamation
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-6 py-5">
          <p className="text-sm font-medium text-slate-700">{title}</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Décrire la solution apportée..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => draft.trim() && onSubmit(draft.trim())}
            disabled={!draft.trim()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Valider la résolution
          </button>
        </div>
      </div>
    </div>
  )
}
