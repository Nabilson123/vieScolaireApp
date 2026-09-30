import { useState } from 'react'
import { X, CalendarClock } from 'lucide-react'
import type { Priorite } from '../../data/helpdesk'
import { TYPE_DEMANDE_LABELS, TYPE_DEMANDE_ICONS, type TypeDemande } from '../../data/helpdeskDemandes'
import { useDeclarantsOptions } from '../../hooks/useDeclarantsOptions'

interface DemandeModalProps {
  onClose: () => void
  onSubmit: (data: {
    type: TypeDemande
    titre: string
    lieu: string
    description: string
    priorite: Priorite
    dateCible: string
    heureCible?: string
    declarant: string
  }) => void
}

const TYPES: TypeDemande[] = ['AMELIORATION', 'ACTIVITE_PREPARATION']

export default function DemandeModal({ onClose, onSubmit }: DemandeModalProps) {
  const declarants = useDeclarantsOptions()

  const [type, setType] = useState<TypeDemande>('AMELIORATION')
  const [titre, setTitre] = useState('')
  const [lieu, setLieu] = useState('')
  const [priorite, setPriorite] = useState<Priorite>('NORMALE')
  const [dateCible, setDateCible] = useState('')
  const [heureCible, setHeureCible] = useState('')
  const [declarant, setDeclarant] = useState('')
  const [description, setDescription] = useState('')

  const canSubmit = titre.trim() && dateCible && declarant

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({ type, titre: titre.trim(), lieu: lieu.trim(), description, priorite, dateCible, heureCible: heureCible || undefined, declarant })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <CalendarClock className="h-5 w-5 text-indigo-500" />
            Nouvelle Amélioration / Activité
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
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    type === t ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {TYPE_DEMANDE_ICONS[t]} {TYPE_DEMANDE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Titre *</label>
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="ex: Réaménager la cour de récréation, Kermesse de fin d'année..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Lieu (optionnel)</label>
            <input
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              placeholder="ex: Cour de récréation, Salle polyvalente..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Priorité *</label>
              <select
                value={priorite}
                onChange={(e) => setPriorite(e.target.value as Priorite)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="URGENT">Urgent</option>
                <option value="NORMALE">Normale</option>
                <option value="BASSE">Basse</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Déclarant *</label>
              <select
                value={declarant}
                onChange={(e) => setDeclarant(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Sélectionner...</option>
                {declarants.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date cible *</label>
              <input
                type="date"
                value={dateCible}
                onChange={(e) => setDateCible(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure cible (optionnel)</label>
              <input
                type="time"
                value={heureCible}
                onChange={(e) => setHeureCible(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description</label>
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
            Enregistrer la Demande
          </button>
        </div>
      </div>
    </div>
  )
}
