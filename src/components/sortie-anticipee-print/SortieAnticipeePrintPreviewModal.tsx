import PrintableSortieAnticipee from './PrintableSortieAnticipee'
import type { Student } from '../../data/students'
import type { StudentIdentity } from '../../data/studentIdentity'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'

interface SortieAnticipeePrintPreviewModalProps {
  student: Student
  identity: StudentIdentity
  date: string
  heure: string
  recuperePar: string
  lienParente: string
  motif: string
  verifIdentite: boolean
  verifAccordResponsable: boolean
  verifSurListe: boolean
  reference: string
  onClose: () => void
}

export default function SortieAnticipeePrintPreviewModal({
  student,
  identity,
  date,
  heure,
  recuperePar,
  lienParente,
  motif,
  verifIdentite,
  verifAccordResponsable,
  verifSurListe,
  reference,
  onClose,
}: SortieAnticipeePrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Sortie anticipée — ${student.name} (${date})`}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={sanitizeFileName(`SortieAnticipee_${student.name}_${todayFileStamp()}`)}
    >
      <PrintableSortieAnticipee
        student={student}
        identity={identity}
        date={date}
        heure={heure}
        recuperePar={recuperePar}
        lienParente={lienParente}
        motif={motif}
        verifIdentite={verifIdentite}
        verifAccordResponsable={verifAccordResponsable}
        verifSurListe={verifSurListe}
        reference={reference}
      />
    </PrintPreviewShell>
  )
}
