import { useRef, useState } from 'react'
import { X, MessageCircle, Copy, Check, CheckCircle2 } from 'lucide-react'

interface PartagerRdvModalProps {
  message: string
  justCreated: boolean
  onClose: () => void
}

export default function PartagerRdvModal({ message: initialMessage, justCreated, onClose }: PartagerRdvModalProps) {
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
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
            Message à envoyer par WhatsApp
          </h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          {justCreated && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Rendez-vous enregistré. Copiez le message ci-dessous pour le partager.
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Informations du rendez-vous</label>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={9}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">Modifiable avant la copie.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Fermer
          </button>
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
