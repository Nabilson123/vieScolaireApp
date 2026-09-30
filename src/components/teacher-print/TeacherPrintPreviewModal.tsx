import type { Teacher } from '../../data/teachers'
import PrintableTeacherReport from './PrintableTeacherReport'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { todayFileStamp } from '../print/printFileName'

interface TeacherPrintPreviewModalProps {
  teachers: Teacher[]
  onClose: () => void
}

export default function TeacherPrintPreviewModal({ teachers, onClose }: TeacherPrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Registre des Enseignants (${teachers.length})`}
      onClose={onClose}
      fileName={`Registre_Enseignants_${todayFileStamp()}`}
    >
      <PrintableTeacherReport teachers={teachers} />
    </PrintPreviewShell>
  )
}
