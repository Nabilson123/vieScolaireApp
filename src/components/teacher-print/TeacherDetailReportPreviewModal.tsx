import { teacherName, type Teacher } from '../../data/teachers'
import type { TeacherExtra } from '../../data/teacherExtras'
import PrintableTeacherDetailReport from './PrintableTeacherDetailReport'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName } from '../print/printFileName'

interface TeacherDetailReportPreviewModalProps {
  teacher: Teacher
  extra: TeacherExtra
  periodStart: string
  periodEnd: string
  onClose: () => void
}

export default function TeacherDetailReportPreviewModal({
  teacher,
  extra,
  periodStart,
  periodEnd,
  onClose,
}: TeacherDetailReportPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Rapport Détaillé — Prof. ${teacherName(teacher)}`}
      onClose={onClose}
      fileName={`Rapport_Enseignant_${sanitizeFileName(teacherName(teacher))}_${periodStart}_${periodEnd}`}
    >
      <PrintableTeacherDetailReport teacher={teacher} extra={extra} periodStart={periodStart} periodEnd={periodEnd} />
    </PrintPreviewShell>
  )
}
