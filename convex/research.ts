import { mutation, internalMutation, query, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

/** Public query — returns the research block for a session (null if none). */
export const getResearchBlock = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("type"), "research"))
      .first()
  },
})

/** Internal query — same as above, callable from actions. */
export const getResearchBlockInternal = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("type"), "research"))
      .first()
  },
})

/** Internal mutation — writes research result into block content. */
export const fillResearchBlock = internalMutation({
  args: { blockId: v.id("blocks"), content: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.blockId, {
      content: args.content,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Start a research generation.
 * Reads block content as the research spec, replaces it with results when done.
 * Enforces: research block must exist and have a non-empty spec.
 */
export const startResearch = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const researchBlock = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("type"), "research"))
      .first()

    if (!researchBlock) {
      throw new Error("No research block found for this session")
    }
    if (!researchBlock.content.trim()) {
      throw new Error("Write a research spec in the block before running")
    }

    // Check not already running
    const activeGen = await ctx.db
      .query("generations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first()
    if (activeGen?.status === "streaming") {
      throw new Error("A generation is already in progress")
    }

    const now = Date.now()
    const generationId = await ctx.db.insert("generations", {
      sessionId: args.sessionId,
      provider: "claude",
      status: "streaming",
      text: "",
      createdAt: now,
      updatedAt: now,
    })

    await ctx.scheduler.runAfter(0, internal.claudeNode.runResearchAction, {
      generationId,
      sessionId: args.sessionId,
      blockId: researchBlock._id,
      spec: researchBlock.content,
    })

    return { generationId, blockId: researchBlock._id }
  },
})
