import { useMemo, useState } from 'react'
import { Search, Plus, X } from 'lucide-react'

interface Category {
  name: string
  emoji: string
  items: string[]
}

const catalogue: Category[] = [
  {
    name: 'Tech & Sciences',
    emoji: '💻',
    items: [
      'Club Robotique',
      'Programmation Python',
      'Création de Jeux Vidéo',
      'Impression 3D',
      'Échecs',
      'Astronomie',
      'Web Development',
      'Intelligence Artificielle (Découverte)',
      'Électronique / Arduino',
    ],
  },
  {
    name: 'Sports & Bien-être',
    emoji: '⚽',
    items: [
      'Football',
      'Basketball',
      'Natation',
      'Arts Martiaux / Aïkido',
      'Tennis',
      'Athlétisme',
      'Équitation',
      'Yoga / Gym',
      'Randonnée / Trekking',
    ],
  },
  {
    name: 'Arts & Culture',
    emoji: '🎨',
    items: [
      'Théâtre',
      'Dessin / Peinture',
      'Musique (Instrument)',
      'Chant / Chorale',
      'Danse',
      'Photographie',
      'Cinéma / Réalisation',
      'Écriture Créative',
      'Calligraphie',
    ],
  },
  {
    name: 'Langues & Communication',
    emoji: '🗣️',
    items: [
      'Anglais Avancé',
      'Espagnol',
      'Débat & Éloquence',
      'Journalisme Scolaire',
      'Traduction',
      'Podcast / Média Scolaire',
    ],
  },
  {
    name: 'Sciences Humaines & Société',
    emoji: '🌍',
    items: [
      'Modèle ONU (MUN)',
      'Environnement & Écologie',
      "Droits de l'Homme",
      'Histoire & Patrimoine',
      'Action Caritative',
    ],
  },
  {
    name: 'Leadership & Entrepreneuriat',
    emoji: '🚀',
    items: [
      'Mini-Entreprise',
      'Délégué de Classe',
      "Organisation d'Événements",
      'Coding Club (Leader)',
      'Tutorat entre Pairs',
    ],
  },
]

interface ActivitesTabProps {
  initial: string[]
}

export default function ActivitesTab({ initial }: ActivitesTabProps) {
  const [selected, setSelected] = useState<string[]>(initial)
  const [search, setSearch] = useState('')
  const [customDraft, setCustomDraft] = useState('')

  const filteredCatalogue = useMemo(() => {
    if (!search.trim()) return catalogue
    const q = search.toLowerCase()
    return catalogue
      .map((cat) => ({ ...cat, items: cat.items.filter((item) => item.toLowerCase().includes(q)) }))
      .filter((cat) => cat.items.length > 0)
  }, [search])

  const toggle = (label: string) => {
    setSelected((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]))
  }

  const addCustom = () => {
    if (!customDraft.trim() || selected.includes(customDraft.trim())) return
    setSelected((prev) => [...prev, customDraft.trim()])
    setCustomDraft('')
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer les activités (ex: Échecs, Robotique, Football, Musique...)"
          className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <p className="mb-2 text-sm font-semibold text-slate-700">
        Activités actuellement sélectionnées ({selected.length}) :
      </p>
      <div className="mb-5 flex min-h-[44px] flex-wrap gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3">
        {selected.length === 0 ? (
          <span className="text-xs text-slate-400">Aucune activité sélectionnée.</span>
        ) : (
          selected.map((label) => (
            <span
              key={label}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-xs font-medium text-white"
            >
              {label}
              <button type="button" onClick={() => toggle(label)} className="hover:opacity-75">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
        {filteredCatalogue.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Aucune activité ne correspond à ce filtre.</p>
        ) : (
          filteredCatalogue.map((cat) => (
            <div key={cat.name}>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                {cat.emoji} {cat.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {cat.items.map((item) => {
                  const isSelected = selected.includes(item)
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggle(item)}
                      className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-600'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item}
                      {isSelected ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          placeholder="+ Autre activité personnalisée..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={addCustom}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>
    </div>
  )
}
