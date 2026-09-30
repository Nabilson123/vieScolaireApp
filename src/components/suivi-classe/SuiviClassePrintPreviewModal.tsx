import PrintableSuiviClasseSchedule, { type PrintSuiviClasseSlot } from './PrintableSuiviClasseSchedule'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'

interface SuiviClassePrintPreviewModalProps {
  slots: PrintSuiviClasseSlot[]
  onClose: () => void
}

export default function SuiviClassePrintPreviewModal({ slots, onClose }: SuiviClassePrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle="Suivi de Classe — Emploi du temps hebdomadaire"
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={sanitizeFileName(`Suivi_de_Classe_Emploi_du_Temps_${todayFileStamp()}`)}
    >
      <PrintableSuiviClasseSchedule slots={slots} />
    </PrintPreviewShell>
  )
}
