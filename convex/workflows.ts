/**
 * Workflows - Ordered sequences of templates for document creation pipelines.
 *
 * Workflows define a multi-step process where each step uses a template.
 * Projects can be created from workflows and progress through steps.
 */

import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import {
  getOptionalUserId,
  canAccessWorkflow,
  canAccessProject,
  requireSessionAccess,
} from "./lib/auth"

const zoneArray = v.array(
  v.union(v.literal("PERMANENT"), v.literal("STABLE"), v.literal("WORKING"))
)

const stepValidator = v.object({
  templateId: v.optional(v.id("templates")),
  name: v.string(),
  description: v.optional(v.string()),
  carryForwardZones: v.optional(zoneArray),
})

/**
 * List all workflows for the current user.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx)

    const allWorkflows = await ctx.db.query("workflows").order("desc").collect()

    // Filter to user's workflows or legacy workflows
    if (userId) {
      return allWorkflows.filter((w) => w.userId === userId || !w.userId)
    }

    return allWorkflows.filter((w) => !w.userId)
  },
})

/**
 * Get a workflow by ID with enriched template data.
 */
export const get = query({
  args: { id: v.id("workflows") },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessWorkflow(ctx, args.id)
    if (!hasAccess) return null

    const workflow = await ctx.db.get(args.id)
    if (!workflow) return null

    // Enrich steps with template details
    const enrichedSteps = await Promise.all(
      workflow.steps.map(async (step) => {
        let template = null
        if (step.templateId) {
          template = await ctx.db.get(step.templateId)
        }
        return {
          ...step,
          template,
        }
      })
    )

    return {
      ...workflow,
      steps: enrichedSteps,
    }
  },
})

/**
 * Create a new workflow.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    steps: v.optional(v.array(stepValidator)),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx)
    const now = Date.now()
    return await ctx.db.insert("workflows", {
      userId: userId ?? undefined,
      name: args.name,
      description: args.description,
      steps: args.steps ?? [],
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update workflow metadata.
 */
export const update = mutation({
  args: {
    id: v.id("workflows"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessWorkflow(ctx, args.id)
    if (!hasAccess) {
      throw new Error("Workflow not found or access denied")
    }

    const workflow = await ctx.db.get(args.id)
    if (!workflow) {
      throw new Error("Workflow not found")
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description

    await ctx.db.patch(args.id, updates)
    return args.id
  },
})

/**
 * Delete a workflow.
 */
export const remove = mutation({
  args: { id: v.id("workflows") },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessWorkflow(ctx, args.id)
    if (!hasAccess) {
      throw new Error("Workflow not found or access denied")
    }

    // Unlink any projects using this workflow
    const projects = await ctx.db.query("projects").collect()
    for (const project of projects) {
      if (project.workflowId === args.id) {
        await ctx.db.patch(project._id, { workflowId: undefined })
      }
    }

    await ctx.db.delete(args.id)
  },
})

/**
 * Add a step to a workflow.
 */
export const addStep = mutation({
  args: {
    workflowId: v.id("workflows"),
    name: v.string(),
    description: v.optional(v.string()),
    templateId: v.optional(v.id("templates")),
    carryForwardZones: v.optional(zoneArray),
    position: v.optional(v.number()), // Insert at position (default: end)
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessWorkflow(ctx, args.workflowId)
    if (!hasAccess) {
      throw new Error("Workflow not found or access denied")
    }

    const workflow = await ctx.db.get(args.workflowId)
    if (!workflow) {
      throw new Error("Workflow not found")
    }

    const newStep = {
      name: args.name,
      description: args.description,
      templateId: args.templateId,
      carryForwardZones: args.carryForwardZones,
    }

    const steps = [...workflow.steps]
    const position = args.position ?? steps.length
    steps.splice(position, 0, newStep)

    await ctx.db.patch(args.workflowId, {
      steps,
      updatedAt: Date.now(),
    })

    return position
  },
})

/**
 * Update a specific step in a workflow.
 */
export const updateStep = mutation({
  args: {
    workflowId: v.id("workflows"),
    stepIndex: v.number(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    templateId: v.optional(v.id("templates")),
    carryForwardZones: v.optional(zoneArray),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessWorkflow(ctx, args.workflowId)
    if (!hasAccess) {
      throw new Error("Workflow not found or access denied")
    }

    const workflow = await ctx.db.get(args.workflowId)
    if (!workflow) {
      throw new Error("Workflow not found")
    }

    if (args.stepIndex < 0 || args.stepIndex >= workflow.steps.length) {
      throw new Error("Invalid step index")
    }

    const steps = [...workflow.steps]
    const step = { ...steps[args.stepIndex] }

    if (args.name !== undefined) step.name = args.name
    if (args.description !== undefined) step.description = args.description
    if (args.templateId !== undefined) step.templateId = args.templateId
    if (args.carryForwardZones !== undefined) step.carryForwardZones = args.carryForwardZones

    steps[args.stepIndex] = step

    await ctx.db.patch(args.workflowId, {
      steps,
      updatedAt: Date.now(),
    })

    return args.stepIndex
  },
})

/**
 * Remove a step from a workflow.
 */
export const removeStep = mutation({
  args: {
    workflowId: v.id("workflows"),
    stepIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessWorkflow(ctx, args.workflowId)
    if (!hasAccess) {
      throw new Error("Workflow not found or access denied")
    }

    const workflow = await ctx.db.get(args.workflowId)
    if (!workflow) {
      throw new Error("Workflow not found")
    }

    if (args.stepIndex < 0 || args.stepIndex >= workflow.steps.length) {
      throw new Error("Invalid step index")
    }

    const steps = workflow.steps.filter((_, i) => i !== args.stepIndex)

    await ctx.db.patch(args.workflowId, {
      steps,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Reorder steps in a workflow.
 */
export const reorderSteps = mutation({
  args: {
    workflowId: v.id("workflows"),
    fromIndex: v.number(),
    toIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessWorkflow(ctx, args.workflowId)
    if (!hasAccess) {
      throw new Error("Workflow not found or access denied")
    }

    const workflow = await ctx.db.get(args.workflowId)
    if (!workflow) {
      throw new Error("Workflow not found")
    }

    const { fromIndex, toIndex } = args
    if (
      fromIndex < 0 ||
      fromIndex >= workflow.steps.length ||
      toIndex < 0 ||
      toIndex >= workflow.steps.length
    ) {
      throw new Error("Invalid step index")
    }

    const steps = [...workflow.steps]
    const [movedStep] = steps.splice(fromIndex, 1)
    steps.splice(toIndex, 0, movedStep)

    await ctx.db.patch(args.workflowId, {
      steps,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Start a new project from a workflow.
 * Creates the project and the first session.
 */
export const startProject = mutation({
  args: {
    workflowId: v.id("workflows"),
    projectName: v.string(),
    projectDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessWorkflow(ctx, args.workflowId)
    if (!hasAccess) {
      throw new Error("Workflow not found or access denied")
    }

    const workflow = await ctx.db.get(args.workflowId)
    if (!workflow) {
      throw new Error("Workflow not found")
    }

    if (workflow.steps.length === 0) {
      throw new Error("Workflow has no steps")
    }

    const userId = await getOptionalUserId(ctx)
    const now = Date.now()
    const firstStep = workflow.steps[0]

    // Create the project
    const projectId = await ctx.db.insert("projects", {
      userId: userId ?? undefined,
      name: args.projectName,
      description: args.projectDescription,
      workflowId: args.workflowId,
      currentStep: 0,
      createdAt: now,
      updatedAt: now,
    })

    // Create the first session
    const sessionId = await ctx.db.insert("sessions", {
      userId: userId ?? undefined,
      name: `${args.projectName} - ${firstStep.name}`,
      projectId,
      stepNumber: 0,
      createdAt: now,
      updatedAt: now,
    })

    // If first step has a template, apply it
    if (firstStep.templateId) {
      const template = await ctx.db.get(firstStep.templateId)
      if (template) {
        // Create blocks from template (including system_prompt blocks)
        for (const blockData of template.blocks) {
          await ctx.db.insert("blocks", {
            sessionId,
            content: blockData.content,
            type: blockData.type,
            zone: blockData.zone,
            position: blockData.position,
            createdAt: now,
            updatedAt: now,
          })
        }
      }
    }

    return { projectId, sessionId }
  },
})

/**
 * Advance to the next step in a workflow.
 * Creates a new session and optionally carries forward blocks.
 */
export const advanceStep = mutation({
  args: {
    projectId: v.id("projects"),
    previousSessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Check access to project and session
    const hasProjectAccess = await canAccessProject(ctx, args.projectId)
    if (!hasProjectAccess) {
      throw new Error("Project not found or access denied")
    }

    await requireSessionAccess(ctx, args.previousSessionId)

    const project = await ctx.db.get(args.projectId)
    if (!project) {
      throw new Error("Project not found")
    }

    if (!project.workflowId) {
      throw new Error("Project is not linked to a workflow")
    }

    const workflow = await ctx.db.get(project.workflowId)
    if (!workflow) {
      throw new Error("Workflow not found")
    }

    const userId = await getOptionalUserId(ctx)
    const currentStep = project.currentStep ?? 0
    const nextStepIndex = currentStep + 1

    if (nextStepIndex >= workflow.steps.length) {
      throw new Error("Already at the last step")
    }

    const nextStep = workflow.steps[nextStepIndex]
    const now = Date.now()

    // Create new session for the next step
    const sessionId = await ctx.db.insert("sessions", {
      userId: userId ?? undefined,
      name: `${project.name} - ${nextStep.name}`,
      projectId: args.projectId,
      stepNumber: nextStepIndex,
      createdAt: now,
      updatedAt: now,
    })

    // Carry forward blocks from previous session if configured
    if (nextStep.carryForwardZones && nextStep.carryForwardZones.length > 0) {
      const previousBlocks = await ctx.db
        .query("blocks")
        .withIndex("by_session", (q) => q.eq("sessionId", args.previousSessionId))
        .collect()

      const blocksToCarry = previousBlocks.filter((block) =>
        nextStep.carryForwardZones!.includes(block.zone as "PERMANENT" | "STABLE" | "WORKING")
      )

      for (const block of blocksToCarry) {
        // Resolve canonical ID — if block is itself a ref, follow the chain
        const canonicalId = block.refBlockId ?? block._id

        if (block.zone === "WORKING") {
          // WORKING: copy content (independent per step)
          const content = block.refBlockId
            ? (await ctx.db.get(block.refBlockId))?.content ?? block.content
            : block.content
          await ctx.db.insert("blocks", {
            sessionId,
            content,
            type: block.type,
            zone: block.zone,
            position: block.position,
            createdAt: now,
            updatedAt: now,
            tokens: block.tokens,
            originalTokens: block.originalTokens,
            tokenModel: block.tokenModel,
            metadata: block.metadata,
          })
        } else {
          // PERMANENT/STABLE: create reference (edits propagate across steps)
          await ctx.db.insert("blocks", {
            sessionId,
            content: "",
            type: block.type,
            zone: block.zone,
            position: block.position,
            createdAt: now,
            updatedAt: now,
            refBlockId: canonicalId,
            tokens: block.tokens,
            originalTokens: block.originalTokens,
            tokenModel: block.tokenModel,
            metadata: block.metadata,
          })
        }
      }
    }

    // Apply template if configured
    if (nextStep.templateId) {
      const template = await ctx.db.get(nextStep.templateId)
      if (template) {
        // Get current max positions per zone (from carried blocks)
        const existingBlocks = await ctx.db
          .query("blocks")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .collect()

        const maxPositions: Record<string, number> = { PERMANENT: -1, STABLE: -1, WORKING: -1 }
        for (const block of existingBlocks) {
          if (block.position > maxPositions[block.zone]) {
            maxPositions[block.zone] = block.position
          }
        }

        // Create blocks from template (including system_prompt blocks, after carried blocks)
        for (const blockData of template.blocks) {
          const position = maxPositions[blockData.zone] + 1 + blockData.position

          await ctx.db.insert("blocks", {
            sessionId,
            content: blockData.content,
            type: blockData.type,
            zone: blockData.zone,
            position,
            createdAt: now,
            updatedAt: now,
            metadata: blockData.metadata,
          })
        }
      }
    }

    // Update project current step
    await ctx.db.patch(args.projectId, {
      currentStep: nextStepIndex,
      updatedAt: now,
    })

    return { sessionId, stepIndex: nextStepIndex }
  },
})

/**
 * Clone an existing workflow.
 */
export const clone = mutation({
  args: {
    workflowId: v.id("workflows"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessWorkflow(ctx, args.workflowId)
    if (!hasAccess) {
      throw new Error("Workflow not found or access denied")
    }

    const workflow = await ctx.db.get(args.workflowId)
    if (!workflow) {
      throw new Error("Workflow not found")
    }

    const userId = await getOptionalUserId(ctx)
    const now = Date.now()
    return await ctx.db.insert("workflows", {
      userId: userId ?? undefined,
      name: args.name,
      description: workflow.description,
      steps: workflow.steps,
      createdAt: now,
      updatedAt: now,
    })
  },
})
