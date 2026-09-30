import { supabase } from '../../lib/supabaseClient'
import type { AiCopilotRequestBody, GeminiGenerateContentResponse } from './types'

export async function callAiCopilot(body: AiCopilotRequestBody): Promise<GeminiGenerateContentResponse> {
  const { data, error } = await supabase.functions.invoke('ai-copilot', { body })
  if (error) throw error
  return data as GeminiGenerateContentResponse
}
