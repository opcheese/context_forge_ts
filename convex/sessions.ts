import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// ============ Queries ============

// List all sessions
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sessions").order("desc").collect()
  },
})

// Get a single session by ID
export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// ============ Mutations ============

// Create a new session
export const create = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("sessions", {
      name: args.name,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Update a session (e.g., rename)
export const update = mutation({
  args: {
    id: v.id("sessions"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id)
    if (!session) throw new Error("Session not found")

    await ctx.db.patch(args.id, {
      name: args.name,
      updatedAt: Date.now(),
    })
    return args.id
  },
})

// Delete a session and all its blocks and snapshots
export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    // Delete all blocks in this session
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect()
    for (const block of blocks) {
      await ctx.db.delete(block._id)
    }

    // Delete all snapshots for this session
    const snapshots = await ctx.db
      .query("snapshots")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect()
    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id)
    }

    // Delete the session itself
    await ctx.db.delete(args.id)
  },
})
