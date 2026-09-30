export interface GeminiTextPart {
  text: string
}

export interface GeminiFunctionCallPart {
  functionCall: {
    name: string
    args: Record<string, unknown>
  }
}

export interface GeminiFunctionResponsePart {
  functionResponse: {
    name: string
    response: Record<string, unknown>
  }
}

export type GeminiPart = GeminiTextPart | GeminiFunctionCallPart | GeminiFunctionResponsePart

export interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface GeminiTool {
  functionDeclarations: GeminiFunctionDeclaration[]
}

export interface GeminiCandidate {
  content?: GeminiContent
  finishReason?: string
}

export interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[]
}

export interface AiCopilotRequestBody {
  systemInstruction: string
  contents: GeminiContent[]
  tools: GeminiTool[]
}
