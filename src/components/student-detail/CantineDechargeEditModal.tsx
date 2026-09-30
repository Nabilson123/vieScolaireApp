import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import type { CantineInfo, Responsable } from '../../data/studentDetails'

interface CantineDechargeEditModalProps {
  cantine: CantineInfo
  onClose: () => void
  onSave: (cantine: CantineInfo) => void
}

const MODALITES = ['Sortie accompagnée', "Sortie seul(e) (Accord signé)", 'Maintien sur place (Interdiction)']
const RELATIONS = ['Père', 'Mère', 'Tuteur légal', 'Grand-parent', 'Oncle', 'Tante', 'Autre']

function todayFR() {
  return new Date().toLocaleDateString('fr-FR')
}

function toIsoDate(frDate: string): string {
  const m = frDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

function fromIsoDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

export default function CantineDechargeEditModal({ cantine, onClose, onSave }: CantineDechargeEditModalProps) {
  const [dechargeSignee, setDechargeSignee] = useState(cantine.dechargeSignee)
  const [dechargeDate, setDechargeDate] = useState(cantine.dechargeDate)
  const [modaliteSortie, setModaliteSortie] = useState(cantine.modaliteSortie)
  const [responsables, setResponsables] = useState<Responsable[]>(cantine.responsables)

  const handleToggleSignee = (checked: boolean) => {
    setDechargeSignee(checked)
    if (checked && !dechargeDate) setDechargeDate(todayFR())
  }

  const updateResponsable = (idx: number, patch: Partial<Responsable>) => {
    setResponsables((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  const addResponsable = () => setResponsables((prev) => [...prev, { name: '', relation: '', phone: '' }])
  const removeResponsable = (idx: number) => setResponsables((prev) => prev.filter((_, i) => i !== idx))

  const handleSave = () => {
    onSave({
      ...cantine,
      dechargeSignee,
      dechargeDate: dechargeSignee ? dechargeDate : '',
      modaliteSortie,
      interdictionSortie: modaliteSortie === 'Maintien sur place (Interdiction)',
      responsables: responsables.filter((r) => r.name.trim() !== ''),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Décharge Parentale & Mode de Sortie</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={dechargeSignee}
              onChange={(e) => handleToggleSignee(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
            />
            Décharge parentale signée
          </label>

          {dechargeSignee && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date de validation</label>
              <input
                type="date"
                value={toIsoDate(dechargeDate)}
                onChange={(e) => setDechargeDate(fromIsoDate(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Modalité de sortie</label>
            <select
              value={modaliteSortie}
              onChange={(e) => setModaliteSortie(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              {MODALITES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">Responsables habilités à récupérer l'élève</label>
              <button
                type="button"
                onClick={addResponsable}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {responsables.map((r, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2">
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => updateResponsable(idx, { name: e.target.value })}
                    placeholder="Nom"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                  />
                  <select
                    value={r.relation}
                    onChange={(e) => updateResponsable(idx, { relation: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">Relation...</option>
                    {RELATIONS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={r.phone}
                    onChange={(e) => updateResponsable(idx, { phone: e.target.value })}
                    placeholder="Téléphone"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeResponsable(idx)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {responsables.length === 0 && <p className="py-2 text-center text-xs text-slate-400">Aucun responsable ajouté.</p>}
            </div>
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
            onClick={handleSave}
            className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  )
}
