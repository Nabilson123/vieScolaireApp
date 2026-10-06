import { useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { RECLAMATION_CATEGORIES } from '../../data/studentDetails'
import { useAddReclamationService, useDeleteReclamationService, useReclamationServices, useUpdateReclamationService } from '../../services/reclamationServicesService'
import { useProfiles } from '../../services/profilesService'
import { categoriesWithoutService, membersOf, toggleCategory } from '../../utils/reclamationsServices'

interface ReclamationServicesTabProps {
  onSaved: () => void
}

/** Services qui traitent les réclamations : chacun a une liste de catégories (une catégorie n'appartient qu'à un
 * service) et ses membres se choisissent sur la page Assistants. */
export default function ReclamationServicesTab({ onSaved }: ReclamationServicesTabProps) {
  const { data: services = [] } = useReclamationServices()
  const { data: profiles = [] } = useProfiles()
  const addService = useAddReclamationService()
  const updateService = useUpdateReclamationService()
  const deleteService = useDeleteReclamationService()
  const [nom, setNom] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const sansService = categoriesWithoutService(services, RECLAMATION_CATEGORIES)
  const serviceOfCategory = (category: string) => services.find((s) => s.categories.includes(category))

  const handleToggle = (serviceId: string, category: string, checked: boolean) => {
    toggleCategory(services, serviceId, category, checked).forEach((s) => updateService.mutate(s))
    onSaved()
  }

  const handleAdd = () => {
    if (!nom.trim()) return
    addService.mutate({ nom: nom.trim() })
    setNom('')
    onSaved()
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-slate-500">
        Chaque réclamation est traitée par le service qui s'occupe de sa catégorie. Une catégorie ne peut appartenir qu'à un service : la cocher pour un service la retire de l'autre.
        Les personnes d'un service se choisissent sur la page Assistants.
      </p>

      {sansService.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">Catégories sans service :</span> {sansService.join(', ')}. Les réclamations de ces catégories n'ont pas de service.
          </span>
        </div>
      )}

      {services.map((s) => {
        const members = membersOf(s, profiles)
        return (
          <div key={s.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <input
                defaultValue={s.nom}
                aria-label="Nom du service"
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next && next !== s.nom) {
                    updateService.mutate({ ...s, nom: next })
                    onSaved()
                  } else {
                    e.target.value = s.nom
                  }
                }}
                className="min-w-[220px] flex-1 rounded-lg border border-transparent px-2 py-1 text-base font-bold text-slate-900 hover:border-slate-200 focus:border-indigo-400 focus:outline-none"
              />
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600" title={members.map((m) => m.nomComplet || m.email).join(', ')}>
                {members.length} membre{members.length > 1 ? 's' : ''}
              </span>
              {confirmDeleteId === s.id ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-rose-600">Supprimer ce service ?</span>
                  <button
                    type="button"
                    onClick={() => {
                      deleteService.mutate(s.id)
                      setConfirmDeleteId(null)
                      onSaved()
                    }}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white hover:bg-rose-700"
                  >
                    Confirmer
                  </button>
                  <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50">
                    Annuler
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(s.id)}
                  title="Supprimer le service"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Catégories traitées</p>
            <div className="flex flex-wrap gap-1.5">
              {RECLAMATION_CATEGORIES.map((c) => {
                const owner = serviceOfCategory(c)
                const mine = owner?.id === s.id
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleToggle(s.id, c, !mine)}
                    aria-pressed={mine}
                    title={mine ? 'Cliquer pour retirer' : owner ? `Traitée par « ${owner.nom} » : cliquer pour la déplacer ici` : 'Cliquer pour l’ajouter'}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      mine ? 'border-indigo-500 bg-indigo-600 text-white' : owner ? 'border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100' : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-4">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder="Nom du nouveau service (ex. Bibliothèque)"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!nom.trim() || addService.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Ajouter un service
        </button>
      </div>
    </div>
  )
}
