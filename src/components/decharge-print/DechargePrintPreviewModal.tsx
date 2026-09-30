import PrintableDechargeParentale from './PrintableDechargeParentale'
import type { Student } from '../../data/students'
import type { StudentIdentity } from '../../data/studentIdentity'
import type { CantineInfo } from '../../data/studentDetails'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'

interface DechargePrintPreviewModalProps {
  student: Student
  identity: StudentIdentity
  cantine: CantineInfo
  onClose: () => void
}

export default function DechargePrintPreviewModal({ student, identity, cantine, onClose }: DechargePrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Décharge Parentale & Mode de Sortie — ${student.name}`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={sanitizeFileName(`Decharge_${student.name}_${todayFileStamp()}`)}
    >
      <PrintableDechargeParentale student={student} identity={identity} cantine={cantine} />
    </PrintPreviewShell>
  )
}
