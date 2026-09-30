import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  NotebookPen,
  FileBarChart,
  PlusCircle,
  Medal,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Search,
  Printer,
  Pencil,
} from 'lucide-react'
import { getClassOptions, initials, type Student } from '../data/students'
import { getStudentsSnapshot, useStudents } from '../services/studentsService'
import { getClassesSnapshot } from '../services/classesService'
import { useMatieresConfig } from '../services/matieresConfigService'
import { type NoteRow } from '../data/studentDetails'
import { useStudentExtras, getStudentExtraSnapshot, updateStudentNotes, applyEvaluation } from '../services/studentDetailsService'
import { computeSubjectMoyenne, computeMoyenneGenerale } from '../utils/studentAggregation'
import { cycleOfClasse, moyenneScaleForClasse } from '../utils/alertEngine'
import { moyenneScale } from '../data/referentiel'
import { CYCLE_KEYS, cycleLabel, type CycleKey } from '../data/alertRules'
import BulkGradeEntryModal from '../components/BulkGradeEntryModal'
import ManageNotesModal from '../components/ManageNotesModal'
import BulletinPrintModal from '../components/BulletinPrintModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export default function NotesGlobal() {
  const queryClient = useQueryClient()
  // getStudentsSnapshot() est année-scopé : filteredStudents dépend de la référence `students`
  // (retournée par useStudents()) pour recalculer au bon moment après un changement d'année.
  const { data: students } = useStudents()
  const { data: extrasMap } = useStudentExtras()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'grades').canEdit
  const isEditable = canEditYear && canEditModule
  const { data: matieresConfig = [] } = useMatieresConfig()
  const allSubjects = matieresConfig.map((m) => m.nom)
  const notesMap: Record<string, NoteRow[]> = {}
  getStudentsSnapshot().forEach((s) => {
    notesMap[s.id] = extrasMap?.[s.id]?.notes ?? []
  })
  const [search, setSearch] = useState('')
  const [classe, setClasse] = useState('Toutes les classes')
  const [matiere, setMatiere] = useState('Toutes les matières')
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [manageStudent, setManageStudent] = useState<Student | null>(null)
  const [printStudent, setPrintStudent] = useState<Student | null>(null)

  const filteredStudents = useMemo(
    () =>
      getStudentsSnapshot().filter(
        (s) =>
          (classe === 'Toutes les classes' || s.classe === classe) &&
          s.name.toLowerCase().includes(search.toLowerCase())
      ),
    [classe, search, students]
  )

  const rows = useMemo(
    () =>
      filteredStudents.map((s) => {
        const notes = notesMap[s.id] ?? []
        const moyenneGenerale = computeMoyenneGenerale(notes)
        const subjectValues: Record<string, number | null> = {}
        allSubjects.forEach((subj) => {
          const row = notes.find((n) => n.subject === subj)
          subjectValues[subj] = row ? computeSubjectMoyenne(row) : null
        })
        return { student: s, notes, moyenneGenerale, subjectValues }
      }),
    [filteredStudents, notesMap, allSubjects]
  )

  // Une classe précise n'a qu'un seul cycle donc qu'une seule échelle ; "Toutes les classes" peut
  // en mélanger plusieurs (/10 primaire, /20 collège) — jamais moyennées/comparées ensemble.
  const statsByCycle = CYCLE_KEYS.map((cycle) => {
    const scale = moyenneScale(cycle)
    if (scale === null) return null
    const cycleRows = rows.filter((r) => cycleOfClasse(r.student.classe) === cycle)
    const scopedValues = cycleRows
      .map((r) => (matiere === 'Toutes les matières' ? r.moyenneGenerale : r.subjectValues[matiere]))
      .filter((v): v is number => v !== null)
    if (scopedValues.length === 0) return null
    return {
      cycle,
      scale,
      moyenneClasse: round1(scopedValues.reduce((a, b) => a + b, 0) / scopedValues.length),
      noteMax: round1(Math.max(...scopedValues)),
      noteMin: round1(Math.min(...scopedValues)),
      tauxReussite: Math.round((scopedValues.filter((v) => v >= scale / 2).length / scopedValues.length) * 100),
    }
  }).filter((s): s is { cycle: CycleKey; scale: number; moyenneClasse: number; noteMax: number; noteMin: number; tauxReussite: number } => s !== null)

  const visibleSubjects = matiere === 'Toutes les matières' ? allSubjects : [matiere]

  const handleBulkSubmit = async (payload: {
    classe: string
    subject: string
    type: string
    coef: number
    date: string
    entries: { studentId: string; value: number }[]
  }) => {
    const newEval = {
      type: payload.type,
      value: 0,
      coef: payload.coef,
      date: payload.date,
      author: 'Nabil LAHRACHE',
    }
    const niveau = getClassesSnapshot().find((c) => c.nom === payload.classe)?.niveau
    const matiereCfg = matieresConfig.find((m) => m.nom === payload.subject)
    const subjectCoef = (niveau ? matiereCfg?.parNiveau[niveau]?.coefficient : undefined) ?? 2

    await Promise.all(
      payload.entries.map(({ studentId, value }) => {
        const current = getStudentExtraSnapshot(studentId).notes
        const updatedNotes = applyEvaluation(current, payload.subject, subjectCoef, { ...newEval, value })
        return updateStudentNotes(studentId, updatedNotes)
      })
    )
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
    setShowBulkModal(false)
  }

  const handleManageUpdate = async (studentId: string, newNotes: NoteRow[]) => {
    await updateStudentNotes(studentId, newNotes)
    await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Suivi des Notes & Bulletins
            <NotebookPen className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            Visualisation des performances scolaires, saisie groupée des contrôles continus et édition des
            bulletins de notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileBarChart className="h-4 w-4" />
            Exporter Classement
          </button>
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            Saisie Groupée des Notes
          </button>
        </div>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-slate-100 pb-4">
        {statsByCycle.length === 0 && <p className="text-sm text-slate-400">Aucune note disponible.</p>}
        {statsByCycle.map((s) => {
          const prefix = statsByCycle.length > 1 ? ` (${cycleLabel(s.cycle)})` : ''
          return (
            <div key={s.cycle} className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <KpiInline icon={Medal} iconColor="text-indigo-500" barColor="bg-indigo-500" label={`Moyenne de Classe${prefix}`} value={`${s.moyenneClasse} /${s.scale}`} />
              <KpiInline icon={TrendingUp} iconColor="text-teal-500" barColor="bg-teal-500" label={`Note Maximale${prefix}`} value={`${s.noteMax} /${s.scale}`} />
              <KpiInline icon={TrendingDown} iconColor="text-rose-500" barColor="bg-rose-500" label={`Note Minimale${prefix}`} value={`${s.noteMin} /${s.scale}`} />
              <KpiInline icon={CheckCircle2} iconColor="text-amber-500" barColor="bg-amber-500" label={`Taux de Réussite${prefix} (>=${s.scale / 2})`} value={`${s.tauxReussite}%`} />
            </div>
          )
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un élève..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Classe :</span>
          <select
            value={classe}
            onChange={(e) => setClasse(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            {getClassOptions().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Matière :</span>
          <select
            value={matiere}
            onChange={(e) => setMatiere(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none"
          >
            <option>Toutes les matières</option>
            {allSubjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Élève</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Classe</th>
                {visibleSubjects.map((subj) => (
                  <th
                    key={subj}
                    className="px-4 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400"
                  >
                    {subj.toUpperCase()}
                  </th>
                ))}
                <th className="bg-slate-50 px-4 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Moyenne Générale
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ student, moyenneGenerale, subjectValues }) => {
                const scale = moyenneScaleForClasse(student.classe) ?? 20
                return (
                <tr key={student.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-xs font-bold text-white">
                        {initials(student.name)}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{student.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {student.classe}
                    </span>
                  </td>
                  {visibleSubjects.map((subj) => {
                    const v = subjectValues[subj]
                    return (
                      <td key={subj} className="px-4 py-4 text-sm font-semibold text-emerald-600">
                        {v === null ? <span className="font-normal text-slate-300">-</span> : `${v.toFixed(2)}/${scale}`}
                      </td>
                    )
                  })}
                  <td className="bg-slate-50/60 px-4 py-4 text-sm font-bold text-indigo-600">
                    {moyenneGenerale === null ? <span className="font-semibold text-slate-400">N/A</span> : `${moyenneGenerale.toFixed(2)}/${scale}`}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Imprimer le bulletin"
                        onClick={() => setPrintStudent(student)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Gérer les notes"
                        onClick={() => setManageStudent(student)}
                        disabled={!isEditable}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showBulkModal && (
        <BulkGradeEntryModal onClose={() => setShowBulkModal(false)} onSubmit={handleBulkSubmit} />
      )}

      {manageStudent && (
        <ManageNotesModal
          student={manageStudent}
          notes={notesMap[manageStudent.id] ?? []}
          onClose={() => setManageStudent(null)}
          onUpdate={(newNotes) => handleManageUpdate(manageStudent.id, newNotes)}
        />
      )}

      {printStudent && (
        <BulletinPrintModal
          student={printStudent}
          notes={notesMap[printStudent.id] ?? []}
          onClose={() => setPrintStudent(null)}
        />
      )}
    </div>
  )
}

function KpiInline({
  icon: Icon,
  iconColor,
  barColor,
  label,
  value,
}: {
  icon: typeof Medal
  iconColor: string
  barColor: string
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`h-6 w-1 rounded-full ${barColor}`} />
      <span className="text-sm text-slate-500">
        {label} <span className="font-bold text-slate-900">{value}</span>
      </span>
      <Icon className={`h-4 w-4 ${iconColor}`} />
    </div>
  )
}
