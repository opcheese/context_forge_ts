import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

// Shared zone validator
const zoneValidator = v.union(
  v.literal("PERMANENT"),
  v.literal("STABLE"),
  v.literal("WORKING")
)

export default defineSchema({
  // Demo table (can remove later)
  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }),

  // Sessions - isolated workspaces for context management
  sessions: defineTable({
    name: v.optional(v.string()), // Optional display name
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Core blocks table - content blocks within sessions
  blocks: defineTable({
    sessionId: v.id("sessions"), // Required - blocks belong to a session
    content: v.string(),
    type: v.string(),
    zone: zoneValidator,
    position: v.number(), // Order within zone (lower = higher in list)
    createdAt: v.number(),
    updatedAt: v.number(),
    // Test data flag - marked records can be bulk deleted
    testData: v.optional(v.boolean()),
  })
    .index("by_zone", ["zone", "position"]) // Legacy index
    .index("by_session", ["sessionId"])
    .index("by_session_zone", ["sessionId", "zone", "position"]),

  // Snapshots - saved copies of session state for testing/restore
  snapshots: defineTable({
    sessionId: v.id("sessions"),
    name: v.string(), // e.g., "before-llm-test-1"
    createdAt: v.number(),
    // Serialized block data (denormalized for easy restore)
    blocks: v.array(
      v.object({
        content: v.string(),
        type: v.string(),
        zone: zoneValidator,
        position: v.number(),
      })
    ),
  }).index("by_session", ["sessionId"]),

  // Streaming generations - tracks LLM generation with real-time text updates
  generations: defineTable({
    sessionId: v.id("sessions"),
    provider: v.string(), // "ollama" | "claude"
    status: v.union(
      v.literal("streaming"),
      v.literal("complete"),
      v.literal("error")
    ),
    text: v.string(), // Accumulated text, updated as chunks arrive
    error: v.optional(v.string()), // Error message if status is "error"
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_session", ["sessionId", "createdAt"]),
})
