/**
 * Client-side Ollama API client.
 * Calls Ollama directly from the browser.
 *
 * IMPORTANT: Ollama must be started with CORS enabled:
 * OLLAMA_ORIGINS="*" ollama serve
 *
 * API Documentation: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

import { ollama as settings } from "./settings"

export interface OllamaMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface OllamaStreamChunk {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export interface OllamaModel {
  name: string
  modified_at: string
  size: number
  digest: string
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
  totalDuration?: number
}

/**
 * Stream chat completion from Ollama.
 * Returns an async generator of text chunks.
 */
export async function* streamChat(
  messages: OllamaMessage[],
  options?: StreamChatOptions
): AsyncGenerator<string, StreamChatResult, unknown> {
  const ollamaUrl = settings.getUrl()
  const model = options?.model || settings.getModel()

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP,
        num_predict: options?.maxTokens,
      },
    }),
    signal: options?.signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  if (!response.body) {
    throw new Error("No response body from Ollama")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let fullText = ""
  let finalStats: Partial<OllamaStreamChunk> = {}

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const chunk: OllamaStreamChunk = JSON.parse(line)

        if (chunk.message?.content) {
          fullText += chunk.message.content
          yield chunk.message.content
        }

        if (chunk.done) {
          finalStats = chunk
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    try {
      const chunk: OllamaStreamChunk = JSON.parse(buffer)
      if (chunk.message?.content) {
        fullText += chunk.message.content
        yield chunk.message.content
      }
      if (chunk.done) {
        finalStats = chunk
      }
    } catch {
      // Skip malformed JSON
    }
  }

  return {
    text: fullText,
    promptTokens: finalStats.prompt_eval_count,
    completionTokens: finalStats.eval_count,
    totalDuration: finalStats.total_duration,
  }
}

/**
 * Check if Ollama is available and responding.
 */
export async function checkHealth(): Promise<{
  ok: boolean
  url: string
  error?: string
  model?: string
}> {
  const ollamaUrl = settings.getUrl()

  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return {
        ok: false,
        url: ollamaUrl,
        error: `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    return {
      ok: true,
      url: ollamaUrl,
      model: settings.getModel(),
    }
  } catch (error) {
    // Provide helpful error messages for common issues
    let errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
      errorMessage = `Cannot connect to Ollama at ${ollamaUrl}. Make sure Ollama is running with CORS enabled: OLLAMA_ORIGINS="*" ollama serve`
    }

    return {
      ok: false,
      url: ollamaUrl,
      error: errorMessage,
    }
  }
}

/**
 * List available models in Ollama.
 */
export async function listModels(): Promise<OllamaModel[]> {
  const ollamaUrl = settings.getUrl()

  const response = await fetch(`${ollamaUrl}/api/tags`, {
    method: "GET",
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as { models: OllamaModel[] }
  return data.models || []
}

/**
 * Check if a specific model is available.
 */
export async function hasModel(modelName: string): Promise<boolean> {
  try {
    const models = await listModels()
    return models.some(
      (m) => m.name === modelName || m.name === `${modelName}:latest`
    )
  } catch {
    return false
  }
}
