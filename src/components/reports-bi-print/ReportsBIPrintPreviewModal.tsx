import { formatPeriodLabel } from '../../utils/period'
import PrintableReportsBI, { type PrintableReportsBIProps } from './PrintableReportsBI'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName } from '../print/printFileName'

interface ReportsBIPrintPreviewModalProps extends PrintableReportsBIProps {
  onClose: () => void
}

export default function ReportsBIPrintPreviewModal({ onClose, ...data }: ReportsBIPrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Rapports BI — ${formatPeriodLabel(data.periodStart, data.periodEnd)}`}
      onClose={onClose}
      fileName={`Rapports_BI_${sanitizeFileName(formatPeriodLabel(data.periodStart, data.periodEnd))}`}
    >
      <PrintableReportsBI {...data} />
    </PrintPreviewShell>
  )
}
