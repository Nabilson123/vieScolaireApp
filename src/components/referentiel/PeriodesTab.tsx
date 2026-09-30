import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { usePeriodes, useAddPeriode, useUpdatePeriode, useDeletePeriode } from '../../services/periodesService'
import type { Periode } from '../../data/periodes'

interface PeriodesTabProps {
  onSaved: () => void
}

export default function PeriodesTab({ onSaved }: PeriodesTabProps) {
  const { data: periodes = [] } = usePeriodes()
  const addPeriode = useAddPeriode()
  const updatePeriode = useUpdatePeriode()
  const deletePeriode = useDeletePeriode()

  const [type, setType] = useState<Periode['type']>('Trimestre')
  const [nom, setNom] = useState('')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  const patch = (p: Periode, next: Partial<Periode>) => {
    updatePeriode.mutate({ ...p, ...next })
    onSaved()
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Début</th>
              <th className="px-4 py-3">Fin</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {periodes.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5 text-slate-600">{p.type}</td>
                <td className="px-4 py-2.5">
                  <input
                    value={p.nom}
                    onChange={(e) => patch(p, { nom: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="date"
                    value={p.dateDebut}
                    onChange={(e) => patch(p, { dateDebut: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="date"
                    value={p.dateFin}
                    onChange={(e) => patch(p, { dateFin: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      deletePeriode.mutate(p.id)
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
        <select value={type} onChange={(e) => setType(e.target.value as Periode['type'])} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          <option value="Trimestre">Trimestre</option>
          <option value="Semestre">Semestre</option>
        </select>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom (ex: Trimestre 1)" className="w-48 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <button
          type="button"
          onClick={() => {
            if (!nom.trim() || !dateDebut || !dateFin) return
            addPeriode.mutate({ type, nom: nom.trim(), dateDebut, dateFin })
            setNom('')
            setDateDebut('')
            setDateFin('')
            onSaved()
          }}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une période
        </button>
      </div>
    </div>
  )
}
