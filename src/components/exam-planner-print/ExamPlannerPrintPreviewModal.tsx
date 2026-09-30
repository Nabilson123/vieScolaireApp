import type { ExamSession } from '../../data/examPlanner'
import PrintableExamPlanner from './PrintableExamPlanner'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { todayFileStamp } from '../print/printFileName'

interface ExamPlannerPrintPreviewModalProps {
  sessions: ExamSession[]
  onClose: () => void
}

export default function ExamPlannerPrintPreviewModal({ sessions, onClose }: ExamPlannerPrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Planning de Surveillance des Examens — ${sessions.length} examen${sessions.length > 1 ? 's' : ''}`}
      onClose={onClose}
      fileName={`Planning_Surveillance_Examens_${todayFileStamp()}`}
    >
      <PrintableExamPlanner sessions={sessions} />
    </PrintPreviewShell>
  )
}
