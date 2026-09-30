import PrintableDisciplineNotice from './PrintableDisciplineNotice'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'

interface DisciplineNoticePreviewModalProps {
  studentName: string
  classe: string
  date: string
  author: string
  typeCode?: string
  title: string
  description: string
  sanction?: string
  procedureStepsDone?: number[]
  retenueDate?: string
  retenueDuree?: string
  procedureStepDetails?: Record<number, string>
  procedureDetailsPrintable?: boolean
  privationActivite?: string
  privationDuree?: string
  onClose: () => void
}

export default function DisciplineNoticePreviewModal({
  studentName,
  classe,
  date,
  author,
  typeCode,
  title,
  description,
  sanction,
  procedureStepsDone,
  retenueDate,
  retenueDuree,
  procedureStepDetails,
  procedureDetailsPrintable,
  privationActivite,
  privationDuree,
  onClose,
}: DisciplineNoticePreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Notification Disciplinaire — ${studentName}`}
      onClose={onClose}
      fileName={`Notification_Disciplinaire_${sanitizeFileName(studentName)}_${todayFileStamp()}`}
    >
      <PrintableDisciplineNotice
        studentName={studentName}
        classe={classe}
        date={date}
        author={author}
        typeCode={typeCode}
        title={title}
        description={description}
        sanction={sanction}
        procedureStepsDone={procedureStepsDone}
        retenueDate={retenueDate}
        retenueDuree={retenueDuree}
        procedureStepDetails={procedureStepDetails}
        procedureDetailsPrintable={procedureDetailsPrintable}
        privationActivite={privationActivite}
        privationDuree={privationDuree}
      />
    </PrintPreviewShell>
  )
}
