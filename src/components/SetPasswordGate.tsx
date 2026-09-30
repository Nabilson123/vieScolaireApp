import { useState } from 'react'
import { Lock, Eye, EyeOff, AlertCircle, GraduationCap } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

interface SetPasswordGateProps {
  onDone: () => void
}

/**
 * Affiché juste après l'acceptation d'un lien d'invitation : Supabase authentifie la personne
 * immédiatement (sans mot de passe), donc sans cet écran elle n'aurait plus jamais moyen de se
 * reconnecter une fois sa session expirée. Bloque l'accès au reste de l'appli tant que ce n'est
 * pas fait.
 */
export default function SetPasswordGate({ onDone }: SetPasswordGateProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onDone()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-800 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Bienvenue</h1>
          <p className="text-sm text-slate-500">Définissez votre mot de passe pour finaliser votre compte.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mot de passe</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:border-indigo-400">
              <Lock className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full text-sm text-slate-800 focus:outline-none"
                placeholder="Au moins 6 caractères"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="shrink-0 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Confirmer le mot de passe</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:border-indigo-400">
              <Lock className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-sm text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Continuer'}
          </button>
        </div>
      </div>
    </div>
  )
}
