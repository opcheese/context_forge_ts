/**
 * Generations - Streaming LLM generation with real-time updates.
 *
 * This module enables true streaming for LLM providers by:
 * 1. Creating a generation record when starting
 * 2. Updating the text field as chunks arrive (from Node.js action)
 * 3. Clients subscribe via useQuery for real-time updates
 */

import { mutation, query, internalMutation, internalQuery } from "./_generated/server"
import { api } from "./_generated/api"
import { v } from "convex/values"
import { countTokens, DEFAULT_TOKEN_MODEL } from "./lib/tokenizer"
import { canAccessSession } from "./lib/auth"

/**
 * Create a new generation record.
 * Returns the generation ID for subscription.
 */
export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("generations", {
      sessionId: args.sessionId,
      provider: args.provider,
      status: "streaming",
      text: "",
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Internal mutation to append text chunk.
 * Called by Node.js action as chunks arrive.
 * Uses internal mutation so it can be called from actions.
 */
export const appendChunk = internalMutation({
  args: {
    generationId: v.id("generations"),
    chunk: v.string(),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId)
    if (!generation) {
      throw new Error("Generation not found")
    }
    if (generation.status !== "streaming") {
      // Already complete or errored, ignore late chunks
      return
    }

    await ctx.db.patch(args.generationId, {
      text: generation.text + args.chunk,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Internal mutation to mark generation as complete.
 */
export const complete = internalMutation({
  args: {
    generationId: v.id("generations"),
    finalText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId)
    if (!generation) {
      throw new Error("Generation not found")
    }

    await ctx.db.patch(args.generationId, {
      status: "complete",
      text: args.finalText ?? generation.text,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Internal mutation to mark generation as complete with usage stats.
 * Used by Claude streaming to capture token usage and cost.
 */
export const completeWithUsage = internalMutation({
  args: {
    generationId: v.id("generations"),
    finalText: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId)
    if (!generation) {
      throw new Error("Generation not found")
    }

    const totalTokens =
      args.inputTokens !== undefined && args.outputTokens !== undefined
        ? args.inputTokens + args.outputTokens
        : undefined

    await ctx.db.patch(args.generationId, {
      status: "complete",
      text: args.finalText ?? generation.text,
      updatedAt: Date.now(),
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens,
      costUsd: args.costUsd,
      durationMs: args.durationMs,
    })
  },
})

/**
 * Internal mutation to mark generation as failed.
 */
export const fail = internalMutation({
  args: {
    generationId: v.id("generations"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId)
    if (!generation) {
      throw new Error("Generation not found")
    }

    await ctx.db.patch(args.generationId, {
      status: "error",
      error: args.error,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Cancel a streaming generation.
 * Sets status to "cancelled" so the server action stops writing chunks.
 */
export const cancel = mutation({
  args: { generationId: v.id("generations") },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId)
    if (!generation) return
    if (generation.status !== "streaming") return

    await ctx.db.patch(args.generationId, {
      status: "cancelled",
      updatedAt: Date.now(),
    })
  },
})

/**
 * Internal query to get generation by ID.
 * Used by server actions to check cancellation status.
 */
export const getInternal = internalQuery({
  args: { generationId: v.id("generations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.generationId)
  },
})

/**
 * Get a generation by ID.
 * Clients subscribe to this for real-time streaming updates.
 */
export const get = query({
  args: {
    generationId: v.id("generations"),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId)
    if (!generation) return null

    // Check session access
    const hasAccess = await canAccessSession(ctx, generation.sessionId)
    if (!hasAccess) {
      return null
    }

    return generation
  },
})

/**
 * Get the latest generation for a session.
 * Useful for resuming UI state after refresh.
 */
export const getLatest = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Check session access
    const hasAccess = await canAccessSession(ctx, args.sessionId)
    if (!hasAccess) {
      return null
    }

    const generations = await ctx.db
      .query("generations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first()
    return generations
  },
})

/**
 * Start a brainstorm streaming generation.
 *
 * This mutation:
 * 1. Creates a generation record
 * 2. Schedules the Claude brainstorm streaming action
 * 3. Returns the generation ID immediately for client subscription
 *
 * Accepts conversation history. Does NOT auto-save to blocks —
 * user saves manually with zone selection via saveBrainstormMessage.
 */
export const startBrainstormGeneration = mutation({
  args: {
    sessionId: v.id("sessions"),
    conversationHistory: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
    newMessage: v.string(),
    disableAgentBehavior: v.optional(v.boolean()), // Append anti-agent suffix to system prompt
    preventSelfTalk: v.optional(v.boolean()), // Append anti-self-talk suffix
    activeSkillIds: v.optional(v.array(v.string())), // Ephemeral skill IDs to inject
    model: v.optional(v.string()), // Claude model override
    isValidation: v.optional(v.boolean()), // Validation mode — include validation criteria blocks + suffix
  },
  handler: async (ctx, args) => {
    // Create generation record
    const now = Date.now()
    const generationId = await ctx.db.insert("generations", {
      sessionId: args.sessionId,
      provider: "claude",
      status: "streaming",
      text: "",
      createdAt: now,
      updatedAt: now,
    })

    // Schedule the streaming action to run immediately
    // System prompt is now extracted from blocks by the action
    await ctx.scheduler.runAfter(0, api.claudeNode.streamBrainstormMessage, {
      generationId,
      sessionId: args.sessionId,
      conversationHistory: args.conversationHistory,
      newMessage: args.newMessage,
      disableAgentBehavior: args.disableAgentBehavior ?? true, // Default to true
      preventSelfTalk: args.preventSelfTalk ?? true, // Default to true
      activeSkillIds: args.activeSkillIds,
      model: args.model,
      isValidation: args.isValidation,
    })

    return { generationId }
  },
})

/**
 * Internal mutation to store Claude Agent SDK session ID on a session.
 * Called by the streaming action after the first turn creates a session.
 */
export const setClaudeSessionId = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    claudeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) return // Session was deleted
    await ctx.db.patch(args.sessionId, {
      claudeSessionId: args.claudeSessionId,
    })
  },
})

/**
 * Internal mutation to clear Claude Agent SDK session ID.
 * Called when PERMANENT/STABLE blocks change, forcing a fresh session on next turn.
 */
export const clearClaudeSessionId = internalMutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) return // Session was deleted
    await ctx.db.patch(args.sessionId, {
      claudeSessionId: undefined,
    })
  },
})

/**
 * Internal mutation to store the actual model resolved by the Claude SDK.
 * Called after the first assistant message reveals the model name.
 */
export const setClaudeResolvedModel = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session) return
    await ctx.db.patch(args.sessionId, {
      claudeResolvedModel: args.model,
    })
  },
})

/**
 * Internal query to get session by ID.
 * Used by the streaming action to read claudeSessionId.
 */
export const getSessionInternal = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId)
  },
})

/**
 * Save a brainstorm message as a block.
 *
 * This is called manually by the user to save individual messages
 * from a brainstorm conversation with zone selection.
 */
export const saveBrainstormMessage = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    zone: v.union(v.literal("PERMANENT"), v.literal("STABLE"), v.literal("WORKING")),
  },
  handler: async (ctx, args) => {
    if (!args.content.trim()) {
      throw new Error("Message has no content")
    }

    // Get max position for the target zone
    const existingBlocks = await ctx.db
      .query("blocks")
      .withIndex("by_session_zone", (q) =>
        q.eq("sessionId", args.sessionId).eq("zone", args.zone)
      )
      .collect()

    const maxPosition = existingBlocks.reduce(
      (max, b) => Math.max(max, b.position),
      -1
    )

    // Create block with message content
    // Use user_message or assistant_message type based on role
    const now = Date.now()
    const tokens = countTokens(args.content)
    const blockType = args.role === "user" ? "user_message" : "assistant_message"

    return await ctx.db.insert("blocks", {
      sessionId: args.sessionId,
      content: args.content,
      type: blockType,
      zone: args.zone,
      position: maxPosition + 1,
      createdAt: now,
      updatedAt: now,
      // Token tracking
      tokens,
      originalTokens: tokens,
      tokenModel: DEFAULT_TOKEN_MODEL,
    })
  },
})
