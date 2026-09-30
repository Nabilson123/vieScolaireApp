import { useMemo, useState } from 'react'
import { FileText, Plus, X, Download, ChevronLeft } from 'lucide-react'
import { useCirculaires, usePublishCirculaire, useCirculaireLectures, type CibleType, type Circulaire } from '../services/circulairesService'
import { useParents } from '../services/parentsService'
import { useClasses } from '../services/classesService'
import { NIVEAUX } from '../data/referentiel'
import { downloadCSV } from '../utils/csvExport'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function PublishCirculaireModal({ onClose }: { onClose: () => void }) {
  const publish = usePublishCirculaire()
  const { data: classes = [] } = useClasses()
  const [titre, setTitre] = useState('')
  const [corps, setCorps] = useState('')
  const [cibleType, setCibleType] = useState<CibleType>('etablissement')
  const [cibleNiveau, setCibleNiveau] = useState(NIVEAUX[0])
  const [cibleClasse, setCibleClasse] = useState(classes[0]?.nom ?? '')
  const [relanceJours, setRelanceJours] = useState('')

  const canSubmit = titre.trim() !== '' && corps.trim() !== ''

  const handleSubmit = async () => {
    if (!canSubmit) return
    await publish.mutateAsync({
      titre: titre.trim(),
      corps: corps.trim(),
      cibleType,
      cibleNiveau: cibleType === 'niveau' ? cibleNiveau : undefined,
      cibleClasse: cibleType === 'classe' ? cibleClasse : undefined,
      relanceJours: relanceJours ? Number(relanceJours) : undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileText className="h-5 w-5 text-indigo-500" />
            Publier une circulaire
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Titre</label>
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Message</label>
            <textarea
              value={corps}
              onChange={(e) => setCorps(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cible</label>
            <select
              value={cibleType}
              onChange={(e) => setCibleType(e.target.value as CibleType)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
            >
              <option value="etablissement">Tout l'établissement</option>
              <option value="niveau">Un niveau</option>
              <option value="classe">Une classe</option>
            </select>
          </div>
          {cibleType === 'niveau' && (
            <select value={cibleNiveau} onChange={(e) => setCibleNiveau(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none">
              {NIVEAUX.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          )}
          {cibleType === 'classe' && (
            <select value={cibleClasse} onChange={(e) => setCibleClasse(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none">
              {classes.map((c) => (
                <option key={c.id} value={c.nom}>{c.nom}</option>
              ))}
            </select>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Relance après (jours, optionnel)</label>
            <input
              type="number"
              min={1}
              value={relanceJours}
              onChange={(e) => setRelanceJours(e.target.value)}
              placeholder="Ex : 3"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <p className="text-xs text-slate-400">Le ciblage est figé au moment de la publication — la liste des destinataires ne change pas ensuite.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || publish.isPending}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publish.isPending ? 'Publication...' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CirculaireDetail({ circulaire, onBack }: { circulaire: Circulaire; onBack: () => void }) {
  const { data: lectures = [] } = useCirculaireLectures(circulaire.id)
  const { data: parents = [] } = useParents()

  const parentName = (id: string) => parents.find((p) => p.id === id)?.nomComplet || parents.find((p) => p.id === id)?.email || id
  const luCount = lectures.filter((l) => l.readAt).length
  const taux = lectures.length > 0 ? Math.round((luCount / lectures.length) * 100) : 0
  const nonLus = lectures.filter((l) => !l.readAt)

  const handleExport = () => {
    downloadCSV(
      `Circulaire_${circulaire.titre.replace(/\s+/g, '_')}.csv`,
      ['Parent', 'Statut', 'Lu le'],
      lectures.map((l) => [parentName(l.parentId), l.readAt ? 'Lu' : 'Non lu', l.readAt ? formatDateTime(l.readAt) : '—'])
    )
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-indigo-600">
        <ChevronLeft className="h-4 w-4" />
        Retour
      </button>
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-xs text-slate-400">{formatDateTime(circulaire.publieAt)}</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">{circulaire.titre}</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{circulaire.corps}</p>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Taux de lecture</p>
          <p className="text-2xl font-bold text-slate-900">{taux}% <span className="text-sm font-normal text-slate-400">({luCount}/{lectures.length})</span></p>
        </div>
        <button type="button" onClick={handleExport} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-bold text-slate-800">Non lus ({nonLus.length})</p>
        {nonLus.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Tout le monde a lu cette circulaire.</p>
        ) : (
          <div className="space-y-1.5">
            {nonLus.map((l) => (
              <p key={l.id} className="text-sm text-slate-600">
                {parentName(l.parentId)}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CirculairesGlobal() {
  const { data: circulaires = [] } = useCirculaires()
  const profile = useCurrentProfile()
  const canEdit = getModuleAccess(profile, 'circulaires').canEdit
  const [showPublish, setShowPublish] = useState(false)
  const [selected, setSelected] = useState<Circulaire | null>(null)

  const cibleLabel = useMemo(
    () => (c: Circulaire) => {
      if (c.cibleType === 'etablissement') return 'Établissement'
      if (c.cibleType === 'niveau') return `Niveau ${c.cibleNiveau}`
      if (c.cibleType === 'classe') return `Classe ${c.cibleClasse}`
      return 'Élèves sélectionnés'
    },
    []
  )

  if (selected) {
    return (
      <div className="mx-auto max-w-[900px] p-6">
        <CirculaireDetail circulaire={selected} onBack={() => setSelected(null)} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1000px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Circulaires
            <FileText className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">Publication ciblée avec accusés de lecture.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowPublish(true)}
          disabled={!canEdit}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Publier
        </button>
      </div>

      {!canEdit && <NoEditAccessBanner />}

      {circulaires.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Aucune circulaire publiée pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {circulaires.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{c.titre}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {cibleLabel(c)} · {formatDateTime(c.publieAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {showPublish && <PublishCirculaireModal onClose={() => setShowPublish(false)} />}
    </div>
  )
}
