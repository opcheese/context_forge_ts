import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// List all blocks, ordered by creation time (newest first)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("blocks").order("desc").collect()
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
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("blocks", {
      content: args.content,
      type: args.type,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Delete a block
export const remove = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
