import { query, mutation, internalQuery, internalMutation } from "./_generated/server"
import { v } from "convex/values"

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

// Internal: get next position for a zone
async function getNextPosition(
  ctx: { db: { query: (table: "blocks") => { withIndex: (index: string, q: (q: { eq: (field: string, value: string) => unknown }) => unknown) => { collect: () => Promise<Array<{ position: number }>> } } } },
  zone: string
): Promise<number> {
  const blocks = await ctx.db
    .query("blocks")
    .withIndex("by_zone", (q) => q.eq("zone", zone))
    .collect()
  if (blocks.length === 0) return 0
  return Math.max(...blocks.map((b) => b.position)) + 1
}

// ============ Public functions ============

// List all blocks, ordered by creation time (newest first)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("blocks").order("desc").collect()
  },
})

// List blocks by zone, ordered by position
export const listByZone = query({
  args: { zone: zoneValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("blocks")
      .withIndex("by_zone", (q) => q.eq("zone", args.zone))
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

// Create a new block
export const create = mutation({
  args: {
    content: v.string(),
    type: v.string(),
    zone: v.optional(zoneValidator),
    testData: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const zone = args.zone ?? "WORKING" // Default to WORKING zone
    const position = await getNextPosition(ctx, zone)
    const now = Date.now()
    return await ctx.db.insert("blocks", {
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
    const position = await getNextPosition(ctx, args.zone)

    await ctx.db.patch(args.id, {
      zone: args.zone,
      position,
      updatedAt: Date.now(),
    })

    return args.id
  },
})

// Reorder a block within its zone
export const reorder = mutation({
  args: {
    id: v.id("blocks"),
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    if (!block) throw new Error("Block not found")

    // Get all blocks in the same zone
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_zone", (q) => q.eq("zone", block.zone))
      .collect()

    const oldPosition = block.position
    const newPosition = args.newPosition

    // Update positions of affected blocks
    for (const b of blocks) {
      if (b._id === args.id) continue

      let updatedPosition = b.position
      if (oldPosition < newPosition) {
        // Moving down: shift blocks up
        if (b.position > oldPosition && b.position <= newPosition) {
          updatedPosition = b.position - 1
        }
      } else {
        // Moving up: shift blocks down
        if (b.position >= newPosition && b.position < oldPosition) {
          updatedPosition = b.position + 1
        }
      }

      if (updatedPosition !== b.position) {
        await ctx.db.patch(b._id, { position: updatedPosition })
      }
    }

    // Update the moved block
    await ctx.db.patch(args.id, {
      position: newPosition,
      updatedAt: Date.now(),
    })

    return args.id
  },
})

// Delete a block
export const remove = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
