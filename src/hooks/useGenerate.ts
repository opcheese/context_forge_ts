import { useState, useCallback, useRef } from "react"
import type { Id } from "../../convex/_generated/dataModel"

interface UseGenerateOptions {
  sessionId: Id<"sessions">
  onChunk?: (chunk: string) => void
  onComplete?: (fullText: string) => void
  onError?: (error: string) => void
}

interface UseGenerateResult {
  generate: (prompt: string) => Promise<void>
  isGenerating: boolean
  streamedText: string
  error: string | null
  stop: () => void
}

// Convex HTTP actions run on port 3211 (separate from main Convex on 3210)
function getChatApiUrl(): string {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
  if (convexUrl) {
    // Replace port 3210 with 3211 for HTTP actions
    return convexUrl.replace(":3210", ":3211") + "/api/chat"
  }
  return "http://127.0.0.1:3211/api/chat"
}

/**
 * Hook for Ollama streaming generation.
 *
 * Calls the Convex HTTP action at /api/chat which:
 * 1. Assembles context from session blocks (respecting zone order)
 * 2. Streams response from Ollama via SSE
 * 3. Auto-saves the result to WORKING zone
 *
 * For Claude, use useClaudeGenerate instead (Convex reactive streaming).
 */
export function useGenerate(options: UseGenerateOptions): UseGenerateResult {
  const { sessionId, onChunk, onComplete, onError } = options
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamedText, setStreamedText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsGenerating(false)
  }, [])

  const generate = useCallback(
    async (prompt: string) => {
      setIsGenerating(true)
      setStreamedText("")
      setError(null)

      abortControllerRef.current = new AbortController()

      try {
        // System prompt is extracted from blocks by the backend
        const response = await fetch(getChatApiUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, prompt }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            (errorData as { error?: string }).error ||
              `HTTP ${response.status}: ${response.statusText}`
          )
        }

        if (!response.body) {
          throw new Error("No response body")
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let fullText = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const data = line.slice(6)

            if (data === "[DONE]") continue

            try {
              const parsed = JSON.parse(data) as {
                type: string
                delta?: string
                error?: string
              }

              if (parsed.type === "text-delta" && parsed.delta) {
                fullText += parsed.delta
                setStreamedText(fullText)
                onChunk?.(parsed.delta)
              } else if (parsed.type === "error") {
                throw new Error(parsed.error || "Unknown streaming error")
              } else if (parsed.type === "finish") {
                onComplete?.(fullText)
              }
            } catch (parseError) {
              // Skip malformed JSON - may be partial chunk
              if (
                parseError instanceof Error &&
                parseError.message !== "Unknown streaming error"
              ) {
                continue
              }
              throw parseError
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User stopped generation - not an error
          return
        }
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        onError?.(message)
      } finally {
        setIsGenerating(false)
        abortControllerRef.current = null
      }
    },
    [sessionId, onChunk, onComplete, onError]
  )

  return { generate, isGenerating, streamedText, error, stop }
}
