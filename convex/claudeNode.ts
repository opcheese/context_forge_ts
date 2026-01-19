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
import { api, internal } from "./_generated/api"
import { v } from "convex/values"
import { query as claudeQuery } from "@anthropic-ai/claude-agent-sdk"
import { spawn, execSync } from "child_process"
import * as fs from "fs"
import * as os from "os"
import { assembleContext } from "./lib/context"

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
 */
export const checkHealth = action({
  args: {},
  handler: async (): Promise<{ ok: boolean; error?: string; version?: string }> => {
    return new Promise((resolve) => {
      const proc = spawn("claude", ["--version"], {
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
 * It assembles context from blocks and then streams the generation.
 */
export const streamGenerateWithContext = action({
  args: {
    generationId: v.id("generations"),
    sessionId: v.id("sessions"),
    prompt: v.string(),
    systemPrompt: v.optional(v.string()),
    throttleMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const throttleMs = args.throttleMs ?? 100

    // Get blocks for context assembly
    const blocks = await ctx.runQuery(api.blocks.list, {
      sessionId: args.sessionId,
    })

    // Assemble context
    const messages = assembleContext(blocks, args.prompt, args.systemPrompt)
    const prompt = formatMessagesAsPrompt(messages)

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
      let hasReceivedStreamEvents = false

      for await (const message of claudeQuery({
        prompt,
        options: {
          allowedTools: [], // Text-only mode
          maxTurns: 1,
          systemPrompt: args.systemPrompt,
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

              // Throttle writes
              const now = Date.now()
              if (now - lastFlush >= throttleMs) {
                await flushBuffer()
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
      console.error(`[Claude Stream] Error: ${errorMessage}`)

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
