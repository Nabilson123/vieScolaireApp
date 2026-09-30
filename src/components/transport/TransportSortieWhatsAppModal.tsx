import { useState } from 'react'
import { X, MessageCircle, AlertTriangle, Copy, Check, ExternalLink } from 'lucide-react'
import { buildWhatsAppLink } from '../../utils/whatsapp'

interface TransportSortieWhatsAppModalProps {
  mode: 'sortie' | 'retour'
  studentName: string
  ligneSoirNom: string | null
  chauffeurNom: string | null
  chauffeurTel: string | null
  aideNom: string | null
  aideTel: string | null
  groupeUrl: string
  message: string
  onClose: () => void
}

function RecipientRow({
  label,
  name,
  phone,
  message,
}: {
  label: string
  name: string | null
  phone: string | null
  message: string
}) {
  const link = phone ? buildWhatsAppLink(phone, message) : null
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm text-slate-700">{name || '—'}</p>
      </div>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Envoyer
        </a>
      ) : (
        <span className="shrink-0 text-xs text-slate-400">{name ? 'Pas de numéro' : 'Non assigné'}</span>
      )}
    </div>
  )
}

export default function TransportSortieWhatsAppModal({
  mode,
  studentName,
  ligneSoirNom,
  chauffeurNom,
  chauffeurTel,
  aideNom,
  aideTel,
  groupeUrl,
  message: initialMessage,
  onClose,
}: TransportSortieWhatsAppModalProps) {
  const [message, setMessage] = useState(initialMessage)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
            {mode === 'sortie' ? 'Prévenir le transport — sortie anticipée' : 'Prévenir le transport — retour à l’école'}
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-xs text-slate-500">
            {studentName} — {ligneSoirNom ? `Ligne ${ligneSoirNom}` : 'ligne du soir non affectée'}
          </p>

          {!chauffeurTel && !aideTel && !groupeUrl && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Aucun numéro de chauffeur/aide-maîtresse ni lien de groupe configuré pour cette ligne — copiez le message et envoyez-le manuellement.
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Message (arabe)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              dir="rtl"
              rows={6}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">Modifiable avant l'envoi.</p>
          </div>

          <div className="space-y-2">
            <RecipientRow label="Chauffeur" name={chauffeurNom} phone={chauffeurTel} message={message} />
            <RecipientRow label="Aide-maîtresse" name={aideNom} phone={aideTel} message={message} />

            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Groupe WhatsApp transport</p>
                <p className="truncate text-sm text-slate-700">{groupeUrl ? 'Copier puis coller dans le groupe' : 'Aucun lien configuré'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
                {groupeUrl && (
                  <a
                    href={groupeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ouvrir
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
