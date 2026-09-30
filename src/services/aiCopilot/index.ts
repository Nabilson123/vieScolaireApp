import type { Profile } from '../../data/profiles'
import { READ_TOOLS } from './readTools'
import { WRITE_TOOLS } from './writeTools'
import type { GeminiTool } from './types'

export { READ_TOOLS } from './readTools'
export { WRITE_TOOLS } from './writeTools'
export * from './types'
export { callAiCopilot } from './client'
export { buildSystemPrompt } from './systemPrompt'

/** Déclarations de fonctions envoyées au modèle — les outils d'écriture non autorisés pour ce
 * profil sont absents ici, pas seulement refusés à l'exécution : le modèle ne sait même pas
 * qu'ils existent. Gemini attend `tools` sous la forme [{ functionDeclarations: [...] }]. */
export function getAvailableTools(profile: Profile | undefined, canEditYear: boolean): GeminiTool[] {
  const readDeclarations = Object.values(READ_TOOLS).map((t) => t.schema)
  const writeDeclarations = Object.values(WRITE_TOOLS)
    .filter((t) => t.moduleGate(profile, canEditYear))
    .map((t) => t.schema)
  return [{ functionDeclarations: [...readDeclarations, ...writeDeclarations] }]
}

export function isWriteTool(name: string): boolean {
  return name in WRITE_TOOLS
}
