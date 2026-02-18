import { useState, useCallback, useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import * as ollamaClient from "@/lib/llm/ollama"
import * as openrouterClient from "@/lib/llm/openrouter"
import {
  assembleContextWithConversation,
  extractSystemPromptFromBlocks,
  NO_TOOLS_SUFFIX,
} from "@/lib/llm/context"
import { DEFAULT_ACTIVE_SKILLS, getActiveSkillsContent } from "@/lib/llm/skills"

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
  /** Default value for disableAgentBehavior toggle (defaults to true) */
  defaultDisableAgentBehavior?: boolean
}

interface UseBrainstormResult {
  // Conversation state (ephemeral)
  messages: Message[]
  isOpen: boolean
  provider: Provider
  hasUnsavedContent: boolean

  // Actions
  open: (provider?: Provider) => void
  close: () => void
  sendMessage: (content: string) => Promise<void>
  clearConversation: () => void
  setProvider: (provider: Provider) => void
  retryMessage: (messageId: string) => Promise<void>
  editMessage: (messageId: string, newContent: string) => Promise<void>

  // Streaming state
  isStreaming: boolean
  streamingText: string
  stopStreaming: () => void

  // Save to blocks
  saveMessage: (messageId: string, zone: Zone) => Promise<Id<"blocks">>

  // Claude Code agent behavior toggle
  disableAgentBehavior: boolean
  setDisableAgentBehavior: (value: boolean) => void

  // Prevent self-talk toggle
  preventSelfTalk: boolean
  setPreventSelfTalk: (value: boolean) => void

  // Model selection (for Claude provider)
  model: string | null
  setModel: (model: string | null) => void

  // Ephemeral skills
  activeSkills: Record<string, boolean>
  toggleSkill: (skillId: string) => void

  // State
  error: string | null
}

// Generate unique ID for messages
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Hook for multi-turn brainstorming conversations with LLMs.
 *
 * Supports three providers:
 * - Claude: Uses Convex reactive streaming via mutations (backend)
 * - Ollama: Uses client-side direct calls
 * - OpenRouter: Uses client-side direct calls
 */
export function useBrainstorm(options: UseBrainstormOptions): UseBrainstormResult {
  const { sessionId, onError, defaultDisableAgentBehavior = true } = options

  // Dialog state
  const [isOpen, setIsOpen] = useState(false)
  const [provider, setProvider] = useState<Provider>("claude")
  const [disableAgentBehavior, setDisableAgentBehavior] = useState(defaultDisableAgentBehavior)
  const [preventSelfTalk, setPreventSelfTalk] = useState(true)
  const [model, setModel] = useState<string | null>(null)

  // Conversation state (ephemeral - lost on close/refresh)
  const [messages, setMessages] = useState<Message[]>([])
  const [hasUnsavedContent, setHasUnsavedContent] = useState(false)

  // Ephemeral skills (reset on dialog close)
  const [activeSkills, setActiveSkills] = useState<Record<string, boolean>>(
    () => ({ ...DEFAULT_ACTIVE_SKILLS })
  )

  // Streaming state
  const [generationId, setGenerationId] = useState<Id<"generations"> | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const streamingTextRef = useRef("")
  const [error, setError] = useState<string | null>(null)

  // Track previous text for Claude chunk detection
  const prevTextRef = useRef("")

  // Keep streamingTextRef in sync for use in callbacks
  useEffect(() => {
    streamingTextRef.current = streamingText
  }, [streamingText])

  // Abort controller for client-side streaming
  const abortControllerRef = useRef<AbortController | null>(null)

  // Get blocks for context assembly (client-side)
  const blocks = useQuery(api.blocks.list, { sessionId })

  // Clear conversation when session changes
  useEffect(() => {
    setMessages([])
    setStreamingText("")
    setError(null)
    setGenerationId(null)
    setIsStreaming(false)
    prevTextRef.current = ""
    abortControllerRef.current?.abort()
  }, [sessionId])

  // Convex mutations (for Claude)
  const startBrainstormGeneration = useMutation(api.generations.startBrainstormGeneration)
  const saveBrainstormMessage = useMutation(api.generations.saveBrainstormMessage)
  const cancelGeneration = useMutation(api.generations.cancel)

  // Cancel generation on page close/refresh (best-effort)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (generationId) {
        cancelGeneration({ generationId }).catch(() => {})
      }
      abortControllerRef.current?.abort()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [generationId, cancelGeneration])

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

    // Handle cancellation (e.g. from another tab — stopStreaming already saved partial text)
    if (generation.status === "cancelled" && isStreaming) {
      setIsStreaming(false)
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

  // Close dialog — also stops any ongoing generation
  const close = useCallback(() => {
    setIsOpen(false)
    abortControllerRef.current?.abort()
    if (generationId) {
      cancelGeneration({ generationId }).catch(console.error)
    }
    setIsStreaming(false)
    setStreamingText("")
    setGenerationId(null)
    prevTextRef.current = ""
  }, [generationId, cancelGeneration])

  // Stop any ongoing streaming (all providers)
  const stopStreaming = useCallback(() => {
    // Save partial text as a message before clearing state.
    // This is the single place that handles partial text for ALL providers —
    // the useEffect for Claude "cancelled" status only does state cleanup.
    const partialText = streamingTextRef.current
    if (partialText.trim()) {
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: partialText + "\n\n*(generation stopped)*",
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    }

    abortControllerRef.current?.abort()
    if (generationId) {
      cancelGeneration({ generationId }).catch(console.error)
    }
    setIsStreaming(false)
    setStreamingText("")
    setGenerationId(null)
    prevTextRef.current = ""
  }, [generationId, cancelGeneration])

  // Toggle an ephemeral skill on/off
  const toggleSkill = useCallback((skillId: string) => {
    setActiveSkills((prev) => ({ ...prev, [skillId]: !prev[skillId] }))
  }, [])

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([])
    setHasUnsavedContent(false)
    setStreamingText("")
    setError(null)
    setGenerationId(null)
    setIsStreaming(false)
    prevTextRef.current = ""
    abortControllerRef.current?.abort()
  }, [])

  // Send message via Ollama (client-side streaming)
  const sendMessageOllama = useCallback(
    async (content: string, conversationHistory: { role: "user" | "assistant"; content: string }[]) => {
      if (!blocks) {
        throw new Error("Blocks not loaded yet")
      }

      // Assemble context with blocks, conversation, and active skills
      const skillsContent = getActiveSkillsContent(activeSkills)
      const contextMessages = assembleContextWithConversation(blocks, conversationHistory, content, skillsContent || undefined)

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

      // Create a fresh AbortController for this request
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const generator = ollamaClient.streamChat(ollamaMessages, {
          signal: controller.signal,
        })

        for await (const chunk of generator) {
          fullText += chunk
          setStreamingText(fullText)
        }

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
      } finally {
        setStreamingText("")
      }
    },
    [blocks, activeSkills]
  )

  // Send message via OpenRouter (client-side streaming)
  const sendMessageOpenRouter = useCallback(
    async (content: string, conversationHistory: { role: "user" | "assistant"; content: string }[]) => {
      if (!blocks) {
        throw new Error("Blocks not loaded yet")
      }

      // Assemble context with blocks, conversation, and active skills
      const skillsContent = getActiveSkillsContent(activeSkills)
      const contextMessages = assembleContextWithConversation(blocks, conversationHistory, content, skillsContent || undefined)

      // Extract system prompt if present
      const systemPrompt = extractSystemPromptFromBlocks(blocks)

      // Build messages for OpenRouter
      const openrouterMessages: openrouterClient.OpenRouterMessage[] = []

      // Add system prompt first if present (with no-tools suffix for consistency)
      if (systemPrompt) {
        openrouterMessages.push({
          role: "system",
          content: systemPrompt + NO_TOOLS_SUFFIX,
        })
      }

      // Add context messages
      for (const msg of contextMessages) {
        openrouterMessages.push({
          role: msg.role,
          content: msg.content,
        })
      }

      let fullText = ""

      // Create a fresh AbortController for this request
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const generator = openrouterClient.streamChat(openrouterMessages, {
          signal: controller.signal,
        })

        for await (const chunk of generator) {
          fullText += chunk
          setStreamingText(fullText)
        }

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
      } finally {
        setStreamingText("")
      }
    },
    [blocks, activeSkills]
  )

  // Send message via Claude (Convex mutations - backend)
  const sendMessageClaude = useCallback(
    async (content: string) => {
      const conversationHistory = messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }))

      // Collect active skill IDs to pass to backend
      const activeSkillIds = Object.entries(activeSkills)
        .filter(([, enabled]) => enabled)
        .map(([id]) => id)

      const result = await startBrainstormGeneration({
        sessionId,
        conversationHistory,
        newMessage: content,
        disableAgentBehavior,
        preventSelfTalk,
        activeSkillIds,
        model: model ?? undefined,
      })
      setGenerationId(result.generationId)
    },
    [sessionId, messages, startBrainstormGeneration, disableAgentBehavior, preventSelfTalk, activeSkills, model]
  )

  // Send a new message (dispatches to correct provider)
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      setError(null)

      // Build conversation history before adding new message
      const conversationHistory = messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }))

      // Add user message to conversation
      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, userMessage])
      setHasUnsavedContent(true) // Mark as unsaved when messages are added

      // Start streaming
      setIsStreaming(true)
      setStreamingText("")
      prevTextRef.current = ""

      try {
        if (provider === "ollama") {
          await sendMessageOllama(content.trim(), conversationHistory)
        } else if (provider === "openrouter") {
          await sendMessageOpenRouter(content.trim(), conversationHistory)
        } else {
          await sendMessageClaude(content.trim())
        }
      } catch (err) {
        // Ignore AbortError — user pressed stop, partial text already saved by stopStreaming
        if (err instanceof DOMException && err.name === "AbortError") {
          return
        }
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
    [provider, isStreaming, messages, sendMessageOllama, sendMessageOpenRouter, sendMessageClaude, onError]
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
      let truncateIndex: number = 0

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

      // Build conversation history up to (but not including) the user message we're retrying
      const conversationHistory = messages.slice(0, truncateIndex - 1).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }))

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
          await sendMessageOllama(userMessage.content, conversationHistory)
        } else if (provider === "openrouter") {
          await sendMessageOpenRouter(userMessage.content, conversationHistory)
        } else {
          await sendMessageClaude(userMessage.content)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return
        }
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

  // Edit a message and resend (for user messages)
  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (isStreaming || !newContent.trim()) return

      const messageIndex = messages.findIndex((m) => m.id === messageId)
      if (messageIndex === -1) return

      const message = messages[messageIndex]
      if (message.role !== "user") return // Can only edit user messages

      // Build conversation history up to (but not including) this message
      const conversationHistory = messages.slice(0, messageIndex).map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }))

      // Update the message content and remove all subsequent messages
      setMessages((prev) => {
        const updated = prev.slice(0, messageIndex)
        updated.push({
          ...message,
          content: newContent.trim(),
          timestamp: Date.now(),
        })
        return updated
      })

      // Reset error state
      setError(null)

      // Start streaming
      setIsStreaming(true)
      setStreamingText("")
      prevTextRef.current = ""

      try {
        if (provider === "ollama") {
          await sendMessageOllama(newContent.trim(), conversationHistory)
        } else if (provider === "openrouter") {
          await sendMessageOpenRouter(newContent.trim(), conversationHistory)
        } else {
          await sendMessageClaude(newContent.trim())
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return
        }
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
    hasUnsavedContent,

    // Actions
    open,
    close,
    sendMessage,
    clearConversation,
    setProvider,
    retryMessage,
    editMessage,

    // Streaming
    isStreaming,
    streamingText,
    stopStreaming,

    // Save
    saveMessage,

    // Claude Code agent behavior toggle
    disableAgentBehavior,
    setDisableAgentBehavior,

    // Prevent self-talk
    preventSelfTalk,
    setPreventSelfTalk,

    // Model selection
    model,
    setModel,

    // Ephemeral skills
    activeSkills,
    toggleSkill,

    // Error
    error,
  }
}
