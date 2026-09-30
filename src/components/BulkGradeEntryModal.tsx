import { useEffect, useState } from 'react'
import { PlusCircle, X } from 'lucide-react'
import { getClassOptions } from '../data/students'
import { getStudentsSnapshot } from '../services/studentsService'
import { getClassesSnapshot } from '../services/classesService'
import { useMatieresConfig } from '../services/matieresConfigService'
import { getMatieresForNiveau } from '../data/referentiel'
import { EVALUATION_TYPES } from '../data/studentDetails'
import { moyenneScaleForClasse } from '../utils/alertEngine'

interface BulkGradeEntryModalProps {
  onClose: () => void
  onSubmit: (payload: {
    classe: string
    subject: string
    type: string
    coef: number
    date: string
    entries: { studentId: string; value: number }[]
  }) => void
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function BulkGradeEntryModal({ onClose, onSubmit }: BulkGradeEntryModalProps) {
  const realClasses = getClassOptions().filter((c) => c !== 'Toutes les classes')
  const { data: matieresConfig = [] } = useMatieresConfig()

  const [classe, setClasse] = useState(realClasses[0])
  const niveau = getClassesSnapshot().find((c) => c.nom === classe)?.niveau
  const subjectOptions = niveau ? getMatieresForNiveau(matieresConfig, niveau).map((m) => m.nom) : matieresConfig.map((m) => m.nom)
  const scale = moyenneScaleForClasse(classe) ?? 20

  const [subject, setSubject] = useState(subjectOptions[0] ?? '')
  const [type, setType] = useState(EVALUATION_TYPES[0])
  const [coef, setCoef] = useState(1)
  const [date, setDate] = useState(todayISO())
  const [scores, setScores] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!subjectOptions.includes(subject)) setSubject(subjectOptions[0] ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectOptions.join('|')])

  const elevesDeLaClasse = getStudentsSnapshot().filter((s) => s.classe === classe)

  const handleSubmit = () => {
    if (!subject) return
    const entries = elevesDeLaClasse
      .map((s) => ({ studentId: s.id, value: Number(scores[s.id]) }))
      .filter((e) => scores[e.studentId] !== undefined && scores[e.studentId] !== '' && !Number.isNaN(e.value))

    if (entries.length === 0) return

    onSubmit({ classe, subject, type, coef, date, entries })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <PlusCircle className="h-5 w-5 text-indigo-600" />
            Saisie Groupée des Notes
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
                onChange={(e) => setClasse(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {realClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Matière</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {subjectOptions.length === 0 && <option value="">Aucune matière pour ce niveau</option>}
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Type d'Évaluation</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {EVALUATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Coeff.</label>
              <input
                type="number"
                min={1}
                value={coef}
                onChange={(e) => setCoef(Number(e.target.value) || 1)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-700">
              Saisie des Notes (Sur {scale})
            </p>
            <div className="space-y-2">
              {elevesDeLaClasse.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"
                >
                  <span className="text-sm font-medium text-slate-800">{s.name}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={scale}
                      step="0.25"
                      placeholder="Note"
                      value={scores[s.id] ?? ''}
                      onChange={(e) => setScores((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">/{scale}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
            disabled={!subject}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer les Notes
          </button>
        </div>
      </div>
    </div>
  )
}
