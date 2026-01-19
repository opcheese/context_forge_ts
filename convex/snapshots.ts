import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// ============ Queries ============

// List all snapshots for a session
export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
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
    return await ctx.db.get(args.id)
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
    // Verify session exists
    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    // Get all blocks for this session
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    // Serialize blocks (without session-specific fields)
    const serializedBlocks = blocks.map((block) => ({
      content: block.content,
      type: block.type,
      zone: block.zone,
      position: block.position,
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

    // Verify session still exists
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

    await ctx.db.patch(args.id, { name: args.name })
    return args.id
  },
})
