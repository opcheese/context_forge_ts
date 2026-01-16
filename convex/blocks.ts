import { query, mutation, internalQuery, internalMutation } from "./_generated/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"

// Zone type for validation
const zoneValidator = v.union(
  v.literal("PERMANENT"),
  v.literal("STABLE"),
  v.literal("WORKING")
)

// ============ Internal functions (for use by other Convex functions) ============

// Internal: list all blocks (for testing/admin)
export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("blocks").collect()
  },
})

// Internal: delete a block by ID
export const removeInternal = internalMutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

// Internal: get next position for a zone within a session
async function getNextPosition(
  ctx: { db: { query: (table: "blocks") => { withIndex: (index: string, q: (q: { eq: (field: string, value: unknown) => { eq: (field: string, value: unknown) => unknown } }) => unknown) => { collect: () => Promise<Array<{ position: number }>> } } } },
  sessionId: Id<"sessions">,
  zone: string
): Promise<number> {
  const blocks = await ctx.db
    .query("blocks")
    .withIndex("by_session_zone", (q) => q.eq("sessionId", sessionId).eq("zone", zone))
    .collect()
  if (blocks.length === 0) return 0
  return Math.max(...blocks.map((b) => b.position)) + 1
}

// ============ Public functions ============

// List all blocks for a session, ordered by creation time (newest first)
export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect()
  },
})

// List blocks by session and zone, ordered by position
export const listByZone = query({
  args: {
    sessionId: v.id("sessions"),
    zone: zoneValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("blocks")
      .withIndex("by_session_zone", (q) =>
        q.eq("sessionId", args.sessionId).eq("zone", args.zone)
      )
      .collect()
  },
})

// Get a single block by ID
export const get = query({
  args: { id: v.id("blocks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Create a new block in a session
export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    type: v.string(),
    zone: v.optional(zoneValidator),
    testData: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify session exists
    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    const zone = args.zone ?? "WORKING" // Default to WORKING zone
    const position = await getNextPosition(ctx, args.sessionId, zone)
    const now = Date.now()

    // Update session's updatedAt
    await ctx.db.patch(args.sessionId, { updatedAt: now })

    return await ctx.db.insert("blocks", {
      sessionId: args.sessionId,
      content: args.content,
      type: args.type,
      zone,
      position,
      createdAt: now,
      updatedAt: now,
      testData: args.testData,
    })
  },
})

// Move a block to a different zone
export const move = mutation({
  args: {
    id: v.id("blocks"),
    zone: zoneValidator,
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    if (!block) throw new Error("Block not found")

    // If already in target zone, do nothing
    if (block.zone === args.zone) return block._id

    // Get next position in target zone
    const position = await getNextPosition(ctx, block.sessionId, args.zone)
    const now = Date.now()

    await ctx.db.patch(args.id, {
      zone: args.zone,
      position,
      updatedAt: now,
    })

    // Update session's updatedAt
    await ctx.db.patch(block.sessionId, { updatedAt: now })

    return args.id
  },
})

// Reorder a block (update its position)
// Uses fractional positioning - just updates the single block's position
export const reorder = mutation({
  args: {
    id: v.id("blocks"),
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    if (!block) throw new Error("Block not found")

    const now = Date.now()

    // Simply update the block's position (fractional ordering)
    await ctx.db.patch(args.id, {
      position: args.newPosition,
      updatedAt: now,
    })

    // Update session's updatedAt
    await ctx.db.patch(block.sessionId, { updatedAt: now })

    return args.id
  },
})

// Update a block's content and/or type
export const update = mutation({
  args: {
    id: v.id("blocks"),
    content: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    if (!block) throw new Error("Block not found")

    const now = Date.now()
    const updates: { content?: string; type?: string; updatedAt: number } = {
      updatedAt: now,
    }

    if (args.content !== undefined) {
      updates.content = args.content
    }
    if (args.type !== undefined) {
      updates.type = args.type
    }

    await ctx.db.patch(args.id, updates)

    // Update session's updatedAt
    await ctx.db.patch(block.sessionId, { updatedAt: now })

    return args.id
  },
})

// Delete a block
export const remove = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    if (block) {
      // Update session's updatedAt before deleting
      await ctx.db.patch(block.sessionId, { updatedAt: Date.now() })
    }
    await ctx.db.delete(args.id)
  },
})
