import { useState } from 'react'
import { Printer } from 'lucide-react'
import { useStudents } from '../services/studentsService'
import { useStudentExtras } from '../services/studentDetailsService'
import { computeSubjectMoyenne, computeMoyenneGenerale } from '../utils/studentAggregation'
import { moyenneScaleForClasse } from '../utils/alertEngine'
import BulletinPrintModal from '../components/BulletinPrintModal'

interface ParentPortalNotesProps {
  studentId: string
}

export default function ParentPortalNotes({ studentId }: ParentPortalNotesProps) {
  const { data: students = [] } = useStudents()
  const { data: extras = {} } = useStudentExtras()
  const [showPrint, setShowPrint] = useState(false)

  const student = students.find((s) => s.id === studentId)
  const notes = extras[studentId]?.notes ?? []
  const moyenneGenerale = computeMoyenneGenerale(notes)

  if (!student) return <p className="py-10 text-center text-sm text-slate-400">Chargement...</p>

  const scale = moyenneScaleForClasse(student.classe) ?? 20

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Moyenne générale</p>
            <p className="text-2xl font-bold text-slate-900">{moyenneGenerale !== null ? moyenneGenerale.toFixed(2) : '—'} /{scale}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5" />
            Bulletin
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">Aucune note enregistrée pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((row) => {
            const moyenne = computeSubjectMoyenne(row)
            return (
              <div key={row.subject} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{row.subject}</p>
                  <p className="text-sm font-bold text-indigo-600">{moyenne !== null ? moyenne.toFixed(2) : '—'} /{scale}</p>
                </div>
                <div className="mt-2 space-y-1">
                  {row.evaluations.map((ev, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {ev.type} · {ev.date}
                      </span>
                      <span className="font-semibold text-slate-700">{ev.value}/{scale}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showPrint && <BulletinPrintModal student={student} notes={notes} onClose={() => setShowPrint(false)} />}
    </div>
  )
}
