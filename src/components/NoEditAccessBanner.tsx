import { ShieldOff } from 'lucide-react'

/** Bandeau affiché quand la personne connectée a un accès Aperçu seul (pas Éditer) sur ce module. */
export default function NoEditAccessBanner() {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
      <ShieldOff className="h-4 w-4 shrink-0" />
      <span>Vous consultez ce module en lecture seule — contactez un administrateur pour obtenir un accès en écriture.</span>
    </div>
  )
}
