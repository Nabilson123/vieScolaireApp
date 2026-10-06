import { useRef, useState, type ReactNode } from 'react'
import { X, MessageCircle, Copy, Check, CheckCircle2, ExternalLink } from 'lucide-react'
import { buildWhatsAppLink } from '../utils/whatsapp'

export interface WhatsAppRecipient {
  label: string
  phone: string
}

interface MessageWhatsAppModalProps {
  message: string
  onClose: () => void
  title?: string
  /** Libellé au-dessus de la zone de texte. */
  label?: string
  /** Bandeau de confirmation (ex. « Rendez-vous enregistré… »). */
  banner?: string
  /** Numéros connus : un bouton « Ouvrir WhatsApp » par destinataire, avec le message pré-rempli. */
  recipients?: WhatsAppRecipient[]
  /** Appelé quand le message est copié ou qu'un lien WhatsApp est ouvert (pour le journaliser). */
  onShared?: () => void
  /** Contrôles affichés au-dessus du texte (ex. choix de la langue). */
  toolbar?: ReactNode
  /** Remarque affichée sous le texte. */
  note?: string
}

/**
 * Message prêt à partager par WhatsApp : zone de texte modifiable, « Copier » (avec repli sur la sélection
 * si le navigateur refuse l'accès au presse-papiers) et, quand un numéro est connu, ouverture directe de
 * WhatsApp avec le message pré-rempli. Aucun envoi automatique : la personne relit et envoie elle-même.
 */
export default function MessageWhatsAppModal({
  message: initialMessage,
  onClose,
  title = 'Message à envoyer par WhatsApp',
  label = 'Message',
  banner,
  recipients = [],
  onShared,
  toolbar,
  note,
}: MessageWhatsAppModalProps) {
  const [message, setMessage] = useState(initialMessage)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
    } catch {
      // Presse-papiers refusé par le navigateur : on sélectionne le texte pour un Ctrl+C manuel.
      textareaRef.current?.select()
      return
    }
    setCopied(true)
    onShared?.()
    setTimeout(() => setCopied(false), 2000)
  }

  const links = recipients
    .map((r) => ({ ...r, href: buildWhatsAppLink(r.phone, message) }))
    .filter((r): r is WhatsAppRecipient & { href: string } => !!r.href)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
            {title}
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          {banner && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {banner}
            </div>
          )}
          {toolbar}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={9}
              dir="auto"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 [unicode-bidi:plaintext] focus:border-indigo-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">Modifiable avant la copie.</p>
            {note && <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">{note}</p>}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Fermer
          </button>
          {links.map((r) => (
            <a
              key={r.phone}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onShared?.()}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <ExternalLink className="h-4 w-4" />
              Ouvrir WhatsApp — {r.label}
            </a>
          ))}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-600"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copié' : 'Copier le message'}
          </button>
        </div>
      </div>
    </div>
  )
}
