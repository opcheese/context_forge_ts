import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // Demo table (can remove later)
  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }),

  // Core blocks table
  blocks: defineTable({
    content: v.string(),
    type: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
})
