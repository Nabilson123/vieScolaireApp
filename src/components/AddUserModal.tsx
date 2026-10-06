import { useState } from 'react'
import { X, UserPlus, AlertCircle } from 'lucide-react'
import { useInviteUser } from '../services/profilesService'
import type { ProfileRole } from '../data/profiles'
import ProfileTypeOptions from './ProfileTypeOptions'

interface AddUserModalProps {
  onClose: () => void
}

export default function AddUserModal({ onClose }: AddUserModalProps) {
  const inviteUser = useInviteUser()
  const [email, setEmail] = useState('')
  const [nomComplet, setNomComplet] = useState('')
  const [role, setRole] = useState<ProfileRole>('Autre')
  const [error, setError] = useState('')

  const canSubmit = email.trim() !== '' && nomComplet.trim() !== ''

  const handleSubmit = async () => {
    if (!canSubmit) return
    setError('')
    try {
      await inviteUser.mutateAsync({ email: email.trim(), nomComplet: nomComplet.trim(), role })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'invitation.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <UserPlus className="h-5 w-5 text-indigo-500" />
            Ajouter un assistant
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
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

          <p className="text-xs text-slate-400">
            Un email d'invitation sera envoyé à cette adresse pour que la personne définisse son mot de passe.
          </p>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || inviteUser.isPending}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {inviteUser.isPending ? 'Envoi...' : "Envoyer l'invitation"}
          </button>
        </div>
      </div>
    </div>
  )
}
