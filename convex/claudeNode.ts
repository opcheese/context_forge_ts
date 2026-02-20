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
import * as path from "path"
import {
  assembleContextWithConversation,
  extractSystemPromptFromBlocks,
  NO_TOOLS_SUFFIX,
  NO_SELF_TALK_SUFFIX,
} from "./lib/context"
import { getActiveSkillsContent } from "./lib/skills"
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
 * Stream brainstorm message with context and conversation history.
 *
 * This action is called by the scheduler from startBrainstormGeneration mutation.
 * It extracts the system prompt from blocks, passes it to the provider,
 * assembles remaining context with conversation history, and streams the response.
 * Does NOT auto-save to blocks — user saves manually with zone selection.
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
    preventSelfTalk: v.optional(v.boolean()), // Append anti-self-talk suffix
    activeSkillIds: v.optional(v.array(v.string())), // Ephemeral skill IDs to inject
    model: v.optional(v.string()), // Claude model override (e.g. "claude-sonnet-4-5-20250929")
  },
  handler: async (ctx, args): Promise<void> => {
    const throttleMs = args.throttleMs ?? 100
    const startTime = Date.now()
    const disableAgentBehavior = args.disableAgentBehavior ?? true
    const preventSelfTalk = args.preventSelfTalk ?? true

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

    // Append anti-self-talk suffix to prevent model from simulating user turns
    // (the XML-formatted conversation is a single prompt string, so the model
    // might continue the <user>/<assistant> XML pattern)
    if (preventSelfTalk) {
      systemPrompt = (systemPrompt ?? "") + NO_SELF_TALK_SUFFIX
    }

    // Build active skills content for injection
    const activeSkillsContent = args.activeSkillIds?.length
      ? getActiveSkillsContent(args.activeSkillIds)
      : undefined

    // Assemble context with conversation history (excludes system_prompt blocks)
    const messages = assembleContextWithConversation(
      blocks,
      args.conversationHistory,
      args.newMessage,
      activeSkillsContent
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

    // Capture stderr from Claude Code process for debugging
    const stderrChunks: string[] = []

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
          model: args.model, // Model override (undefined = CLI default)
          pathToClaudeCodeExecutable: getClaudeCodePath(),
          includePartialMessages: true, // Enable streaming deltas
          stderr: (data: string) => {
            stderrChunks.push(data)
          },
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

        // Capture usage stats and errors from result message
        if (msgType === "result") {
          const msg = message as Record<string, unknown>
          const usage = msg.usage as Record<string, unknown> | undefined
          if (usage) {
            inputTokens = usage.input_tokens as number | undefined
            outputTokens = usage.output_tokens as number | undefined
          }
          costUsd = msg.total_cost_usd as number | undefined

          // Log SDK-level execution errors
          if (msg.subtype === "error_during_execution") {
            const errors = msg.errors as string[] | undefined
            if (errors?.length) {
              console.error(`[Claude Brainstorm] SDK execution errors: ${errors.join("; ")}`)
            }
          }
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
      const stderrOutput = stderrChunks.join("").trim()
      console.error(`[Claude Brainstorm] Error: ${errorMessage}`)
      if (stderrOutput) {
        console.error(`[Claude Brainstorm] stderr: ${stderrOutput}`)
      }

      // Flush any partial content
      await flushBuffer()

      // Mark as failed — include stderr in error for visibility
      const fullError = stderrOutput
        ? `Claude Code error: ${errorMessage}\nstderr: ${stderrOutput}`
        : `Claude Code error: ${errorMessage}`
      await ctx.runMutation(internal.generations.fail, {
        generationId: args.generationId,
        error: fullError,
      })

      // Record error in LangFuse
      trace.error(fullError)
      await flushLangfuse()
    }
  },
})

/**
 * Get Claude subscription usage (5-hour and 7-day windows).
 * Reads OAuth token from ~/.claude/.credentials.json and calls the usage API.
 */
export const getSubscriptionUsage = action({
  args: {},
  handler: async () => {
    try {
      const credPath = path.join(os.homedir(), ".claude", ".credentials.json")
      if (!fs.existsSync(credPath)) {
        return { error: "No credentials file found" }
      }
      const creds = JSON.parse(fs.readFileSync(credPath, "utf-8"))
      const token = creds.claudeAiOauth?.accessToken
      if (!token) return { error: "No OAuth token found" }

      const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
        headers: {
          Authorization: `Bearer ${token}`,
          "anthropic-beta": "oauth-2025-04-20",
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) return { error: `HTTP ${res.status}` }
      const data = await res.json()
      return {
        fiveHour: {
          utilization: data.five_hour?.utilization ?? 0,
          resetsAt: data.five_hour?.resets_at ?? "",
        },
        sevenDay: {
          utilization: data.seven_day?.utilization ?? 0,
          resetsAt: data.seven_day?.resets_at ?? "",
        },
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  },
})
