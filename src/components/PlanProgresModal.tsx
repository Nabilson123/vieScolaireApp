import { useState } from 'react'
import { X, Target, Plus, Trash2 } from 'lucide-react'
import type { PlanProgresItem } from '../data/inspections'

interface PlanProgresModalProps {
  teacherName: string
  planProgres: PlanProgresItem[]
  onClose: () => void
  onSave: (items: PlanProgresItem[]) => void
  isEditable: boolean
}

const STATUT_OPTIONS: PlanProgresItem['statut'][] = ['En cours', 'Atteint', 'Non atteint']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function PlanProgresModal({ teacherName, planProgres, onClose, onSave, isEditable }: PlanProgresModalProps) {
  const [items, setItems] = useState<PlanProgresItem[]>(planProgres)
  const [objectif, setObjectif] = useState('')
  const [echeance, setEcheance] = useState(todayISO())

  const handleAdd = () => {
    if (!objectif.trim()) return
    setItems((prev) => [...prev, { objectif: objectif.trim(), echeance, statut: 'En cours' }])
    setObjectif('')
  }

  const handleStatutChange = (idx: number, statut: PlanProgresItem['statut']) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, statut } : it)))
  }

  const handleDelete = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Target className="h-5 w-5 text-indigo-500" />
              Plan de Progrès
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

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">Aucun objectif défini pour l’instant.</p>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{item.objectif}</p>
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    disabled={!isEditable}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>Échéance : {item.echeance}</span>
                  <select
                    value={item.statut}
                    onChange={(e) => handleStatutChange(idx, e.target.value as PlanProgresItem['statut'])}
                    disabled={!isEditable}
                    className={`rounded-lg border px-2 py-1 text-xs font-semibold focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                      item.statut === 'Atteint'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        : item.statut === 'Non atteint'
                          ? 'border-rose-200 bg-rose-50 text-rose-600'
                          : 'border-amber-200 bg-amber-50 text-amber-600'
                    }`}
                  >
                    {STATUT_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}

          {isEditable && (
            <div className="rounded-xl border border-dashed border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">Ajouter un objectif</p>
              <input
                type="text"
                value={objectif}
                onChange={(e) => setObjectif(e.target.value)}
                placeholder="ex: Diversifier les outils numériques en classe"
                className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={echeance}
                  onChange={(e) => setEcheance(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!objectif.trim()}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter
                </button>
              </div>
            </div>
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
            onClick={() => onSave(items)}
            disabled={!isEditable}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
