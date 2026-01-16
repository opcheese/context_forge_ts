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
    zone: v.union(
      v.literal("PERMANENT"),
      v.literal("STABLE"),
      v.literal("WORKING")
    ),
    position: v.number(), // Order within zone (lower = higher in list)
    createdAt: v.number(),
    updatedAt: v.number(),
    // Test data flag - marked records can be bulk deleted
    testData: v.optional(v.boolean()),
  }).index("by_zone", ["zone", "position"]),
})
