import { useState } from 'react'
import { RectangleHorizontal, RectangleVertical } from 'lucide-react'
import PrintableScheduleLudique, { type ScheduleOrientation } from './PrintableScheduleLudique'
import { toPrintSchedule } from './scheduleprintUtils'
import { computeClassSchedule, type ClassScheduleSlot } from '../../utils/classAggregation'
import { computeTeacherSchedule, type TeacherScheduleSlot } from '../../utils/teacherAggregation'
import { teacherName, type Teacher } from '../../data/teachers'
import PrintPreviewShell from '../print/PrintPreviewShell'
import { sanitizeFileName } from '../print/printFileName'

type AllSchedulesPrintPreviewModalProps = {
  weekStart: Date
  weekEnd: Date
  onClose: () => void
} & ({ variant: 'classes'; classes: string[] } | { variant: 'profs'; teachers: Teacher[] })

export default function AllSchedulesPrintPreviewModal(props: AllSchedulesPrintPreviewModalProps) {
  const { weekStart, weekEnd, onClose } = props
  const [orientation, setOrientation] = useState<ScheduleOrientation>('paysage')

  const pages =
    props.variant === 'classes'
      ? props.classes.map((classe) => ({
          key: classe,
          metaLabel: `Classe : ${classe}`,
          schedule: toPrintSchedule(computeClassSchedule(classe), (s: ClassScheduleSlot) => (s.teacherName === 'Inconnu' ? 'Prof. Inconnu' : `Prof. ${s.teacherName}`)),
        }))
      : props.teachers.map((t) => ({
          key: t.id,
          metaLabel: `Prof. ${teacherName(t)}`,
          schedule: toPrintSchedule(computeTeacherSchedule(t), (s: TeacherScheduleSlot) => `Cl ${s.classe}`),
        }))

  const title =
    props.variant === 'classes'
      ? `Emplois du Temps — Toutes les classes (${pages.length})`
      : `Emplois du Temps — Tous les professeurs (${pages.length})`

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
      {pages.map((p) => (
        <PrintableScheduleLudique
          key={p.key}
          metaLabel={p.metaLabel}
          weekStart={weekStart}
          weekEnd={weekEnd}
          schedule={p.schedule}
          orientation={orientation}
          footerMessage={props.variant === 'profs' ? '💡 Merci de signaler toute indisponibilité à l’avance.' : undefined}
        />
      ))}
    </PrintPreviewShell>
  )
}
