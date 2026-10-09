import { useState } from 'react'
import { X, ShieldCheck } from 'lucide-react'
import { navGroups } from '../data/navigation'
import { useUpdateProfilePermissions } from '../services/profilesService'
import type { Profile, ModulePermission } from '../data/profiles'
import { CLUBS_PAIEMENTS_KEY, droitParDefaut } from '../utils/clubsDroits'

interface EditPermissionsModalProps {
  profile: Profile
  onClose: () => void
}

type Draft = Record<string, ModulePermission>

function seedDraft(profile: Profile): Draft {
  const draft: Draft = {}
  navGroups.forEach((g) =>
    g.items.forEach((item) => {
      draft[item.key] = profile.permissions[item.key] ?? { view: true, edit: true }
    })
  )
  // L'argent des clubs est refusé par défaut (sauf Direction) : le droit est toujours enregistré explicitement, et jamais
  // perdu à l'enregistrement puisque cette fenêtre réécrit tout l'objet `permissions`.
  draft[CLUBS_PAIEMENTS_KEY] = profile.permissions[CLUBS_PAIEMENTS_KEY] ?? droitParDefaut(profile.role)
  return draft
}

export default function EditPermissionsModal({ profile, onClose }: EditPermissionsModalProps) {
  const [draft, setDraft] = useState<Draft>(() => seedDraft(profile))
  const updatePermissions = useUpdateProfilePermissions()

  // Cocher Éditer force Aperçu ; décocher Aperçu force-décoche Éditer (on ne peut éditer ce qu'on ne voit pas).
  const toggleView = (key: string, view: boolean) =>
    setDraft((prev) => ({ ...prev, [key]: { view, edit: view ? prev[key].edit : false } }))
  const toggleEdit = (key: string, edit: boolean) =>
    setDraft((prev) => ({ ...prev, [key]: { view: edit ? true : prev[key].view, edit } }))

  const handleSubmit = async () => {
    await updatePermissions.mutateAsync({ id: profile.id, permissions: draft })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            Accès de {profile.nomComplet || profile.email}
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {navGroups.map((group) => (
            <div key={group.key}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
                    <span className="truncate text-sm text-slate-700">{item.label}</span>
                    <div className="flex shrink-0 gap-3 text-xs">
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={draft[item.key].view} onChange={(e) => toggleView(item.key, e.target.checked)} />
                        Aperçu
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={draft[item.key].edit} onChange={(e) => toggleEdit(item.key, e.target.checked)} />
                        Éditer
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Argent</p>
            <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-2.5">
              <div className="min-w-0">
                <span className="block truncate text-sm text-slate-700">Paiements des clubs</span>
                <span className="block text-[11px] text-slate-400">Règlements, reçus, mensualités payées et impayés. Réservé à la Direction par défaut.</span>
              </div>
              <div className="flex shrink-0 gap-3 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={draft[CLUBS_PAIEMENTS_KEY].view} onChange={(e) => toggleView(CLUBS_PAIEMENTS_KEY, e.target.checked)} />
                  Aperçu
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={draft[CLUBS_PAIEMENTS_KEY].edit} onChange={(e) => toggleEdit(CLUBS_PAIEMENTS_KEY, e.target.checked)} />
                  Éditer
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={updatePermissions.isPending}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updatePermissions.isPending ? 'Enregistrement...' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  )
}
