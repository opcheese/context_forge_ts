/**
 * Client-side OpenRouter API client.
 * Calls OpenRouter directly from the browser using user's API key.
 *
 * API Documentation: https://openrouter.ai/docs
 */

import { openrouter as settings } from "./settings"

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface OpenRouterStreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenRouterModel {
  id: string
  name: string
  description?: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
  }
}

export interface StreamChatOptions {
  model?: string
  temperature?: number
  topP?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface StreamChatResult {
  text: string
  promptTokens?: number
  completionTokens?: number
  model?: string
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1"

/**
 * Stream chat completion from OpenRouter.
 * Returns an async generator of text chunks.
 */
export async function* streamChat(
  messages: OpenRouterMessage[],
  options?: StreamChatOptions
): AsyncGenerator<string, StreamChatResult, unknown> {
  const apiKey = settings.getApiKey()
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured. Please add your API key in Settings.")
  }

  const model = options?.model || settings.getModel()

  const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "ContextForge",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: options?.temperature ?? 0.7,
      top_p: options?.topP,
      max_tokens: options?.maxTokens,
    }),
    signal: options?.signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `OpenRouter error: ${response.status} ${response.statusText} - ${errorText}`
    )
  }

  if (!response.body) {
    throw new Error("No response body from OpenRouter")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let fullText = ""
  let finalUsage: OpenRouterStreamChunk["usage"] | undefined
  let responseModel: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith("data: ")) continue

      const data = trimmed.slice(6)
      if (data === "[DONE]") continue

      try {
        const chunk: OpenRouterStreamChunk = JSON.parse(data)
        responseModel = chunk.model

        const content = chunk.choices[0]?.delta?.content
        if (content) {
          fullText += content
          yield content
        }

        if (chunk.usage) {
          finalUsage = chunk.usage
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim() && buffer.trim().startsWith("data: ")) {
    const data = buffer.trim().slice(6)
    if (data !== "[DONE]") {
      try {
        const chunk: OpenRouterStreamChunk = JSON.parse(data)
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          fullText += content
          yield content
        }
        if (chunk.usage) {
          finalUsage = chunk.usage
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }

  return {
    text: fullText,
    promptTokens: finalUsage?.prompt_tokens,
    completionTokens: finalUsage?.completion_tokens,
    model: responseModel,
  }
}

/**
 * Check if OpenRouter is available and API key is configured.
 */
export async function checkHealth(): Promise<{
  ok: boolean
  configured: boolean
  error?: string
  model?: string
}> {
  const apiKey = settings.getApiKey()

  // Return early if no API key - don't make network request
  if (!apiKey || apiKey.trim() === "") {
    return {
      ok: false,
      configured: false,
      // Don't set error - this is expected when not configured
    }
  }

  try {
    const response = await fetch(`${OPENROUTER_URL}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        error: `API error: ${response.status} ${response.statusText}`,
      }
    }

    return {
      ok: true,
      configured: true,
      model: settings.getModel(),
    }
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * List available models from OpenRouter.
 */
export async function listModels(): Promise<OpenRouterModel[]> {
  const apiKey = settings.getApiKey()
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured")
  }

  const response = await fetch(`${OPENROUTER_URL}/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`OpenRouter error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as { data: OpenRouterModel[] }
  return data.data || []
}
