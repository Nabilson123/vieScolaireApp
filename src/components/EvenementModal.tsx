import { useState } from 'react'
import { X, Flag } from 'lucide-react'
import { getActiveClassNamesSnapshot } from '../services/classesService'

interface EvenementModalProps {
  onClose: () => void
  onSubmit: (data: { titre: string; date: string; heure?: string; description: string; classes: string[] }) => void
  initial?: { titre: string; date: string; heure?: string; description: string; classes: string[] }
}

export default function EvenementModal({ onClose, onSubmit, initial }: EvenementModalProps) {
  const [titre, setTitre] = useState(initial?.titre ?? '')
  const [date, setDate] = useState(initial?.date ?? '')
  const [heure, setHeure] = useState(initial?.heure ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [classes, setClasses] = useState<string[]>(initial?.classes ?? [])

  const canSubmit = titre.trim() && date

  const toggleClasse = (c: string) => {
    setClasses((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({ titre: titre.trim(), date, heure: heure || undefined, description, classes })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Flag className="h-5 w-5 text-indigo-500" />
            {initial ? "Modifier l'Événement" : 'Nouvel Événement'}
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
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Titre *</label>
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="ex: Élections des délégués de classe"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure (optionnel)</label>
              <input
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Classes concernées</label>
            <p className="mb-2 text-xs text-slate-400">Laisser vide = concerne toute l'école.</p>
            <div className="grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2.5">
              {getActiveClassNamesSnapshot().map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={classes.includes(c)} onChange={() => toggleClasse(c)} className="h-3.5 w-3.5 rounded border-slate-300" />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description (optionnel)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Donnez plus de détails..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
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
            disabled={!canSubmit}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
