import { useState } from 'react'
import { X, MessageSquare } from 'lucide-react'

interface CommentaireEnseignantModalProps {
  teacherName: string
  initial?: string
  onClose: () => void
  onSave: (comment: string) => void
}

export default function CommentaireEnseignantModal({ teacherName, initial, onClose, onSave }: CommentaireEnseignantModalProps) {
  const [comment, setComment] = useState(initial ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <MessageSquare className="h-5 w-5 text-indigo-500" />
              Commentaire de l’enseignant
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{teacherName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Réaction / commentaire suite au bilan</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="Le professeur peut ajouter ici sa réaction au bilan (remarque, contestation, précision)..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          />
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
            onClick={() => onSave(comment.trim())}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
