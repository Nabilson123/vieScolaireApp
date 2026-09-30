import { Lock } from 'lucide-react'

/** Bandeau d'avertissement affiché en haut des pages quand l'année consultée n'est pas l'année active. */
export default function ReadOnlyYearBanner() {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
      <Lock className="h-4 w-4 shrink-0" />
      <span>Vous consultez une année en lecture seule. Basculez sur l'année active (menu en bas de la barre latérale) pour modifier ces données.</span>
    </div>
  )
}
