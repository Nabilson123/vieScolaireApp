import { useRef, useState } from 'react'
import { Wrench, X, ImagePlus } from 'lucide-react'
import { PANNE_CATEGORIES, type Priorite } from '../../data/helpdesk'
import { useDeclarantsOptions } from '../../hooks/useDeclarantsOptions'

interface IncidentModalProps {
  onClose: () => void
  onSubmit: (data: { titre: string; categorie: string; lieu: string; priorite: Priorite; description: string; declarant: string; photo?: string }) => void
}

export default function IncidentModal({ onClose, onSubmit }: IncidentModalProps) {
  const declarants = useDeclarantsOptions()

  const [titre, setTitre] = useState('')
  const [lieu, setLieu] = useState('')
  const [priorite, setPriorite] = useState<Priorite>('NORMALE')
  const [declarant, setDeclarant] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const categorie = PANNE_CATEGORIES.find((c) => c.items.includes(titre))?.categorie ?? 'Autre'
  const canSubmit = titre && lieu && declarant

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({ titre, categorie, lieu, priorite, description, declarant, photo })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Wrench className="h-5 w-5 text-indigo-500" />
            Déclarer un Nouvel Incident
          </h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Titre de l'incident / Panne *</label>
            <select
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <option value="">-- Sélectionner le type de panne / incident --</option>
              {PANNE_CATEGORIES.map((cat) => (
                <optgroup key={cat.categorie} label={cat.categorie}>
                  {cat.items.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Lieu / Salle concernée *</label>
            <input
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              placeholder="ex: Salle 12, Laboratoire 2, Sanitaires 1er étage..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Niveau de Priorité *</label>
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
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Déclarant</label>
              <select
                value={declarant}
                onChange={(e) => setDeclarant(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">Sélectionner le déclarant...</option>
                {declarants.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description détaillée de la panne</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Donnez plus d'explications sur le problème observé..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Photo de la panne (optionnel)</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            {photo ? (
              <div className="relative w-fit">
                <img src={photo} alt="Aperçu de la panne" className="h-24 w-24 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPhoto(undefined)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                <ImagePlus className="h-4 w-4" />
                Ajouter une photo
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
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
