import { useMemo, useState } from 'react'
import { GraduationCap, Printer, Download, CirclePlus, UserPlus } from 'lucide-react'
import StudentsFilterBar from '../components/StudentsFilterBar'
import StudentsTable from '../components/StudentsTable'
import StudentDetail from '../components/StudentDetail'
import SignalerAbsenceModal from '../components/SignalerAbsenceModal'
import AddStudentModal from '../components/AddStudentModal'
import StudentsPrintPreviewModal from '../components/student-print/StudentsPrintPreviewModal'
import ReadOnlyYearBanner from '../components/ReadOnlyYearBanner'
import { useStudents } from '../services/studentsService'
import { useStudentIdentities } from '../services/studentIdentityService'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../services/permissions'
import NoEditAccessBanner from '../components/NoEditAccessBanner'
import { isWithinPeriod } from '../utils/period'
import { downloadCSV } from '../utils/csvExport'
import { todayFileStamp } from '../components/print/printFileName'

interface StudentsListProps {
  initialStudentId?: string
  initialTab?: string
  initialClasse?: string
}

export default function StudentsList({ initialStudentId, initialTab, initialClasse }: StudentsListProps) {
  const { data: studentsData = [], isLoading } = useStudents()
  const { data: identities = {} } = useStudentIdentities()
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const canEditModule = getModuleAccess(profile, 'list').canEdit
  const isEditable = canEditYear && canEditModule
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState(initialClasse ?? 'Toutes les classes')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(initialStudentId ?? null)
  const [showSignalModal, setShowSignalModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPrint, setShowPrint] = useState(false)

  const filtered = useMemo(() => {
    return studentsData.filter((student) => {
      const matchesClass = selectedClass === 'Toutes les classes' || student.classe === selectedClass
      const matchesSearch = student.name.toLowerCase().includes(search.toLowerCase())
      const dateEntree = identities[student.id]?.dateEntree ?? ''
      const matchesPeriod = !dateEntree ? !periodStart && !periodEnd : isWithinPeriod(dateEntree, periodStart, periodEnd)
      return matchesClass && matchesSearch && matchesPeriod
    })
  }, [studentsData, identities, search, selectedClass, periodStart, periodEnd])

  const handleExportCsv = () => {
    const headers = ['Élève', 'Classe', 'Absences', 'Nb. Absences', 'Retards', 'Nb. Retards', 'Total Heures Manquées', 'Taux de Présence']
    const rows = filtered.map((s) => [s.name, s.classe, s.absencesHeures, s.absencesFois, s.retardsMin, s.retardsFois, s.totalHeures, `${s.taux.toFixed(1)}%`])
    downloadCSV(`fiches-eleves_${todayFileStamp()}.csv`, headers, rows)
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-400">Chargement…</div>
  }

  const selectedStudent = selectedId ? (studentsData.find((s) => s.id === selectedId) ?? null) : null

  if (selectedStudent) {
    return (
      <div className="mx-auto max-w-[1800px] p-6">
        <StudentDetail
          student={selectedStudent}
          onBack={() => setSelectedId(null)}
          initialTab={initialTab}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            Fiches Élèves
            <GraduationCap className="h-6 w-6 text-slate-800" />
          </h1>
          <p className="max-w-xl text-sm text-slate-500">
            Consultez le registre des élèves du Groupe Scolaire Mondrian, filtrez par classe et modifiez
            les fiches d'assiduité.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Exporter
          </button>
          <button
            type="button"
            onClick={() => setShowSignalModal(true)}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CirclePlus className="h-4 w-4" />
            Saisir Absence / Retard
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            disabled={!isEditable}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Ajouter un élève
          </button>
        </div>
      </div>

      {!canEditYear && <ReadOnlyYearBanner />}
      {canEditYear && !canEditModule && <NoEditAccessBanner />}

      <StudentsFilterBar
        total={filtered.length}
        search={search}
        onSearchChange={setSearch}
        selectedClass={selectedClass}
        onClassChange={setSelectedClass}
        periodStart={periodStart}
        periodEnd={periodEnd}
        onPeriodStartChange={setPeriodStart}
        onPeriodEndChange={setPeriodEnd}
        onResetPeriod={() => {
          setPeriodStart('')
          setPeriodEnd('')
        }}
      />

      <StudentsTable rows={filtered} onView={(s) => setSelectedId(s.id)} canEdit={isEditable} />

      {showSignalModal && <SignalerAbsenceModal onClose={() => setShowSignalModal(false)} />}

      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onCreated={(newStudentId) => setSelectedId(newStudentId)}
        />
      )}

      {showPrint && <StudentsPrintPreviewModal students={filtered} onClose={() => setShowPrint(false)} />}
    </div>
  )
}
