import { useMemo, useState } from 'react'
import { X, MessageCircle, CheckCircle2, Send, AlertTriangle, FileDown } from 'lucide-react'
import { teacherName, initials, type Teacher } from '../data/teachers'
import { computeTeacherSchedule, teacherCycles } from '../utils/teacherAggregation'
import { buildTeacherScheduleMessage, buildWhatsAppLink } from '../utils/whatsapp'
import { CYCLES } from '../data/referentiel'
import SchedulePrintPreviewModal from './schedule-print/SchedulePrintPreviewModal'

interface BulkTeacherWhatsAppModalProps {
  teachers: Teacher[]
  onClose: () => void
}

const CYCLE_OPTIONS = [{ key: 'tous', label: 'Tous les cycles' }, ...CYCLES.map((c) => ({ key: c.key, label: c.label }))]

/** Lundi de la semaine en cours — même calcul que EmploiDuTempsGlobal.tsx (mondayOf). */
function currentMonday(): Date {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

export default function BulkTeacherWhatsAppModal({ teachers, onClose }: BulkTeacherWhatsAppModalProps) {
  const [cycle, setCycle] = useState('tous')
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [pdfTeacher, setPdfTeacher] = useState<Teacher | null>(null)

  const filtered = useMemo(() => {
    return teachers
      .filter((t) => cycle === 'tous' || teacherCycles(t).includes(cycle))
      .sort((a, b) => teacherName(a).localeCompare(teacherName(b)))
  }, [teachers, cycle])

  const withPhone = filtered.filter((t) => t.telephoneMobile.trim())

  const sendOne = (teacher: Teacher) => {
    const message = buildTeacherScheduleMessage(teacherName(teacher), computeTeacherSchedule(teacher))
    const link = buildWhatsAppLink(teacher.telephoneMobile, message)
    if (!link) return
    window.open(link, '_blank', 'noopener,noreferrer')
    setSentIds((prev) => new Set(prev).add(teacher.id))
  }

  const sendAll = () => {
    // Best effort : la plupart des navigateurs bloquent les popups multiples ouverts hors d'un
    // clic direct — ça fonctionne pour quelques profs, au-delà mieux vaut cliquer un par un
    // ci-dessous (chaque clic est un vrai geste utilisateur, jamais bloqué).
    withPhone.forEach((t) => sendOne(t))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
            Envoi rapide — Emplois du temps
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 py-4">
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cycle</label>
          <select
            value={cycle}
            onChange={(e) => {
              setCycle(e.target.value)
              setSentIds(new Set())
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
          >
            {CYCLE_OPTIONS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-400">
            Chaque professeur reçoit son propre emploi du temps réel. WhatsApp s'ouvre dans un nouvel onglet par envoi.
            L'icône <FileDown className="inline h-3 w-3 align-text-bottom" /> télécharge son PDF (portrait/paysage) à joindre vous-même
            dans la conversation — WhatsApp ne permet pas de joindre un fichier automatiquement.
          </p>
          <button
            type="button"
            onClick={sendAll}
            disabled={withPhone.length === 0}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Tout envoyer ({withPhone.length})
          </button>
          <p className="mt-1.5 flex items-start gap-1 text-xs text-amber-600">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            Si le navigateur bloque les onglets multiples, envoie individuellement ci-dessous.
          </p>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto px-6 py-4">
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucun professeur dans ce cycle.</p>}
          {filtered.map((t) => {
            const hasPhone = !!t.telephoneMobile.trim()
            const sent = sentIds.has(t.id)
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {initials(teacherName(t))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{teacherName(t)}</p>
                  <p className="truncate text-xs text-slate-400">{hasPhone ? t.telephoneMobile : 'Pas de numéro renseigné'}</p>
                </div>
                <button
                  type="button"
                  title="Télécharger son emploi du temps en PDF"
                  onClick={() => setPdfTeacher(t)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                >
                  <FileDown className="h-3.5 w-3.5" />
                </button>
                {sent ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Envoyé
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendOne(t)}
                    disabled={!hasPhone}
                    className="shrink-0 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Envoyer
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Fermer
          </button>
        </div>
      </div>

      {pdfTeacher && (
        <SchedulePrintPreviewModal
          title={`Emploi du Temps — ${teacherName(pdfTeacher)}`}
          variant="enseignant"
          teacherName={teacherName(pdfTeacher)}
          schedule={computeTeacherSchedule(pdfTeacher)}
          weekStart={currentMonday()}
          weekEnd={(() => {
            const end = currentMonday()
            end.setDate(end.getDate() + 4)
            return end
          })()}
          onClose={() => setPdfTeacher(null)}
        />
      )}
    </div>
  )
}
