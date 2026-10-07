import type { RapportClasse } from '../../utils/soutien'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { todayFileStamp } from '../print/printFileName'
import PrintableSoutienClasse from './PrintableSoutienClasse'

interface Props {
  rapports: RapportClasse[]
  /** Portée affichée dans le titre et le nom du fichier (« Toutes les classes », « CE1 », « CE1-A »). */
  portee: string
  onClose: () => void
}

export default function SoutienPrintPreviewModal({ rapports, portee, onClose }: Props) {
  return (
    <PrintPreviewShell
      subtitle={`Transport, sorties et soutien — ${portee} (${rapports.length} classe${rapports.length > 1 ? 's' : ''})`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={`Transport_Sorties_Soutien_${portee}_${todayFileStamp()}`}
    >
      <PrintableSoutienClasse rapports={rapports} />
    </PrintPreviewShell>
  )
}
