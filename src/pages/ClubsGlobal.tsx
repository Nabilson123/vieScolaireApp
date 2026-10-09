import { useState } from 'react'
import { BarChart3, CalendarClock, CheckCircle2, Receipt, TriangleAlert, Trophy, Users, X } from 'lucide-react'
import BilanPanel from '../components/clubs/BilanPanel'
import ClubsCatalogue from '../components/clubs/ClubsCatalogue'
import InscritsPanel from '../components/clubs/InscritsPanel'
import MensualitesPanel from '../components/clubs/MensualitesPanel'
import RecouvrementPanel from '../components/clubs/RecouvrementPanel'
import ReglementModal from '../components/clubs/ReglementModal'
import ReglementsList from '../components/clubs/ReglementsList'
import RecuPrintPreviewModal from '../components/clubs-print/RecuPrintPreviewModal'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { getModuleAccess, useClubsPaiementsAccess, useCurrentProfile } from '../services/permissions'
import { useIsViewedYearEditable } from '../services/viewedYear'

type Onglet = 'clubs' | 'inscrits' | 'mensualites' | 'reglements' | 'recouvrement' | 'bilan'

const ONGLETS_ARGENT: Onglet[] = ['mensualites', 'reglements', 'recouvrement', 'bilan']

/** Clubs : catalogue, inscrits (avec liste d'attente), puis mensualités, règlements et recouvrement pour qui a le droit sur les paiements. */
export default function ClubsGlobal({ initialOnglet }: { initialOnglet?: string }) {
  const canEditYear = useIsViewedYearEditable()
  const profile = useCurrentProfile()
  const canEditModule = getModuleAccess(profile, 'clubs').canEdit
  const isEditable = canEditYear && canEditModule
  const paiements = useClubsPaiementsAccess()
  const canEditPaiements = canEditYear && paiements.canEdit

  const [onglet, setOnglet] = useState<Onglet>(() => (initialOnglet === 'recouvrement' ? 'recouvrement' : 'clubs'))
  const [clubInscrits, setClubInscrits] = useState('')
  const [encaisser, setEncaisser] = useState<{ familleCle?: string } | null>(null)
  const [recuId, setRecuId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const onglets: { key: Onglet; label: string; icon: typeof Trophy }[] = [
    { key: 'clubs', label: 'Clubs', icon: Trophy },
    { key: 'inscrits', label: 'Inscrits', icon: Users },
    ...(paiements.canView
      ? [
          { key: 'mensualites' as const, label: 'Mensualités', icon: CalendarClock },
          { key: 'reglements' as const, label: 'Règlements', icon: Receipt },
          { key: 'recouvrement' as const, label: 'Recouvrement', icon: TriangleAlert },
          { key: 'bilan' as const, label: 'Bilan', icon: BarChart3 },
        ]
      : []),
  ]
  // Un onglet d'argent n'est jamais montré sans le droit (par exemple si le droit est retiré pendant la consultation).
  const actif: Onglet = ONGLETS_ARGENT.includes(onglet) && !paiements.canView ? 'clubs' : onglet

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

      {notice && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice('')} aria-label="Fermer" className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1 sm:inline-flex">
        {onglets.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setOnglet(key)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              actif === key ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {actif === 'clubs' && (
        <ClubsCatalogue
          isEditable={isEditable}
          onVoirInscrits={(clubId) => {
            setClubInscrits(clubId)
            setOnglet('inscrits')
          }}
        />
      )}
      {actif === 'inscrits' && <InscritsPanel key={clubInscrits || 'tous'} isEditable={isEditable} clubInitial={clubInscrits} />}
      {actif === 'mensualites' && <MensualitesPanel canEdit={canEditPaiements} onEncaisser={(familleCle) => setEncaisser({ familleCle })} />}
      {actif === 'reglements' && <ReglementsList canEdit={canEditPaiements} onEncaisser={() => setEncaisser({})} onOuvrirRecu={setRecuId} />}
      {actif === 'recouvrement' && <RecouvrementPanel canEdit={canEditPaiements} onEncaisser={(familleCle) => setEncaisser({ familleCle })} />}
      {actif === 'bilan' && <BilanPanel />}

      {encaisser && paiements.canEdit && (
        <ReglementModal
          familleCle={encaisser.familleCle}
          onClose={() => setEncaisser(null)}
          onDone={(message, reglementId) => {
            setNotice(message)
            setRecuId(reglementId)
          }}
        />
      )}
      {recuId && paiements.canView && <RecuPrintPreviewModal reglementId={recuId} onClose={() => setRecuId(null)} />}
    </div>
  )
}
