import { useState } from 'react'
import { MessageCircle, Eye, UserRoundMinus, AlertTriangle, X } from 'lucide-react'
import { initials, parseDuration, type Student } from '../data/students'
import { useAbsencesConfig } from '../services/absencesConfigService'
import { useDeleteStudent } from '../services/studentsService'

interface StudentsTableProps {
  rows: Student[]
  onView: (student: Student) => void
  canEdit: boolean
}

const columns = ['ÉLÈVE', 'CLASSE', 'ABSENCES', 'RETARDS', 'TOTAL HEURES MANQUÉES', 'TAUX DE PRÉSENCE', 'ACTIONS']

export default function StudentsTable({ rows, onView, canEdit }: StudentsTableProps) {
  const { data: absencesConfig } = useAbsencesConfig()
  const seuilHeures = absencesConfig?.seuilHeures ?? 10
  const seuilMinutes = seuilHeures * 60
  const deleteStudent = useDeleteStudent()
  const [confirmTarget, setConfirmTarget] = useState<Student | null>(null)

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return
    await deleteStudent.mutateAsync({ id: confirmTarget.id, name: confirmTarget.name, classe: confirmTarget.classe })
    setConfirmTarget(null)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b border-slate-100">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((student) => (
              <tr key={student.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-6 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
                      {initials(student.name)}
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                  </div>
                </td>
                <td className="px-6 py-2.5">
                  <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {student.classe}
                  </span>
                </td>
                <td className="px-6 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-slate-800">{student.absencesHeures}</p>
                    {parseDuration(student.absencesHeures) >= seuilMinutes && (
                      <span title={`Seuil d'alerte dépassé (${seuilHeures}h)`}>
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                      </span>
                    )}
                    <span className="text-xs text-slate-400">({student.absencesFois}x)</span>
                  </div>
                </td>
                <td className="px-6 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-slate-800">{student.retardsMin}</p>
                    <span className="text-xs text-slate-400">({student.retardsFois}x)</span>
                  </div>
                </td>
                <td className="px-6 py-2.5">
                  <p className="text-sm font-semibold text-slate-800">{student.totalHeures}</p>
                </td>
                <td className="px-6 py-2.5">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                    {student.taux.toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title="Contacter les parents (WhatsApp)"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Voir la fiche"
                      onClick={() => onView(student)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600 hover:bg-sky-100"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title={canEdit ? "Retirer l'élève" : "Retirer l'élève (droits insuffisants)"}
                      onClick={() => setConfirmTarget(student)}
                      disabled={!canEdit}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rose-50"
                    >
                      <UserRoundMinus className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <UserRoundMinus className="h-5 w-5 text-rose-500" />
                Retirer l'élève
              </h2>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600">
                Voulez-vous vraiment retirer <span className="font-semibold text-slate-900">{confirmTarget.name}</span> ({confirmTarget.classe}) ?
                Cette action supprimera définitivement sa fiche et toutes ses données associées.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                disabled={deleteStudent.isPending}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteStudent.isPending}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteStudent.isPending ? 'Suppression…' : 'Retirer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
