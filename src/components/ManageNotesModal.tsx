import { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import type { Student } from '../data/students'
import type { NoteRow } from '../data/studentDetails'
import { moyenneScaleForClasse } from '../utils/alertEngine'

interface ManageNotesModalProps {
  student: Student
  notes: NoteRow[]
  onClose: () => void
  onUpdate: (notes: NoteRow[]) => void
}

interface FlatRow {
  subjectIndex: number
  evalIndex: number
  subject: string
  type: string
  value: number
  coef: number
  date: string
  author: string
}

function flatten(notes: NoteRow[]): FlatRow[] {
  const rows: FlatRow[] = []
  notes.forEach((row, subjectIndex) => {
    row.evaluations.forEach((ev, evalIndex) => {
      rows.push({
        subjectIndex,
        evalIndex,
        subject: row.subject,
        type: ev.type,
        value: ev.value,
        coef: ev.coef,
        date: ev.date,
        author: ev.author,
      })
    })
  })
  return rows
}

export default function ManageNotesModal({ student, notes, onClose, onUpdate }: ManageNotesModalProps) {
  const [draft, setDraft] = useState<NoteRow[]>(() => notes.map((r) => ({ ...r, evaluations: [...r.evaluations] })))

  const rows = flatten(draft)
  const scale = moyenneScaleForClasse(student.classe) ?? 20

  const updateField = (subjectIndex: number, evalIndex: number, field: 'value' | 'coef', raw: string) => {
    const num = Number(raw)
    setDraft((prev) =>
      prev.map((row, si) =>
        si !== subjectIndex
          ? row
          : {
              ...row,
              evaluations: row.evaluations.map((ev, ei) =>
                ei !== evalIndex ? ev : { ...ev, [field]: Number.isNaN(num) ? 0 : num }
              ),
            }
      )
    )
  }

  const handleSave = () => {
    onUpdate(draft)
  }

  const handleDelete = (subjectIndex: number, evalIndex: number) => {
    setDraft((prev) => {
      const next = prev
        .map((row, si) =>
          si !== subjectIndex ? row : { ...row, evaluations: row.evaluations.filter((_, ei) => ei !== evalIndex) }
        )
        .filter((row) => row.evaluations.length > 0)
      onUpdate(next)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Pencil className="h-5 w-5 text-indigo-600" />
            Gérer les Notes :<span className="text-indigo-600">{student.name}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucune note enregistrée pour cet élève.</p>
          ) : (
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Matière</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Évaluation</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Note /{scale}</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Coef</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Date</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Saisi par</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.subjectIndex}-${row.evalIndex}`} className="border-b border-slate-50 last:border-0">
                    <td className="py-3 pr-2 text-sm font-semibold text-slate-800">{row.subject}</td>
                    <td className="py-3 pr-2 text-sm text-slate-600">{row.type}</td>
                    <td className="py-3 pr-2">
                      <input
                        type="number"
                        step="0.25"
                        min={0}
                        max={scale}
                        value={row.value}
                        onChange={(e) => updateField(row.subjectIndex, row.evalIndex, 'value', e.target.value)}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                      />
                    </td>
                    <td className="py-3 pr-2">
                      <input
                        type="number"
                        min={1}
                        value={row.coef}
                        onChange={(e) => updateField(row.subjectIndex, row.evalIndex, 'coef', e.target.value)}
                        className="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                      />
                    </td>
                    <td className="py-3 pr-2 whitespace-nowrap text-sm text-slate-500">{row.date}</td>
                    <td className="py-3 pr-2 text-sm text-slate-500">{row.author}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSave}
                          className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-indigo-500 hover:to-violet-500"
                        >
                          Sauver
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.subjectIndex, row.evalIndex)}
                          className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
