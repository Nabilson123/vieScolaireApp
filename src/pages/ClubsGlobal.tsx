import { useState } from 'react'
import { Trophy, Users } from 'lucide-react'
import ClubsCatalogue from '../components/clubs/ClubsCatalogue'
import InscritsPanel from '../components/clubs/InscritsPanel'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { getModuleAccess, useCurrentProfile } from '../services/permissions'
import { useIsViewedYearEditable } from '../services/viewedYear'

type Onglet = 'clubs' | 'inscrits'

/** Clubs : catalogue, inscrits (avec liste d'attente), puis mensualités, règlements et recouvrement. */
export default function ClubsGlobal() {
  const canEditYear = useIsViewedYearEditable()
  const profile = useCurrentProfile()
  const canEditModule = getModuleAccess(profile, 'clubs').canEdit
  const isEditable = canEditYear && canEditModule

  const [onglet, setOnglet] = useState<Onglet>('clubs')
  const [clubInscrits, setClubInscrits] = useState('')

  const onglets: { key: Onglet; label: string; icon: typeof Trophy }[] = [
    { key: 'clubs', label: 'Clubs', icon: Trophy },
    { key: 'inscrits', label: 'Inscrits', icon: Users },
  ]

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          Clubs
          <Trophy className="h-6 w-6 text-amber-500" />
        </h1>
        <p className="max-w-2xl text-sm text-slate-500">Activités hebdomadaires encadrées : inscrits, places, liste d'attente et mensualités.</p>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1 sm:inline-flex">
        {onglets.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setOnglet(key)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              onglet === key ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {onglet === 'clubs' && (
        <ClubsCatalogue
          isEditable={isEditable}
          onVoirInscrits={(clubId) => {
            setClubInscrits(clubId)
            setOnglet('inscrits')
          }}
        />
      )}
      {onglet === 'inscrits' && <InscritsPanel key={clubInscrits || 'tous'} isEditable={isEditable} clubInitial={clubInscrits} />}
    </div>
  )
}
