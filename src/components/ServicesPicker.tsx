import type { ReclamationService } from '../data/reclamationServices'

/** Cases à cocher des services d'une personne (un ou plusieurs). Ne touche à aucun droit d'accès : les services
 * servent à répartir le traitement des réclamations. */
export default function ServicesPicker({ services, value, onChange }: { services: ReclamationService[]; value: string[]; onChange: (ids: string[]) => void }) {
  if (services.length === 0) {
    return <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Aucun service défini : créez-les dans Référentiel → Services.</p>
  }
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Services">
      {services.map((s) => {
        const on = value.includes(s.id)
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            aria-pressed={on}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {s.nom}
          </button>
        )
      })}
    </div>
  )
}
