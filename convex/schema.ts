import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { authTables } from "@convex-dev/auth/server"
import { zoneValidator, marketplaceTypeValidator } from "./lib/validators"

// Shared validator for skill block metadata (used in blocks, templates, snapshots)
const skillMetadataValidator = v.object({
  skillName: v.string(),
  skillDescription: v.optional(v.string()),
  disableModelInvocation: v.optional(v.boolean()),
  argumentHint: v.optional(v.string()),
  sourceType: v.union(v.literal("local"), v.literal("upload"), v.literal("url")),
  sourceRef: v.optional(v.string()),
  parentSkillName: v.optional(v.string()), // Links reference blocks to their parent skill
})

export default defineSchema({
  // Auth tables from Convex Auth
  ...authTables,
  // Demo table - can be removed along with convex/counters.ts
  // @deprecated For demo/testing only
  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }),

  // Sessions - isolated workspaces for context management
  sessions: defineTable({
    userId: v.optional(v.id("users")), // Owner of this session (optional for migration)
    name: v.optional(v.string()), // Optional display name
    createdAt: v.number(),
    updatedAt: v.number(),
    // Token budget configuration (optional, uses defaults if not set)
    budgets: v.optional(
      v.object({
        permanent: v.number(), // Default: 30000
        stable: v.number(), // Default: 50000
        working: v.number(), // Default: 40000
        total: v.number(), // Default: 150000
      })
    ),
    // System prompt for LLM interactions
    systemPrompt: v.optional(v.string()),
    // Claude Agent SDK session ID for resume (enables prompt caching)
    claudeSessionId: v.optional(v.string()),
    // Actual model resolved by the Claude SDK (e.g. "claude-sonnet-4-5-20250929")
    claudeResolvedModel: v.optional(v.string()),
    // Memory pins (session-scoped — not carried forward)
    pinnedMemories: v.optional(v.array(v.id("memoryEntries"))),
    // Session tags for memory auto-selection (merged from template defaults + user overrides)
    sessionTags: v.optional(v.array(v.string())),
    // Project/workflow linkage (Phase 2+)
    projectId: v.optional(v.id("projects")),
    templateId: v.optional(v.id("templates")),
    stepNumber: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"]),

  // Templates - reusable session configurations
  templates: defineTable({
    userId: v.optional(v.id("users")), // Owner of this template (optional for migration)
    name: v.string(),
    description: v.optional(v.string()),
    // Snapshot of blocks to load when applying template
    blocks: v.array(
      v.object({
        content: v.string(),
        type: v.string(),
        zone: zoneValidator,
        position: v.number(),
        metadata: v.optional(skillMetadataValidator),
      })
    ),
    // Workflow linkage (Phase 3)
    workflowId: v.optional(v.id("workflows")),
    stepOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedMarketplaceId: v.optional(v.id("marketplace")),
    sourceMarketplaceId: v.optional(v.id("marketplace")),
  })
    .index("by_workflow", ["workflowId", "stepOrder"])
    .index("by_user", ["userId"]),

  // Projects - groups related sessions (Phase 2)
  projects: defineTable({
    userId: v.optional(v.id("users")), // Owner of this project (optional for migration)
    name: v.string(),
    description: v.optional(v.string()),
    workflowId: v.optional(v.id("workflows")),
    currentStep: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Workflows - ordered sequence of templates (Phase 3)
  workflows: defineTable({
    userId: v.optional(v.id("users")), // Owner of this workflow (optional for migration)
    name: v.string(),
    description: v.optional(v.string()),
    steps: v.array(
      v.object({
        templateId: v.optional(v.id("templates")), // Optional - can be unlinked initially
        name: v.string(),
        description: v.optional(v.string()),
        // Which zones to carry forward from previous step
        carryForwardZones: v.optional(
          v.array(v.union(v.literal("PERMANENT"), v.literal("STABLE"), v.literal("WORKING")))
        ),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedMarketplaceId: v.optional(v.id("marketplace")),
    sourceMarketplaceId: v.optional(v.id("marketplace")),
  }).index("by_user", ["userId"]),

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
    // Context mode - controls how the block participates in LLM context
    contextMode: v.optional(v.union(v.literal("default"), v.literal("draft"), v.literal("validation"))),
    // Token tracking
    tokens: v.optional(v.number()), // Current token count
    originalTokens: v.optional(v.number()), // Original token count (before compression)
    tokenModel: v.optional(v.string()), // Model used for counting (e.g., "cl100k_base")
    // Compression state
    isCompressed: v.optional(v.boolean()), // Whether this block has been compressed
    compressionStrategy: v.optional(v.string()), // "semantic" | "structural" | "statistical"
    compressionRatio: v.optional(v.number()), // e.g., 2.5 means 2.5x smaller
    compressedAt: v.optional(v.number()), // Timestamp when compressed
    // Merge tracking (for multi-block compression)
    mergedFromCount: v.optional(v.number()), // Number of blocks that were merged into this one
    // Skill metadata (for skill blocks)
    metadata: v.optional(skillMetadataValidator),
    // Linked block reference — points to canonical block in another session
    refBlockId: v.optional(v.id("blocks")),
    // Content hash for duplicate detection (DJB2 hex, first 16 chars)
    contentHash: v.optional(v.string()),
    // Template this block was created from — suppresses "Link?" for same-template siblings
    sourceTemplateId: v.optional(v.id("templates")),
    // Research block fields
    researchSource: v.optional(v.union(v.literal("web"), v.literal("local"))),
    researchPath: v.optional(v.string()),
  })
    .index("by_zone", ["zone", "position"]) // Legacy index
    .index("by_session", ["sessionId"])
    .index("by_session_zone", ["sessionId", "zone", "position"])
    .index("by_content_hash", ["contentHash"])
    .index("by_ref_block", ["refBlockId"]),

  // Memory type definitions per project
  memorySchemas: defineTable({
    projectId: v.id("projects"),
    types: v.array(
      v.object({
        name: v.string(),
        color: v.string(),
        icon: v.string(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  // Individual memory entries
  memoryEntries: defineTable({
    projectId: v.id("projects"),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_type", ["projectId", "type"]),

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
        // Token tracking (optional for backwards compatibility)
        tokens: v.optional(v.number()),
        originalTokens: v.optional(v.number()),
        tokenModel: v.optional(v.string()),
        metadata: v.optional(skillMetadataValidator),
        contextMode: v.optional(v.union(v.literal("default"), v.literal("draft"), v.literal("validation"))),
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
      v.literal("error"),
      v.literal("cancelled")
    ),
    text: v.string(), // Accumulated text, updated as chunks arrive
    error: v.optional(v.string()), // Error message if status is "error"
    createdAt: v.number(),
    updatedAt: v.number(),
    // Usage tracking
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  }).index("by_session", ["sessionId", "createdAt"]),

  // Marketplace - community template/workflow library
  marketplace: defineTable({
    authorId: v.id("users"),
    authorName: v.string(),
    type: marketplaceTypeValidator,
    name: v.string(),
    description: v.string(),
    category: v.string(),

    // Content snapshot (copied on publish, self-contained)
    templateBlocks: v.optional(v.array(v.object({
      content: v.string(),
      type: v.string(),
      zone: zoneValidator,
      position: v.number(),
      metadata: v.optional(skillMetadataValidator),
    }))),
    workflowSteps: v.optional(v.array(v.object({
      name: v.string(),
      description: v.optional(v.string()),
      carryForwardZones: v.optional(v.array(v.union(
        v.literal("PERMANENT"), v.literal("STABLE"), v.literal("WORKING")
      ))),
    }))),
    importCount: v.number(),
    searchText: v.string(),
    publishedAt: v.number(),
    updatedAt: v.number(),
  })
    .searchIndex("search_marketplace", {
      searchField: "searchText",
      filterFields: ["type", "category"],
    })
    .index("by_author", ["authorId"])
    .index("by_category", ["category", "importCount"]),

  // Marketplace categories - admin-managed
  marketplaceCategories: defineTable({
    slug: v.string(),
    label: v.string(),
    position: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_position", ["position"]),

  // Marketplace blocks - template blocks stored per step (avoids 1 MiB doc limit)
  marketplaceBlocks: defineTable({
    marketplaceId: v.id("marketplace"),
    stepIndex: v.number(),
    blocks: v.array(v.object({
      content: v.string(),
      type: v.string(),
      zone: zoneValidator,
      position: v.number(),
      metadata: v.optional(skillMetadataValidator),
    })),
  })
    .index("by_marketplace", ["marketplaceId"]),
})
