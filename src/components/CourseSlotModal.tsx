import { useState } from 'react'
import { X, BookOpen, AlertCircle } from 'lucide-react'
import { useTeachers } from '../services/teachersService'
import { SCHEDULE_DAYS } from '../data/classSchedules'
import { detectConflictForTeacher } from '../services/classSchedulesService'
import { formatHeures } from '../utils/teacherAggregation'
import { useMatieresConfig } from '../services/matieresConfigService'
import { getClassesSnapshot } from '../services/classesService'
import { getMatieresForNiveau } from '../data/referentiel'
import TeacherSearchSelect from './TeacherSearchSelect'

const DAY_LABELS: Record<string, string> = { LUNDI: 'Lundi', MARDI: 'Mardi', MERCREDI: 'Mercredi', JEUDI: 'Jeudi', VENDREDI: 'Vendredi' }

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export interface CourseSlotFormData {
  day: string
  subject: string
  teacherId: string
  start: string
  end: string
  hours: number
}

interface CourseSlotModalProps {
  className: string
  initialDay: string
  onClose: () => void
  onSubmit: (data: CourseSlotFormData) => void
  initial?: { slotId: string; day: string; subject: string; teacherId: string; start: string; end: string }
}

export default function CourseSlotModal({ className, initialDay, onClose, onSubmit, initial }: CourseSlotModalProps) {
  const { data: matieresConfig = [] } = useMatieresConfig()
  const niveau = getClassesSnapshot().find((c) => c.nom === className)?.niveau
  const allMatieres = (niveau ? getMatieresForNiveau(matieresConfig, niveau) : matieresConfig).map((m) => m.nom)
  const { data: teachers = [] } = useTeachers()

  const isEdit = !!initial
  const [day, setDay] = useState(initial?.day ?? initialDay)
  const [subject, setSubject] = useState(initial?.subject ?? allMatieres[0] ?? '')
  const [teacherId, setTeacherId] = useState(initial?.teacherId ?? '')
  const [start, setStart] = useState(initial?.start ?? '08:30')
  const [end, setEnd] = useState(initial?.end ?? '10:30')
  const [error, setError] = useState('')

  // Un prof qui enseigne déjà cette matière (peu importe dans quelle(s) classe(s)) peut être affecté à une
  // classe qu'il n'a encore jamais eue — sans ça, comme Niveaux/Matières/Classes sont désormais dérivés de
  // l'emploi du temps réel (voir syncTeacherProfileFromSchedule), il serait impossible de lui assigner une
  // nouvelle classe : il n'apparaîtrait jamais tant qu'il n'y est pas déjà, et il ne peut pas y être déjà.
  const eligibleTeachers = teachers.filter((t) => t.matieres.includes(subject))

  const hours = Math.max(0, Math.round((timeToMinutes(end) - timeToMinutes(start)) / 5) * 5 / 60)
  const canSubmit = day && subject && teacherId && start && end && hours > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    const conflict = detectConflictForTeacher(teacherId, day, start, end, initial?.slotId)
    if (conflict) {
      setError('Ce professeur est déjà occupé sur un autre cours à ce créneau.')
      return
    }
    setError('')
    onSubmit({ day, subject, teacherId, start, end, hours })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            {isEdit ? 'Modifier le Cours' : 'Ajouter un Cours'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-xs text-slate-500">
            Classe : <span className="font-semibold text-slate-700">{className}</span>
          </p>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Jour*</label>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              {SCHEDULE_DAYS.map((d) => (
                <option key={d} value={d}>
                  {DAY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Matière*</label>
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value)
                setTeacherId('')
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            >
              {allMatieres.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Enseignant*</label>
            <TeacherSearchSelect teachers={eligibleTeachers} value={teacherId} onChange={setTeacherId} placeholder="Sélectionnez un enseignant..." />
            {subject && eligibleTeachers.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-600">
                Aucun professeur ne déclare enseigner {subject}. Déclarez-le d’abord via « Éditer » dans Corps Professoral.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure début*</label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Heure fin*</label>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Durée : <span className="font-semibold text-slate-700">{formatHeures(hours)}</span>
          </p>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
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
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isEdit ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}
