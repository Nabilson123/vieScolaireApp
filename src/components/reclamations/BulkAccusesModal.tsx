import { useState } from 'react'
import { Check, CheckCircle2, Copy, ExternalLink, MailCheck, X } from 'lucide-react'
import { useReclamationActions } from '../../hooks/useReclamationActions'
import { buildWhatsAppLink } from '../../utils/whatsapp'
import { cleanReclamationText, isAccuseAEnvoyer } from '../../utils/reclamationsLogic'
import { buildReclamationOutbound } from './ReclamationMessageModal'
import type { QueueReclamation } from './ReclamationQueueModal'

interface BulkAccusesModalProps {
  /** Réclamations choisies, dans l'ordre d'affichage — figées à l'ouverture. */
  keys: { studentId: string; id: string }[]
  /** État courant de toutes les réclamations : une ligne passe à « envoyé » dès que l'accusé est enregistré. */
  items: QueueReclamation[]
  isEditable: boolean
  onClose: () => void
}

/**
 * Accusés de réception en série : une ligne par réclamation avec le message prêt, « Copier » et « Ouvrir WhatsApp ».
 * Chaque envoi (copie, ouverture de WhatsApp ou case « Envoyé ») est enregistré tout de suite : rien n'est perdu
 * si on ferme à mi-parcours. Aucun envoi automatique — la personne relit et envoie elle-même.
 */
export default function BulkAccusesModal({ keys, items, isEditable, onClose }: BulkAccusesModalProps) {
  const actions = useReclamationActions()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copyError, setCopyError] = useState(false)

  const rows = keys
    .map((k) => items.find((r) => r.studentId === k.studentId && r.id === k.id))
    .filter((r): r is QueueReclamation => !!r)
  const sentCount = rows.filter((r) => !isAccuseAEnvoyer(r)).length

  const markSent = (r: QueueReclamation) => {
    if (isEditable && isAccuseAEnvoyer(r)) actions.marquerAccuse(r.studentId, r.id)
  }

  const copy = async (r: QueueReclamation, message: string) => {
    try {
      await navigator.clipboard.writeText(message)
    } catch {
      setCopyError(true)
      return
    }
    setCopyError(false)
    setCopiedKey(`${r.studentId}-${r.id}`)
    setTimeout(() => setCopiedKey(null), 2000)
    markSent(r)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-label="Accusés de réception">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <MailCheck className="h-5 w-5 text-sky-600" />
              Accusés de réception
            </h2>
            <p className="text-xs text-slate-500">
              {sentCount} / {rows.length} envoyé{sentCount > 1 ? 's' : ''} · copier ou ouvrir WhatsApp l'enregistre comme envoyé.
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {copyError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Le navigateur a refusé la copie : utilisez « Ouvrir WhatsApp », ou le message individuel de la carte.</p>}
          {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucune réclamation sélectionnée.</p>}
          {rows.map((r) => {
            const key = `${r.studentId}-${r.id}`
            const sent = !isAccuseAEnvoyer(r)
            const { message, recipients } = buildReclamationOutbound(r, r.studentId, r.studentName, r.classe, 'accuse')
            const links = recipients.map((rc) => ({ ...rc, href: buildWhatsAppLink(rc.phone, message) })).filter((rc): rc is typeof rc & { href: string } => !!rc.href)
            return (
              <div key={key} className={`rounded-xl border p-3.5 ${sent ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      {r.studentName} <span className="font-normal text-slate-400">({r.classe})</span>
                      {r.parentNom && <span className="font-normal text-slate-500"> — {r.parentNom}</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{cleanReclamationText(r.objet)}</p>
                  </div>
                  <label className={`flex items-center gap-1.5 text-xs font-semibold ${sent ? 'text-emerald-700' : 'text-slate-600'}`}>
                    <input type="checkbox" checked={sent} disabled={sent || !isEditable} onChange={() => markSent(r)} className="h-4 w-4 rounded border-slate-300" />
                    Envoyé
                  </label>
                </div>
                <p className="mt-2 line-clamp-2 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copy(r, message)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    {copiedKey === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === key ? 'Copié' : 'Copier'}
                  </button>
                  {links.map((l) => (
                    <a
                      key={l.phone}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markSent(r)}
                      className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      WhatsApp — {l.label}
                    </a>
                  ))}
                  {links.length === 0 && <span className="text-[11px] text-slate-400">Aucun numéro connu pour cet élève.</span>}
                  {sent && (
                    <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Accusé enregistré
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            {sentCount === rows.length && rows.length > 0 ? 'Terminer' : 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  )
}
