import type { FeuilleSeance } from '../../utils/soutienContexte'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { todayFileStamp } from '../print/printFileName'
import PrintableSoutienSeance from './PrintableSoutienSeance'

export default function SoutienSeancePrintPreviewModal({ feuille, onClose }: { feuille: FeuilleSeance; onClose: () => void }) {
  return (
    <PrintPreviewShell
      subtitle={`Feuille de soutien — ${feuille.seance.matiere}`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={`Soutien_${feuille.seance.matiere}_${feuille.seance.jour}_${todayFileStamp()}`}
    >
      <PrintableSoutienSeance feuille={feuille} />
    </PrintPreviewShell>
  )
}
