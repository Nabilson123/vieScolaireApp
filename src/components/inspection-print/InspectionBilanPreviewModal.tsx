import type { InspectionRecord } from '../../data/inspections'
import type { Teacher } from '../../data/teachers'
import { teacherName } from '../../data/teachers'
import PrintableInspectionBilan from './PrintableInspectionBilan'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName } from '../print/printFileName'

interface InspectionBilanPreviewModalProps {
  record: InspectionRecord
  teacher: Teacher
  onClose: () => void
}

export default function InspectionBilanPreviewModal({ record, teacher, onClose }: InspectionBilanPreviewModalProps) {
  return (
    <PrintPreviewShell
      title="Aperçu du Bilan Individuel d'Inspection"
      subtitle={teacherName(teacher)}
      printLabel="Imprimer le Bilan A4 (PDF)"
      onClose={onClose}
      fileName={`Bilan_Inspection_${sanitizeFileName(teacherName(teacher))}_${record.date}`}
    >
      <PrintableInspectionBilan record={record} teacher={teacher} />
    </PrintPreviewShell>
  )
}
