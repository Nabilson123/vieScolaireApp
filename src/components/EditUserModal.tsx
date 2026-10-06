import { useState } from 'react'
import { X, UserCog, AlertCircle, MailWarning } from 'lucide-react'
import { useUpdateProfile, useUpdateUserEmail } from '../services/profilesService'
import type { Profile, ProfileRole } from '../data/profiles'
import ProfileTypeOptions from './ProfileTypeOptions'
import { useReclamationServices } from '../services/reclamationServicesService'
import ServicesPicker from './ServicesPicker'

interface EditUserModalProps {
  profile: Profile
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Modifier le compte d'un AUTRE assistant (réservé à un administrateur `canEdit`, jamais son propre
 * compte — cf. `!isSelf` dans UsersGlobal.tsx, `EditOwnProfileModal.tsx` reste le chemin pour soi).
 * Seule vraie différence avec ce dernier : l'email est ici modifiable, parce que c'est précisément
 * un administrateur intervenant sur le compte de quelqu'un d'autre qui a besoin de corriger une
 * adresse erronée ou de la faire pointer vers une nouvelle boîte — un changement d'email envoie un
 * nouveau lien de réinitialisation de mot de passe (`useUpdateUserEmail`), donc traité à part du
 * reste du formulaire plutôt que comme un simple champ texte de plus.
 */
export default function EditUserModal({ profile, onClose }: EditUserModalProps) {
  const updateProfile = useUpdateProfile()
  const updateEmail = useUpdateUserEmail()
  const [nomComplet, setNomComplet] = useState(profile.nomComplet)
  const [role, setRole] = useState<ProfileRole>(profile.role)
  const { data: services = [] } = useReclamationServices()
  const [serviceIds, setServiceIds] = useState<string[]>(profile.serviceIds)
  const [email, setEmail] = useState(profile.email)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const trimmedEmail = email.trim()
  const emailChanged = trimmedEmail !== profile.email
  const canSubmit = nomComplet.trim() !== '' && (!emailChanged || EMAIL_RE.test(trimmedEmail))
  const isPending = updateProfile.isPending || updateEmail.isPending

  const handleSave = async () => {
    if (!canSubmit) return
    setError('')
    try {
      const servicesChanged = serviceIds.length !== profile.serviceIds.length || serviceIds.some((id) => !profile.serviceIds.includes(id))
      if (nomComplet.trim() !== profile.nomComplet || role !== profile.role || servicesChanged) {
        await updateProfile.mutateAsync({ id: profile.id, nomComplet: nomComplet.trim(), role, serviceIds })
      }
      if (emailChanged) {
        await updateEmail.mutateAsync({ userId: profile.id, newEmail: trimmedEmail })
      }
      setSaved(true)
      setTimeout(onClose, emailChanged ? 1400 : 700)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <UserCog className="h-5 w-5 text-indigo-500" />
            Modifier l'assistant
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
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nom complet</label>
            <input
              value={nomComplet}
              onChange={(e) => setNomComplet(e.target.value)}
              placeholder="Prénom Nom"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Profil</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ProfileRole)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              <ProfileTypeOptions current={role} />
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Services</label>
            <ServicesPicker services={services} value={serviceIds} onChange={setServiceIds} />
            <p className="mt-1 text-xs text-slate-400">Les services dont la personne traite les réclamations.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@ecole.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          {emailChanged && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              <MailWarning className="h-4 w-4 shrink-0" />
              <span>
                Un email sera envoyé à la nouvelle adresse pour définir un nouveau mot de passe. L'ancienne adresse ne
                pourra plus servir à se connecter.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {saved && (
            <span className="mr-auto text-sm font-medium text-emerald-600">
              {emailChanged ? 'Enregistré — email envoyé ✓' : 'Enregistré ✓'}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit || isPending}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
