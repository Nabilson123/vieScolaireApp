import { useState } from 'react'
import { MessageSquareWarning, X } from 'lucide-react'
import type { ReclamationRecord } from '../../data/studentDetails'
import ReclamationCard from '../ReclamationCard'
import EditReclamationModal from '../reclamations/EditReclamationModal'
import ReclamationMessageModal, { MESSAGE_KIND_LABELS, messageKindForStatut } from '../reclamations/ReclamationMessageModal'
import type { ReclamationMessageKind } from '../../utils/whatsapp'
import { useIsViewedYearEditable } from '../../services/viewedYear'
import { useCurrentProfile, getModuleAccess } from '../../services/permissions'
import { useReclamationActions } from '../../hooks/useReclamationActions'

interface ReclamationsTabProps {
  studentId: string
  studentName: string
  classe: string
  reclamations: ReclamationRecord[]
}

export default function ReclamationsTab({ studentId, studentName, classe, reclamations }: ReclamationsTabProps) {
  const profile = useCurrentProfile()
  const isEditable = useIsViewedYearEditable() && getModuleAccess(profile, 'reclamations').canEdit
  const actions = useReclamationActions()
  const [editing, setEditing] = useState<ReclamationRecord | null>(null)
  const [message, setMessage] = useState<{ reclamation: ReclamationRecord; kind: ReclamationMessageKind } | null>(null)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquareWarning className="h-4 w-4 text-rose-400" />
        <h3 className="text-sm font-semibold text-slate-800">Suivi des Réclamations des Parents</h3>
      </div>

      {actions.error && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <span>{actions.error}</span>
          <button type="button" onClick={actions.clearError} title="Fermer" className="shrink-0 text-rose-400 hover:text-rose-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {reclamations.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucune réclamation enregistrée.</p>
      ) : (
        <div className="space-y-3">
          {reclamations.map((r) => (
            <ReclamationCard
              key={r.id}
              reclamation={r}
              isEditable={isEditable}
              onTakeCharge={async () => {
                const updated = await actions.prendreEnCharge(studentId, r.id)
                if (updated) setMessage({ reclamation: updated, kind: 'prise_en_charge' })
              }}
              onResolve={async (resolution) => {
                const updated = await actions.resoudre(studentId, r.id, resolution)
                if (updated) setMessage({ reclamation: updated, kind: 'resolution' })
              }}
              onMessage={() => setMessage({ reclamation: r, kind: messageKindForStatut(r.statut) })}
              onAssign={(responsable, echeance) => actions.assigner(studentId, r.id, responsable, echeance || undefined)}
              onReopen={() => actions.rouvrir(studentId, r.id)}
              onEdit={() => setEditing(r)}
              onDelete={() => actions.supprimer(studentId, r.id)}
            />
          ))}
        </div>
      )}

      {message && (
        <ReclamationMessageModal
          reclamation={message.reclamation}
          studentId={studentId}
          studentName={studentName}
          classe={classe}
          kind={message.kind}
          onShared={(kind) => actions.journaliserMessage(studentId, message.reclamation.id, MESSAGE_KIND_LABELS[kind])}
          onClose={() => setMessage(null)}
        />
      )}

      {editing && (
        <EditReclamationModal
          reclamation={editing}
          studentId={studentId}
          studentName={studentName}
          onClose={() => setEditing(null)}
          onSave={async (patch, detail) => {
            const target = editing
            setEditing(null)
            await actions.modifier(studentId, target.id, patch, detail)
          }}
        />
      )}
    </div>
  )
}
