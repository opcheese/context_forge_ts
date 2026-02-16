"use node"

/**
 * Claude Code SDK actions - runs in Node.js runtime.
 *
 * This file uses the "use node" directive to enable Node.js APIs
 * required by the Claude Agent SDK.
 *
 * Environment variables:
 * - CLAUDE_CODE_PATH: Path to Claude Code CLI executable (optional, defaults to "claude")
 */

import { action } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { query as claudeQuery } from "@anthropic-ai/claude-agent-sdk"
import { spawn, execSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import {
  assembleContext,
  assembleContextWithConversation,
  extractSystemPromptFromBlocks,
  NO_TOOLS_SUFFIX,
} from "./lib/context"
import { createGeneration, flushLangfuse } from "./lib/langfuse"
import { isClaudeCodeEnabled } from "./lib/featureFlags"

// Get Claude Code executable path by trying to locate it
const getClaudeCodePath = (): string | undefined => {
  // First try environment variable
  if (process.env.CLAUDE_CODE_PATH) {
    return process.env.CLAUDE_CODE_PATH
  }

  // Try using 'which' to find claude
  try {
    const result = execSync("which claude", { encoding: "utf8", timeout: 3000 })
    const path = result.trim()
    if (path && fs.existsSync(path)) {
      return path
    }
  } catch {
    // which failed
  }

  // Try common locations
  const home = os.homedir()
  const commonPaths = [
    `${home}/.local/bin/claude`,
    "/usr/local/bin/claude",
    "/usr/bin/claude",
  ]

  for (const path of commonPaths) {
    try {
      if (fs.existsSync(path)) {
        return path
      }
    } catch {
      // Path doesn't exist or not accessible
    }
  }

  return undefined
}

// Message format for context
interface ClaudeMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Format messages array into a prompt string for Claude Agent SDK.
 */
function formatMessagesAsPrompt(messages: ClaudeMessage[]): string {
  const parts: string[] = []

  for (const msg of messages) {
    if (msg.role === "system") {
      parts.push(`<system>\n${msg.content}\n</system>`)
    } else if (msg.role === "user") {
      parts.push(`<user>\n${msg.content}\n</user>`)
    } else if (msg.role === "assistant") {
      parts.push(`<assistant>\n${msg.content}\n</assistant>`)
    }
  }

  return parts.join("\n\n")
}

/**
 * Check if Claude Code CLI is available.
 * Returns disabled status if CLAUDE_CODE_ENABLED feature flag is false.
 */
export const checkHealth = action({
  args: {},
  handler: async (): Promise<{ ok: boolean; error?: string; version?: string; disabled?: boolean }> => {
    // Check feature flag first
    if (!isClaudeCodeEnabled()) {
      return {
        ok: false,
        disabled: true,
        error: "Claude Code is disabled (CLAUDE_CODE_ENABLED=false)",
      }
    }

    return new Promise((resolve) => {
      const claudePath = getClaudeCodePath() || "claude"
      const proc = spawn(claudePath, ["--version"], {
        timeout: 5000,
      })

      let output = ""
      let errorOutput = ""

      proc.stdout?.on("data", (data: Buffer) => {
        output += data.toString()
      })

      proc.stderr?.on("data", (data: Buffer) => {
        errorOutput += data.toString()
      })

      proc.on("close", (code: number | null) => {
        if (code === 0) {
          resolve({
            ok: true,
            version: output.trim(),
          })
        } else {
          resolve({
            ok: false,
            error: errorOutput || "Claude Code CLI not available",
          })
        }
      })

      proc.on("error", (err: Error) => {
        resolve({
          ok: false,
          error: `Claude Code CLI error: ${err.message}`,
        })
      })
    })
  },
})

/**
 * Generate text using Claude Code SDK.
 * This is a non-streaming action that returns the full response.
 *
 * Note: Convex actions cannot stream responses directly.
 * For streaming, we'd need a different architecture (e.g., polling or WebSocket).
 */
export const generate = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (_, args): Promise<{
    text: string
    inputTokens?: number
    outputTokens?: number
    costUsd?: number
    durationMs?: number
    error?: string
  }> => {
    const prompt = formatMessagesAsPrompt(args.messages)

    let fullText = ""
    let inputTokens: number | undefined
    let outputTokens: number | undefined
    let costUsd: number | undefined
    let durationMs: number | undefined

    try {
      for await (const message of claudeQuery({
        prompt,
        options: {
          allowedTools: [], // Text-only mode
          maxTurns: 1,
          systemPrompt: args.systemPrompt,
          pathToClaudeCodeExecutable: getClaudeCodePath(),
        },
      })) {
        // Collect text content
        if (message.type === "assistant" && message.message?.content) {
          for (const block of message.message.content) {
            if ("text" in block && block.text) {
              fullText += block.text
            }
          }
        }

        // Capture completion stats
        if (message.type === "result") {
          inputTokens = message.usage?.input_tokens
          outputTokens = message.usage?.output_tokens
          costUsd = message.total_cost_usd
          durationMs = message.duration_ms
        }
      }

      return {
        text: fullText,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        text: "",
        error: `Claude Code error: ${errorMessage}`,
      }
    }
  },
})

/**
 * Stream generate text using Claude Code SDK with database delta updates.
 *
 * This action writes chunks to the database as they arrive,
 * enabling true streaming via Convex's reactive queries.
 *
 * Throttles writes to avoid excessive database operations.
 */
export const streamGenerate = action({
  args: {
    generationId: v.id("generations"),
    messages: v.array(
      v.object({
        role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    systemPrompt: v.optional(v.string()),
    throttleMs: v.optional(v.number()), // Default 100ms
  },
  handler: async (ctx, args): Promise<void> => {
    const throttleMs = args.throttleMs ?? 100
    const prompt = formatMessagesAsPrompt(args.messages)

    let buffer = ""
    let lastFlush = Date.now()

    // Helper to flush buffer to database
    const flushBuffer = async () => {
      if (buffer.length > 0) {
        await ctx.runMutation(internal.generations.appendChunk, {
          generationId: args.generationId,
          chunk: buffer,
        })
        buffer = ""
        lastFlush = Date.now()
      }
    }

    try {
      for await (const message of claudeQuery({
        prompt,
        options: {
          allowedTools: [], // Text-only mode
          maxTurns: 1,
          systemPrompt: args.systemPrompt,
          pathToClaudeCodeExecutable: getClaudeCodePath(),
        },
      })) {
        // Collect text content
        if (message.type === "assistant" && message.message?.content) {
          for (const block of message.message.content) {
            if ("text" in block && block.text) {
              buffer += block.text

              // Throttle writes - flush if enough time has passed
              const now = Date.now()
              if (now - lastFlush >= throttleMs) {
                await flushBuffer()
              }
            }
          }
        }
      }

      // Final flush of any remaining buffer
      await flushBuffer()

      // Mark as complete
      await ctx.runMutation(internal.generations.complete, {
        generationId: args.generationId,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Flush any partial content
      await flushBuffer()

      // Mark as failed
      await ctx.runMutation(internal.generations.fail, {
        generationId: args.generationId,
        error: `Claude Code error: ${errorMessage}`,
      })
    }
  },
})

/**
 * Stream generate with context assembly.
 *
 * This action is called by the scheduler from startClaudeGeneration mutation.
 * It extracts the system prompt from blocks and passes it to the provider,
 * then assembles remaining context and streams the generation.
 */
export const streamGenerateWithContext = action({
  args: {
    generationId: v.id("generations"),
    sessionId: v.id("sessions"),
    prompt: v.string(),
    throttleMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const throttleMs = args.throttleMs ?? 100
    const startTime = Date.now()

    // Get blocks for context assembly (use internal query to bypass auth in scheduled actions)
    const blocks = await ctx.runQuery(internal.blocks.listBySessionInternal, {
      sessionId: args.sessionId,
    })

    // Extract system prompt from blocks to pass to provider
    const systemPrompt = extractSystemPromptFromBlocks(blocks)

    // Assemble context (excludes system_prompt blocks - passed to provider separately)
    const messages = assembleContext(blocks, args.prompt)
    const prompt = formatMessagesAsPrompt(messages)

    // Create LangFuse trace for observability
    const trace = createGeneration(
      "claude-generate",
      {
        sessionId: args.sessionId,
        provider: "claude",
        model: "claude-code",
      },
      {
        systemPrompt,
        messages,
        prompt,
      }
    )

    let buffer = ""
    let fullText = ""
    let lastFlush = Date.now()

    // Usage tracking
    let inputTokens: number | undefined
    let outputTokens: number | undefined
    let costUsd: number | undefined

    // AbortController for SDK process termination
    const abortController = new AbortController()

    // Helper to check if generation was cancelled via DB flag
    const isCancelled = async (): Promise<boolean> => {
      const gen = await ctx.runQuery(internal.generations.getInternal, {
        generationId: args.generationId,
      })
      return gen?.status === "cancelled"
    }

    // Helper to flush buffer to database
    const flushBuffer = async () => {
      if (buffer.length > 0) {
        await ctx.runMutation(internal.generations.appendChunk, {
          generationId: args.generationId,
          chunk: buffer,
        })
        buffer = ""
        lastFlush = Date.now()
      }
    }

    try {
      let hasReceivedStreamEvents = false

      for await (const message of claudeQuery({
        prompt,
        options: {
          abortController,
          allowedTools: [], // Text-only mode
          maxTurns: 1,
          systemPrompt, // Pass system prompt from blocks to provider
          pathToClaudeCodeExecutable: getClaudeCodePath(),
          includePartialMessages: true, // Enable streaming deltas
        },
      })) {
        const msgType = (message as Record<string, unknown>).type as string

        // Handle SDKPartialAssistantMessage (type: 'stream_event') for true streaming
        // The SDK wraps Anthropic's raw stream events in this structure
        if (msgType === "stream_event") {
          const event = (message as Record<string, unknown>).event as Record<string, unknown> | undefined
          if (event && event.type === "content_block_delta") {
            const delta = event.delta as Record<string, unknown> | undefined
            if (delta && delta.type === "text_delta" && typeof delta.text === "string") {
              hasReceivedStreamEvents = true
              buffer += delta.text
              fullText += delta.text

              // Throttle writes + check cancellation
              const now = Date.now()
              if (now - lastFlush >= throttleMs) {
                await flushBuffer()
                if (await isCancelled()) {
                  abortController.abort()
                  break
                }
              }
            }
          }
        }

        // Fallback: handle assistant messages if we didn't receive stream events
        if (msgType === "assistant" && !hasReceivedStreamEvents) {
          const msg = message as Record<string, unknown>
          const msgContent = msg.message as Record<string, unknown> | undefined
          const content = msgContent?.content as Array<Record<string, unknown>> | undefined
          if (content) {
            for (const block of content) {
              if (block.type === "text" && typeof block.text === "string") {
                buffer += block.text
                fullText += block.text
                await flushBuffer()
              }
            }
          }
        }

        // Capture usage stats from result message
        if (msgType === "result") {
          const msg = message as Record<string, unknown>
          const usage = msg.usage as Record<string, unknown> | undefined
          if (usage) {
            inputTokens = usage.input_tokens as number | undefined
            outputTokens = usage.output_tokens as number | undefined
          }
          costUsd = msg.total_cost_usd as number | undefined
        }
      }

      // Final flush of any remaining buffer
      await flushBuffer()

      const durationMs = Date.now() - startTime

      // Only mark complete if not cancelled
      const gen = await ctx.runQuery(internal.generations.getInternal, {
        generationId: args.generationId,
      })
      if (gen?.status === "cancelled") {
        trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs })
        await flushLangfuse()
        return
      }

      // Mark as complete with usage stats
      await ctx.runMutation(internal.generations.completeWithUsage, {
        generationId: args.generationId,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
      })

      // Complete LangFuse trace
      trace.complete({
        text: fullText,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
      })
      await flushLangfuse()
    } catch (error) {
      // Handle AbortError gracefully — not a real error
      if (error instanceof Error && error.name === "AbortError") {
        await flushBuffer()
        const durationMs = Date.now() - startTime
        trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs })
        await flushLangfuse()
        return
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Claude Stream] Error: ${errorMessage}`)

      // Flush any partial content
      await flushBuffer()

      // Mark as failed
      await ctx.runMutation(internal.generations.fail, {
        generationId: args.generationId,
        error: `Claude Code error: ${errorMessage}`,
      })

      // Record error in LangFuse
      trace.error(errorMessage)
      await flushLangfuse()
    }
  },
})

/**
 * Stream brainstorm message with context and conversation history.
 *
 * This action is called by the scheduler from startBrainstormGeneration mutation.
 * It extracts the system prompt from blocks, passes it to the provider,
 * assembles remaining context with conversation history, and streams the response.
 * Unlike streamGenerateWithContext, this does NOT auto-save to blocks.
 */
export const streamBrainstormMessage = action({
  args: {
    generationId: v.id("generations"),
    sessionId: v.id("sessions"),
    conversationHistory: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    newMessage: v.string(),
    throttleMs: v.optional(v.number()),
    disableAgentBehavior: v.optional(v.boolean()), // Append anti-agent suffix
  },
  handler: async (ctx, args): Promise<void> => {
    const throttleMs = args.throttleMs ?? 100
    const startTime = Date.now()
    const disableAgentBehavior = args.disableAgentBehavior ?? true

    // Get blocks for context assembly (use internal query to bypass auth in scheduled actions)
    const blocks = await ctx.runQuery(internal.blocks.listBySessionInternal, {
      sessionId: args.sessionId,
    })

    // Extract system prompt from blocks to pass to provider
    let systemPrompt = extractSystemPromptFromBlocks(blocks)

    // Append anti-agent suffix if enabled
    if (disableAgentBehavior) {
      systemPrompt = (systemPrompt ?? "") + NO_TOOLS_SUFFIX
    }

    // Assemble context with conversation history (excludes system_prompt blocks)
    const messages = assembleContextWithConversation(
      blocks,
      args.conversationHistory,
      args.newMessage
    )
    const prompt = formatMessagesAsPrompt(messages)

    // Create LangFuse trace for observability
    const trace = createGeneration(
      "claude-brainstorm",
      {
        sessionId: args.sessionId,
        provider: "claude",
        model: "claude-code",
      },
      {
        systemPrompt,
        messages,
        prompt,
      }
    )

    let buffer = ""
    let fullText = ""
    let lastFlush = Date.now()

    // Usage tracking
    let inputTokens: number | undefined
    let outputTokens: number | undefined
    let costUsd: number | undefined

    // AbortController for SDK process termination
    const abortController = new AbortController()

    // Helper to check if generation was cancelled via DB flag
    const isCancelled = async (): Promise<boolean> => {
      const gen = await ctx.runQuery(internal.generations.getInternal, {
        generationId: args.generationId,
      })
      return gen?.status === "cancelled"
    }

    // Helper to flush buffer to database
    const flushBuffer = async () => {
      if (buffer.length > 0) {
        await ctx.runMutation(internal.generations.appendChunk, {
          generationId: args.generationId,
          chunk: buffer,
        })
        buffer = ""
        lastFlush = Date.now()
      }
    }

    try {
      let hasReceivedStreamEvents = false

      for await (const message of claudeQuery({
        prompt,
        options: {
          abortController,
          allowedTools: [], // Text-only mode
          maxTurns: 1,
          systemPrompt, // Pass system prompt from blocks to provider
          pathToClaudeCodeExecutable: getClaudeCodePath(),
          includePartialMessages: true, // Enable streaming deltas
        },
      })) {
        const msgType = (message as Record<string, unknown>).type as string

        // Handle SDKPartialAssistantMessage (type: 'stream_event') for true streaming
        if (msgType === "stream_event") {
          const event = (message as Record<string, unknown>).event as Record<string, unknown> | undefined
          if (event && event.type === "content_block_delta") {
            const delta = event.delta as Record<string, unknown> | undefined
            if (delta && delta.type === "text_delta" && typeof delta.text === "string") {
              hasReceivedStreamEvents = true
              buffer += delta.text
              fullText += delta.text

              // Throttle writes + check cancellation
              const now = Date.now()
              if (now - lastFlush >= throttleMs) {
                await flushBuffer()
                if (await isCancelled()) {
                  abortController.abort()
                  break
                }
              }
            }
          }
        }

        // Fallback: handle assistant messages if we didn't receive stream events
        if (msgType === "assistant" && !hasReceivedStreamEvents) {
          const msg = message as Record<string, unknown>
          const msgContent = msg.message as Record<string, unknown> | undefined
          const content = msgContent?.content as Array<Record<string, unknown>> | undefined
          if (content) {
            for (const block of content) {
              if (block.type === "text" && typeof block.text === "string") {
                buffer += block.text
                fullText += block.text
                await flushBuffer()
              }
            }
          }
        }

        // Capture usage stats from result message
        if (msgType === "result") {
          const msg = message as Record<string, unknown>
          const usage = msg.usage as Record<string, unknown> | undefined
          if (usage) {
            inputTokens = usage.input_tokens as number | undefined
            outputTokens = usage.output_tokens as number | undefined
          }
          costUsd = msg.total_cost_usd as number | undefined
        }
      }

      // Final flush of any remaining buffer
      await flushBuffer()

      const durationMs = Date.now() - startTime

      // Only mark complete if not cancelled
      const gen = await ctx.runQuery(internal.generations.getInternal, {
        generationId: args.generationId,
      })
      if (gen?.status === "cancelled") {
        trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs })
        await flushLangfuse()
        return
      }

      // Mark as complete with usage stats (no auto-save to blocks)
      await ctx.runMutation(internal.generations.completeWithUsage, {
        generationId: args.generationId,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
      })

      // Complete LangFuse trace
      trace.complete({
        text: fullText,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
      })
      await flushLangfuse()
    } catch (error) {
      // Handle AbortError gracefully — not a real error
      if (error instanceof Error && error.name === "AbortError") {
        await flushBuffer()
        const durationMs = Date.now() - startTime
        trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs })
        await flushLangfuse()
        return
      }

      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Claude Brainstorm] Error: ${errorMessage}`)

      // Flush any partial content
      await flushBuffer()

      // Mark as failed
      await ctx.runMutation(internal.generations.fail, {
        generationId: args.generationId,
        error: `Claude Code error: ${errorMessage}`,
      })

      // Record error in LangFuse
      trace.error(errorMessage)
      await flushLangfuse()
    }
  },
})
