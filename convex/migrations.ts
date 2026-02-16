/**
 * Migration helpers — internal functions callable only via admin auth.
 *
 * Used by scripts/migrate-workflow.mjs to copy workflows + templates
 * between Convex deployments without user auth context.
 */

import { internalMutation, internalQuery } from "./_generated/server"
import { v } from "convex/values"
import { zoneValidator } from "./lib/validators"

const skillMetadataValidator = v.object({
  skillName: v.string(),
  skillDescription: v.optional(v.string()),
  sourceType: v.union(v.literal("local"), v.literal("upload"), v.literal("url")),
  sourceRef: v.optional(v.string()),
  parentSkillName: v.optional(v.string()),
})

const blockValidator = v.object({
  content: v.string(),
  type: v.string(),
  zone: zoneValidator,
  position: v.number(),
  metadata: v.optional(skillMetadataValidator),
})

/**
 * Get a workflow by ID without auth checks.
 */
export const getWorkflow = internalQuery({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workflowId)
  },
})

/**
 * Get a template by ID without auth checks.
 */
export const getTemplate = internalQuery({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.templateId)
  },
})

/**
 * Create a template from migration data (no auth required).
 */
export const createTemplate = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    blocks: v.array(blockValidator),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("templates", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      blocks: args.blocks,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Create a workflow from migration data (no auth required).
 */
export const createWorkflow = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    steps: v.array(
      v.object({
        templateId: v.optional(v.id("templates")),
        name: v.string(),
        description: v.optional(v.string()),
        carryForwardZones: v.optional(
          v.array(v.union(v.literal("PERMANENT"), v.literal("STABLE"), v.literal("WORKING")))
        ),
      })
    ),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("workflows", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      steps: args.steps,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Link a template to a workflow (set workflowId + stepOrder).
 */
export const linkTemplateToWorkflow = internalMutation({
  args: {
    templateId: v.id("templates"),
    workflowId: v.id("workflows"),
    stepOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.templateId, {
      workflowId: args.workflowId,
      stepOrder: args.stepOrder,
      updatedAt: Date.now(),
    })
  },
})

/**
 * List all users (for --to-user auto-detection).
 */
export const listUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").take(10)
  },
})
