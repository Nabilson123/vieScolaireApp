import { useState } from 'react'
import { X, ShieldAlert } from 'lucide-react'
import { getClassOptions } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import type { PAIInfo } from '../data/studentDetails'

interface ManagePAIModalProps {
  onClose: () => void
  onSubmit: (studentId: string, pai: PAIInfo) => void
  onRemove?: (studentId: string) => void
  initial?: { studentId: string; pai: PAIInfo }
}

export default function ManagePAIModal({ onClose, onSubmit, onRemove, initial }: ManagePAIModalProps) {
  const realClasses = getClassOptions().filter((c) => c !== 'Toutes les classes')
  const initialStudent = initial ? getStudentsSnapshot().find((s) => s.id === initial.studentId) : undefined

  const [classe, setClasse] = useState(initialStudent?.classe ?? realClasses[0])
  const [studentId, setStudentId] = useState(initial?.studentId ?? '')
  const [condition, setCondition] = useState(initial?.pai.condition ?? '')
  const [niveau, setNiveau] = useState<'CRITIQUE' | 'MODÉRÉ'>(initial?.pai.niveau ?? 'MODÉRÉ')
  const [protocole, setProtocole] = useState(initial?.pai.protocole ?? '')

  const elevesDeLaClasse = getStudentsSnapshot().filter((s) => s.classe === classe)

  const handleSubmit = () => {
    if (!studentId || !condition.trim() || !protocole.trim()) return
    onSubmit(studentId, { condition: condition.trim(), niveau, protocole: protocole.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            Gérer les PAI
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Classe</label>
              <select
                value={classe}
                disabled={!!initial}
                onChange={(e) => {
                  setClasse(e.target.value)
                  setStudentId('')
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              >
                {realClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Élève concerné</label>
              <select
                value={studentId}
                disabled={!!initial}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">Sélectionner...</option>
                {elevesDeLaClasse.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Condition médicale</label>
            <input
              type="text"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="ex : Allergie sévère, Asthme, Diabète..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Niveau</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNiveau('MODÉRÉ')}
                className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                  niveau === 'MODÉRÉ'
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Modéré
              </button>
              <button
                type="button"
                onClick={() => setNiveau('CRITIQUE')}
                className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                  niveau === 'CRITIQUE'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Critique
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Protocole d'urgence</label>
            <textarea
              value={protocole}
              onChange={(e) => setProtocole(e.target.value)}
              rows={3}
              placeholder="Consignes à suivre en cas d'urgence..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-between gap-2 border-t border-slate-100 px-6 py-4">
          {initial && onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(initial.studentId)}
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
            >
              Supprimer la PAI
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
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
              disabled={!studentId || !condition.trim() || !protocole.trim()}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
