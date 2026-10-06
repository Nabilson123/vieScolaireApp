import { useMemo, useState } from 'react'
import { Users, Search, Plus, MoreVertical, UserX, UserCheck2, Trash2, ShieldCheck, Pencil } from 'lucide-react'
import { useProfiles, useSetUserActive, useDeleteUser } from '../services/profilesService'
import { useReclamationServices } from '../services/reclamationServicesService'
import { useCurrentUserId } from '../services/currentUser'
import { initials } from '../data/profiles'
import { roleLabel, useProfileTypes } from '../services/profileTypesService'
import { avatarGradient } from '../utils/avatarColor'
import AddUserModal from '../components/AddUserModal'
import EditPermissionsModal from '../components/EditPermissionsModal'
import EditOwnProfileModal from '../components/EditOwnProfileModal'
import EditUserModal from '../components/EditUserModal'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

export default function UsersGlobal() {
  const { data: profiles = [] } = useProfiles()
  const setUserActive = useSetUserActive()
  const deleteUser = useDeleteUser()
  const currentUserId = useCurrentUserId()
  const profile = useCurrentProfile()
  const canEdit = getModuleAccess(profile, 'users').canEdit

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('Tous les profils')
  const [serviceFilter, setServiceFilter] = useState('')
  const { data: services = [] } = useReclamationServices()
  // S'abonne aux types de profil : les libellés affichés se mettent à jour dès leur chargement.
  useProfileTypes()
  const [showAddModal, setShowAddModal] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [permissionsProfileId, setPermissionsProfileId] = useState<string | null>(null)
  const [showOwnProfileModal, setShowOwnProfileModal] = useState(false)
  const [editProfileId, setEditProfileId] = useState<string | null>(null)

  const availableRoles = useMemo(() => {
    const roles = new Set(profiles.map((p) => p.role))
    return ['Tous les profils', ...Array.from(roles).sort()]
  }, [profiles])

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchesSearch =
        p.nomComplet.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase())
      const matchesRole = roleFilter === 'Tous les profils' || p.role === roleFilter
      const matchesService = !serviceFilter || p.serviceIds.includes(serviceFilter)
      return matchesSearch && matchesRole && matchesService
    })
  }, [profiles, search, roleFilter, serviceFilter])

  const handleToggleActive = (id: string, actif: boolean) => {
    setOpenMenuId(null)
    setUserActive.mutate({ userId: id, actif })
  }

  const handleDelete = (id: string) => {
    setOpenMenuId(null)
    setConfirmDeleteId(null)
    deleteUser.mutate(id)
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Assistants
            <Users className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">Les personnes qui ont accès à l'application.</p>
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Filtrer par :</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {r === 'Tous les profils' ? r : roleLabel(r)}
              </option>
            ))}
          </select>
        </div>
        {services.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Service :</span>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
            >
              <option value="">Tous les services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </div>
        )}
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
          <span className="text-sm font-semibold text-slate-700">Ajouter</span>
        </button>

        {filteredProfiles.map((p) => {
          const isSelf = p.id === currentUserId
          const isConfirmingDelete = confirmDeleteId === p.id
          return (
            <div
              key={p.id}
              className={`relative flex flex-col items-center gap-3 rounded-2xl border p-6 text-center shadow-sm ${
                p.actif ? 'border-slate-100 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'
              }`}
            >
              {!isSelf && canEdit && (
                <button
                  type="button"
                  onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              )}

              {/* Sur son propre profil : jamais le menu Accès/Désactiver/Supprimer (verrou
                  anti-auto-verrouillage conservé tel quel), mais on peut toujours modifier son
                  propre nom — même action déjà possible dans Paramètres, non soumise à `canEdit`
                  (ce droit concerne la gestion des AUTRES comptes, pas le sien). */}
              {isSelf && (
                <button
                  type="button"
                  onClick={() => setShowOwnProfileModal(true)}
                  title="Modifier mon profil"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}

              {canEdit && openMenuId === p.id && (
                <div className="absolute right-2 top-10 z-10 w-48 rounded-xl border border-slate-100 bg-white p-1.5 text-left shadow-lg">
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
                          setEditProfileId(p.id)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-4 w-4 text-indigo-500" />
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null)
                          setPermissionsProfileId(p.id)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <ShieldCheck className="h-4 w-4 text-indigo-500" />
                        Gérer les accès
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
                <p className="text-xs text-slate-500">{roleLabel(p.role)}</p>
                {(() => {
                  const mine = services.filter((s) => p.serviceIds.includes(s.id))
                  if (mine.length === 0) return null
                  return (
                    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                      {mine.slice(0, 3).map((s) => (
                        <span key={s.id} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                          {s.nom}
                        </span>
                      ))}
                      {mine.length > 3 && (
                        <span title={mine.slice(3).map((s) => s.nom).join(', ')} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          +{mine.length - 3}
                        </span>
                      )}
                    </div>
                  )
                })()}
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

      {filteredProfiles.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">Aucune personne ne correspond aux filtres sélectionnés.</p>
      )}

      {showAddModal && <AddUserModal onClose={() => setShowAddModal(false)} />}

      {editProfileId && (
        <EditUserModal profile={profiles.find((p) => p.id === editProfileId)!} onClose={() => setEditProfileId(null)} />
      )}

      {permissionsProfileId && (
        <EditPermissionsModal
          profile={profiles.find((p) => p.id === permissionsProfileId)!}
          onClose={() => setPermissionsProfileId(null)}
        />
      )}

      {showOwnProfileModal && (
        <EditOwnProfileModal
          profile={profiles.find((p) => p.id === currentUserId)!}
          onClose={() => setShowOwnProfileModal(false)}
        />
      )}
    </div>
  )
}
