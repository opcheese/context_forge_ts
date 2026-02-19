import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { canAccessSession, requireSessionAccess } from "./lib/auth"
import { resolveBlocks } from "./lib/resolve"

// ============ Queries ============

// List all snapshots for a session
export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    // Check session access
    const hasAccess = await canAccessSession(ctx, args.sessionId)
    if (!hasAccess) {
      return []
    }

    return await ctx.db
      .query("snapshots")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect()
  },
})

// Get a single snapshot by ID
export const get = query({
  args: { id: v.id("snapshots") },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.id)
    if (!snapshot) return null

    // Check session access
    const hasAccess = await canAccessSession(ctx, snapshot.sessionId)
    if (!hasAccess) {
      return null
    }

    return snapshot
  },
})

// ============ Mutations ============

// Create a snapshot from current session state
export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify session exists and user has access
    await requireSessionAccess(ctx, args.sessionId)

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    // Get all blocks for this session
    const rawBlocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    // Resolve linked block content so snapshots are self-contained
    const refIds = [...new Set(rawBlocks.filter((b) => b.refBlockId).map((b) => String(b.refBlockId)))]
    const canonicalLookup = new Map<string, Pick<Doc<"blocks">, "content">>()
    await Promise.all(refIds.map(async (id) => {
      const canonical = await ctx.db.get(id as Id<"blocks">)
      if (canonical) canonicalLookup.set(id, { content: canonical.content })
    }))
    const blocks = resolveBlocks(rawBlocks, canonicalLookup)

    // Serialize blocks (without session-specific fields)
    const serializedBlocks = blocks.map((block) => ({
      content: block.content,
      type: block.type,
      zone: block.zone,
      position: block.position,
      // Include token tracking
      tokens: block.tokens,
      originalTokens: block.originalTokens,
      tokenModel: block.tokenModel,
      metadata: block.metadata,
      isDraft: block.isDraft,
    }))

    return await ctx.db.insert("snapshots", {
      sessionId: args.sessionId,
      name: args.name,
      createdAt: Date.now(),
      blocks: serializedBlocks,
    })
  },
})

// Restore a snapshot (replace session blocks with snapshot data)
export const restore = mutation({
  args: { id: v.id("snapshots") },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.id)
    if (!snapshot) throw new Error("Snapshot not found")

    // Verify session exists and user has access
    await requireSessionAccess(ctx, snapshot.sessionId)

    const session = await ctx.db.get(snapshot.sessionId)
    if (!session) throw new Error("Session not found")

    // Delete all current blocks in the session
    const existingBlocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", snapshot.sessionId))
      .collect()

    for (const block of existingBlocks) {
      await ctx.db.delete(block._id)
    }

    // Recreate blocks from snapshot
    const now = Date.now()
    for (const blockData of snapshot.blocks) {
      await ctx.db.insert("blocks", {
        sessionId: snapshot.sessionId,
        content: blockData.content,
        type: blockData.type,
        zone: blockData.zone,
        position: blockData.position,
        createdAt: now,
        updatedAt: now,
        // Restore token tracking
        tokens: blockData.tokens,
        originalTokens: blockData.originalTokens,
        tokenModel: blockData.tokenModel,
        metadata: blockData.metadata,
        isDraft: blockData.isDraft,
      })
    }

    // Update session's updatedAt
    await ctx.db.patch(snapshot.sessionId, { updatedAt: now })

    return snapshot.sessionId
  },
})

// Delete a snapshot
export const remove = mutation({
  args: { id: v.id("snapshots") },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.id)
    if (!snapshot) throw new Error("Snapshot not found")

    // Check session access
    await requireSessionAccess(ctx, snapshot.sessionId)

    await ctx.db.delete(args.id)
  },
})

// Rename a snapshot
export const rename = mutation({
  args: {
    id: v.id("snapshots"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.id)
    if (!snapshot) throw new Error("Snapshot not found")

    // Check session access
    await requireSessionAccess(ctx, snapshot.sessionId)

    await ctx.db.patch(args.id, { name: args.name })
    return args.id
  },
})
