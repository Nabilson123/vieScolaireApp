import { useState } from 'react'
import { X, Clock } from 'lucide-react'

const SURVEILLANTS = ['Mme Sanaa Ouahbi', 'M. Rachid Amrani', 'Mme Khadija Idrissi', 'Infirmière scolaire']

interface PointageModalProps {
  studentName: string
  onClose: () => void
  onSubmit: (arrivee: string, sortie: string, surveillant: string) => void
}

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function PointageModal({ studentName, onClose, onSubmit }: PointageModalProps) {
  const [heureArrivee, setHeureArrivee] = useState(nowHHMM())
  const [statutSortie, setStatutSortie] = useState<'maintenu' | 'sorti'>('maintenu')
  const [surveillant, setSurveillant] = useState(SURVEILLANTS[0])

  const handleSubmit = () => {
    const arrivee = `Arrivé à ${heureArrivee}`
    const sortie = statutSortie === 'maintenu' ? 'Maintenu (repas pris)' : `Sorti à ${heureArrivee}`
    onSubmit(arrivee, sortie, surveillant)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Clock className="h-4 w-4 text-indigo-500" />
            Pointer {studentName}
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure d'arrivée au repas</label>
            <input
              type="time"
              value={heureArrivee}
              onChange={(e) => setHeureArrivee(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Statut</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatutSortie('maintenu')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  statutSortie === 'maintenu' ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500'
                }`}
              >
                Maintenu (repas pris)
              </button>
              <button
                type="button"
                onClick={() => setStatutSortie('sorti')}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  statutSortie === 'sorti' ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500'
                }`}
              >
                Sorti
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Surveillant responsable</label>
            <select
              value={surveillant}
              onChange={(e) => setSurveillant(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              {SURVEILLANTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
          >
            Enregistrer le pointage
          </button>
        </div>
      </div>
    </div>
  )
}
