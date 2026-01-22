/**
 * Templates - Reusable session configurations.
 *
 * Templates capture a session's state (blocks + system prompt) so it can be
 * reapplied to create consistent starting points for workflows.
 */

import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { zoneValidator } from "./lib/validators"

/**
 * List all templates.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("templates").order("desc").collect()
  },
})

/**
 * Get a template by ID.
 */
export const get = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
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
    const now = Date.now()
    return await ctx.db.insert("templates", {
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
 */
export const createFromSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the session
    const session = await ctx.db.get(args.sessionId)
    if (!session) {
      throw new Error("Session not found")
    }

    // Get all blocks in the session
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()

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
    }))

    const now = Date.now()
    return await ctx.db.insert("templates", {
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
    let maxPositions: Record<string, number> = { PERMANENT: -1, STABLE: -1, WORKING: -1 }
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
    await ctx.db.delete(args.id)
  },
})

/**
 * List templates for a specific workflow.
 */
export const listByWorkflow = query({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("templates")
      .withIndex("by_workflow", (q) => q.eq("workflowId", args.workflowId))
      .collect()
  },
})
