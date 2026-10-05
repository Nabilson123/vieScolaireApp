import { useState } from 'react'
import { HeartHandshake, MessageCircle } from 'lucide-react'
import type { ReclamationRecord, ReclamationSuiviFamille } from '../../data/studentDetails'
import { useReclamationActions } from '../../hooks/useReclamationActions'
import { formatDateFR, isRelanceDue, relanceDueLe, todayLocalISO } from '../../utils/reclamationsLogic'
import ReclamationMessageModal, { MESSAGE_KIND_LABELS } from './ReclamationMessageModal'

const ISSUE_LABELS: Record<ReclamationSuiviFamille['issue'], string> = {
  satisfaite: 'Famille satisfaite',
  insatisfaite: 'Famille non satisfaite — réclamation rouverte',
  sans_reponse: 'Sans réponse de la famille',
}

/**
 * Après la résolution, l'établissement revient vers la famille (« la réponse vous a-t-elle convenu ? ») et note
 * l'issue. Seules les réclamations dont la date de résolution est connue sont suivies : les anciennes
 * résolutions n'en ont pas et ne sont jamais relancées au hasard.
 */
export default function SuiviFamilleSection({
  reclamation,
  studentId,
  studentName,
  classe,
  isEditable,
}: {
  reclamation: ReclamationRecord
  studentId: string
  studentName: string
  classe: string
  isEditable: boolean
}) {
  const actions = useReclamationActions()
  const [showMessage, setShowMessage] = useState(false)
  const [note, setNote] = useState('')
  const [confirmReopen, setConfirmReopen] = useState(false)
  const [saving, setSaving] = useState(false)

  const suivi = reclamation.suiviFamille
  const resolueDatee = reclamation.statut === 'Résolue' && !!reclamation.resoluLe

  // Déjà suivie (ou rouverte à la demande de la famille) : on affiche l'issue.
  if (suivi) {
    return (
      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-800">Suivi de la famille</h3>
        <div className="rounded-lg border border-pink-100 bg-pink-50/60 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-pink-700">
            <HeartHandshake className="h-4 w-4" />
            {ISSUE_LABELS[suivi.issue]}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">le {formatDateFR(todayLocalISO(new Date(suivi.le)))}</p>
          {suivi.note && <p className="mt-1 text-sm text-slate-700">{suivi.note}</p>}
        </div>
      </div>
    )
  }
  if (!resolueDatee) return null

  const due = relanceDueLe(reclamation)
  const record = async (issue: ReclamationSuiviFamille['issue']) => {
    setSaving(true)
    await actions.suiviFamille(studentId, reclamation.id, issue, note)
    setSaving(false)
    setNote('')
    setConfirmReopen(false)
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-slate-800">Suivi de la famille</h3>
      <div className="space-y-2.5 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
        <p className="text-xs text-violet-800">
          {isRelanceDue(reclamation) ? <span className="font-bold">Relance à faire</span> : 'Relance prévue'}
          {due && <> le {formatDateFR(due)}</>} : vérifier que la réponse apportée a convenu.
        </p>
        <button
          type="button"
          onClick={() => setShowMessage(true)}
          className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Message de suivi
        </button>
        {isEditable && (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Note sur l'échange avec la famille (facultatif)…"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Issue :</span>
              <button type="button" disabled={saving} onClick={() => record('satisfaite')} className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
                Satisfaite
              </button>
              <button type="button" disabled={saving} onClick={() => record('sans_reponse')} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Sans réponse
              </button>
              {confirmReopen ? (
                <>
                  <button type="button" disabled={saving} onClick={() => record('insatisfaite')} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                    Confirmer : rouvrir
                  </button>
                  <button type="button" onClick={() => setConfirmReopen(false)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
                    Annuler
                  </button>
                </>
              ) : (
                <button type="button" disabled={saving} onClick={() => setConfirmReopen(true)} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                  Pas satisfaite
                </button>
              )}
            </div>
          </>
        )}
        {actions.error && <p className="text-xs text-rose-600">{actions.error}</p>}
      </div>

      {showMessage && (
        <ReclamationMessageModal
          reclamation={reclamation}
          studentId={studentId}
          studentName={studentName}
          classe={classe}
          kind="relance"
          onShared={(kind) => actions.messagePartage(studentId, reclamation, kind, MESSAGE_KIND_LABELS[kind])}
          onClose={() => setShowMessage(false)}
        />
      )}
    </div>
  )
}
