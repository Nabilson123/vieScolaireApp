import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import SeancesPanel from './SeancesPanel'

type Volet = 'seances'

const VOLETS: { key: Volet; label: string; icon: typeof GraduationCap }[] = [{ key: 'seances', label: 'Séances', icon: GraduationCap }]

/** Onglet « Soutien & Sorties » d'Emplois du Temps : séances de soutien, confirmations des parents, sorties seul(e) et PDF par classe. */
export default function SoutienSortiesTab({ isEditable }: { isEditable: boolean }) {
  const [volet, setVolet] = useState<Volet>('seances')

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1 sm:inline-flex">
        {VOLETS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setVolet(key)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              volet === key ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {volet === 'seances' && <SeancesPanel isEditable={isEditable} />}
    </div>
  )
}
