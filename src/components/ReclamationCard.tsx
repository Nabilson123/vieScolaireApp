import { useState } from 'react'
import { CheckCircle2, Trash2 } from 'lucide-react'
import type { ReclamationRecord } from '../data/studentDetails'

const CATEGORY_COLORS: Record<string, string> = {
  Notes: 'bg-indigo-50 text-indigo-600',
  'Absence / Assiduité': 'bg-purple-50 text-purple-600',
  Comportement: 'bg-rose-50 text-rose-600',
  Cantine: 'bg-amber-50 text-amber-600',
  Transport: 'bg-teal-50 text-teal-600',
}

const STATUT_COLORS: Record<ReclamationRecord['statut'], string> = {
  'En cours': 'bg-amber-50 text-amber-600',
  Résolue: 'bg-emerald-50 text-emerald-600',
  'En attente': 'bg-slate-100 text-slate-500',
}

interface ReclamationCardProps {
  reclamation: ReclamationRecord
  studentName?: string
  classe?: string
  onTakeCharge: () => void
  onResolve: (resolution: string) => void
  onDelete: () => void
  isEditable: boolean
}

export default function ReclamationCard({ reclamation, studentName, classe, onTakeCharge, onResolve, onDelete, isEditable }: ReclamationCardProps) {
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [draft, setDraft] = useState('')

  const categoryClass = CATEGORY_COLORS[reclamation.type] ?? 'bg-slate-100 text-slate-600'
  const statutClass = STATUT_COLORS[reclamation.statut]

  const handleValidate = () => {
    if (!draft.trim()) return
    onResolve(draft.trim())
    setShowResolveForm(false)
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <span className={`mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${categoryClass}`}>
            {reclamation.type}
          </span>
          <p className="text-sm font-bold text-slate-900">{reclamation.objet}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statutClass}`}>
          {reclamation.statut}
        </span>
      </div>

      <p className="mb-3 border-l-2 border-slate-200 pl-3 text-sm text-slate-600">{reclamation.description}</p>

      {reclamation.statut === 'Résolue' && reclamation.resolution && (
        <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            SOLUTION / COMMENTAIRE :
          </p>
          <p className="text-sm text-emerald-700">{reclamation.resolution}</p>
        </div>
      )}

      {showResolveForm && (
        <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Décrire la solution apportée..."
            className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowResolveForm(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={!draft.trim()}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Valider la résolution
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-3">
          {studentName && (
            <span>
              Élève : <span className="font-semibold text-slate-700">{studentName}</span>
              {classe && (
                <span className="ml-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">
                  {classe}
                </span>
              )}
            </span>
          )}
          <span>
            Date : <span className="font-semibold text-slate-700">{reclamation.date}</span>
          </span>
          {reclamation.parentNom && (
            <span>
              Parent : <span className="font-semibold text-slate-700">{reclamation.parentNom}</span>
            </span>
          )}
          {reclamation.enseignant && (
            <span>
              Concernant : <span className="font-semibold text-slate-700">{reclamation.enseignant}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {reclamation.statut === 'En attente' && !showResolveForm && (
            <button
              type="button"
              onClick={onTakeCharge}
              disabled={!isEditable}
              className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prendre en charge
            </button>
          )}
          {reclamation.statut !== 'Résolue' && !showResolveForm && (
            <button
              type="button"
              onClick={() => setShowResolveForm(true)}
              disabled={!isEditable}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Résoudre
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={!isEditable}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
