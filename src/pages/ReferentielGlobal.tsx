import { useState } from 'react'
import { BookMarked } from 'lucide-react'
import InformationsTab from '../components/referentiel/InformationsTab'
import NiveauxMatieresTab from '../components/referentiel/NiveauxMatieresTab'
import ControlesCompetencesTab from '../components/referentiel/ControlesCompetencesTab'
import SallesTab from '../components/referentiel/SallesTab'
import PeriodesTab from '../components/referentiel/PeriodesTab'
import AbsencesConfigTab from '../components/referentiel/AbsencesConfigTab'
import GardeEvenementsTab from '../components/referentiel/GardeEvenementsTab'
import AnneesScolairesTab from '../components/referentiel/AnneesScolairesTab'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

interface ReferentielGlobalProps {
  onDataChanged: () => void
}

const TABS = [
  { key: 'informations', label: 'Informations' },
  { key: 'niveaux', label: 'Niveaux et matières' },
  { key: 'controles', label: 'Contrôles/Compétences' },
  { key: 'salles', label: 'Salles de classe' },
  { key: 'periodes', label: 'Périodes' },
  { key: 'absences', label: 'Absences' },
  { key: 'gardeEvenements', label: 'Événements de Garde' },
  { key: 'annees', label: 'Années Scolaires' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ReferentielGlobal({ onDataChanged }: ReferentielGlobalProps) {
  const [tab, setTab] = useState<TabKey>('informations')
  const profile = useCurrentProfile()
  const canEdit = getModuleAccess(profile, 'referentiel').canEdit

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
          <BookMarked className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Référentiel Pédagogique</h1>
          <p className="text-sm text-slate-500">Identité de l'établissement, structure pédagogique et paramètres partagés par tous les modules.</p>
        </div>
      </div>

      {!canEdit && <NoEditAccessBanner />}

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 overflow-x-auto border-b border-slate-100 px-4 pt-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <fieldset disabled={!canEdit} className="contents">
          <div className="p-6">
            {tab === 'informations' && <InformationsTab onSaved={onDataChanged} />}
            {tab === 'niveaux' && <NiveauxMatieresTab onSaved={onDataChanged} canEdit={canEdit} />}
            {tab === 'controles' && <ControlesCompetencesTab onSaved={onDataChanged} />}
            {tab === 'salles' && <SallesTab onSaved={onDataChanged} />}
            {tab === 'periodes' && <PeriodesTab onSaved={onDataChanged} />}
            {tab === 'absences' && <AbsencesConfigTab onSaved={onDataChanged} />}
            {tab === 'gardeEvenements' && <GardeEvenementsTab onSaved={onDataChanged} />}
            {tab === 'annees' && <AnneesScolairesTab onSaved={onDataChanged} />}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
