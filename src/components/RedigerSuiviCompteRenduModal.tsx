import { useState } from 'react'
import { X, FileText } from 'lucide-react'

interface RedigerSuiviCompteRenduModalProps {
  initial?: string
  onClose: () => void
  onSubmit: (notes: string) => void
}

export default function RedigerSuiviCompteRenduModal({ initial, onClose, onSubmit }: RedigerSuiviCompteRenduModalProps) {
  const [notes, setNotes] = useState(initial ?? '')

  const handleSubmit = () => {
    onSubmit(notes.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileText className="h-5 w-5 text-emerald-500" />
            Compte-rendu du suivi
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Résumé de l'entretien</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            autoFocus
            placeholder="Points abordés, décisions, suites à donner..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          />
          <p className="mt-2 text-xs text-slate-400">Enregistrer marque ce suivi comme Réalisé.</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-emerald-500 hover:to-teal-500"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
