import PrintableTransportAdminListe, {
  type TransportAdminClasseGroup,
  type TransportAdminLigneInfo,
  type TransportAdminNonAffecteRow,
} from './PrintableTransportAdminListe'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { todayFileStamp } from '../print/printFileName'

interface TransportAdminListePrintPreviewModalProps {
  groups: TransportAdminClasseGroup[]
  lignesInfo: TransportAdminLigneInfo[]
  nonAffectes: TransportAdminNonAffecteRow[]
  total: number
  onClose: () => void
}

export default function TransportAdminListePrintPreviewModal({ groups, lignesInfo, nonAffectes, total, onClose }: TransportAdminListePrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle="Liste Administrative — Transport"
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={`Liste_Administrative_Transport_${todayFileStamp()}`}
    >
      <PrintableTransportAdminListe groups={groups} lignesInfo={lignesInfo} nonAffectes={nonAffectes} total={total} />
    </PrintPreviewShell>
  )
}
