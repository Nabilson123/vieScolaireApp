import { Sparkles } from 'lucide-react'
import { useAiCopilotChat } from '../hooks/useAiCopilotChat'
import WriteToolConfirmationCard from '../components/ai-copilot/WriteToolConfirmationCard'
import ChatInputBar from '../components/ai-copilot/ChatInputBar'

export default function AiCopilotGlobal() {
  const { displayMessages, status, error, pendingDescription, hasWriteTools, sendUserMessage, confirmPending, cancelPending } =
    useAiCopilotChat()

  const inputDisabled = status === 'sending' || status === 'executing' || status === 'awaiting_confirmation'

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          Assistant IA
          <Sparkles className="h-6 w-6 text-violet-500" />
        </h1>
        <p className="max-w-xl text-sm text-slate-500">
          Posez des questions sur les données de l'école ou demandez une action — chaque action est
          soumise à votre confirmation avant d'être exécutée.
        </p>
      </div>

      {!hasWriteTools && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          Vous consultez cet assistant en lecture seule (aucune action d'écriture disponible avec vos droits actuels).
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        {displayMessages.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Posez une première question pour commencer.
          </div>
        )}

        {displayMessages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-lg whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === 'user' ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white' : 'bg-slate-50 text-slate-700'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {(status === 'awaiting_confirmation' || status === 'executing') && pendingDescription && (
          <WriteToolConfirmationCard
            description={pendingDescription}
            executing={status === 'executing'}
            onConfirm={confirmPending}
            onCancel={cancelPending}
          />
        )}

        {status === 'sending' && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-400">L'assistant réfléchit...</div>
          </div>
        )}

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</div>}
      </div>

      <ChatInputBar disabled={inputDisabled} onSend={sendUserMessage} />
    </div>
  )
}
