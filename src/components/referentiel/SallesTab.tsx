import { useState } from 'react'
import { Plus, Trash2, AlertTriangle, DoorOpen } from 'lucide-react'
import { fullLabel, detectSalleConflicts } from '../../data/salles'
import { useSalles, useAddSalle, useUpdateSalle, useDeleteSalle } from '../../services/sallesService'

interface SallesTabProps {
  onSaved: () => void
}

export default function SallesTab({ onSaved }: SallesTabProps) {
  const { data: salles = [] } = useSalles()
  const addSalle = useAddSalle()
  const updateSalle = useUpdateSalle()
  const deleteSalle = useDeleteSalle()

  const [nom, setNom] = useState('')
  const [batiment, setBatiment] = useState('')
  const [capacite, setCapacite] = useState(30)

  const conflicts = detectSalleConflicts()

  return (
    <div>
      {conflicts.length > 0 && (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            {conflicts.length} conflit(s) de salle détecté(s)
          </div>
          <div className="space-y-1 text-xs text-rose-600">
            {conflicts.map((c) => (
              <p key={c.salleLabel}>
                <span className="font-semibold">{c.salleLabel}</span> est assignée à {c.classes.length} classes actives :{' '}
                {c.classes.map((cl) => cl.nom).join(', ')}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Bâtiment</th>
              <th className="px-4 py-3">Salle</th>
              <th className="px-4 py-3">Capacité</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {salles.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5">
                  <input
                    defaultValue={s.batiment}
                    onBlur={(e) => {
                      if (e.target.value !== s.batiment) {
                        updateSalle.mutate({ ...s, batiment: e.target.value })
                        onSaved()
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    defaultValue={s.nom}
                    onBlur={(e) => {
                      if (e.target.value !== s.nom) {
                        updateSalle.mutate({ ...s, nom: e.target.value })
                        onSaved()
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="number"
                    min={1}
                    defaultValue={s.capacite}
                    onBlur={(e) => {
                      const next = Number(e.target.value)
                      if (next !== s.capacite) {
                        updateSalle.mutate({ ...s, capacite: next })
                        onSaved()
                      }
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      deleteSalle.mutate(s.id)
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
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 p-3">
        <DoorOpen className="h-4 w-4 text-slate-400" />
        <input value={batiment} onChange={(e) => setBatiment(e.target.value)} placeholder="Bâtiment" className="w-44 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de la salle" className="w-44 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <input
          type="number"
          min={1}
          value={capacite}
          onChange={(e) => setCapacite(Number(e.target.value))}
          className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!nom.trim() || !batiment.trim()) return
            addSalle.mutate({ nom: nom.trim(), batiment: batiment.trim(), capacite })
            setNom('')
            setBatiment('')
            onSaved()
          }}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une salle
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Utilisez <code className="rounded bg-slate-100 px-1 py-0.5">{fullLabel(salles[0] ?? { id: '', nom: '', batiment: '—', capacite: 0 })}</code> comme format pour
        assigner une salle à une classe dans Structure Scolaire.
      </p>
    </div>
  )
}
