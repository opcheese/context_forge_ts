/**
 * LangFuse integration for LLM observability.
 *
 * Provides tracing for all LLM calls to both Claude and Ollama providers.
 * This module is designed to be resilient - if LangFuse is not configured
 * or has issues, it will silently fail without affecting the main functionality.
 *
 * Environment variables:
 * - LANGFUSE_SECRET_KEY: LangFuse secret key
 * - LANGFUSE_PUBLIC_KEY: LangFuse public key
 * - LANGFUSE_BASE_URL: LangFuse host URL (default: https://cloud.langfuse.com)
 */

import { Langfuse } from "langfuse"

// Singleton instance
let langfuseInstance: Langfuse | null = null
let initializationFailed = false

/**
 * Get or create the LangFuse client instance.
 * Returns null if credentials are not configured or initialization failed.
 */
export function getLangfuse(): Langfuse | null {
  // Don't retry if initialization already failed
  if (initializationFailed) {
    return null
  }

  if (langfuseInstance) {
    return langfuseInstance
  }

  const secretKey = process.env.LANGFUSE_SECRET_KEY
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const baseUrl = process.env.LANGFUSE_BASE_URL

  if (!secretKey || !publicKey) {
    // LangFuse not configured - tracing disabled (this is fine)
    return null
  }

  try {
    langfuseInstance = new Langfuse({
      secretKey,
      publicKey,
      baseUrl: baseUrl || "https://cloud.langfuse.com",
    })
    return langfuseInstance
  } catch (error) {
    // LangFuse initialization failed - disable for this session
    console.warn("[LangFuse] Initialization failed:", error)
    initializationFailed = true
    return null
  }
}

/**
 * Flush pending traces to LangFuse.
 * Call this at the end of request handlers to ensure traces are sent.
 * Silently fails if LangFuse is not available.
 */
export async function flushLangfuse(): Promise<void> {
  try {
    const langfuse = getLangfuse()
    if (langfuse) {
      await langfuse.flushAsync()
    }
  } catch (error) {
    // Silently ignore flush errors - don't affect main functionality
    console.warn("[LangFuse] Flush failed:", error)
  }
}

/**
 * Trace metadata for LLM calls.
 */
export interface TraceMetadata {
  sessionId: string
  provider: "claude" | "ollama"
  model?: string
  userId?: string
}

/**
 * Generation input for tracing.
 */
export interface GenerationInput {
  systemPrompt?: string
  messages?: Array<{ role: string; content: string }>
  prompt?: string // Formatted prompt string
}

/**
 * Generation output for tracing.
 */
export interface GenerationOutput {
  text: string
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  durationMs?: number
  resolvedModel?: string
}

/**
 * No-op trace functions for when LangFuse is disabled.
 */
const noopTrace = {
  complete: () => {},
  error: () => {},
}

/**
 * Create a traced generation span.
 * Returns functions to update and complete the trace.
 * If LangFuse is not configured or has errors, returns no-op functions.
 */
export function createGeneration(
  name: string,
  metadata: TraceMetadata,
  input: GenerationInput
): {
  complete: (output: GenerationOutput) => void
  error: (error: string) => void
} {
  try {
    const langfuse = getLangfuse()

    if (!langfuse) {
      // No-op if LangFuse not configured
      return noopTrace
    }

    const trace = langfuse.trace({
      name,
      sessionId: metadata.sessionId,
      userId: metadata.userId,
      metadata: {
        provider: metadata.provider,
        model: metadata.model,
      },
    })

    const generation = trace.generation({
      name: `${metadata.provider}-generation`,
      model: metadata.model,
      input: {
        systemPrompt: input.systemPrompt,
        messages: input.messages,
        formattedPrompt: input.prompt?.slice(0, 1000), // Truncate for display
      },
      metadata: {
        messageCount: input.messages?.length ?? 0,
        systemPromptLength: input.systemPrompt?.length ?? 0,
      },
    })

    return {
      complete: (output: GenerationOutput) => {
        try {
          generation.end({
            output: output.text,
            model: output.resolvedModel,
            usage: {
              input: output.inputTokens,
              output: output.outputTokens,
              total: (output.inputTokens ?? 0) + (output.outputTokens ?? 0),
            },
            metadata: {
              costUsd: output.costUsd,
              durationMs: output.durationMs,
              resolvedModel: output.resolvedModel,
            },
          })
        } catch (error) {
          console.warn("[LangFuse] Failed to complete trace:", error)
        }
      },
      error: (errorMsg: string) => {
        try {
          generation.end({
            output: errorMsg,
            level: "ERROR",
            statusMessage: errorMsg,
          })
        } catch (error) {
          console.warn("[LangFuse] Failed to record error:", error)
        }
      },
    }
  } catch (error) {
    // If anything fails during trace creation, return no-op
    console.warn("[LangFuse] Failed to create trace:", error)
    return noopTrace
  }
}
