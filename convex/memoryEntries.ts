/**
 * Memory Entries — individual memory items within a project.
 *
 * Each entry has a type (from the project's memory schema), a title,
 * content, and tags for filtering/auto-selection.
 */

import { mutation, query, internalQuery } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"
import { canAccessProject } from "./lib/auth"

/**
 * Invalidate Claude sessions for all sessions in a project.
 * Memory is rendered into the system prompt (PERMANENT zone),
 * so any memory change must clear cached SDK sessions.
 */
async function invalidateProjectSessions(
  ctx: MutationCtx,
  projectId: Id<"projects">
) {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect()

  for (const session of sessions) {
    if (session.claudeSessionId) {
      await ctx.db.patch(session._id, { claudeSessionId: undefined })
    }
  }
}

// ============ Queries ============

/**
 * List all memory entries for a project.
 */
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) return []

    return await ctx.db
      .query("memoryEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()
  },
})

/**
 * List memory entries for a project filtered by type.
 */
export const listByType = query({
  args: {
    projectId: v.id("projects"),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) return []

    return await ctx.db
      .query("memoryEntries")
      .withIndex("by_project_type", (q) =>
        q.eq("projectId", args.projectId).eq("type", args.type)
      )
      .collect()
  },
})

/**
 * Get a single memory entry by ID.
 */
export const get = query({
  args: { id: v.id("memoryEntries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id)
    if (!entry) return null

    const hasAccess = await canAccessProject(ctx, entry.projectId)
    if (!hasAccess) return null

    return entry
  },
})

/**
 * Get counts of memory entries per type for a project.
 */
export const countsByType = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) return {}

    const entries = await ctx.db
      .query("memoryEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    const counts: Record<string, number> = {}
    for (const entry of entries) {
      counts[entry.type] = (counts[entry.type] ?? 0) + 1
    }
    return counts
  },
})

// ============ Internal Queries ============

/**
 * List all memory entries for a project (bypasses auth for context assembly).
 */
export const listByProjectInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memoryEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()
  },
})

// ============ Mutations ============

/**
 * Create a new memory entry.
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) {
      throw new Error("Project not found or access denied")
    }

    if (!args.title.trim()) {
      throw new Error("Title cannot be empty")
    }

    const now = Date.now()
    const id = await ctx.db.insert("memoryEntries", {
      projectId: args.projectId,
      type: args.type,
      title: args.title.trim(),
      content: args.content,
      tags: args.tags.map((t) => t.trim().toLowerCase()),
      createdAt: now,
      updatedAt: now,
    })

    await invalidateProjectSessions(ctx, args.projectId)
    return id
  },
})

/**
 * Update a memory entry (partial update).
 */
export const update = mutation({
  args: {
    id: v.id("memoryEntries"),
    type: v.optional(v.string()),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id)
    if (!entry) {
      throw new Error("Memory entry not found")
    }

    const hasAccess = await canAccessProject(ctx, entry.projectId)
    if (!hasAccess) {
      throw new Error("Project not found or access denied")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.type !== undefined) updates.type = args.type
    if (args.title !== undefined) {
      if (!args.title.trim()) {
        throw new Error("Title cannot be empty")
      }
      updates.title = args.title.trim()
    }
    if (args.content !== undefined) updates.content = args.content
    if (args.tags !== undefined) {
      updates.tags = args.tags.map((t) => t.trim().toLowerCase())
    }

    await ctx.db.patch(args.id, updates)
    await invalidateProjectSessions(ctx, entry.projectId)
    return args.id
  },
})

/**
 * Delete a memory entry and clean up any session pins that reference it.
 */
export const remove = mutation({
  args: { id: v.id("memoryEntries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id)
    if (!entry) {
      throw new Error("Memory entry not found")
    }

    const hasAccess = await canAccessProject(ctx, entry.projectId)
    if (!hasAccess) {
      throw new Error("Project not found or access denied")
    }

    // Clean up pinnedMemories in sessions that reference this entry
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_project", (q) => q.eq("projectId", entry.projectId))
      .collect()

    for (const session of sessions) {
      if (session.pinnedMemories && session.pinnedMemories.includes(args.id)) {
        await ctx.db.patch(session._id, {
          pinnedMemories: session.pinnedMemories.filter((id) => id !== args.id),
        })
      }
    }

    await ctx.db.delete(args.id)
    await invalidateProjectSessions(ctx, entry.projectId)
  },
})
