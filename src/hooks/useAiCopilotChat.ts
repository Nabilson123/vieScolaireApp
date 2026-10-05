import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCurrentProfile } from '../services/permissions'
import { useIsViewedYearEditable } from '../services/viewedYear'
import { useMarkAppelParentDone } from '../services/appelsParentsService'
import { useDeclareSortieAnticipeeStaff } from '../services/sortiesAnticipeesService'
import { createReclamations } from '../services/studentDetailsService'
import { todayLocalISO } from '../utils/reclamationsLogic'
import { callAiCopilot, buildSystemPrompt, getAvailableTools, isWriteTool, READ_TOOLS, WRITE_TOOLS } from '../services/aiCopilot'
import type { GeminiContent, GeminiPart } from '../services/aiCopilot/types'

export type ChatStatus = 'idle' | 'sending' | 'awaiting_confirmation' | 'executing' | 'error'

interface PendingWrite {
  name: string
  args: Record<string, unknown>
}

export interface ChatDisplayMessage {
  role: 'user' | 'assistant'
  text: string
}

function isTextPart(p: GeminiPart): p is Extract<GeminiPart, { text: string }> {
  return 'text' in p
}

function isFunctionCallPart(p: GeminiPart): p is Extract<GeminiPart, { functionCall: unknown }> {
  return 'functionCall' in p
}

export function useAiCopilotChat() {
  const profile = useCurrentProfile()
  const canEditYear = useIsViewedYearEditable()
  const queryClient = useQueryClient()
  const markAppelParentDone = useMarkAppelParentDone()
  const declareSortie = useDeclareSortieAnticipeeStaff()

  const [history, setHistory] = useState<GeminiContent[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [pending, setPending] = useState<PendingWrite | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tools = getAvailableTools(profile, canEditYear)

  async function runTurn(nextHistory: GeminiContent[]) {
    setStatus('sending')
    setError(null)
    try {
      const response = await callAiCopilot({ systemInstruction: buildSystemPrompt(), contents: nextHistory, tools })
      const candidate = response.candidates?.[0]
      if (!candidate?.content?.parts) {
        setError('Réponse vide ou bloquée par les filtres de sécurité — reformulez votre demande.')
        setStatus('error')
        return
      }
      const withModel: GeminiContent[] = [...nextHistory, candidate.content]
      setHistory(withModel)

      // Un seul appel de fonction traité par tour même si le modèle en propose plusieurs en
      // parallèle — suffisant pour ce périmètre d'outils et garde la pause de confirmation simple.
      const callPart = candidate.content.parts.find(isFunctionCallPart)
      if (!callPart) {
        setStatus('idle')
        return
      }

      const { name, args } = callPart.functionCall

      // Un outil d'écriture met la boucle en pause : aucune functionResponse n'est produite avant
      // que l'utilisateur ait cliqué Confirmer/Annuler (voir confirmPending/cancelPending) — c'est
      // ce qui rend la confirmation structurellement obligatoire, pas seulement demandée au modèle.
      if (isWriteTool(name)) {
        setPending({ name, args })
        setStatus('awaiting_confirmation')
        return
      }

      const readTool = READ_TOOLS[name]
      const result = readTool ? await readTool.execute(args) : { error: `Outil inconnu : ${name}` }
      const nextWithResult: GeminiContent[] = [
        ...withModel,
        { role: 'user', parts: [{ functionResponse: { name, response: { result } } }] },
      ]
      await runTurn(nextWithResult)
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  async function executeWriteTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (name === 'marquer_appel_parent_fait') {
      const markedBy = profile?.nomComplet || profile?.email || ''
      await markAppelParentDone.mutateAsync({
        studentId: String(args.studentId ?? ''),
        markedBy,
        parentAppele: String(args.parentAppele ?? ''),
        note: args.note ? String(args.note) : undefined,
      })
      return 'Appel marqué comme fait.'
    }
    if (name === 'declarer_sortie_anticipee') {
      await declareSortie.mutateAsync({
        studentId: String(args.studentId ?? ''),
        date: String(args.date ?? ''),
        heure: String(args.heure ?? ''),
        recuperePar: String(args.recuperePar ?? ''),
        motif: String(args.motif ?? ''),
      })
      return 'Sortie anticipée déclarée.'
    }
    if (name === 'creer_reclamation') {
      await createReclamations({
        studentId: String(args.studentId ?? ''),
        parentNom: String(args.parentNom ?? ''),
        date: String(args.date ?? todayLocalISO()),
        items: (args.items as { category: string; objet: string; description: string; concernant: string }[] | undefined) ?? [],
      })
      await queryClient.invalidateQueries({ queryKey: ['studentExtras'] })
      return 'Réclamation créée.'
    }
    throw new Error(`Outil d'écriture inconnu : ${name}`)
  }

  async function continueAfterFunctionResponse(name: string, resultOrMessage: string, isErrorResult: boolean) {
    const next: GeminiContent[] = [
      ...history,
      {
        role: 'user',
        parts: [{ functionResponse: { name, response: isErrorResult ? { error: resultOrMessage } : { result: resultOrMessage } } }],
      },
    ]
    setPending(null)
    await runTurn(next)
  }

  async function confirmPending() {
    if (!pending) return
    setStatus('executing')
    try {
      const summary = await executeWriteTool(pending.name, pending.args)
      await continueAfterFunctionResponse(pending.name, summary, false)
    } catch (e) {
      await continueAfterFunctionResponse(pending.name, (e as Error).message, true)
    }
  }

  async function cancelPending() {
    if (!pending) return
    await continueAfterFunctionResponse(pending.name, "Action annulée par l'utilisateur.", true)
  }

  async function sendUserMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    await runTurn([...history, { role: 'user', parts: [{ text: trimmed }] }])
  }

  const displayMessages: ChatDisplayMessage[] = history
    .map((m) => ({
      role: (m.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
      text: m.parts.filter(isTextPart).map((p) => p.text).join('\n'),
    }))
    .filter((m) => m.text.trim().length > 0)

  const pendingDescription = pending ? (WRITE_TOOLS[pending.name]?.describe(pending.args) ?? pending.name) : null
  const hasWriteTools = tools.some((t) => t.functionDeclarations.some((d) => isWriteTool(d.name)))

  return {
    displayMessages,
    status,
    error,
    pendingDescription,
    hasWriteTools,
    sendUserMessage,
    confirmPending,
    cancelPending,
  }
}
