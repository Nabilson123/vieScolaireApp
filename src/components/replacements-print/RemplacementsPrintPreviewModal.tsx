import { formatPeriodLabel } from '../../utils/period'
import PrintableRemplacementsBilan from './PrintableRemplacementsBilan'
import type { FlatRemplacement, EquiteRow, RemplacementGlobalStats } from '../../utils/replacementAggregation'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName } from '../print/printFileName'

interface RemplacementsPrintPreviewModalProps {
  periodStart: string
  periodEnd: string
  stats: RemplacementGlobalStats
  equite: EquiteRow[]
  historique: FlatRemplacement[]
  onClose: () => void
}

export default function RemplacementsPrintPreviewModal({
  periodStart,
  periodEnd,
  stats,
  equite,
  historique,
  onClose,
}: RemplacementsPrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Bilan des Remplacements — ${formatPeriodLabel(periodStart, periodEnd)}`}
      onClose={onClose}
      fileName={`Bilan_Remplacements_${sanitizeFileName(formatPeriodLabel(periodStart, periodEnd))}`}
    >
      <PrintableRemplacementsBilan
        periodStart={periodStart}
        periodEnd={periodEnd}
        stats={stats}
        equite={equite}
        historique={historique}
      />
    </PrintPreviewShell>
  )
}
