import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Appreciation } from '../../data/controlesConfig'
import {
  useControlesConfig,
  useAddTypeControleNote,
  useUpdateTypeControleNote,
  useDeleteTypeControleNote,
  useAddNiveauAcquisition,
  useDeleteNiveauAcquisition,
  useAddObjectif,
  useDeleteObjectif,
  useAddCompetence,
  useDeleteCompetence,
  useAddAppreciation,
  useDeleteAppreciation,
} from '../../services/controlesConfigService'
import { NIVEAUX } from '../../data/referentiel'

interface ControlesCompetencesTabProps {
  onSaved: () => void
}

const SUB_TABS = [
  { key: 'notes', label: 'Contrôles (Notes)' },
  { key: 'acquis', label: 'Contrôles (Acquis)' },
  { key: 'objectifs', label: 'Objectifs' },
  { key: 'competences', label: 'Compétences' },
  { key: 'appreciations', label: 'Appréciations' },
] as const

type SubTab = (typeof SUB_TABS)[number]['key']

export default function ControlesCompetencesTab({ onSaved }: ControlesCompetencesTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('notes')
  const { data, isLoading } = useControlesConfig()

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-slate-400">Chargement…</div>
  }

  return (
    <div>
      <div className="mb-5 inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              subTab === t.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'notes' && <ControlesNotesSection onSaved={onSaved} typesControleNotes={data.typesControleNotes} />}
      {subTab === 'acquis' && <ControlesAcquisSection onSaved={onSaved} niveauxAcquisition={data.niveauxAcquisition} />}
      {subTab === 'objectifs' && <ObjectifsSection onSaved={onSaved} objectifs={data.objectifs} />}
      {subTab === 'competences' && <CompetencesSection onSaved={onSaved} competences={data.competences} />}
      {subTab === 'appreciations' && <AppreciationsSection onSaved={onSaved} appreciations={data.appreciations} />}
    </div>
  )
}

function ControlesNotesSection({
  onSaved,
  typesControleNotes,
}: {
  onSaved: () => void
  typesControleNotes: { id: string; nom: string; ponderation: number }[]
}) {
  const updateType = useUpdateTypeControleNote()
  const deleteType = useDeleteTypeControleNote()
  const addType = useAddTypeControleNote()
  const [nom, setNom] = useState('')
  const [ponderation, setPonderation] = useState(20)

  return (
    <div className="max-w-xl">
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-800">Types d'évaluation</h3>
        <div className="space-y-2">
          {typesControleNotes.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5">
              <input
                defaultValue={t.nom}
                onBlur={(e) => {
                  if (e.target.value !== t.nom) {
                    updateType.mutate({ id: t.id, nom: e.target.value, ponderation: t.ponderation })
                    onSaved()
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min={0}
                max={100}
                defaultValue={t.ponderation}
                onBlur={(e) => {
                  const next = Number(e.target.value)
                  if (next !== t.ponderation) {
                    updateType.mutate({ id: t.id, nom: t.nom, ponderation: next })
                    onSaved()
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-slate-400">%</span>
              <button
                type="button"
                onClick={() => {
                  deleteType.mutate(t.id)
                  onSaved()
                }}
                className="text-rose-500 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nouveau type (ex: Interrogation)"
            className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={ponderation}
            onChange={(e) => setPonderation(Number(e.target.value))}
            className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (!nom.trim()) return
              addType.mutate({ nom: nom.trim(), ponderation })
              setNom('')
              onSaved()
            }}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Les coefficients par matière se gèrent désormais dans l'onglet <span className="font-semibold text-slate-500">Matières</span> du
          référentiel, avec une valeur par niveau.
        </p>
      </div>
    </div>
  )
}

const COULEUR_STYLE: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  amber: 'bg-amber-50 text-amber-600 border-amber-200',
  rose: 'bg-rose-50 text-rose-600 border-rose-200',
  sky: 'bg-sky-50 text-sky-600 border-sky-200',
}

function ControlesAcquisSection({
  onSaved,
  niveauxAcquisition,
}: {
  onSaved: () => void
  niveauxAcquisition: { id: string; nom: string; couleur: 'emerald' | 'amber' | 'rose' | 'sky' }[]
}) {
  const addNiveau = useAddNiveauAcquisition()
  const deleteNiveau = useDeleteNiveauAcquisition()
  const [nom, setNom] = useState('')

  return (
    <div>
      <h3 className="mb-3 text-sm font-bold text-slate-800">Niveaux d'acquisition</h3>
      <div className="flex flex-wrap gap-2">
        {niveauxAcquisition.map((n) => (
          <span key={n.id} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${COULEUR_STYLE[n.couleur]}`}>
            {n.nom}
            <button
              type="button"
              onClick={() => {
                deleteNiveau.mutate(n.id)
                onSaved()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nouveau niveau (ex: Non évalué)"
          className="w-64 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!nom.trim()) return
            addNiveau.mutate({ nom: nom.trim(), couleur: 'sky' })
            setNom('')
            onSaved()
          }}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>
    </div>
  )
}

function ObjectifsSection({
  onSaved,
  objectifs,
}: {
  onSaved: () => void
  objectifs: { id: string; matiere: string; niveau: string; texte: string }[]
}) {
  const addObjectif = useAddObjectif()
  const deleteObjectif = useDeleteObjectif()
  const [matiere, setMatiere] = useState('Mathématiques')
  const [niveau, setNiveau] = useState('CE1')
  const [texte, setTexte] = useState('')

  return (
    <div>
      <h3 className="mb-3 text-sm font-bold text-slate-800">Objectifs pédagogiques</h3>
      <div className="space-y-2">
        {objectifs.map((o) => (
          <div key={o.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 p-3">
            <div>
              <p className="text-xs font-semibold text-indigo-600">
                {o.matiere} · {o.niveau}
              </p>
              <p className="text-sm text-slate-700">{o.texte}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                deleteObjectif.mutate(o.id)
                onSaved()
              }}
              className="shrink-0 text-rose-500 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={matiere} onChange={(e) => setMatiere(e.target.value)} placeholder="Matière" className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          {NIVEAUX.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Texte de l'objectif"
          className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!texte.trim()) return
            addObjectif.mutate({ matiere, niveau, texte: texte.trim() })
            setTexte('')
            onSaved()
          }}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>
    </div>
  )
}

function CompetencesSection({
  onSaved,
  competences,
}: {
  onSaved: () => void
  competences: { id: string; matiere: string; niveau: string; texte: string }[]
}) {
  const addCompetence = useAddCompetence()
  const deleteCompetence = useDeleteCompetence()
  const [matiere, setMatiere] = useState('Mathématiques')
  const [niveau, setNiveau] = useState('CE1')
  const [texte, setTexte] = useState('')

  return (
    <div>
      <h3 className="mb-3 text-sm font-bold text-slate-800">Référentiel de compétences</h3>
      <div className="space-y-2">
        {competences.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 p-3">
            <div>
              <p className="text-xs font-semibold text-indigo-600">
                {c.matiere} · {c.niveau}
              </p>
              <p className="text-sm text-slate-700">{c.texte}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                deleteCompetence.mutate(c.id)
                onSaved()
              }}
              className="shrink-0 text-rose-500 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={matiere} onChange={(e) => setMatiere(e.target.value)} placeholder="Matière" className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          {NIVEAUX.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Texte de la compétence"
          className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!texte.trim()) return
            addCompetence.mutate({ matiere, niveau, texte: texte.trim() })
            setTexte('')
            onSaved()
          }}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>
    </div>
  )
}

const APPRECIATION_CATEGORIES: Appreciation['categorie'][] = ['Excellent', 'Bien', 'Peut mieux faire', 'Insuffisant']

const APPRECIATION_STYLE: Record<Appreciation['categorie'], string> = {
  Excellent: 'border-emerald-200 bg-emerald-50',
  Bien: 'border-sky-200 bg-sky-50',
  'Peut mieux faire': 'border-amber-200 bg-amber-50',
  Insuffisant: 'border-rose-200 bg-rose-50',
}

function AppreciationsSection({
  onSaved,
  appreciations,
}: {
  onSaved: () => void
  appreciations: Appreciation[]
}) {
  const addAppreciation = useAddAppreciation()
  const deleteAppreciation = useDeleteAppreciation()
  const [categorie, setCategorie] = useState<Appreciation['categorie']>('Bien')
  const [texte, setTexte] = useState('')

  return (
    <div>
      <h3 className="mb-3 text-sm font-bold text-slate-800">Banque d'appréciations</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {APPRECIATION_CATEGORIES.map((cat) => (
          <div key={cat} className={`rounded-xl border p-3 ${APPRECIATION_STYLE[cat]}`}>
            <p className="mb-2 text-xs font-bold uppercase text-slate-600">{cat}</p>
            <div className="space-y-1.5">
              {appreciations
                .filter((a) => a.categorie === cat)
                .map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg bg-white/70 p-2 text-xs text-slate-700">
                    <span>{a.texte}</span>
                    <button
                      type="button"
                      onClick={() => {
                        deleteAppreciation.mutate(a.id)
                        onSaved()
                      }}
                      className="shrink-0 text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={categorie} onChange={(e) => setCategorie(e.target.value as Appreciation['categorie'])} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          {APPRECIATION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Texte de l'appréciation"
          className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!texte.trim()) return
            addAppreciation.mutate({ categorie, texte: texte.trim() })
            setTexte('')
            onSaved()
          }}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>
    </div>
  )
}
