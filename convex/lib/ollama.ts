/**
 * Ollama API client for local LLM inference.
 * Ollama runs at localhost:11434 and provides an OpenAI-compatible API.
 *
 * API Documentation: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

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
  // Final chunk includes these stats
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export interface OllamaChatResponse {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
  total_duration: number
  load_duration: number
  prompt_eval_count: number
  prompt_eval_duration: number
  eval_count: number
  eval_duration: number
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
}

export interface StreamChatResult {
  text: string
  promptTokens?: number
  completionTokens?: number
  totalDuration?: number
}

// Default configuration
const DEFAULT_OLLAMA_URL = "http://localhost:11434"
const DEFAULT_MODEL = "gpt-oss:latest"

function getOllamaUrl(): string {
  // In Convex, process.env is available in actions
  return typeof process !== "undefined" && process.env?.OLLAMA_URL
    ? process.env.OLLAMA_URL
    : DEFAULT_OLLAMA_URL
}

function getDefaultModel(): string {
  return typeof process !== "undefined" && process.env?.OLLAMA_MODEL
    ? process.env.OLLAMA_MODEL
    : DEFAULT_MODEL
}

/**
 * Stream chat completion from Ollama.
 * Returns an async generator of text chunks.
 */
export async function* streamChat(
  messages: OllamaMessage[],
  options?: StreamChatOptions
): AsyncGenerator<string, StreamChatResult, unknown> {
  const ollamaUrl = getOllamaUrl()
  const model = options?.model || getDefaultModel()

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

        // Capture final stats from done chunk
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
 * Non-streaming chat completion from Ollama.
 */
export async function chat(
  messages: OllamaMessage[],
  options?: StreamChatOptions
): Promise<OllamaChatResponse> {
  const ollamaUrl = getOllamaUrl()
  const model = options?.model || getDefaultModel()

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP,
        num_predict: options?.maxTokens,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return response.json()
}

/**
 * Check if Ollama is available and responding.
 */
export async function checkHealth(): Promise<{
  ok: boolean
  url: string
  error?: string
}> {
  const ollamaUrl = getOllamaUrl()

  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    return {
      ok: response.ok,
      url: ollamaUrl,
    }
  } catch (error) {
    return {
      ok: false,
      url: ollamaUrl,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * List available models in Ollama.
 */
export async function listModels(): Promise<OllamaModel[]> {
  const ollamaUrl = getOllamaUrl()

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
