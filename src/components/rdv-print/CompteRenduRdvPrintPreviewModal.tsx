import PrintableCompteRenduRdv from './PrintableCompteRenduRdv'
import type { RendezVousRecord } from '../../data/studentDetails'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'

interface CompteRenduRdvPrintPreviewModalProps {
  record: RendezVousRecord
  studentName: string
  classe: string
  onClose: () => void
}

export default function CompteRenduRdvPrintPreviewModal({ record, studentName, classe, onClose }: CompteRenduRdvPrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Compte-rendu de Rendez-vous — ${studentName} (${record.date})`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={sanitizeFileName(`CR_RDV_${studentName}_${todayFileStamp()}`)}
    >
      <PrintableCompteRenduRdv record={record} studentName={studentName} classe={classe} />
    </PrintPreviewShell>
  )
}
