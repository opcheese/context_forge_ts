/**
 * Memory Schemas — per-project memory type definitions.
 *
 * Each project gets a single memorySchemas document that lists the
 * available memory types (e.g., "decision", "character", "tension").
 * Starter templates provide sensible defaults for common project types.
 */

import { mutation, query, internalQuery } from "./_generated/server"
import { v } from "convex/values"
import { canAccessProject } from "./lib/auth"

// ============ Starter Templates ============

type MemoryType = { name: string; color: string; icon: string }

export const STARTER_TEMPLATES: Record<string, MemoryType[]> = {
  general: [
    { name: "note", color: "#6B7280", icon: "📝" },
    { name: "decision", color: "#3B82F6", icon: "⚖️" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
  ],
  fiction: [
    { name: "character", color: "#8B5CF6", icon: "🧑" },
    { name: "place", color: "#10B981", icon: "🏔️" },
    { name: "lore_rule", color: "#F59E0B", icon: "📜" },
    { name: "plot_thread", color: "#EC4899", icon: "🧵" },
    { name: "timeline", color: "#6366F1", icon: "📅" },
    { name: "voice_note", color: "#14B8A6", icon: "🎤" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
  ],
  pm: [
    { name: "learning", color: "#10B981", icon: "💡" },
    { name: "decision", color: "#3B82F6", icon: "⚖️" },
    { name: "stakeholder", color: "#8B5CF6", icon: "👤" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
  ],
  "game-design": [
    { name: "lore_rule", color: "#F59E0B", icon: "📜" },
    { name: "mechanic", color: "#3B82F6", icon: "⚙️" },
    { name: "conflict_resolution", color: "#EC4899", icon: "🤝" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
  ],
  "system-architecture": [
    { name: "service", color: "#3B82F6", icon: "🔧" },
    { name: "event", color: "#10B981", icon: "📡" },
    { name: "decision", color: "#6366F1", icon: "⚖️" },
    { name: "constraint", color: "#F59E0B", icon: "🚧" },
    { name: "infra_pattern", color: "#8B5CF6", icon: "🏗️" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
    { name: "squad_context", color: "#14B8A6", icon: "👥" },
  ],
  dev: [
    { name: "decision", color: "#3B82F6", icon: "⚖️" },
    { name: "constraint", color: "#F59E0B", icon: "🚧" },
    { name: "pattern", color: "#8B5CF6", icon: "🧩" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
  ],
}

// ============ Queries ============

/**
 * Get the memory schema for a project.
 */
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) return null

    return await ctx.db
      .query("memorySchemas")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first()
  },
})

/**
 * List available starter templates with their type counts and type names.
 */
export const listTemplates = query({
  args: {},
  handler: async () => {
    return Object.entries(STARTER_TEMPLATES).map(([name, types]) => ({
      name,
      typeCount: types.length,
      typeNames: types.map((t) => t.name),
    }))
  },
})

// ============ Internal Queries ============

/**
 * Get the memory schema for a project (bypasses auth for server-side actions).
 */
export const getByProjectInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memorySchemas")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first()
  },
})

// ============ Mutations ============

/**
 * Create a memory schema from a starter template.
 * Deletes any existing schema for the project first.
 */
export const createFromTemplate = mutation({
  args: {
    projectId: v.id("projects"),
    templateName: v.string(),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) {
      throw new Error("Project not found or access denied")
    }

    const template = STARTER_TEMPLATES[args.templateName]
    if (!template) {
      throw new Error(`Unknown template: ${args.templateName}`)
    }

    // Delete existing schema if any
    const existing = await ctx.db
      .query("memorySchemas")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first()
    if (existing) {
      await ctx.db.delete(existing._id)
    }

    const now = Date.now()
    return await ctx.db.insert("memorySchemas", {
      projectId: args.projectId,
      types: template,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update the types array of a memory schema.
 */
export const updateTypes = mutation({
  args: {
    schemaId: v.id("memorySchemas"),
    types: v.array(
      v.object({
        name: v.string(),
        color: v.string(),
        icon: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const schema = await ctx.db.get(args.schemaId)
    if (!schema) {
      throw new Error("Memory schema not found")
    }

    const hasAccess = await canAccessProject(ctx, schema.projectId)
    if (!hasAccess) {
      throw new Error("Project not found or access denied")
    }

    await ctx.db.patch(args.schemaId, {
      types: args.types,
      updatedAt: Date.now(),
    })

    return args.schemaId
  },
})
