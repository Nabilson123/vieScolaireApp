import PrintableCalendarReport from './PrintableCalendarReport'
import type { CalendarEvent, MonthGridCell } from '../../utils/calendarAggregation'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName } from '../print/printFileName'

interface CalendarPrintPreviewModalProps {
  title: string
  subtitle: string
  grid: MonthGridCell[]
  eventsByDay: Record<string, CalendarEvent[]>
  onClose: () => void
}

export default function CalendarPrintPreviewModal({ title, subtitle, grid, eventsByDay, onClose }: CalendarPrintPreviewModalProps) {
  return (
    <PrintPreviewShell
      subtitle={title}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={sanitizeFileName(title)}
    >
      <PrintableCalendarReport title={title} subtitle={subtitle} grid={grid} eventsByDay={eventsByDay} />
    </PrintPreviewShell>
  )
}
