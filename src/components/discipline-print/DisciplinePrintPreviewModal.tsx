import PrintableDisciplineReport from './PrintableDisciplineReport'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName, todayFileStamp } from '../print/printFileName'

interface PalmaresRow {
  id: string
  name: string
  classe: string
  conduite: number
  statutLabel: string
}

interface JournalRow {
  id: string
  studentId: string
  date: string
  studentName: string
  classe: string
  points: number
  title: string
  description: string
  author: string
  typeCode?: string
}

interface DisciplinePrintPreviewModalProps {
  classe: string
  dateStart: string
  dateEnd: string
  palmares: PalmaresRow[]
  entries: JournalRow[]
  onClose: () => void
}

export default function DisciplinePrintPreviewModal({
  classe,
  dateStart,
  dateEnd,
  palmares,
  entries,
  onClose,
}: DisciplinePrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={`Rapport Disciplinaire (${entries.length} fait(s))`}
      onClose={onClose}
      fileName={`Rapport_Disciplinaire_${sanitizeFileName(classe)}_${todayFileStamp()}`}
    >
      <PrintableDisciplineReport classe={classe} dateStart={dateStart} dateEnd={dateEnd} palmares={palmares} entries={entries} />
    </PrintPreviewShell>
  )
}
