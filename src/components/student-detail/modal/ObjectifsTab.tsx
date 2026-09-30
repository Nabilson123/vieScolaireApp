import { useState } from 'react'
import { CheckCircle2, Loader2, Clock3, X, Plus } from 'lucide-react'
import type { ObjectifChecklistItem } from '../../../data/studentDetails'

type Status = ObjectifChecklistItem['status']

const statusOptions: { key: Status; label: string; icon: typeof CheckCircle2; activeClass: string }[] = [
  { key: 'atteint', label: 'Atteint', icon: CheckCircle2, activeClass: 'bg-emerald-500 text-white border-emerald-500' },
  { key: 'encours', label: 'En cours', icon: Loader2, activeClass: 'bg-orange-500 text-white border-orange-500' },
  { key: 'planifie', label: 'Planifié', icon: Clock3, activeClass: 'bg-violet-500 text-white border-violet-500' },
]

export default function ObjectifsTab({ initial }: { initial: ObjectifChecklistItem[] }) {
  const [items, setItems] = useState<ObjectifChecklistItem[]>(initial)
  const [progress, setProgress] = useState(92)
  const [draftTitle, setDraftTitle] = useState('')

  const setStatus = (idx: number, status: Status) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, status } : item)))
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const addItem = () => {
    if (!draftTitle.trim()) return
    setItems((prev) => [...prev, { title: draftTitle.trim(), subtitle: '', status: 'planifie' }])
    setDraftTitle('')
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">Niveau de progression globale :</label>
        <span className="text-sm font-bold text-indigo-600">{progress}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={progress}
        onChange={(e) => setProgress(Number(e.target.value))}
        className="mb-5 w-full accent-indigo-600"
      />

      <p className="mb-2 text-sm font-semibold text-slate-700">Checklist des Objectifs & Jalons :</p>
      <div className="mb-4 max-h-64 space-y-2 overflow-y-auto pr-1">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
          >
            <div className="min-w-[160px]">
              <p className="text-sm font-semibold text-slate-800">{item.title}</p>
              {item.subtitle && <p className="text-xs text-slate-500">{item.subtitle}</p>}
            </div>
            <div className="flex items-center gap-1.5">
              {statusOptions.map((opt) => {
                const Icon = opt.icon
                const isActive = item.status === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setStatus(idx, opt.key)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      isActive ? opt.activeClass : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {opt.label}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-rose-400 hover:bg-rose-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Ajouter un nouvel objectif ou jalon..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={addItem}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>
    </div>
  )
}
