import PrintableBonCommande from './PrintableBonCommande'
import type { BonCommande, BCContext } from '../../data/helpdesk'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName } from '../print/printFileName'

interface BCPrintPreviewModalProps {
  incident: BCContext
  bc: BonCommande
  onClose: () => void
}

export default function BCPrintPreviewModal({ incident, bc, onClose }: BCPrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Bon de Commande ${bc.numero}`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={`Bon_Commande_${sanitizeFileName(bc.numero)}`}
    >
      <PrintableBonCommande incident={incident} bc={bc} />
    </PrintPreviewShell>
  )
}
