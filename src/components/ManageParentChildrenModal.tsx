import { useMemo, useState } from 'react'
import { X, Users2, Plus, Trash2 } from 'lucide-react'
import type { Parent, ParentStudentLink } from '../data/parents'
import { useStudents } from '../services/studentsService'
import StudentSearchSelect from './StudentSearchSelect'
import { useLinkParentToStudent, useUnlinkParentFromStudent } from '../services/parentsService'

interface ManageParentChildrenModalProps {
  parent: Parent
  links: ParentStudentLink[]
  onClose: () => void
}

const RELATIONS = ['Père', 'Mère', 'Tuteur', 'Autre']

export default function ManageParentChildrenModal({ parent, links, onClose }: ManageParentChildrenModalProps) {
  const { data: students = [] } = useStudents()
  const linkParent = useLinkParentToStudent()
  const unlinkParent = useUnlinkParentFromStudent()

  const [studentId, setStudentId] = useState('')
  const [relation, setRelation] = useState(RELATIONS[0])

  const parentLinks = links.filter((l) => l.parentId === parent.id)
  const linkedStudentIds = new Set(parentLinks.map((l) => l.studentId))
  const availableStudents = useMemo(
    () => students.filter((s) => !linkedStudentIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [students, linkedStudentIds]
  )
  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? id

  const handleAdd = () => {
    if (!studentId) return
    linkParent.mutate({ parentId: parent.id, studentId, relation })
    setStudentId('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Users2 className="h-5 w-5 text-indigo-500" />
            Enfants liés — {parent.nomComplet || parent.email}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            {parentLinks.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Aucun enfant lié pour l'instant.</p>
            ) : (
              parentLinks.map((link) => (
                <div key={link.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{studentName(link.studentId)}</p>
                    <p className="text-xs text-slate-500">{link.relation}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => unlinkParent.mutate(link.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">Lier un enfant</p>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <StudentSearchSelect students={availableStudents} value={studentId} onChange={setStudentId} size="sm" placeholder="Rechercher un élève..." />
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                {RELATIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!studentId}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Lier
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
