import PrintableInspectionConsolidatedReport from './PrintableInspectionConsolidatedReport'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { todayFileStamp } from '../print/printFileName'

interface InspectionConsolidatedPreviewModalProps {
  onClose: () => void
}

export default function InspectionConsolidatedPreviewModal({ onClose }: InspectionConsolidatedPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle="Rapport Consolidé des Inspections Pédagogiques"
      onClose={onClose}
      fileName={`Rapport_Consolide_Inspections_${todayFileStamp()}`}
    >
      <PrintableInspectionConsolidatedReport />
    </PrintPreviewShell>
  )
}
