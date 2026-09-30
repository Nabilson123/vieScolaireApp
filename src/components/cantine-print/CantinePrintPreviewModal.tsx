import PrintableCantineReport, { type CantineReportVariant } from './PrintableCantineReport'
import type { Student } from '../../data/students'
import type { CantineInfo } from '../../data/studentDetails'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'

interface CantinePrintPreviewModalProps {
  title: string
  subtitle: string
  variant: CantineReportVariant
  rows: { student: Student; cantine: CantineInfo }[]
  onClose: () => void
}

export default function CantinePrintPreviewModal({ title, subtitle, variant, rows, onClose }: CantinePrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={title}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={`${sanitizeFileName(title)}_${todayFileStamp()}`}
    >
      <PrintableCantineReport title={title} subtitle={subtitle} variant={variant} rows={rows} />
    </PrintPreviewShell>
  )
}
