import { useState } from 'react'
import { X, Files, FileStack, ChevronLeft, Download } from 'lucide-react'
import AllSchedulesPrintPreviewModal from './AllSchedulesPrintPreviewModal'
import SchedulePrintPreviewModal from './SchedulePrintPreviewModal'
import { computeClassSchedule } from '../../utils/classAggregation'
import { computeTeacherSchedule } from '../../utils/teacherAggregation'
import { teacherName, type Teacher } from '../../data/teachers'

type SchedulesExportModalProps = {
  weekStart: Date
  weekEnd: Date
  onClose: () => void
} & ({ variant: 'classes'; classes: string[] } | { variant: 'profs'; teachers: Teacher[] })

type Step = 'choix' | 'ensemble' | 'separe'

export default function SchedulesExportModal(props: SchedulesExportModalProps) {
  const { weekStart, weekEnd, onClose } = props
  const [step, setStep] = useState<Step>('choix')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const items =
    props.variant === 'classes'
      ? props.classes.map((c) => ({ key: c, label: c }))
      : props.teachers.map((t) => ({ key: t.id, label: teacherName(t) }))

  const entityLabel = props.variant === 'classes' ? 'classe' : 'professeur'
  const entityLabelPlural = props.variant === 'classes' ? 'classes' : 'professeurs'

  if (step === 'ensemble') {
    return props.variant === 'classes' ? (
      <AllSchedulesPrintPreviewModal variant="classes" classes={props.classes} weekStart={weekStart} weekEnd={weekEnd} onClose={onClose} />
    ) : (
      <AllSchedulesPrintPreviewModal variant="profs" teachers={props.teachers} weekStart={weekStart} weekEnd={weekEnd} onClose={onClose} />
    )
  }

  if (step === 'separe' && selectedKey) {
    if (props.variant === 'classes') {
      return (
        <SchedulePrintPreviewModal
          title={`Emploi du Temps — ${selectedKey}`}
          variant="classe"
          classe={selectedKey}
          schedule={computeClassSchedule(selectedKey)}
          weekStart={weekStart}
          weekEnd={weekEnd}
          onClose={() => setSelectedKey(null)}
        />
      )
    }
    const teacher = props.teachers.find((t) => t.id === selectedKey)
    if (!teacher) return null
    return (
      <SchedulePrintPreviewModal
        title={`Emploi du Temps — ${teacherName(teacher)}`}
        variant="enseignant"
        teacherName={teacherName(teacher)}
        schedule={computeTeacherSchedule(teacher)}
        weekStart={weekStart}
        weekEnd={weekEnd}
        onClose={() => setSelectedKey(null)}
      />
    )
  }

  if (step === 'separe') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
        <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
            <button type="button" onClick={() => setStep('choix')} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="flex-1 text-lg font-bold text-slate-900">PDF séparés — {entityLabelPlural}</h2>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="border-b border-slate-100 px-6 py-3 text-xs text-slate-400">
            Chaque {entityLabel} a son propre fichier — cliquez pour ouvrir son aperçu, puis "Imprimer / Télécharger" pour l'enregistrer.
          </p>
          <div className="flex-1 space-y-1.5 overflow-y-auto px-6 py-4">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedKey(item.key)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-left hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                <Download className="h-4 w-4 shrink-0 text-indigo-500" />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Télécharger les emplois du temps — {entityLabelPlural}</h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-6 py-5">
          <button
            type="button"
            onClick={() => setStep('ensemble')}
            className="flex w-full items-start gap-3 rounded-xl border border-slate-200 px-4 py-3.5 text-left hover:border-indigo-300 hover:bg-indigo-50/40"
          >
            <Files className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Un seul PDF — tout ensemble</span>
              <span className="block text-xs text-slate-400">Un seul fichier avec {items.length} page(s), une par {entityLabel}.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStep('separe')}
            className="flex w-full items-start gap-3 rounded-xl border border-slate-200 px-4 py-3.5 text-left hover:border-indigo-300 hover:bg-indigo-50/40"
          >
            <FileStack className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
            <span>
              <span className="block text-sm font-semibold text-slate-800">PDF séparés — un fichier par {entityLabel}</span>
              <span className="block text-xs text-slate-400">Une liste, un clic par {entityLabel} pour l'enregistrer individuellement.</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
