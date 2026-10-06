import { useState } from 'react'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { BUILT_IN_ROLES } from '../../data/profiles'
import { useProfiles } from '../../services/profilesService'
import { useAddProfileType, useDeleteProfileType, useProfileTypes, useRenameProfileType } from '../../services/profileTypesService'

interface ProfileTypesTabProps {
  onSaved: () => void
}

/** Types de profil proposés pour les assistants (CPE, Surveillant, Direction de la vie scolaire…). Les six types
 * d'origine se renomment mais ne se suppriment pas : les droits des notes de service s'appuient dessus. Un type
 * ajouté ici n'a aucun droit particulier. */
export default function ProfileTypesTab({ onSaved }: ProfileTypesTabProps) {
  const { data: types = [] } = useProfileTypes()
  const { data: profiles = [] } = useProfiles()
  const addType = useAddProfileType()
  const renameType = useRenameProfileType()
  const deleteType = useDeleteProfileType()
  const [libelle, setLibelle] = useState('')
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null)

  const handleAdd = () => {
    if (!libelle.trim()) return
    addType.mutate(libelle.trim())
    setLibelle('')
    onSaved()
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-slate-500">
        Les types de profil proposés pour chaque assistant. Renommer un type change son nom partout (cartes, signatures, rapports). Un type ne peut être supprimé que
        si personne ne l'utilise ; les types d'origine ne se suppriment pas.
      </p>

      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Nom du profil</th>
              <th className="px-4 py-3">Personnes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const count = profiles.filter((p) => p.role === t.cle).length
              const builtIn = (BUILT_IN_ROLES as string[]).includes(t.cle)
              const canDelete = !builtIn && count === 0
              return (
                <tr key={t.cle} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <input
                      defaultValue={t.libelle}
                      aria-label="Nom du profil"
                      onBlur={(e) => {
                        const next = e.target.value.trim()
                        if (next && next !== t.libelle) {
                          renameType.mutate({ cle: t.cle, libelle: next })
                          onSaved()
                        } else {
                          e.target.value = t.libelle
                        }
                      }}
                      className="w-full max-w-sm rounded-lg border border-transparent px-2 py-1 text-sm font-medium text-slate-800 hover:border-slate-200 focus:border-indigo-400 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{count}</td>
                  <td className="px-4 py-2.5 text-right">
                    {confirmDeleteKey === t.cle ? (
                      <span className="inline-flex items-center gap-2 text-xs">
                        <span className="font-medium text-rose-600">Supprimer ?</span>
                        <button
                          type="button"
                          onClick={() => {
                            deleteType.mutate(t.cle)
                            setConfirmDeleteKey(null)
                            onSaved()
                          }}
                          className="rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white hover:bg-rose-700"
                        >
                          Confirmer
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteKey(null)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50">
                          Annuler
                        </button>
                      </span>
                    ) : canDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteKey(t.cle)}
                        title="Supprimer ce type"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span
                        title={builtIn ? 'Type d’origine : il se renomme mais ne se supprime pas' : `${count} personne${count > 1 ? 's' : ''} l’utilise${count > 1 ? 'nt' : ''} encore`}
                        className="inline-flex h-8 w-8 items-center justify-center text-slate-300"
                      >
                        <Lock className="h-4 w-4" />
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-4">
        <input
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder="Nom du nouveau profil (ex. Assistante de direction)"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!libelle.trim() || addType.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Ajouter un profil
        </button>
      </div>
    </div>
  )
}
