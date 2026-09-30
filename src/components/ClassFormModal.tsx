import { useState } from 'react'
import { X, School } from 'lucide-react'
import { NIVEAUX_ORDER, type SchoolClass } from '../data/schoolStructure'

interface ClassFormModalProps {
  onClose: () => void
  onSubmit: (data: Omit<SchoolClass, 'id'>) => void
  initial?: SchoolClass
  mode?: 'create' | 'edit' | 'duplicate'
}

export default function ClassFormModal({ onClose, onSubmit, initial, mode = initial ? 'edit' : 'create' }: ClassFormModalProps) {
  const [nom, setNom] = useState(mode === 'duplicate' ? '' : (initial?.nom ?? ''))
  const [niveau, setNiveau] = useState(initial?.niveau ?? NIVEAUX_ORDER[0])
  const [capaciteMax, setCapaciteMax] = useState(initial?.capaciteMax ?? 30)
  const [salle, setSalle] = useState(initial?.salle ?? '')
  const [statut, setStatut] = useState<SchoolClass['statut']>(mode === 'duplicate' ? 'Active' : (initial?.statut ?? 'Active'))

  const canSubmit = nom.trim() && capaciteMax > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({ nom: nom.trim(), niveau, capaciteMax, salle: salle.trim(), statut, professeurPrincipalId: mode === 'duplicate' ? undefined : initial?.professeurPrincipalId })
  }

  const title = mode === 'edit' ? 'Modifier la Classe' : mode === 'duplicate' ? 'Dupliquer la Classe' : 'Nouvelle Classe'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <School className="h-5 w-5 text-indigo-500" />
            {title}
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
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nom de la classe*</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="ex: CE1-C"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Niveau*</label>
            <select
              value={niveau}
              onChange={(e) => setNiveau(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              {NIVEAUX_ORDER.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Capacité max*</label>
              <input
                type="number"
                min={1}
                value={capaciteMax}
                onChange={(e) => setCapaciteMax(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Statut</label>
              <select
                value={statut}
                onChange={(e) => setStatut(e.target.value as SchoolClass['statut'])}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="Active">Active</option>
                <option value="Archivée">Archivée</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Salle</label>
            <input
              type="text"
              value={salle}
              onChange={(e) => setSalle(e.target.value)}
              placeholder="ex: Bâtiment Primaire - Salle 13"
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
            {mode === 'edit' ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}
