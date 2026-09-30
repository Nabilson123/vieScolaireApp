import { useState } from 'react'
import { PhoneCall, X } from 'lucide-react'
import type { ParentToCall } from '../utils/liveCockpitAggregation'

const AUTRE_SENTINEL = '__AUTRE__'
const LES_DEUX_SENTINEL = '__LES_DEUX__'

interface MarquerAppelParentModalProps {
  eleve: ParentToCall
  onClose: () => void
  onConfirm: (note: string, parentAppele: string) => void
  isSaving?: boolean
}

export default function MarquerAppelParentModal({ eleve, onClose, onConfirm, isSaving = false }: MarquerAppelParentModalProps) {
  const [note, setNote] = useState('')
  const [parentSelect, setParentSelect] = useState('')
  const [parentAutre, setParentAutre] = useState('')

  const parentOptions = [
    { key: 'parent1', label: (eleve.parent1Nom || 'Parent 1').trim(), show: !!eleve.parent1Tel },
    { key: 'parent2', label: (eleve.parent2Nom || 'Parent 2').trim(), show: !!eleve.parent2Tel },
  ].filter((p) => p.show)

  const parentAppele = parentSelect === AUTRE_SENTINEL ? parentAutre.trim() : parentSelect === LES_DEUX_SENTINEL ? 'Les deux parents' : parentSelect

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <PhoneCall className="h-5 w-5 text-indigo-600" />
            Marquer l'appel fait
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
            <p className="text-sm font-semibold text-slate-900">
              {eleve.studentName} <span className="font-normal text-slate-400">{eleve.classe}</span>
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {eleve.reasons.map((r, i) => (
                <li key={i} className="text-xs text-slate-500">
                  · {r}
                </li>
              ))}
            </ul>
          </div>

          {(eleve.parent1Tel || eleve.parent2Tel) && (
            <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-600">
              {eleve.parent1Tel && (
                <p>
                  {eleve.parent1Nom || 'Parent 1'} : <span className="font-semibold text-slate-800">{eleve.parent1Tel}</span>
                </p>
              )}
              {eleve.parent2Tel && (
                <p>
                  {eleve.parent2Nom || 'Parent 2'} : <span className="font-semibold text-slate-800">{eleve.parent2Tel}</span>
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Parent appelé</label>
            <select
              value={parentSelect}
              onChange={(e) => {
                setParentSelect(e.target.value)
                if (e.target.value !== AUTRE_SENTINEL) setParentAutre('')
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">Sélectionner...</option>
              {parentOptions.map((p) => (
                <option key={p.key} value={p.label}>
                  {p.label}
                </option>
              ))}
              {parentOptions.length > 1 && <option value={LES_DEUX_SENTINEL}>Les deux parents</option>}
              <option value={AUTRE_SENTINEL}>Autre / Non renseigné...</option>
            </select>
            {parentSelect === AUTRE_SENTINEL && (
              <input
                type="text"
                value={parentAutre}
                onChange={(e) => setParentAutre(e.target.value)}
                placeholder="ex : Tuteur légal, Grand-mère..."
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Note (optionnel)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ex. Parent informé, rappel demandé, injoignable..."
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
            onClick={() => onConfirm(note, parentAppele)}
            disabled={isSaving || !parentAppele}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Enregistrement...' : "Confirmer l'appel"}
          </button>
        </div>
      </div>
    </div>
  )
}
