/**
 * Generations - Streaming LLM generation with real-time updates.
 *
 * This module enables true streaming for LLM providers by:
 * 1. Creating a generation record when starting
 * 2. Updating the text field as chunks arrive (from Node.js action)
 * 3. Clients subscribe via useQuery for real-time updates
 */

import { mutation, query, internalMutation, action } from "./_generated/server"
import { api, internal } from "./_generated/api"
import { v } from "convex/values"

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
 * Get a generation by ID.
 * Clients subscribe to this for real-time streaming updates.
 */
export const get = query({
  args: {
    generationId: v.id("generations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.generationId)
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
    const generations = await ctx.db
      .query("generations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first()
    return generations
  },
})

/**
 * Start a Claude Code streaming generation.
 *
 * This mutation:
 * 1. Creates a generation record
 * 2. Schedules the Claude streaming action
 * 3. Returns the generation ID immediately for client subscription
 *
 * The streaming action runs asynchronously via scheduler.
 */
export const startClaudeGeneration = mutation({
  args: {
    sessionId: v.id("sessions"),
    prompt: v.string(),
    systemPrompt: v.optional(v.string()),
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
    // This allows us to return the generationId right away
    await ctx.scheduler.runAfter(0, api.claudeNode.streamGenerateWithContext, {
      generationId,
      sessionId: args.sessionId,
      prompt: args.prompt,
      systemPrompt: args.systemPrompt,
    })

    return { generationId }
  },
})

/**
 * Save completed generation to blocks.
 * Called when generation completes to persist the result.
 */
export const saveToBlocks = mutation({
  args: {
    generationId: v.id("generations"),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId)
    if (!generation) {
      throw new Error("Generation not found")
    }
    if (generation.status !== "complete") {
      throw new Error("Generation not complete")
    }
    if (!generation.text.trim()) {
      throw new Error("Generation has no content")
    }

    // Get max position for WORKING zone
    const existingBlocks = await ctx.db
      .query("blocks")
      .withIndex("by_session_zone", (q) =>
        q.eq("sessionId", generation.sessionId).eq("zone", "WORKING")
      )
      .collect()

    const maxPosition = existingBlocks.reduce(
      (max, b) => Math.max(max, b.position),
      -1
    )

    // Create block with generated content
    const now = Date.now()
    return await ctx.db.insert("blocks", {
      sessionId: generation.sessionId,
      content: generation.text,
      type: "ASSISTANT",
      zone: "WORKING",
      position: maxPosition + 1,
      createdAt: now,
      updatedAt: now,
    })
  },
})
