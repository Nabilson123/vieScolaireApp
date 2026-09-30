import { useState } from 'react'
import { RectangleHorizontal, RectangleVertical } from 'lucide-react'
import PrintableScheduleLudique, { type ScheduleOrientation } from './PrintableScheduleLudique'
import type { ClassScheduleSlot } from '../../utils/classAggregation'
import type { TeacherScheduleSlot } from '../../utils/teacherAggregation'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName } from '../print/printFileName'
import { toPrintSchedule } from './scheduleprintUtils'

type SchedulePrintPreviewModalProps = {
  title: string
  weekStart: Date
  weekEnd: Date
  onClose: () => void
} & (
  | { variant: 'classe'; classe: string; schedule: Record<string, ClassScheduleSlot[]> }
  | { variant: 'enseignant'; teacherName: string; schedule: Record<string, TeacherScheduleSlot[]> }
)

export default function SchedulePrintPreviewModal(props: SchedulePrintPreviewModalProps) {
  const { title, weekStart, weekEnd, onClose } = props
  const [orientation, setOrientation] = useState<ScheduleOrientation>('paysage')

  const printSchedule =
    props.variant === 'classe'
      ? toPrintSchedule(props.schedule, (s: ClassScheduleSlot) => (s.teacherName === 'Inconnu' ? 'Prof. Inconnu' : `Prof. ${s.teacherName}`))
      : toPrintSchedule(props.schedule, (s: TeacherScheduleSlot) => `Cl ${s.classe}`)

  const metaLabel = props.variant === 'classe' ? `Classe : ${props.classe}` : `Prof. ${props.teacherName}`
  const footerMessage =
    props.variant === 'classe' ? undefined : '💡 Merci de signaler toute indisponibilité à l’avance.'

  return (
    <PrintPreviewShell
      subtitle={title}
      printLabel="Imprimer / Télécharger"
      onClose={onClose}
      fileName={sanitizeFileName(title)}
      extraHeaderActions={
        <div className="flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setOrientation('portrait')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              orientation === 'portrait' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            <RectangleVertical className="h-3.5 w-3.5" />
            Portrait
          </button>
          <button
            type="button"
            onClick={() => setOrientation('paysage')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              orientation === 'paysage' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            <RectangleHorizontal className="h-3.5 w-3.5" />
            Paysage
          </button>
        </div>
      }
    >
      <PrintableScheduleLudique
        metaLabel={metaLabel}
        weekStart={weekStart}
        weekEnd={weekEnd}
        schedule={printSchedule}
        orientation={orientation}
        footerMessage={footerMessage}
      />
    </PrintPreviewShell>
  )
}
