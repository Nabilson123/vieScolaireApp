import PrintableExportCoverPage from './PrintableExportCoverPage'
import PrintableExportSectionPage from './PrintableExportSectionPage'
import type { ExportReportData } from '../../utils/exportGeneraliseAggregation'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { todayFileStamp } from '../print/printFileName'

interface ExportPrintPreviewModalProps {
  report: ExportReportData
  subtitle: string
  onClose: () => void
}

export default function ExportPrintPreviewModal({ report, subtitle, onClose }: ExportPrintPreviewModalProps) {
  const totalPages = report.sectionPages.length + 1

  return (
    <PrintPreviewShell subtitle={subtitle} onClose={onClose} fileName={`Export_Generalise_${todayFileStamp()}`}>
      <PrintableExportCoverPage data={report} subtitle={subtitle} totalPages={totalPages} />
      {report.sectionPages.map((page, i) => (
        <PrintableExportSectionPage key={i} page={page} pageNum={i + 2} totalPages={totalPages} />
      ))}
    </PrintPreviewShell>
  )
}
