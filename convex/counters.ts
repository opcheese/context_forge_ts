/**
 * Demo counter module - for testing Convex setup.
 *
 * This is a simple example module that can be removed once the app
 * is fully functional. It demonstrates basic query/mutation patterns.
 *
 * @deprecated This module is for demo purposes only. It can be safely
 * removed along with the `counters` table in schema.ts.
 */

import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// Get all counters
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("counters").collect()
  },
})

// Get a single counter by name
export const get = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first()
  },
})

// Create a new counter
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    // Check if counter already exists
    const existing = await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first()

    if (existing) {
      return existing._id
    }

    return await ctx.db.insert("counters", {
      name: args.name,
      value: 0,
    })
  },
})

// Increment a counter
export const increment = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const counter = await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first()

    if (!counter) {
      // Create if doesn't exist
      return await ctx.db.insert("counters", {
        name: args.name,
        value: 1,
      })
    }

    await ctx.db.patch(counter._id, {
      value: counter.value + 1,
    })

    return counter._id
  },
})

// Decrement a counter
export const decrement = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const counter = await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first()

    if (!counter) {
      return null
    }

    await ctx.db.patch(counter._id, {
      value: counter.value - 1,
    })

    return counter._id
  },
})

// Reset a counter to zero
export const reset = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const counter = await ctx.db
      .query("counters")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first()

    if (!counter) {
      return null
    }

    await ctx.db.patch(counter._id, {
      value: 0,
    })

    return counter._id
  },
})
