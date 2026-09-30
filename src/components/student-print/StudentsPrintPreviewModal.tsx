import type { Student } from '../../data/students'
import PrintableStudentsReport from './PrintableStudentsReport'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { todayFileStamp } from '../print/printFileName'

interface StudentsPrintPreviewModalProps {
  students: Student[]
  onClose: () => void
}

export default function StudentsPrintPreviewModal({ students, onClose }: StudentsPrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Fiches Élèves (${students.length})`}
      onClose={onClose}
      fileName={`Fiches_Eleves_${todayFileStamp()}`}
    >
      <PrintableStudentsReport students={students} />
    </PrintPreviewShell>
  )
}
