import { useMemo, useState } from 'react'
import { UserCheck, Search, Plus, MoreVertical, UserX, UserCheck2, Trash2, Users2 } from 'lucide-react'
import { useParents, useSetParentActive, useDeleteParent, useParentStudentLinks } from '../services/parentsService'
import { initials } from '../data/profiles'
import { avatarGradient } from '../utils/avatarColor'
import AddParentModal from '../components/AddParentModal'
import ManageParentChildrenModal from '../components/ManageParentChildrenModal'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

export default function ParentsAdminGlobal() {
  const { data: parents = [] } = useParents()
  const { data: links = [] } = useParentStudentLinks()
  const setParentActive = useSetParentActive()
  const deleteParent = useDeleteParent()
  const profile = useCurrentProfile()
  const canEdit = getModuleAccess(profile, 'parentAccounts').canEdit

  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [childrenParentId, setChildrenParentId] = useState<string | null>(null)

  const filteredParents = useMemo(() => {
    return parents.filter(
      (p) => p.nomComplet.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase())
    )
  }, [parents, search])

  const childrenCount = (parentId: string) => links.filter((l) => l.parentId === parentId).length

  const handleToggleActive = (id: string, actif: boolean) => {
    setOpenMenuId(null)
    setParentActive.mutate({ parentId: id, actif })
  }

  const handleDelete = (id: string) => {
    setOpenMenuId(null)
    setConfirmDeleteId(null)
    deleteParent.mutate(id)
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Comptes Parents
            <UserCheck className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">Accès au portail parent — lecture seule, un compte peut couvrir plusieurs enfants.</p>
        </div>
      </div>

      {!canEdit && <NoEditAccessBanner />}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          disabled={!canEdit}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white p-6 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Plus className="h-6 w-6" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Inviter</span>
        </button>

        {filteredParents.map((p) => {
          const isConfirmingDelete = confirmDeleteId === p.id
          return (
            <div
              key={p.id}
              className={`relative flex flex-col items-center gap-3 rounded-2xl border p-6 text-center shadow-sm ${
                p.actif ? 'border-slate-100 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'
              }`}
            >
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              )}

              {canEdit && openMenuId === p.id && (
                <div className="absolute right-2 top-10 z-10 w-52 rounded-xl border border-slate-100 bg-white p-1.5 text-left shadow-lg">
                  {isConfirmingDelete ? (
                    <div className="p-2">
                      <p className="mb-2 text-xs font-medium text-rose-600">Action irréversible. Confirmer ?</p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null)
                          setChildrenParentId(p.id)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Users2 className="h-4 w-4 text-indigo-500" />
                        Gérer les enfants liés
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p.id, !p.actif)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {p.actif ? <UserX className="h-4 w-4 text-amber-500" /> : <UserCheck2 className="h-4 w-4 text-emerald-500" />}
                        {p.actif ? 'Désactiver le compte' : 'Réactiver le compte'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer définitivement
                      </button>
                    </>
                  )}
                </div>
              )}

              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold text-white ${avatarGradient(p.id)}`}
              >
                {initials(p.nomComplet || p.email)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{p.nomComplet || p.email}</p>
                <p className="text-xs text-slate-500">
                  {childrenCount(p.id)} enfant{childrenCount(p.id) !== 1 ? 's' : ''} lié{childrenCount(p.id) !== 1 ? 's' : ''}
                </p>
                {!p.actif && (
                  <span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    Désactivé
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filteredParents.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucun parent ne correspond à la recherche.</p>}

      {showAddModal && <AddParentModal onClose={() => setShowAddModal(false)} />}

      {childrenParentId && (
        <ManageParentChildrenModal
          parent={parents.find((p) => p.id === childrenParentId)!}
          links={links}
          onClose={() => setChildrenParentId(null)}
        />
      )}
    </div>
  )
}
