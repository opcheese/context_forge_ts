/**
 * Templates - Reusable session configurations.
 *
 * Templates capture a session's blocks so it can be reapplied to create
 * consistent starting points for workflows.
 */

import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { zoneValidator } from "./lib/validators"
import {
  getOptionalUserId,
  canAccessTemplate,
  requireSessionAccess,
} from "./lib/auth"
import { resolveBlocks } from "./lib/resolve"

/**
 * List all templates for the current user.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx)

    const templates = await ctx.db.query("templates").order("desc").collect()

    // Filter to user's templates or legacy templates (no userId)
    if (userId) {
      return templates.filter((t) => t.userId === userId || !t.userId)
    }

    // Unauthenticated users see only templates without userId
    return templates.filter((t) => !t.userId)
  },
})

/**
 * Get a template by ID.
 */
export const get = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessTemplate(ctx, args.id)
    if (!hasAccess) {
      return null
    }

    return await ctx.db.get(args.id)
  },
})

/**
 * Create a template from scratch.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    blocks: v.array(
      v.object({
        content: v.string(),
        type: v.string(),
        zone: zoneValidator,
        position: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx)
    const now = Date.now()
    return await ctx.db.insert("templates", {
      userId: userId ?? undefined,
      name: args.name,
      description: args.description,
      blocks: args.blocks,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Create a template from an existing session.
 * Snapshots all blocks (including system_prompt blocks).
 * If overwriteTemplateId is provided, updates that template instead of creating a new one.
 */
export const createFromSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    name: v.string(),
    description: v.optional(v.string()),
    overwriteTemplateId: v.optional(v.id("templates")),
  },
  handler: async (ctx, args) => {
    // Check session access
    await requireSessionAccess(ctx, args.sessionId)

    // Get the session
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new Error("Session not found")
    }

    // If overwriting, verify the template exists and user has access
    if (args.overwriteTemplateId) {
      const hasTemplateAccess = await canAccessTemplate(ctx, args.overwriteTemplateId)
      if (!hasTemplateAccess) {
        throw new Error("Template to overwrite not found or access denied")
      }
    }

    // Get all blocks in the session
    const rawBlocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    // Resolve linked block content so templates are self-contained
    const refIds = [...new Set(rawBlocks.filter((b) => b.refBlockId).map((b) => String(b.refBlockId)))]
    const canonicalLookup = new Map<string, Pick<Doc<"blocks">, "content">>()
    await Promise.all(refIds.map(async (id) => {
      const canonical = await ctx.db.get(id as Id<"blocks">)
      if (canonical) canonicalLookup.set(id, { content: canonical.content })
    }))
    const blocks = resolveBlocks(rawBlocks, canonicalLookup)

    // Sort by zone and position for consistent ordering
    blocks.sort((a, b) => {
      if (a.zone !== b.zone) {
        const zoneOrder = { PERMANENT: 0, STABLE: 1, WORKING: 2 }
        return zoneOrder[a.zone as keyof typeof zoneOrder] - zoneOrder[b.zone as keyof typeof zoneOrder]
      }
      return a.position - b.position
    })

    // Snapshot blocks (only the fields we need)
    const blockSnapshots = blocks.map((block) => ({
      content: block.content,
      type: block.type,
      zone: block.zone as "PERMANENT" | "STABLE" | "WORKING",
      position: block.position,
      metadata: block.metadata,
    }))

    const now = Date.now()
    const userId = await getOptionalUserId(ctx)

    // Overwrite existing template or create new one
    if (args.overwriteTemplateId) {
      await ctx.db.patch(args.overwriteTemplateId, {
        name: args.name,
        description: args.description,
        blocks: blockSnapshots,
        updatedAt: now,
      })
      return args.overwriteTemplateId
    }

    return await ctx.db.insert("templates", {
      userId: userId ?? undefined,
      name: args.name,
      description: args.description,
      blocks: blockSnapshots,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Apply a template to a session.
 * Optionally clears existing blocks or merges with them.
 */
export const applyToSession = mutation({
  args: {
    templateId: v.id("templates"),
    sessionId: v.id("sessions"),
    clearExisting: v.optional(v.boolean()), // Default: true
  },
  handler: async (ctx, args) => {
    // Check access to both template and session
    const hasTemplateAccess = await canAccessTemplate(ctx, args.templateId)
    if (!hasTemplateAccess) {
      throw new Error("Template not found or access denied")
    }

    await requireSessionAccess(ctx, args.sessionId)

    const template = await ctx.db.get(args.templateId)
    if (!template) {
      throw new Error("Template not found")
    }

    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new Error("Session not found")
    }

    const clearExisting = args.clearExisting ?? true
    const now = Date.now()

    // Clear existing blocks if requested
    if (clearExisting) {
      const existingBlocks = await ctx.db
        .query("blocks")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect()

      for (const block of existingBlocks) {
        await ctx.db.delete(block._id)
      }
    }

    // Get max position per zone if merging (not clearing)
    const maxPositions: Record<string, number> = { PERMANENT: -1, STABLE: -1, WORKING: -1 }
    if (!clearExisting) {
      const existingBlocks = await ctx.db
        .query("blocks")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect()

      for (const block of existingBlocks) {
        if (block.position > maxPositions[block.zone]) {
          maxPositions[block.zone] = block.position
        }
      }
    }

    // Create blocks from template
    for (const blockData of template.blocks) {
      const position = clearExisting
        ? blockData.position
        : maxPositions[blockData.zone] + 1 + blockData.position

      await ctx.db.insert("blocks", {
        sessionId: args.sessionId,
        content: blockData.content,
        type: blockData.type,
        zone: blockData.zone,
        position,
        createdAt: now,
        updatedAt: now,
        metadata: blockData.metadata,
      })
    }

    // Update session link to template
    await ctx.db.patch(args.sessionId, {
      templateId: args.templateId,
      updatedAt: now,
    })

    return { success: true, blocksCreated: template.blocks.length }
  },
})

/**
 * Update template metadata.
 */
export const update = mutation({
  args: {
    id: v.id("templates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessTemplate(ctx, args.id)
    if (!hasAccess) {
      throw new Error("Template not found or access denied")
    }

    const template = await ctx.db.get(args.id)
    if (!template) {
      throw new Error("Template not found")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description

    await ctx.db.patch(args.id, updates)
    return args.id
  },
})

/**
 * Delete a template.
 */
export const remove = mutation({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessTemplate(ctx, args.id)
    if (!hasAccess) {
      throw new Error("Template not found or access denied")
    }

    await ctx.db.delete(args.id)
  },
})

/**
 * List templates for a specific workflow.
 */
export const listByWorkflow = query({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx)

    const templates = await ctx.db
      .query("templates")
      .withIndex("by_workflow", (q) => q.eq("workflowId", args.workflowId))
      .collect()

    // Filter to user's templates or legacy templates
    if (userId) {
      return templates.filter((t) => t.userId === userId || !t.userId)
    }

    return templates.filter((t) => !t.userId)
  },
})
