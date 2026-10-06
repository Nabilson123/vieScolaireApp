import { useRef, useState } from 'react'
import { X, UserCog, PenTool } from 'lucide-react'
import { useUpdateProfile } from '../services/profilesService'
import { useUploadSignature, useRemoveSignature, readImageAsDataUrl } from '../services/signatureService'
import { ROLE_LABELS, type Profile, type ProfileRole } from '../data/profiles'
import { useReclamationServices } from '../services/reclamationServicesService'
import ServicesPicker from './ServicesPicker'

interface EditOwnProfileModalProps {
  profile: Profile
  onClose: () => void
}

// Même référentiel que AddUserModal.tsx (seul autre endroit où ces 4 profils sont listés), non
// mutualisé — 4 littéraux, cohérent avec la convention de petites constantes dupliquées par fichier
// déjà en place ailleurs dans ce codebase.
const ROLES: ProfileRole[] = ['CPE', 'Surveillant', 'Direction', 'AED', 'Secrétariat', 'Autre']

/**
 * Modale volontairement minimale : le nom affiché, le profil (étiquette CPE/Surveillant/Direction/
 * Autre — sert uniquement au filtre de UsersGlobal.tsx, ne pilote aucun accès) + l'email en lecture
 * seule. Jamais les permissions ni les actions désactiver/supprimer — ces deux-là restent réservées
 * à un administrateur intervenant sur un AUTRE profil (garde `!isSelf` de UsersGlobal.tsx,
 * inchangée), conformément au choix explicite de l'utilisateur.
 */
export default function EditOwnProfileModal({ profile, onClose }: EditOwnProfileModalProps) {
  const updateOwnProfile = useUpdateProfile()
  const uploadSignature = useUploadSignature()
  const removeSignature = useRemoveSignature()
  const [nomComplet, setNomComplet] = useState(profile.nomComplet)
  const [role, setRole] = useState<ProfileRole>(profile.role)
  const { data: services = [] } = useReclamationServices()
  const [serviceIds, setServiceIds] = useState<string[]>(profile.serviceIds)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    if (!nomComplet.trim()) return
    await updateOwnProfile.mutateAsync({ id: profile.id, nomComplet: nomComplet.trim(), role, serviceIds })
    setSaved(true)
    setTimeout(onClose, 700)
  }

  const handleSignatureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await readImageAsDataUrl(file)
    await uploadSignature.mutateAsync({ profileId: profile.id, dataUrl })
    e.target.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <UserCog className="h-5 w-5 text-indigo-500" />
            Mon profil
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
              placeholder="Votre nom complet"
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
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Services</label>
            <ServicesPicker services={services} value={serviceIds} onChange={setServiceIds} />
            <p className="mt-1 text-xs text-slate-400">Les services dont vous traitez les réclamations.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Identifiant</label>
            <input
              value={profile.email}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Signature manuscrite</label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {profile.signatureImage ? (
                  <img src={profile.signatureImage} alt="Signature" className="h-full w-full object-contain" />
                ) : (
                  <PenTool className="h-5 w-5 text-slate-300" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSignatureChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadSignature.isPending}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploadSignature.isPending ? 'Chargement...' : profile.signatureImage ? 'Changer' : 'Charger une image'}
                </button>
                {profile.signatureImage && (
                  <button
                    type="button"
                    onClick={() => removeSignature.mutate(profile.id)}
                    disabled={removeSignature.isPending}
                    className="text-xs font-medium text-rose-500 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Retirer
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Photo ou scan de votre signature — utilisée sur les Notes de Service que vous signez.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Pour changer votre mot de passe, rendez-vous dans Paramètres Système → Sécurité du Compte.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {saved && <span className="mr-auto text-sm font-medium text-emerald-600">Profil mis à jour ✓</span>}
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
            disabled={!nomComplet.trim() || updateOwnProfile.isPending}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateOwnProfile.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
