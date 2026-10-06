import { useState } from 'react'
import { X, Users, GraduationCap, Clock, AlertTriangle, Copy, Archive, Trash2, Pencil, ArrowRightLeft } from 'lucide-react'
import type { SchoolClass } from '../data/schoolStructure'
import { getActiveClassNamesSnapshot } from '../services/classesService'
import { teacherName } from '../data/teachers'
import { getTeachersSnapshot } from '../services/teachersService'
import { useUpdateStudent } from '../services/studentsService'
import { useClassSchedules } from '../services/classSchedulesService'
import {
  computeClassSchedule,
  computeClassVolume,
  detectScheduleConflicts,
  getClassStudents,
  getClassTeachers,
} from '../utils/classAggregation'
import ScheduleTimeGrid from './schedule/ScheduleTimeGrid'
import { formatHeures } from '../utils/teacherAggregation'
import TeacherSearchSelect from './TeacherSearchSelect'

interface ClassDetailModalProps {
  schoolClass: SchoolClass
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onArchive: () => void
  onDelete: () => void
  onAssignPP: (teacherId: string | undefined) => void
  onRefresh: () => void
  isEditable: boolean
}

export default function ClassDetailModal({
  schoolClass,
  onClose,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
  onAssignPP,
  onRefresh,
  isEditable,
}: ClassDetailModalProps) {
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({})
  const updateStudent = useUpdateStudent()
  // Abonnement direct : computeClassSchedule() lit un cache module-level qui ne se re-render pas
  // tout seul quand l'année change dans la Sidebar.
  useClassSchedules()

  const students = getClassStudents(schoolClass.nom)
  const classTeachers = getClassTeachers(schoolClass.nom)
  const schedule = computeClassSchedule(schoolClass.nom)
  const volume = computeClassVolume(schoolClass.nom)
  const conflicts = detectScheduleConflicts(schoolClass.nom)
  const otherClasses = getActiveClassNamesSnapshot().filter((n) => n !== schoolClass.nom)
  const ppTeacher = getTeachersSnapshot().find((t) => t.id === schoolClass.professeurPrincipalId)

  const effectifPct = Math.min(100, (students.length / schoolClass.capaciteMax) * 100)
  const effectifColor = effectifPct >= 100 ? 'bg-rose-500' : effectifPct >= 85 ? 'bg-amber-500' : 'bg-emerald-500'

  const handleMoveStudent = (studentId: string) => {
    const target = moveTarget[studentId]
    if (!target) return
    updateStudent.mutate({ id: studentId, patch: { classe: target } })
    onRefresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <GraduationCap className="h-5 w-5 text-indigo-500" />
              {schoolClass.nom}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                  schoolClass.statut === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {schoolClass.statut}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Niveau {schoolClass.niveau} · {schoolClass.salle}
            </p>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 p-3">
              <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <Users className="h-3 w-3" />
                Effectif
              </p>
              <p className="mb-1 text-base font-bold text-slate-900">
                {students.length}/{schoolClass.capaciteMax}
              </p>
              <div className="h-1.5 w-full rounded-full bg-slate-100">
                <div className={`h-1.5 rounded-full ${effectifColor}`} style={{ width: `${effectifPct}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 p-3">
              <p className="mb-1 text-[11px] font-semibold text-slate-500">Cours hebdomadaires</p>
              <p className="text-base font-bold text-slate-900">{volume.seances} séances</p>
            </div>
            <div className="rounded-2xl border border-slate-100 p-3">
              <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <Clock className="h-3 w-3" />
                Volume horaire
              </p>
              <p className="text-base font-bold text-slate-900">{formatHeures(volume.heures)}/sem</p>
            </div>
            <div className="rounded-2xl border border-slate-100 p-3">
              <p className="mb-1 text-[11px] font-semibold text-slate-500">Professeur Principal</p>
              <TeacherSearchSelect
                teachers={classTeachers}
                value={schoolClass.professeurPrincipalId ?? ''}
                onChange={(id) => onAssignPP(id || undefined)}
                disabled={!isEditable}
                size="sm"
                placeholder="Non assigné"
              />
            </div>
          </div>

          {conflicts.length > 0 && (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{conflicts.length} conflit(s) d’emploi du temps détecté(s) pour cette classe.</span>
            </div>
          )}

          {!ppTeacher && schoolClass.statut === 'Active' && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Aucun Professeur Principal assigné à cette classe.
            </div>
          )}

          <div className="rounded-2xl border border-slate-100 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Emploi du Temps</h3>
            {volume.seances === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">Aucun cours planifié (aucun enseignant assigné à cette classe).</p>
            ) : (
              <ScheduleTimeGrid
                schedule={Object.fromEntries(
                  Object.entries(schedule).map(([day, slots]) => [
                    day,
                    slots.map((s) => ({ id: s.id, subject: s.subject, start: s.start, end: s.end, hours: s.hours, subtitle: `Prof. ${s.teacherName}` })),
                  ])
                )}
              />
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Enseignants intervenant dans la classe</h3>
            {classTeachers.length === 0 ? (
              <p className="py-2 text-center text-xs text-slate-400">Aucun enseignant assigné.</p>
            ) : (
              <ul className="space-y-1.5">
                {classTeachers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                    <span className="font-medium text-slate-700">{teacherName(t)}</span>
                    <span className="text-slate-500">{t.matieres.join(', ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Élèves inscrits ({students.length})</h3>
            {students.length === 0 ? (
              <p className="py-2 text-center text-xs text-slate-400">Aucun élève inscrit dans cette classe.</p>
            ) : (
              <ul className="space-y-1.5">
                {students.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
                    <span className="font-medium text-slate-700">{s.name}</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={moveTarget[s.id] ?? ''}
                        onChange={(e) => setMoveTarget((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        disabled={!isEditable}
                        className="rounded-lg border border-slate-200 px-1.5 py-1 text-[11px] text-slate-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Déplacer vers...</option>
                        {otherClasses.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleMoveStudent(s.id)}
                        disabled={!isEditable || !moveTarget[s.id]}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                        Déplacer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              disabled={!isEditable}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Pencil className="h-3.5 w-3.5" />
              Éditer
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              disabled={!isEditable}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy className="h-3.5 w-3.5" />
              Dupliquer
            </button>
            {schoolClass.statut === 'Active' && (
              <button
                type="button"
                onClick={onArchive}
                disabled={!isEditable}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Archive className="h-3.5 w-3.5" />
                Archiver
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onDelete}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}
