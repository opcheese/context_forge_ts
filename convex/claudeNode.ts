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
  assembleSystemPromptWithContext,
  formatPromptForSDK,
  NO_TOOLS_SUFFIX,
  NO_SELF_TALK_SUFFIX,
  VALIDATION_SUFFIX,
  RESEARCH_SUFFIX,
  LOCAL_RESEARCH_SUFFIX,
} from "./lib/context"
import { SelfTalkDetector } from "./lib/selfTalkDetector"
import { getActiveSkillsContent } from "./lib/skills"
import { renderMemoryBlock } from "./lib/memoryRendering"
import { createGeneration, flushLangfuse } from "./lib/langfuse"
import { isClaudeCodeEnabled, isLocalResearchEnabled } from "./lib/featureFlags"

// Get Claude Code executable path by trying to locate it
export const getClaudeCodePath = (): string | undefined => {
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
    // Note: conversationHistory is used only on turn 1 (no existing claudeSessionId).
    // On turn 2+ with resume, the SDK has the full conversation cached.
    // We still accept it here as fallback if the session is invalidated mid-conversation.
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
    isValidation: v.optional(v.boolean()), // Validation mode — include validation criteria blocks + suffix
  },
  handler: async (ctx, args): Promise<void> => {
    const throttleMs = args.throttleMs ?? 100
    const startTime = Date.now()
    const disableAgentBehavior = args.disableAgentBehavior ?? true
    const preventSelfTalk = args.preventSelfTalk ?? true
    const isValidation = args.isValidation ?? false
    const contextMode = isValidation ? "validation" as const : "brainstorm" as const

    // Check for existing Claude session (enables prompt caching on turn 2+)
    const session = await ctx.runQuery(internal.generations.getSessionInternal, {
      sessionId: args.sessionId,
    })
    // Validation mode always needs fresh context assembly (criteria blocks differ)
    const existingClaudeSessionId = isValidation ? undefined : session?.claudeSessionId

    // Get blocks for context assembly (use internal query to bypass auth in scheduled actions)
    const blocks = await ctx.runQuery(internal.blocks.listBySessionInternal, {
      sessionId: args.sessionId,
    })

    // Fetch memory entries if session belongs to a project
    let renderedMemory: string | undefined
    if (session?.projectId) {
      const memoryEntries = await ctx.runQuery(
        internal.memoryEntries.listByProjectInternal,
        { projectId: session.projectId }
      )
      if (memoryEntries.length > 0) {
        const sessionTags = session.sessionTags ?? []
        const pinnedIds = new Set(session.pinnedMemories ?? [])
        const pinnedEntries = memoryEntries.filter((e) => pinnedIds.has(e._id))

        renderedMemory = renderMemoryBlock(memoryEntries, sessionTags, pinnedEntries)
      }
    }

    // System prompt is the same for both fresh and resume paths
    let systemPrompt: string | undefined = assembleSystemPromptWithContext(blocks, renderedMemory, contextMode)
    if (disableAgentBehavior) {
      systemPrompt = (systemPrompt ?? "") + NO_TOOLS_SUFFIX
    }
    if (preventSelfTalk) {
      systemPrompt = (systemPrompt ?? "") + NO_SELF_TALK_SUFFIX
    }
    if (isValidation) {
      const validationPromptBlock = blocks.find(
        (b) => b.type === "validation_prompt" && b.zone === "PERMANENT" && (b.contextMode ?? "default") !== "draft"
      )
      if (validationPromptBlock) {
        systemPrompt = (systemPrompt ?? "") + "\n\n" + validationPromptBlock.content
      } else {
        systemPrompt = (systemPrompt ?? "") + VALIDATION_SUFFIX
      }
    }

    let prompt: string

    // Resolve active skills content once (used in both paths)
    const activeSkillsContent = args.activeSkillIds?.length
      ? getActiveSkillsContent(args.activeSkillIds)
      : undefined

    if (existingClaudeSessionId) {
      // Turn 2+: SDK has full prior context cached, send only new message.
      // Inject skills into system prompt since there's no context assembly on resume.
      if (activeSkillsContent) {
        systemPrompt = (systemPrompt ?? "") + "\n\nActive Skills:\n\n" + activeSkillsContent
      }
      prompt = args.newMessage
    } else {
      // Turn 1: assemble full context as prompt (skills injected via assembleContextWithConversation)
      const messages = assembleContextWithConversation(
        blocks,
        args.conversationHistory,
        args.newMessage,
        activeSkillsContent,
        contextMode
      )
      const nonSystemMessages = messages.filter((m) => m.role !== "system")
      prompt = formatPromptForSDK(nonSystemMessages)
    }

    // Create LangFuse trace for observability
    const trace = createGeneration(
      existingClaudeSessionId ? "claude-brainstorm-resume" : "claude-brainstorm",
      {
        sessionId: args.sessionId,
        provider: "claude",
        model: args.model || "claude-code",
      },
      {
        systemPrompt,
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
    let resolvedModel: string | undefined

    // AbortController for SDK process termination
    const abortController = new AbortController()

    // Capture stderr from Claude Code process for debugging
    const stderrChunks: string[] = []

    // Self-talk detection (when preventSelfTalk is enabled)
    const selfTalkDetector = preventSelfTalk ? new SelfTalkDetector() : null

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
          maxBudgetUsd: 0.50,
          ...(existingClaudeSessionId ? { resume: existingClaudeSessionId } : {}),
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

              // Check for self-talk markers before buffering
              if (selfTalkDetector) {
                const detection = selfTalkDetector.feed(delta.text)
                if (detection) {
                  // Add the clean portion before the marker
                  if (detection.cleanText) {
                    buffer += detection.cleanText
                    fullText += detection.cleanText
                  }
                  // Flush what we have, then abort
                  console.warn(
                    `[Claude Brainstorm] Self-talk detected: model generated "${detection.marker}" ` +
                    `at position ${detection.position}. Aborting stream.`
                  )
                  await flushBuffer()
                  abortController.abort()
                  break
                }
              }

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

        // Capture the actual model from the SDK response
        if (msgType === "assistant" && !resolvedModel) {
          const msg = message as Record<string, unknown>
          const msgContent = msg.message as Record<string, unknown> | undefined
          if (typeof msgContent?.model === "string") {
            resolvedModel = msgContent.model
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

          // Capture and store Claude session ID + resolved model
          const claudeSessionId = msg.session_id as string | undefined
          if (claudeSessionId && !existingClaudeSessionId) {
            await ctx.runMutation(internal.generations.setClaudeSessionId, {
              sessionId: args.sessionId,
              claudeSessionId,
            })
          }
          if (resolvedModel) {
            await ctx.runMutation(internal.generations.setClaudeResolvedModel, {
              sessionId: args.sessionId,
              model: resolvedModel,
            })
          }

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
        trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs, resolvedModel })
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
        resolvedModel,
      })
      await flushLangfuse()
    } catch (error) {
      // If resume failed, clear session ID so next turn starts fresh
      if (existingClaudeSessionId) {
        console.warn("[Claude Brainstorm] Session resume may have failed, clearing claudeSessionId")
        try {
          await ctx.runMutation(internal.generations.clearClaudeSessionId, {
            sessionId: args.sessionId,
          })
        } catch {
          // Best effort — don't mask the original error
        }
      }

      // Handle AbortError gracefully — not a real error
      if (error instanceof Error && error.name === "AbortError") {
        await flushBuffer()
        const durationMs = Date.now() - startTime
        trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs, resolvedModel })
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

export const runResearchAction = action({
  args: {
    generationId: v.id("generations"),
    sessionId: v.id("sessions"),
    blockId: v.id("blocks"),
    spec: v.string(),
    source: v.optional(v.union(v.literal("web"), v.literal("local"))),
    researchPath: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const startTime = Date.now()

    const blocks = await ctx.runQuery(internal.blocks.listBySessionInternal, {
      sessionId: args.sessionId,
    })
    const isLocal = args.source === "local"
    if (isLocal && !isLocalResearchEnabled()) {
      throw new Error("Local research is not enabled on this deployment (LOCAL_RESEARCH_ENABLED=false)")
    }
    let systemPrompt = assembleSystemPromptWithContext(blocks, undefined, "brainstorm")
    systemPrompt = (systemPrompt ?? "") + (isLocal ? LOCAL_RESEARCH_SUFFIX : RESEARCH_SUFFIX)

    const prompt = isLocal && args.researchPath
      ? `Research folder: ${args.researchPath}\n\n${args.spec}`
      : args.spec

    const trace = createGeneration(
      "claude-research",
      { sessionId: args.sessionId, provider: "claude", model: "claude-code" },
      { systemPrompt, prompt }
    )

    let buffer = ""
    let fullText = ""
    let lastFlush = Date.now()
    const throttleMs = 100
    let inputTokens: number | undefined
    let outputTokens: number | undefined
    let costUsd: number | undefined
    let resolvedModel: string | undefined
    const abortController = new AbortController()
    const stderrChunks: string[] = []

    const isCancelled = async (): Promise<boolean> => {
      const gen = await ctx.runQuery(internal.generations.getInternal, {
        generationId: args.generationId,
      })
      return gen?.status === "cancelled"
    }

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
          allowedTools: isLocal ? ["Read", "Glob", "Grep"] : ["WebSearch", "WebFetch"],
          maxTurns: 10,
          systemPrompt,
          pathToClaudeCodeExecutable: getClaudeCodePath(),
          includePartialMessages: true,
          maxBudgetUsd: 1.00,
          stderr: (data: string) => { stderrChunks.push(data) },
        },
      })) {
        const msgType = (message as Record<string, unknown>).type as string

        if (msgType === "stream_event") {
          const event = (message as Record<string, unknown>).event as Record<string, unknown> | undefined
          if (event?.type === "content_block_delta") {
            const delta = event.delta as Record<string, unknown> | undefined
            if (delta?.type === "text_delta" && typeof delta.text === "string") {
              hasReceivedStreamEvents = true
              buffer += delta.text
              fullText += delta.text
              if (Date.now() - lastFlush >= throttleMs) {
                await flushBuffer()
                if (await isCancelled()) { abortController.abort(); break }
              }
            }
          }
        }

        if (msgType === "assistant" && !resolvedModel) {
          const msgContent = ((message as Record<string, unknown>).message as Record<string, unknown> | undefined)
          if (typeof msgContent?.model === "string") resolvedModel = msgContent.model
        }

        if (msgType === "assistant" && !hasReceivedStreamEvents) {
          const content = (((message as Record<string, unknown>).message as Record<string, unknown> | undefined)
            ?.content) as Array<Record<string, unknown>> | undefined
          if (content) {
            for (const blk of content) {
              if (blk.type === "text" && typeof blk.text === "string") {
                buffer += blk.text; fullText += blk.text
                await flushBuffer()
              }
            }
          }
        }

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

      await flushBuffer()

      const durationMs = Date.now() - startTime
      const gen = await ctx.runQuery(internal.generations.getInternal, { generationId: args.generationId })

      if (gen?.status === "cancelled") {
        trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs, resolvedModel })
        await flushLangfuse()
        return
      }

      await ctx.runMutation(internal.research.fillResearchBlock, {
        blockId: args.blockId,
        content: fullText,
      })
      await ctx.runMutation(internal.generations.completeWithUsage, {
        generationId: args.generationId,
        inputTokens, outputTokens, costUsd, durationMs,
      })
      trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs, resolvedModel })
      await flushLangfuse()
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        await flushBuffer()
        trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs: Date.now() - startTime, resolvedModel })
        await flushLangfuse()
        return
      }
      const errorMessage = error instanceof Error ? error.message : String(error)
      const stderrOutput = stderrChunks.join("").trim()
      await flushBuffer()
      const fullError = stderrOutput ? `Research error: ${errorMessage}\nstderr: ${stderrOutput}` : `Research error: ${errorMessage}`
      await ctx.runMutation(internal.generations.fail, { generationId: args.generationId, error: fullError })
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
