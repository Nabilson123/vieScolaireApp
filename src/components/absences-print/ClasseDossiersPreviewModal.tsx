import type { Student } from '../../data/students'
import { getStudentIdentitySnapshot } from '../../services/studentIdentityService'
import { getStudentExtraSnapshot } from '../../services/studentDetailsService'
import PrintableIdentity from '../student-detail/print/PrintableIdentity'
import { TOUTE_ETABLISSEMENT } from '../../utils/absencesScope'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'

interface ClasseDossiersPreviewModalProps {
  classe: string
  students: Student[]
  onClose: () => void
}

export default function ClasseDossiersPreviewModal({ classe, students, onClose }: ClasseDossiersPreviewModalProps) {
  const subtitle = `${classe === TOUTE_ETABLISSEMENT ? 'Dossiers Établissement Entier' : 'Dossiers Classe Entière'} — ${classe} (${students.length} élève${students.length > 1 ? 's' : ''})`
  const fileName = `Dossiers_${sanitizeFileName(classe === TOUTE_ETABLISSEMENT ? 'Etablissement' : classe)}_${todayFileStamp()}`

  return (
    <PrintPreviewShell subtitle={subtitle} onClose={onClose} fileName={fileName}>
      {students.length === 0 ? (
        <p className="rounded-2xl bg-white px-6 py-10 text-sm text-slate-400">Aucun élève dans cette classe.</p>
      ) : (
        students.map((student) => (
          <PrintableIdentity
            key={student.id}
            student={student}
            identity={getStudentIdentitySnapshot(student.id)}
            cantine={getStudentExtraSnapshot(student.id).cantine}
          />
        ))
      )}
    </PrintPreviewShell>
  )
}
