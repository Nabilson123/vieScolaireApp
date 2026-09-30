import { useState } from 'react'
import { Check, Clock3, X, Plus } from 'lucide-react'
import type { TimelineStep } from '../../../data/studentDetails'

export default function ChronologieTab({ initial }: { initial: TimelineStep[] }) {
  const [steps, setSteps] = useState<TimelineStep[]>(initial)
  const [draftDate, setDraftDate] = useState('')
  const [draftLabel, setDraftLabel] = useState('')

  const toggleStatus = (idx: number) => {
    setSteps((prev) =>
      prev.map((step, i) =>
        i === idx ? { ...step, status: step.status === 'VALIDÉ' ? 'PLANIFIÉ' : 'VALIDÉ' } : step
      )
    )
  }

  const updateField = (idx: number, field: 'date' | 'label', value: string) => {
    setSteps((prev) => prev.map((step, i) => (i === idx ? { ...step, [field]: value } : step)))
  }

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx))
  }

  const addStep = () => {
    if (!draftDate.trim() || !draftLabel.trim()) return
    setSteps((prev) => [...prev, { date: draftDate.trim(), label: draftLabel.trim(), status: 'PLANIFIÉ' }])
    setDraftDate('')
    setDraftLabel('')
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-slate-700">Étapes chronologiques de l'orientation :</p>

      <div className="mb-4 max-h-64 space-y-2 overflow-y-auto pr-1">
        {steps.map((step, idx) => {
          const validated = step.status === 'VALIDÉ'
          return (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={step.date}
                onChange={(e) => updateField(idx, 'date', e.target.value)}
                className="w-[130px] rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-medium text-indigo-600 focus:border-indigo-400 focus:outline-none"
              />
              <input
                type="text"
                value={step.label}
                onChange={(e) => updateField(idx, 'label', e.target.value)}
                className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => toggleStatus(idx)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  validated
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                    : 'border-amber-200 bg-amber-50 text-amber-600'
                }`}
              >
                {validated ? <Check className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                {step.status.charAt(0) + step.status.slice(1).toLowerCase()}
              </button>
              <button
                type="button"
                onClick={() => removeStep(idx)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-rose-400 hover:bg-rose-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draftDate}
          onChange={(e) => setDraftDate(e.target.value)}
          placeholder="Date (ex: Mai 2026)"
          className="w-[140px] rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        <input
          type="text"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addStep()}
          placeholder="Intitulé de l'étape d'orientation..."
          className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={addStep}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>
    </div>
  )
}
