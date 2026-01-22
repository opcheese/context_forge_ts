import { useState, useCallback, useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

export type Provider = "ollama" | "claude" | "openrouter"
export type Zone = "PERMANENT" | "STABLE" | "WORKING"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  savedAsBlockId?: Id<"blocks">
}

interface UseBrainstormOptions {
  sessionId: Id<"sessions">
  onError?: (error: string) => void
}

interface UseBrainstormResult {
  // Conversation state (ephemeral)
  messages: Message[]
  isOpen: boolean
  provider: Provider

  // Actions
  open: (provider?: Provider) => void
  close: () => void
  sendMessage: (content: string) => Promise<void>
  clearConversation: () => void
  setProvider: (provider: Provider) => void
  retryMessage: (messageId: string) => Promise<void>

  // Streaming state
  isStreaming: boolean
  streamingText: string

  // Save to blocks
  saveMessage: (messageId: string, zone: Zone) => Promise<Id<"blocks">>

  // State
  error: string | null
}

// Generate unique ID for messages
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Get brainstorm API URL for Ollama
function getBrainstormApiUrl(): string {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
  if (convexUrl) {
    return convexUrl.replace(":3210", ":3211") + "/api/brainstorm"
  }
  return "http://127.0.0.1:3211/api/brainstorm"
}

// Get brainstorm API URL for OpenRouter
function getOpenRouterBrainstormApiUrl(): string {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
  if (convexUrl) {
    return convexUrl.replace(":3210", ":3211") + "/api/openrouter/brainstorm"
  }
  return "http://127.0.0.1:3211/api/openrouter/brainstorm"
}

/**
 * Hook for multi-turn brainstorming conversations with LLMs.
 *
 * Supports both providers:
 * - Claude: Uses Convex reactive streaming via mutations
 * - Ollama: Uses HTTP/SSE streaming via /api/brainstorm endpoint
 */
export function useBrainstorm(options: UseBrainstormOptions): UseBrainstormResult {
  const { sessionId, onError } = options

  // Dialog state
  const [isOpen, setIsOpen] = useState(false)
  const [provider, setProvider] = useState<Provider>("claude")

  // Conversation state (ephemeral - lost on close/refresh)
  const [messages, setMessages] = useState<Message[]>([])

  // Streaming state
  const [generationId, setGenerationId] = useState<Id<"generations"> | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Track previous text for Claude chunk detection
  const prevTextRef = useRef("")

  // Abort controller for Ollama HTTP streaming
  const abortControllerRef = useRef<AbortController | null>(null)

  // Convex mutations (for Claude)
  const startBrainstormGeneration = useMutation(api.generations.startBrainstormGeneration)
  const saveBrainstormMessage = useMutation(api.generations.saveBrainstormMessage)

  // Subscribe to generation updates (for Claude)
  const generation = useQuery(
    api.generations.get,
    generationId ? { generationId } : "skip"
  )

  // Sync Claude streaming data to local state
  useEffect(() => {
    if (!generation || provider !== "claude") return

    // Detect new chunks
    const newText = generation.text
    if (newText !== prevTextRef.current) {
      prevTextRef.current = newText
      setStreamingText(newText)
    }

    // Handle completion - add assistant message to conversation
    if (generation.status === "complete" && isStreaming) {
      setIsStreaming(false)

      if (generation.text.trim()) {
        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: generation.text,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      }

      setStreamingText("")
      setGenerationId(null)
    }

    // Handle error
    if (generation.status === "error" && isStreaming) {
      setIsStreaming(false)
      const errorMsg = generation.error || "Unknown error"
      setError(errorMsg)
      onError?.(errorMsg)
      setStreamingText("")
      setGenerationId(null)
    }
  }, [generation, isStreaming, onError, provider])

  // Open dialog
  const open = useCallback((newProvider?: Provider) => {
    if (newProvider) {
      setProvider(newProvider)
    }
    setIsOpen(true)
  }, [])

  // Close dialog
  const close = useCallback(() => {
    setIsOpen(false)
    // Stop any ongoing streaming
    abortControllerRef.current?.abort()
  }, [])

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([])
    setStreamingText("")
    setError(null)
    setGenerationId(null)
    setIsStreaming(false)
    prevTextRef.current = ""
    abortControllerRef.current?.abort()
  }, [])

  // Send message via Ollama (HTTP streaming)
  // System prompt is now extracted from blocks by the backend
  const sendMessageOllama = useCallback(
    async (content: string) => {
      abortControllerRef.current = new AbortController()

      try {
        const conversationHistory = messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }))

        const response = await fetch(getBrainstormApiUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            conversationHistory,
            newMessage: content,
          }),
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
                fullText?: string
                error?: string
              }

              if (parsed.type === "text-delta" && parsed.delta) {
                fullText += parsed.delta
                setStreamingText(fullText)
              } else if (parsed.type === "error") {
                throw new Error(parsed.error || "Unknown streaming error")
              } else if (parsed.type === "finish") {
                // Add assistant message to conversation
                if (fullText.trim()) {
                  const assistantMessage: Message = {
                    id: generateId(),
                    role: "assistant",
                    content: fullText,
                    timestamp: Date.now(),
                  }
                  setMessages((prev) => [...prev, assistantMessage])
                }
              }
            } catch (parseError) {
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
          return // User stopped - not an error
        }
        throw err
      } finally {
        setStreamingText("")
        abortControllerRef.current = null
      }
    },
    [sessionId, messages]
  )

  // Send message via OpenRouter (HTTP streaming, similar to Ollama)
  // System prompt is now extracted from blocks by the backend
  const sendMessageOpenRouter = useCallback(
    async (content: string) => {
      abortControllerRef.current = new AbortController()

      try {
        const conversationHistory = messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }))

        const response = await fetch(getOpenRouterBrainstormApiUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            conversationHistory,
            newMessage: content,
          }),
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
                fullText?: string
                error?: string
              }

              if (parsed.type === "text-delta" && parsed.delta) {
                fullText += parsed.delta
                setStreamingText(fullText)
              } else if (parsed.type === "error") {
                throw new Error(parsed.error || "Unknown streaming error")
              } else if (parsed.type === "finish") {
                // Add assistant message to conversation
                if (fullText.trim()) {
                  const assistantMessage: Message = {
                    id: generateId(),
                    role: "assistant",
                    content: fullText,
                    timestamp: Date.now(),
                  }
                  setMessages((prev) => [...prev, assistantMessage])
                }
              }
            } catch (parseError) {
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
          return // User stopped - not an error
        }
        throw err
      } finally {
        setStreamingText("")
        abortControllerRef.current = null
      }
    },
    [sessionId, messages]
  )

  // Send message via Claude (Convex mutations)
  // System prompt is now extracted from blocks by the backend
  const sendMessageClaude = useCallback(
    async (content: string) => {
      const conversationHistory = messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }))

      const result = await startBrainstormGeneration({
        sessionId,
        conversationHistory,
        newMessage: content,
      })
      setGenerationId(result.generationId)
    },
    [sessionId, messages, startBrainstormGeneration]
  )

  // Send a new message (dispatches to correct provider)
  // System prompt is now extracted from blocks by the backend
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      setError(null)

      // Add user message to conversation
      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Start streaming
      setIsStreaming(true)
      setStreamingText("")
      prevTextRef.current = ""

      try {
        if (provider === "ollama") {
          await sendMessageOllama(content.trim())
        } else if (provider === "openrouter") {
          await sendMessageOpenRouter(content.trim())
        } else {
          await sendMessageClaude(content.trim())
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        onError?.(message)
      } finally {
        // For Ollama/OpenRouter, streaming ends here. For Claude, it ends in the useEffect.
        if (provider === "ollama" || provider === "openrouter") {
          setIsStreaming(false)
        }
      }
    },
    [provider, isStreaming, sendMessageOllama, sendMessageOpenRouter, sendMessageClaude, onError]
  )

  // Save a message as a block
  const saveMessage = useCallback(
    async (messageId: string, zone: Zone): Promise<Id<"blocks">> => {
      const message = messages.find((m) => m.id === messageId)
      if (!message) {
        throw new Error("Message not found")
      }

      const blockId = await saveBrainstormMessage({
        sessionId,
        content: message.content,
        role: message.role,
        zone,
      })

      // Update message to track saved block
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, savedAsBlockId: blockId } : m
        )
      )

      return blockId
    },
    [sessionId, messages, saveBrainstormMessage]
  )

  // Retry from a specific message (regenerate assistant response)
  const retryMessage = useCallback(
    async (messageId: string) => {
      if (isStreaming) return

      // Find the message index
      const messageIndex = messages.findIndex((m) => m.id === messageId)
      if (messageIndex === -1) return

      const message = messages[messageIndex]

      // Find the user message to retry from
      let userMessage: Message | undefined
      let truncateIndex: number

      if (message.role === "assistant") {
        // Retry an assistant message: find the preceding user message
        for (let i = messageIndex - 1; i >= 0; i--) {
          if (messages[i].role === "user") {
            userMessage = messages[i]
            truncateIndex = i + 1 // Keep up to and including the user message
            break
          }
        }
      } else {
        // Retry a user message: use this message
        userMessage = message
        truncateIndex = messageIndex + 1 // Keep up to and including this user message
      }

      if (!userMessage) return

      // Remove this message and all subsequent messages
      setMessages((prev) => prev.slice(0, truncateIndex))

      // Reset error state
      setError(null)

      // Start streaming
      setIsStreaming(true)
      setStreamingText("")
      prevTextRef.current = ""

      try {
        if (provider === "ollama") {
          await sendMessageOllama(userMessage.content)
        } else if (provider === "openrouter") {
          await sendMessageOpenRouter(userMessage.content)
        } else {
          await sendMessageClaude(userMessage.content)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        setError(errorMsg)
        onError?.(errorMsg)
      } finally {
        if (provider === "ollama" || provider === "openrouter") {
          setIsStreaming(false)
        }
      }
    },
    [messages, isStreaming, provider, sendMessageOllama, sendMessageOpenRouter, sendMessageClaude, onError]
  )

  return {
    // State
    messages,
    isOpen,
    provider,

    // Actions
    open,
    close,
    sendMessage,
    clearConversation,
    setProvider,
    retryMessage,

    // Streaming
    isStreaming,
    streamingText,

    // Save
    saveMessage,

    // Error
    error,
  }
}
