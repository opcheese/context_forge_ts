import { useState, useCallback, useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

interface UseClaudeGenerateOptions {
  sessionId: Id<"sessions">
  onChunk?: (chunk: string) => void
  onComplete?: (fullText: string) => void
  onError?: (error: string) => void
}

interface UseClaudeGenerateResult {
  generate: (prompt: string, systemPrompt?: string) => Promise<void>
  isGenerating: boolean
  streamedText: string
  error: string | null
  stop: () => void
}

/**
 * Hook for streaming Claude Code generation using Convex reactive queries.
 *
 * Unlike HTTP streaming (used for Ollama), this uses:
 * 1. Action to start generation (creates generation record)
 * 2. useQuery subscription for real-time text updates
 * 3. Database writes from Node.js action as chunks arrive
 */
export function useClaudeGenerate(
  options: UseClaudeGenerateOptions
): UseClaudeGenerateResult {
  const { sessionId, onChunk, onComplete, onError } = options

  const [generationId, setGenerationId] = useState<Id<"generations"> | null>(
    null
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamedText, setStreamedText] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Track previous text for chunk detection
  const prevTextRef = useRef("")

  // Convex hooks
  const startGeneration = useMutation(api.generations.startClaudeGeneration)
  const saveToBlocks = useMutation(api.generations.saveToBlocks)

  // Subscribe to generation updates
  const generation = useQuery(
    api.generations.get,
    generationId ? { generationId } : "skip"
  )

  // Sync Convex reactive data to local state for streaming UI updates.
  // This is an intentional pattern: we're syncing external state (Convex query)
  // to local state to provide chunk-by-chunk callbacks and stable text reference.
  useEffect(() => {
    if (!generation) return

    // Detect new chunks
    const newText = generation.text
    if (newText !== prevTextRef.current) {
      const chunk = newText.slice(prevTextRef.current.length)
      if (chunk) {
        onChunk?.(chunk)
      }
      prevTextRef.current = newText
      // Intentional: syncing external Convex data to local state
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreamedText(newText)
    }

    // Handle completion
    if (generation.status === "complete" && isGenerating) {
       
      setIsGenerating(false)
      onComplete?.(generation.text)

      // Auto-save to blocks
      if (generation.text.trim()) {
        saveToBlocks({ generationId: generation._id }).catch((err) => {
          console.error("Failed to save generation to blocks:", err)
        })
      }
    }

    // Handle error
    if (generation.status === "error" && isGenerating) {
       
      setIsGenerating(false)
      const errorMsg = generation.error || "Unknown error"
       
      setError(errorMsg)
      onError?.(errorMsg)
    }
  }, [
    generation,
    isGenerating,
    onChunk,
    onComplete,
    onError,
    saveToBlocks,
  ])

  const generate = useCallback(
    async (prompt: string, systemPrompt?: string) => {
      setIsGenerating(true)
      setStreamedText("")
      setError(null)
      prevTextRef.current = ""

      try {
        const result = await startGeneration({
          sessionId,
          prompt,
          systemPrompt,
        })
        setGenerationId(result.generationId)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        onError?.(message)
        setIsGenerating(false)
      }
    },
    [sessionId, startGeneration, onError]
  )

  const stop = useCallback(() => {
    // For now, just mark as not generating locally
    // TODO: Implement server-side cancellation
    setIsGenerating(false)
  }, [])

  return { generate, isGenerating, streamedText, error, stop }
}
