import PrintableHelpdeskBilan from './PrintableHelpdeskBilan'
import type { Incident } from '../../data/helpdesk'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { todayFileStamp } from '../print/printFileName'
import { formatPeriodLabel } from '../../utils/period'

interface HelpdeskBilanPreviewModalProps {
  start: string
  end: string
  incidents: Incident[]
  onClose: () => void
}

export default function HelpdeskBilanPreviewModal({ start, end, incidents, onClose }: HelpdeskBilanPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Rapport Bilan Helpdesk & Maintenance — ${formatPeriodLabel(start, end)}`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={`Bilan_Helpdesk_${todayFileStamp()}`}
    >
      <PrintableHelpdeskBilan start={start} end={end} incidents={incidents} />
    </PrintPreviewShell>
  )
}
