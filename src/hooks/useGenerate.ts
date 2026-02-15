import { useState, useCallback, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import * as ollamaClient from "@/lib/llm/ollama"
import {
  assembleContext,
  extractSystemPromptFromBlocks,
} from "@/lib/llm/context"

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

/**
 * Hook for Ollama streaming generation (client-side).
 *
 * 1. Assembles context from session blocks (respecting zone order)
 * 2. Streams response from Ollama directly (client-side)
 * 3. Optionally saves the result to WORKING zone
 *
 * For Claude, use useClaudeGenerate instead (Convex reactive streaming).
 */
export function useGenerate(options: UseGenerateOptions): UseGenerateResult {
  const { sessionId, onChunk, onComplete, onError } = options
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamedText, setStreamedText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Get blocks for context assembly
  const blocks = useQuery(api.blocks.list, { sessionId })

  // Mutation to save generated text as a block
  const createBlock = useMutation(api.blocks.create)

  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsGenerating(false)
  }, [])

  const generate = useCallback(
    async (prompt: string) => {
      if (!blocks) {
        const message = "Blocks not loaded yet"
        setError(message)
        onError?.(message)
        return
      }

      setIsGenerating(true)
      setStreamedText("")
      setError(null)

      try {
        // Assemble context with blocks
        const contextMessages = assembleContext(blocks, prompt)

        // Extract system prompt if present
        const systemPrompt = extractSystemPromptFromBlocks(blocks)

        // Build messages for Ollama
        const ollamaMessages: ollamaClient.OllamaMessage[] = []

        // Add system prompt first if present
        if (systemPrompt) {
          ollamaMessages.push({
            role: "system",
            content: systemPrompt,
          })
        }

        // Add context messages
        for (const msg of contextMessages) {
          ollamaMessages.push({
            role: msg.role,
            content: msg.content,
          })
        }

        let fullText = ""

        const controller = new AbortController()
        abortControllerRef.current = controller

        const generator = ollamaClient.streamChat(ollamaMessages, {
          signal: controller.signal,
        })

        for await (const chunk of generator) {
          fullText += chunk
          setStreamedText(fullText)
          onChunk?.(chunk)
        }

        // Save to blocks on completion
        if (fullText.trim()) {
          await createBlock({
            sessionId,
            content: fullText,
            type: "assistant_message",
            zone: "WORKING",
          })
        }

        onComplete?.(fullText)
      } catch (err) {
        if ((err as Error).name === "AbortError") {
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
    [blocks, sessionId, createBlock, onChunk, onComplete, onError]
  )

  return { generate, isGenerating, streamedText, error, stop }
}
