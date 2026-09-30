import { useState } from 'react'
import { X, Lock } from 'lucide-react'
import type { CantineInfo } from '../../data/studentDetails'

interface CantineInterdictionEditModalProps {
  cantine: CantineInfo
  onClose: () => void
  onSave: (cantine: CantineInfo) => void
}

export default function CantineInterdictionEditModal({ cantine, onClose, onSave }: CantineInterdictionEditModalProps) {
  const [interdictionSortie, setInterdictionSortie] = useState(cantine.interdictionSortie)
  const [interdictionMessage, setInterdictionMessage] = useState(cantine.interdictionMessage)
  const [interdictionHoraire, setInterdictionHoraire] = useState(cantine.interdictionHoraire)

  const handleSave = () => {
    onSave({
      ...cantine,
      interdictionSortie,
      interdictionMessage: interdictionSortie ? interdictionMessage : '',
      interdictionHoraire: interdictionSortie ? interdictionHoraire : '',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Lock className="h-5 w-5 text-rose-500" />
            Gérer l'Autorisation de Sortie
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={interdictionSortie}
              onChange={(e) => setInterdictionSortie(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-400"
            />
            Interdiction de sortir de l'établissement (maintien obligatoire)
          </label>

          {interdictionSortie && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure de maintien</label>
                <input
                  type="text"
                  value={interdictionHoraire}
                  onChange={(e) => setInterdictionHoraire(e.target.value)}
                  placeholder="Ex: 16h30"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Message affiché au surveillant</label>
                <textarea
                  value={interdictionMessage}
                  onChange={(e) => setInterdictionMessage(e.target.value)}
                  rows={3}
                  placeholder="Ex: Maintien obligatoire dans l'enceinte de l'école jusqu'à la fin des cours"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </>
          )}
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
            onClick={handleSave}
            className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  )
}
