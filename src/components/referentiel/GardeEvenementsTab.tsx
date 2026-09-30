import { useState } from 'react'
import { Plus, Trash2, ShieldCheck } from 'lucide-react'
import {
  useGardeEvenements,
  useAddGardeEvenement,
  useUpdateGardeEvenement,
  useDeleteGardeEvenement,
  type GardeEvenement,
} from '../../services/gardeEvenementsService'
import { useGardeFamilles } from '../../services/gardeFamillesService'

interface GardeEvenementsTabProps {
  onSaved: () => void
}

const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(COMBINING_DIACRITICS, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `evt_${Date.now()}`
  )
}

export default function GardeEvenementsTab({ onSaved }: GardeEvenementsTabProps) {
  const { data: evenements = [] } = useGardeEvenements()
  const { data: familles = [] } = useGardeFamilles()
  const addEvenement = useAddGardeEvenement()
  const updateEvenement = useUpdateGardeEvenement()
  const deleteEvenement = useDeleteGardeEvenement()

  const [label, setLabel] = useState('')
  const [familleKey, setFamilleKey] = useState('neutral')

  return (
    <div className="max-w-2xl">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <ShieldCheck className="h-4 w-4 text-indigo-500" />
        Événements du Planning de Garde
      </p>
      <p className="mb-3 text-xs text-slate-400">
        Postes proposés lors de l'affectation des créneaux dans le module Garde. La couleur affichée sur le planning se règle par famille,
        directement dans l'écran Garde (légende à côté de la grille).
      </p>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Libellé</th>
              <th className="px-4 py-3">Famille</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {evenements.map((ev: GardeEvenement) => (
              <tr key={ev.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5">
                  <input
                    defaultValue={ev.label}
                    onBlur={(e) => {
                      if (e.target.value !== ev.label) {
                        updateEvenement.mutate({ ...ev, label: e.target.value })
                        onSaved()
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={ev.familleKey}
                    onChange={(e) => {
                      updateEvenement.mutate({ ...ev, familleKey: e.target.value })
                      onSaved()
                    }}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {familles.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      deleteEvenement.mutate(ev.id)
                      onSaved()
                    }}
                    className="text-rose-500 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {evenements.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucun événement enregistré.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 p-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Libellé (ex : ACCUEIL)"
          className="w-64 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <select value={familleKey} onChange={(e) => setFamilleKey(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          {familles.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (!label.trim()) return
            const id = slugify(label.trim())
            if (evenements.some((e) => e.id === id)) return
            addEvenement.mutate({ id, label: label.trim(), familleKey })
            setLabel('')
            onSaved()
          }}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>
    </div>
  )
}
