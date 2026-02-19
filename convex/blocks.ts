import { query, mutation, internalQuery, internalMutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { zoneValidator, type Zone } from "./lib/validators"
import { countTokens, DEFAULT_TOKEN_MODEL } from "./lib/tokenizer"
import { computeContentHash } from "./lib/contentHash"
import { canAccessSession, requireSessionAccess } from "./lib/auth"
import { resolveBlocks } from "./lib/resolve"

// Fetch canonical blocks for a set of linked blocks, returns lookup map
async function fetchCanonicalLookup(
  ctx: { db: any },
  blocks: Array<{ refBlockId?: Id<"blocks"> | undefined }>
): Promise<Map<string, Pick<Doc<"blocks">, "content">>> {
  const refIds = blocks
    .filter((b): b is typeof b & { refBlockId: Id<"blocks"> } => !!b.refBlockId)
    .map((b) => b.refBlockId)
  const uniqueIds = [...new Set(refIds.map(String))]

  const lookup = new Map<string, Pick<Doc<"blocks">, "content">>()
  await Promise.all(
    uniqueIds.map(async (id) => {
      const canonical = await ctx.db.get(id as Id<"blocks">)
      if (canonical) {
        lookup.set(id, { content: canonical.content })
      }
    })
  )
  return lookup
}

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

// Internal: list blocks for a session (bypasses auth for server-side actions)
// Use this for scheduled actions that run without user context
export const listBySessionInternal = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect()
    const lookup = await fetchCanonicalLookup(ctx, blocks)
    return resolveBlocks(blocks, lookup)
  },
})

// Get next position for a zone within a session
// NOTE: Uses .first() instead of .collect() to avoid fetching all blocks (N+1 prevention)
async function getNextPosition(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  zone: Zone
): Promise<number> {
  const lastBlock = await ctx.db
    .query("blocks")
    .withIndex("by_session_zone", (q) => q.eq("sessionId", sessionId).eq("zone", zone))
    .order("desc")
    .first()
  return lastBlock ? lastBlock.position + 1 : 0
}

// ============ Public functions ============

// List all blocks for a session, ordered by creation time (newest first)
export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    // Check session access
    const hasAccess = await canAccessSession(ctx, args.sessionId)
    if (!hasAccess) {
      return []
    }

    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect()
    const lookup = await fetchCanonicalLookup(ctx, blocks)
    return resolveBlocks(blocks, lookup)
  },
})

// List blocks by session and zone, ordered by position
export const listByZone = query({
  args: {
    sessionId: v.id("sessions"),
    zone: zoneValidator,
  },
  handler: async (ctx, args) => {
    // Check session access
    const hasAccess = await canAccessSession(ctx, args.sessionId)
    if (!hasAccess) {
      return []
    }

    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session_zone", (q) =>
        q.eq("sessionId", args.sessionId).eq("zone", args.zone)
      )
      .order("asc")
      .collect()
    const lookup = await fetchCanonicalLookup(ctx, blocks)
    return resolveBlocks(blocks, lookup)
  },
})

// Get a single block by ID
export const get = query({
  args: { id: v.id("blocks") },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    if (!block) return null

    // Check session access
    const hasAccess = await canAccessSession(ctx, block.sessionId)
    if (!hasAccess) {
      return null
    }

    // Resolve linked block content
    if (block.refBlockId) {
      const canonical = await ctx.db.get(block.refBlockId)
      return { ...block, content: canonical?.content ?? "" }
    }
    return block
  },
})

// Find a block with matching content hash in a different session (for duplicate detection)
export const findDuplicate = query({
  args: {
    contentHash: v.string(),
    excludeSessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    if (!args.contentHash) return null
    const match = await ctx.db
      .query("blocks")
      .withIndex("by_content_hash", (q) => q.eq("contentHash", args.contentHash))
      .first()
    if (!match || match.sessionId === args.excludeSessionId) return null
    // Get session name for display
    const session = await ctx.db.get(match.sessionId)
    return {
      blockId: match._id,
      sessionId: match.sessionId,
      sessionName: session?.name ?? "Untitled",
    }
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
    // Verify session exists and user has access
    await requireSessionAccess(ctx, args.sessionId)

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    const zone = args.zone ?? "WORKING" // Default to WORKING zone
    const position = await getNextPosition(ctx, args.sessionId, zone)
    const now = Date.now()

    // Count tokens for the content
    const tokens = countTokens(args.content)
    const contentHash = computeContentHash(args.content)

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
      // Token tracking
      tokens,
      originalTokens: tokens,
      tokenModel: DEFAULT_TOKEN_MODEL,
      contentHash,
    })
  },
})

// Create a linked reference to an existing block in another session
export const createLinked = mutation({
  args: {
    sessionId: v.id("sessions"),
    refBlockId: v.id("blocks"),
    zone: v.optional(zoneValidator),
  },
  handler: async (ctx, args) => {
    await requireSessionAccess(ctx, args.sessionId)
    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    // Fetch canonical block to get type, tokens, metadata
    const canonical = await ctx.db.get(args.refBlockId)
    if (!canonical) throw new Error("Referenced block not found")

    const zone = args.zone ?? (canonical.zone as Zone)
    const position = await getNextPosition(ctx, args.sessionId, zone)
    const now = Date.now()

    await ctx.db.patch(args.sessionId, { updatedAt: now })

    return await ctx.db.insert("blocks", {
      sessionId: args.sessionId,
      content: "", // Empty — content comes from canonical
      type: canonical.type,
      zone,
      position,
      createdAt: now,
      updatedAt: now,
      refBlockId: args.refBlockId,
      tokens: canonical.tokens,
      originalTokens: canonical.originalTokens,
      tokenModel: canonical.tokenModel,
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

    // Check session access
    await requireSessionAccess(ctx, block.sessionId)

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

// Move a block to a different zone AND set its position in one mutation.
// Avoids two-step move+reorder which causes intermediate renders.
export const moveAndReorder = mutation({
  args: {
    id: v.id("blocks"),
    zone: zoneValidator,
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    if (!block) throw new Error("Block not found")

    await requireSessionAccess(ctx, block.sessionId)

    const now = Date.now()

    await ctx.db.patch(args.id, {
      zone: args.zone,
      position: args.newPosition,
      updatedAt: now,
    })

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

    // Check session access
    await requireSessionAccess(ctx, block.sessionId)

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

    // Check session access
    await requireSessionAccess(ctx, block.sessionId)

    const now = Date.now()

    // If this is a linked block, update the canonical instead
    let targetId = args.id
    if (block.refBlockId) {
      const canonical = await ctx.db.get(block.refBlockId)
      if (!canonical) throw new Error("Canonical block not found")
      targetId = canonical._id
    }

    const updates: {
      content?: string
      type?: string
      updatedAt: number
      tokens?: number
      tokenModel?: string
      contentHash?: string
    } = {
      updatedAt: now,
    }

    if (args.content !== undefined) {
      updates.content = args.content
      // Recount tokens when content changes
      updates.tokens = countTokens(args.content)
      updates.tokenModel = DEFAULT_TOKEN_MODEL
      updates.contentHash = computeContentHash(args.content)
    }
    if (args.type !== undefined) {
      updates.type = args.type
    }

    await ctx.db.patch(targetId, updates)

    // If we updated a canonical block through a ref, also update all referencing blocks' tokens
    if (block.refBlockId && args.content !== undefined) {
      const refs = await ctx.db
        .query("blocks")
        .filter((q) => q.eq(q.field("refBlockId"), block.refBlockId))
        .collect()
      for (const ref of refs) {
        await ctx.db.patch(ref._id, {
          tokens: updates.tokens,
          tokenModel: updates.tokenModel,
          updatedAt: now,
        })
      }
    }

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
      // Check session access
      await requireSessionAccess(ctx, block.sessionId)

      // Promote any blocks that reference this one (prevent dangling refs)
      const referencingBlocks = await ctx.db
        .query("blocks")
        .filter((q) => q.eq(q.field("refBlockId"), args.id))
        .collect()
      for (const ref of referencingBlocks) {
        await ctx.db.patch(ref._id, {
          content: block.content,
          refBlockId: undefined,
          tokens: block.tokens,
          originalTokens: block.originalTokens,
          tokenModel: block.tokenModel,
        })
      }

      // Update session's updatedAt before deleting
      await ctx.db.patch(block.sessionId, { updatedAt: Date.now() })
    }
    await ctx.db.delete(args.id)
  },
})

// Toggle draft status on a block
export const toggleDraft = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    if (!block) throw new Error("Block not found")

    await requireSessionAccess(ctx, block.sessionId)

    const now = Date.now()
    await ctx.db.patch(args.id, {
      isDraft: block.isDraft ? undefined : true,
      updatedAt: now,
    })
    await ctx.db.patch(block.sessionId, { updatedAt: now })

    return args.id
  },
})

// Unlink a referenced block — copy canonical content and make it a regular block
export const unlink = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    if (!block) throw new Error("Block not found")
    if (!block.refBlockId) throw new Error("Block is not linked")

    await requireSessionAccess(ctx, block.sessionId)

    const canonical = await ctx.db.get(block.refBlockId)
    const content = canonical?.content ?? ""
    const tokens = canonical?.tokens ?? countTokens(content)

    await ctx.db.patch(args.id, {
      content,
      refBlockId: undefined,
      tokens,
      originalTokens: tokens,
      tokenModel: DEFAULT_TOKEN_MODEL,
      updatedAt: Date.now(),
    })
  },
})

// ============ Compression mutations ============

/**
 * Compress a single block in-place.
 * Replaces the block's content with compressed version and updates metadata.
 */
export const compress = mutation({
  args: {
    blockId: v.id("blocks"),
    compressedContent: v.string(),
    originalTokens: v.number(),
    compressedTokens: v.number(),
    compressionRatio: v.number(),
    strategy: v.string(),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.blockId)
    if (!block) throw new Error("Block not found")
    if (block.refBlockId) throw new Error("Cannot compress a linked block — unlink first")

    // Check session access
    await requireSessionAccess(ctx, block.sessionId)

    const now = Date.now()

    // Update block with compressed content and metadata
    await ctx.db.patch(args.blockId, {
      // Replace content with compressed version
      content: args.compressedContent,

      // Compression metadata
      isCompressed: true,
      compressionStrategy: args.strategy,
      compressionRatio: args.compressionRatio,
      compressedAt: now,

      // Token tracking - keep originalTokens, update current tokens
      tokens: args.compressedTokens,
      // If originalTokens wasn't set, set it now
      originalTokens: block.originalTokens || args.originalTokens,

      updatedAt: now,
    })

    // Update session's updatedAt
    await ctx.db.patch(block.sessionId, { updatedAt: now })

    return { success: true, blockId: args.blockId }
  },
})

/**
 * Compress and merge multiple blocks into a single compressed block.
 * Creates a new block with merged content and deletes the original blocks.
 */
export const compressAndMerge = mutation({
  args: {
    blockIds: v.array(v.id("blocks")),
    compressedContent: v.string(),
    originalTokens: v.number(),
    compressedTokens: v.number(),
    compressionRatio: v.number(),
    strategy: v.string(),
    targetZone: zoneValidator,
    targetType: v.string(),
    targetPosition: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.blockIds.length === 0) {
      throw new Error("No blocks to merge")
    }

    // Verify all blocks exist and get session
    const blocks = await Promise.all(args.blockIds.map((id) => ctx.db.get(id)))

    const firstBlock = blocks[0]
    if (!firstBlock) throw new Error("First block not found")

    // Check session access
    await requireSessionAccess(ctx, firstBlock.sessionId)

    // Verify all blocks belong to same session
    const sessionId = firstBlock.sessionId
    for (const block of blocks) {
      if (!block) throw new Error("Block not found")
      if (block.sessionId !== sessionId) {
        throw new Error("All blocks must belong to same session")
      }
    }

    const now = Date.now()

    // Create new merged block
    const newBlockId = await ctx.db.insert("blocks", {
      sessionId,
      content: args.compressedContent,
      zone: args.targetZone,
      type: args.targetType,
      position: args.targetPosition,

      // Compression metadata
      isCompressed: true,
      compressionStrategy: args.strategy,
      compressionRatio: args.compressionRatio,
      compressedAt: now,
      mergedFromCount: args.blockIds.length,

      // Token tracking
      tokens: args.compressedTokens,
      originalTokens: args.originalTokens,
      tokenModel: DEFAULT_TOKEN_MODEL,

      createdAt: now,
      updatedAt: now,
    })

    // Delete all original blocks
    await Promise.all(args.blockIds.map((id) => ctx.db.delete(id)))

    // Update session's updatedAt
    await ctx.db.patch(sessionId, { updatedAt: now })

    return {
      success: true,
      newBlockId,
      blocksDeleted: args.blockIds.length,
    }
  },
})
