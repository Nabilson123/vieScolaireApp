import type { Student } from '../../../data/students'
import type { StudentExtra } from '../../../data/studentDetails'
import { getStudentIdentitySnapshot } from '../../../services/studentIdentityService'
import type { FilteredStudentView } from '../../../utils/studentAggregation'
import PrintableBilan from './PrintableBilan'
import PrintableIdentity from './PrintableIdentity'
import PrintPreviewShell from '../../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../../print/printFileName'

interface PrintPreviewModalProps {
  student: Student
  extra: StudentExtra
  view: FilteredStudentView
  periodLabel: string
  evaluationType: string
  onClose: () => void
}

export default function PrintPreviewModal({ student, extra, view, periodLabel, evaluationType, onClose }: PrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Fiche de Bilan Individuel — ${student.name}`}
      onClose={onClose}
      fileName={`Dossier_Eleve_${sanitizeFileName(student.name)}_${todayFileStamp()}`}
    >
      <PrintableIdentity student={student} identity={getStudentIdentitySnapshot(student.id)} cantine={extra.cantine} />
      <PrintableBilan student={student} extra={extra} view={view} periodLabel={periodLabel} evaluationType={evaluationType} />
    </PrintPreviewShell>
  )
}
