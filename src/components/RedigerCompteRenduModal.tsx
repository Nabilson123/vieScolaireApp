import { useState } from 'react'
import { X, FileText, Plus, Trash2 } from 'lucide-react'
import type { CompteRenduRDV, CompteRenduRdvDecision } from '../data/studentDetails'

interface RedigerCompteRenduModalProps {
  motif: string
  /** Rendez-vous sans enseignant concerné (rencontre avec l'administration seulement) — masque le
   * bloc d'avis "Enseignant", qui n'aurait pas de sens sans professeur impliqué. */
  hasEnseignant: boolean
  initial?: CompteRenduRDV
  onClose: () => void
  onSubmit: (compteRendu: CompteRenduRDV) => void
}

const AUTEUR = 'Nabil LAHRACHE'

function makeEmptyDecision(): CompteRenduRdvDecision {
  return { texte: '', echeance: '' }
}

export default function RedigerCompteRenduModal({ motif, hasEnseignant, initial, onClose, onSubmit }: RedigerCompteRenduModalProps) {
  const [administration, setAdministration] = useState(initial?.administration ?? '')
  const [parents, setParents] = useState(initial?.parents ?? '')
  const [enseignant, setEnseignant] = useState(initial?.enseignant ?? '')
  const [signeParent, setSigneParent] = useState(initial?.signeParent ?? false)
  const [decisions, setDecisions] = useState<CompteRenduRdvDecision[]>(initial?.decisions ?? [])

  const canSubmit = administration.trim() || parents.trim() || enseignant.trim()

  const updateDecision = (index: number, patch: Partial<CompteRenduRdvDecision>) => {
    setDecisions((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }
  const addDecision = () => setDecisions((prev) => [...prev, makeEmptyDecision()])
  const removeDecision = (index: number) => setDecisions((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({
      administration: administration.trim(),
      parents: parents.trim(),
      enseignant: enseignant.trim(),
      redacteur: initial?.redacteur ?? AUTEUR,
      signeParent,
      decisions: decisions
        .filter((d) => d.texte.trim())
        .map((d) => ({ texte: d.texte.trim(), echeance: d.echeance.trim() || '—' })),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileText className="h-5 w-5 text-indigo-500" />
              Compte-rendu du Rendez-vous
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{motif}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-purple-600">Administration</label>
            <textarea
              value={administration}
              onChange={(e) => setAdministration(e.target.value)}
              rows={2}
              placeholder="Avis / recommandation de l'administration..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-pink-600">Parents</label>
            <textarea
              value={parents}
              onChange={(e) => setParents(e.target.value)}
              rows={2}
              placeholder="Demandes / remarques formulées par les parents..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          {hasEnseignant && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-emerald-600">Enseignant</label>
              <textarea
                value={enseignant}
                onChange={(e) => setEnseignant(e.target.value)}
                rows={2}
                placeholder="Retour / recommandation de l'enseignant..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Décisions &amp; engagements <span className="font-normal text-slate-400">(optionnel)</span>
            </label>
            <div className="space-y-2">
              {decisions.map((decision, index) => (
                <div key={index} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={decision.texte}
                      onChange={(e) => updateDecision(index, { texte: e.target.value })}
                      placeholder="Décision / engagement..."
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={decision.echeance}
                      onChange={(e) => updateDecision(index, { echeance: e.target.value })}
                      placeholder="Échéance (ex. 15/09/2026, Fin du trimestre...)"
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDecision(index)}
                    className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addDecision}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter une décision
            </button>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-sm text-amber-700">
            <input
              type="checkbox"
              checked={signeParent}
              onChange={(e) => setSigneParent(e.target.checked)}
              className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-400"
            />
            Signé par le parent
          </label>

          <p className="text-xs text-slate-400">Rédigé par {initial?.redacteur ?? AUTEUR}</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer le compte-rendu
          </button>
        </div>
      </div>
    </div>
  )
}
