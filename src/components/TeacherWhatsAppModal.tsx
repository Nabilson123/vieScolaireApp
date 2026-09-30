import { useMemo, useState } from 'react'
import { X, MessageCircle, AlertTriangle, FileDown } from 'lucide-react'
import { teacherName, type Teacher } from '../data/teachers'
import { computeTeacherSchedule } from '../utils/teacherAggregation'
import { buildTeacherScheduleMessage, buildWhatsAppLink } from '../utils/whatsapp'
import SchedulePrintPreviewModal from './schedule-print/SchedulePrintPreviewModal'

interface TeacherWhatsAppModalProps {
  teacher: Teacher
  onClose: () => void
}

type Mode = 'emploi' | 'libre'

/** Lundi de la semaine en cours — même calcul que EmploiDuTempsGlobal.tsx (mondayOf). */
function currentMonday(): Date {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

export default function TeacherWhatsAppModal({ teacher, onClose }: TeacherWhatsAppModalProps) {
  const scheduleMessage = useMemo(() => buildTeacherScheduleMessage(teacherName(teacher), computeTeacherSchedule(teacher)), [teacher])
  const [mode, setMode] = useState<Mode>('emploi')
  const [message, setMessage] = useState(scheduleMessage)
  const [showPdf, setShowPdf] = useState(false)

  const handleModeChange = (next: Mode) => {
    setMode(next)
    setMessage(next === 'emploi' ? scheduleMessage : '')
  }

  const hasPhone = !!teacher.telephoneMobile.trim()
  const canSend = hasPhone && message.trim() !== ''

  const handleSend = () => {
    const link = buildWhatsAppLink(teacher.telephoneMobile, message)
    if (!link) return
    window.open(link, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
            Contacter {teacherName(teacher)} — WhatsApp
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {!hasPhone && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Aucun numéro de téléphone mobile renseigné pour ce professeur — éditez sa fiche avant d'envoyer.
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleModeChange('emploi')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'emploi' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              Emploi du temps
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('libre')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'libre' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              Message libre
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              placeholder="Tapez votre message..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">Modifiable avant l'envoi — ce texte sera pré-rempli dans WhatsApp.</p>
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setShowPdf(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <FileDown className="h-4 w-4" />
              Télécharger le PDF de son emploi du temps
            </button>
            <p className="mt-1 text-xs text-slate-400">
              WhatsApp ne permet pas de joindre un fichier automatiquement : téléchargez le PDF puis joignez-le vous-même dans la conversation qui s'ouvrira.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" />
            Envoyer via WhatsApp
          </button>
        </div>
      </div>

      {showPdf && (
        <SchedulePrintPreviewModal
          title={`Emploi du Temps — ${teacherName(teacher)}`}
          variant="enseignant"
          teacherName={teacherName(teacher)}
          schedule={computeTeacherSchedule(teacher)}
          weekStart={currentMonday()}
          weekEnd={(() => {
            const end = currentMonday()
            end.setDate(end.getDate() + 4)
            return end
          })()}
          onClose={() => setShowPdf(false)}
        />
      )}
    </div>
  )
}
