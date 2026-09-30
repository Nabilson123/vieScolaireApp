import { useEffect, useState } from 'react'
import { Plus, Trash2, AlertTriangle, Clock } from 'lucide-react'
import { useAbsencesConfig, useUpdateAbsencesConfig } from '../../services/absencesConfigService'
import type { AbsencesConfig } from '../../data/absencesConfig'

interface AbsencesConfigTabProps {
  onSaved: () => void
}

type ConfigWithId = AbsencesConfig & { id: string }

export default function AbsencesConfigTab({ onSaved }: AbsencesConfigTabProps) {
  const { data: remoteConfig } = useAbsencesConfig()
  const updateConfig = useUpdateAbsencesConfig()
  const [config, setConfig] = useState<ConfigWithId | null>(null)
  const [motif, setMotif] = useState('')

  useEffect(() => {
    if (remoteConfig) setConfig(remoteConfig)
  }, [remoteConfig])

  const save = (next: ConfigWithId) => {
    setConfig(next)
    updateConfig.mutate(next)
    onSaved()
  }

  if (!config) {
    return <p className="text-sm text-slate-400">Chargement...</p>
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Clock className="h-4 w-4 text-indigo-500" />
          Horaires de la journée
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="mb-1 text-xs text-slate-500">Début matin</p>
            <input
              type="time"
              value={config.heureDebutMatin}
              onChange={(e) => save({ ...config, heureDebutMatin: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">Fin matin</p>
            <input
              type="time"
              value={config.heureFinMatin}
              onChange={(e) => save({ ...config, heureFinMatin: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">Début après-midi</p>
            <input
              type="time"
              value={config.heureDebutApresMidi}
              onChange={(e) => save({ ...config, heureDebutApresMidi: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">Fin après-midi</p>
            <input
              type="time"
              value={config.heureFinApresMidi}
              onChange={(e) => save({ ...config, heureFinApresMidi: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
            />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          Ces bornes déterminent la répartition Matin / Après-midi du Bilan Journalier d'Assiduité (écran et rapport imprimé). L'heure de
          début d'après-midi sert aussi de frontière : tout événement débutant avant cette heure est classé en matinée.
        </p>
      </div>

      <div className="mb-6">
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Seuil d'alerte (heures cumulées non justifiées)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={config.seuilHeures}
            onChange={(e) => save({ ...config, seuilHeures: Number(e.target.value) })}
            className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <span className="text-sm text-slate-500">heures</span>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          Au-delà de ce seuil, une alerte visuelle apparaît dans le module Fiches Élèves (colonne Absences).
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Motifs d'absence standardisés</p>
        <div className="flex flex-wrap gap-2">
          {config.motifs.map((m) => (
            <span key={m} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
              {m}
              <button type="button" onClick={() => save({ ...config, motifs: config.motifs.filter((x) => x !== m) })}>
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Nouveau motif"
            className="w-64 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (!motif.trim() || config.motifs.includes(motif.trim())) return
              save({ ...config, motifs: [...config.motifs, motif.trim()] })
              setMotif('')
            }}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>
      </div>
    </div>
  )
}
