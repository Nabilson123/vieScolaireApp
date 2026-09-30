import { useState } from 'react'
import { Check, Pencil, Image, Trash2, Plus } from 'lucide-react'
import { CYCLES, NIVEAUX, getMatieresForNiveau, colorForMatiere, niveauxOf, type MatiereConfig } from '../../data/referentiel'
import { useMatieresConfig, useToggleMatiereNiveau, useDeleteMatiere } from '../../services/matieresConfigService'
import MatiereEditModal from './MatiereEditModal'

interface NiveauxMatieresTabProps {
  onSaved: () => void
  canEdit: boolean
}

export default function NiveauxMatieresTab({ onSaved, canEdit }: NiveauxMatieresTabProps) {
  const [cycleKey, setCycleKey] = useState<string>('primaire')
  const [niveau, setNiveau] = useState<string>('CE1')
  const [modalTarget, setModalTarget] = useState<MatiereConfig | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MatiereConfig | null>(null)

  const { data: allMatieres = [], isLoading } = useMatieresConfig()
  const toggleNiveau = useToggleMatiereNiveau()
  const deleteMatiere = useDeleteMatiere()

  const cycles = [{ key: 'tous', label: 'Tous les cycles', niveaux: NIVEAUX }, ...CYCLES]
  const activeCycle = cycles.find((c) => c.key === cycleKey) ?? cycles[0]
  const niveauxDisponibles = activeCycle.niveaux.length > 0 ? activeCycle.niveaux : NIVEAUX

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-400">Chargement…</div>
  }

  const matieresDuNiveau = getMatieresForNiveau(allMatieres, niveau)

  const handleToggle = (m: MatiereConfig) => {
    const active = m.parNiveau[niveau]?.active ?? false
    toggleNiveau.mutate({ matiereId: m.id, niveau, active: !active })
    onSaved()
  }

  return (
    <div>
      <div className="mb-5">
        <p className="mb-2 text-sm font-semibold text-slate-700">Cycles</p>
        <div className="flex flex-wrap gap-4">
          {cycles.map((c) => (
            <label key={c.key} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="radio"
                name="cycle"
                checked={cycleKey === c.key}
                onChange={() => {
                  setCycleKey(c.key)
                  const niveaux = c.niveaux.length > 0 ? c.niveaux : NIVEAUX
                  if (!niveaux.includes(niveau)) setNiveau(niveaux[0])
                }}
                className="h-4 w-4 text-indigo-600"
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold text-slate-700">Niveaux ({niveauxDisponibles.length})</p>
        <div className="flex flex-wrap gap-2">
          {niveauxDisponibles.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNiveau(n)}
              className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                niveau === n ? 'border-emerald-500 text-emerald-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-800">Matières</p>
          <button
            type="button"
            onClick={() => setModalTarget('new')}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-amber-500 hover:to-amber-600"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          Matières configurées pour le niveau {niveau} ({matieresDuNiveau.length})
        </p>
        <div className="flex flex-wrap gap-6">
          {allMatieres.map((m) => {
            const active = m.parNiveau[niveau]?.active ?? false
            return (
              <div key={m.id} className="flex w-24 flex-col items-center gap-2 text-center">
                <button
                  type="button"
                  onClick={() => handleToggle(m)}
                  className="relative flex h-16 w-16 items-center justify-center rounded-full"
                  title={active ? `Retirer ${m.nom} du niveau ${niveau}` : `Ajouter ${m.nom} au niveau ${niveau}`}
                >
                  <span className={`flex h-16 w-16 items-center justify-center rounded-full text-[10px] font-bold uppercase leading-tight text-white ${active ? colorForMatiere(m.nom) : 'bg-slate-200 text-slate-400'}`}>
                    {m.nom}
                  </span>
                  {active && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-600 shadow">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                  <span className="absolute bottom-0.5 flex items-center gap-1 rounded-full bg-black/25 px-1.5 py-0.5">
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (canEdit) setModalTarget(m)
                      }}
                      className={canEdit ? 'text-white/90 hover:text-white' : 'text-white/30'}
                    >
                      <Pencil className="h-3 w-3" />
                    </span>
                    <span role="button" onClick={(e) => e.stopPropagation()} className="text-white/60">
                      <Image className="h-3 w-3" />
                    </span>
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (canEdit) setDeleteTarget(m)
                      }}
                      className={canEdit ? 'text-white/90 hover:text-white' : 'text-white/30'}
                    >
                      <Trash2 className="h-3 w-3" />
                    </span>
                  </span>
                </button>
                <p className="truncate text-[11px] text-slate-500">{niveauxOf(m).length} niveau(x)</p>
              </div>
            )
          })}
        </div>
      </div>

      {modalTarget && (
        <MatiereEditModal
          matiere={modalTarget === 'new' ? null : modalTarget}
          onClose={() => setModalTarget(null)}
          onSaved={onSaved}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-base font-bold text-slate-900">Supprimer la matière « {deleteTarget.nom} » ?</h2>
            <p className="mb-4 text-sm text-slate-500">Cette matière sera retirée du référentiel pour tous les niveaux.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteMatiere.mutate(deleteTarget.id)
                  setDeleteTarget(null)
                  onSaved()
                }}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
