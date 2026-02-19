import { query, mutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"
import { getOptionalUserId, requireSessionAccess } from "./lib/auth"

// ============ Helper Functions ============

/**
 * Before deleting a session's blocks, promote any references to them.
 * Copies canonical content into referencing blocks and clears their refBlockId.
 */
async function promoteReferencesForSession(
  ctx: MutationCtx,
  sessionId: Id<"sessions">
) {
  const sessionBlocks = await ctx.db
    .query("blocks")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect()

  for (const block of sessionBlocks) {
    const refs = await ctx.db
      .query("blocks")
      .filter((q) => q.eq(q.field("refBlockId"), block._id))
      .collect()
    for (const ref of refs) {
      await ctx.db.patch(ref._id, {
        content: block.content,
        refBlockId: undefined,
        tokens: block.tokens,
        originalTokens: block.originalTokens,
        tokenModel: block.tokenModel,
      })
    }
  }
}

/**
 * Cascade delete all data for given session IDs.
 * Uses bulk fetches to avoid N+1 queries.
 *
 * Pattern: Fetch all related data ONCE, then filter and delete.
 * This is O(1) queries + O(N) deletes, not O(N) queries + O(N) deletes.
 */
async function cascadeDeleteSessions(
  ctx: MutationCtx,
  sessionIds: Set<Id<"sessions">>
): Promise<{ deletedBlocks: number; deletedSnapshots: number; deletedGenerations: number }> {
  let deletedBlocks = 0
  let deletedSnapshots = 0
  let deletedGenerations = 0

  // Promote references for all sessions being deleted
  for (const sessionId of sessionIds) {
    await promoteReferencesForSession(ctx, sessionId)
  }

  // Bulk fetch all related data (3 queries total, regardless of session count)
  const allBlocks = await ctx.db.query("blocks").collect()
  const allSnapshots = await ctx.db.query("snapshots").collect()
  const allGenerations = await ctx.db.query("generations").collect()

  // Filter and delete blocks
  for (const block of allBlocks) {
    if (sessionIds.has(block.sessionId)) {
      await ctx.db.delete(block._id)
      deletedBlocks++
    }
  }

  // Filter and delete snapshots
  for (const snapshot of allSnapshots) {
    if (sessionIds.has(snapshot.sessionId)) {
      await ctx.db.delete(snapshot._id)
      deletedSnapshots++
    }
  }

  // Filter and delete generations
  for (const generation of allGenerations) {
    if (sessionIds.has(generation.sessionId)) {
      await ctx.db.delete(generation._id)
      deletedGenerations++
    }
  }

  return { deletedBlocks, deletedSnapshots, deletedGenerations }
}

// ============ Queries ============

// List all sessions for the current user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx)

    // If authenticated, show only user's sessions
    // If not authenticated, show sessions without userId (legacy/anonymous)
    const sessions = await ctx.db.query("sessions").order("desc").collect()

    if (userId) {
      return sessions.filter((s) => s.userId === userId || !s.userId)
    }

    // Unauthenticated users see only sessions without userId
    return sessions.filter((s) => !s.userId)
  },
})

// Get a single session by ID (with access control)
export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id)
    if (!session) return null

    // Check access
    const userId = await getOptionalUserId(ctx)
    if (session.userId && session.userId !== userId) {
      return null // User doesn't have access
    }

    return session
  },
})

// ============ Mutations ============

// Create a new session
export const create = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx)
    const now = Date.now()
    return await ctx.db.insert("sessions", {
      userId: userId ?? undefined,
      name: args.name,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Update a session (e.g., rename, system prompt)
export const update = mutation({
  args: {
    id: v.id("sessions"),
    name: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSessionAccess(ctx, args.id)

    const session = await ctx.db.get(args.id)
    if (!session) throw new Error("Session not found")

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name
    if (args.systemPrompt !== undefined) updates.systemPrompt = args.systemPrompt

    await ctx.db.patch(args.id, updates)
    return args.id
  },
})

// Delete a session and all its blocks and snapshots
export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireSessionAccess(ctx, args.id)

    // Promote references to blocks in this session before deleting them
    await promoteReferencesForSession(ctx, args.id)

    // Delete all blocks in this session
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect()
    for (const block of blocks) {
      await ctx.db.delete(block._id)
    }

    // Delete all snapshots for this session
    const snapshots = await ctx.db
      .query("snapshots")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect()
    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id)
    }

    // Delete all generations for this session
    const generations = await ctx.db
      .query("generations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect()
    for (const generation of generations) {
      await ctx.db.delete(generation._id)
    }

    // Delete the session itself
    await ctx.db.delete(args.id)
  },
})

// Delete all sessions for the current user (and their blocks, snapshots, generations)
// Uses bulk fetches to avoid N+1 queries
export const removeAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx)

    const allSessions = await ctx.db.query("sessions").collect()

    // Filter to only sessions the user owns or legacy sessions (no userId)
    const sessions = userId
      ? allSessions.filter((s) => s.userId === userId || !s.userId)
      : allSessions.filter((s) => !s.userId)

    const sessionIds = new Set(sessions.map((s) => s._id))

    // Cascade delete using bulk fetches (avoids N+1)
    const { deletedBlocks, deletedSnapshots, deletedGenerations } =
      await cascadeDeleteSessions(ctx, sessionIds)

    // Delete filtered sessions
    for (const session of sessions) {
      await ctx.db.delete(session._id)
    }

    return {
      deletedSessions: sessions.length,
      deletedBlocks,
      deletedSnapshots,
      deletedGenerations,
    }
  },
})

// Delete all sessions matching a name for current user (and their blocks, snapshots, generations)
// Uses bulk fetches to avoid N+1 queries
export const removeByName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx)

    const allSessions = await ctx.db.query("sessions").collect()

    // Filter to user's sessions (or legacy) that match the name
    const matching = allSessions.filter((s) => {
      const isOwned = userId ? (s.userId === userId || !s.userId) : !s.userId
      return isOwned && s.name === args.name
    })

    if (matching.length === 0) {
      return { deletedSessions: 0, deletedBlocks: 0, deletedSnapshots: 0, deletedGenerations: 0 }
    }

    const sessionIds = new Set(matching.map((s) => s._id))

    // Cascade delete using bulk fetches (avoids N+1)
    const { deletedBlocks, deletedSnapshots, deletedGenerations } =
      await cascadeDeleteSessions(ctx, sessionIds)

    // Delete matching sessions
    for (const session of matching) {
      await ctx.db.delete(session._id)
    }

    return {
      deletedSessions: matching.length,
      deletedBlocks,
      deletedSnapshots,
      deletedGenerations,
    }
  },
})

// Clear all blocks from a session (keep the session itself)
export const clear = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireSessionAccess(ctx, args.id)

    const session = await ctx.db.get(args.id)
    if (!session) throw new Error("Session not found")

    // Promote references to blocks in this session before clearing them
    await promoteReferencesForSession(ctx, args.id)

    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect()

    for (const block of blocks) {
      await ctx.db.delete(block._id)
    }

    await ctx.db.patch(args.id, { updatedAt: Date.now() })

    return { deletedBlocks: blocks.length }
  },
})

// ============ Workflow Context ============

/**
 * Get workflow context for a session.
 * Returns null if the session is not part of a workflow.
 */
export const getWorkflowContext = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId)
    if (!session || !session.projectId || session.stepNumber === undefined) {
      return null
    }

    // Check access
    const userId = await getOptionalUserId(ctx)
    if (session.userId && session.userId !== userId) {
      return null
    }

    const project = await ctx.db.get(session.projectId)
    if (!project || !project.workflowId) {
      return null
    }

    const workflow = await ctx.db.get(project.workflowId)
    if (!workflow) {
      return null
    }

    const currentStepIndex = session.stepNumber
    const totalSteps = workflow.steps.length
    const hasNextStep = currentStepIndex < totalSteps - 1
    const currentStep = workflow.steps[currentStepIndex]
    const nextStep = hasNextStep ? workflow.steps[currentStepIndex + 1] : null

    // Check if next step session already exists
    let nextStepSessionId: Id<"sessions"> | null = null
    if (hasNextStep) {
      const projectSessions = await ctx.db
        .query("sessions")
        .withIndex("by_project", (q) => q.eq("projectId", session.projectId!))
        .collect()
      const nextStepSession = projectSessions.find(
        (s) => s.stepNumber === currentStepIndex + 1
      )
      nextStepSessionId = nextStepSession?._id ?? null
    }

    return {
      projectId: session.projectId,
      projectName: project.name,
      workflowId: project.workflowId,
      workflowName: workflow.name,
      currentStepIndex,
      currentStepName: currentStep?.name ?? `Step ${currentStepIndex + 1}`,
      totalSteps,
      hasNextStep,
      nextStepName: nextStep?.name ?? null,
      nextStepSessionId,
    }
  },
})

/**
 * Go to the next workflow step.
 * Creates the next step session if it doesn't exist, or returns the existing one.
 */
export const goToNextStep = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireSessionAccess(ctx, args.sessionId)

    const session = await ctx.db.get(args.sessionId)
    if (!session || !session.projectId || session.stepNumber === undefined) {
      throw new Error("Session is not part of a workflow")
    }

    const project = await ctx.db.get(session.projectId)
    if (!project || !project.workflowId) {
      throw new Error("Project not found or not linked to a workflow")
    }

    const workflow = await ctx.db.get(project.workflowId)
    if (!workflow) {
      throw new Error("Workflow not found")
    }

    const currentStepIndex = session.stepNumber
    const nextStepIndex = currentStepIndex + 1

    if (nextStepIndex >= workflow.steps.length) {
      throw new Error("Already at the last step")
    }

    // Check if next step session already exists
    const projectSessions = await ctx.db
      .query("sessions")
      .withIndex("by_project", (q) => q.eq("projectId", session.projectId!))
      .collect()
    const existingNextSession = projectSessions.find(
      (s) => s.stepNumber === nextStepIndex
    )

    if (existingNextSession) {
      // Return existing session
      return { sessionId: existingNextSession._id, created: false }
    }

    // Create new session for the next step
    const nextStep = workflow.steps[nextStepIndex]
    const now = Date.now()
    const userId = await getOptionalUserId(ctx)

    const newSessionId = await ctx.db.insert("sessions", {
      userId: userId ?? undefined,
      name: `${project.name} - ${nextStep.name}`,
      projectId: session.projectId,
      stepNumber: nextStepIndex,
      createdAt: now,
      updatedAt: now,
    })

    // Carry forward blocks from current session if configured
    if (nextStep.carryForwardZones && nextStep.carryForwardZones.length > 0) {
      const currentBlocks = await ctx.db
        .query("blocks")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect()

      const blocksToCarry = currentBlocks.filter((block) =>
        nextStep.carryForwardZones!.includes(block.zone as "PERMANENT" | "STABLE" | "WORKING")
      )

      for (const block of blocksToCarry) {
        await ctx.db.insert("blocks", {
          sessionId: newSessionId,
          content: block.content,
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
      }
    }

    // Apply template if configured
    if (nextStep.templateId) {
      const template = await ctx.db.get(nextStep.templateId)
      if (template) {
        // Get current max positions per zone (from carried blocks)
        const existingBlocks = await ctx.db
          .query("blocks")
          .withIndex("by_session", (q) => q.eq("sessionId", newSessionId))
          .collect()

        const maxPositions: Record<string, number> = { PERMANENT: -1, STABLE: -1, WORKING: -1 }
        for (const block of existingBlocks) {
          if (block.position > maxPositions[block.zone]) {
            maxPositions[block.zone] = block.position
          }
        }

        // Create blocks from template (after carried blocks)
        for (const templateBlock of template.blocks) {
          const zone = templateBlock.zone
          maxPositions[zone]++
          await ctx.db.insert("blocks", {
            sessionId: newSessionId,
            content: templateBlock.content,
            type: templateBlock.type,
            zone: templateBlock.zone,
            position: maxPositions[zone],
            createdAt: now,
            updatedAt: now,
            metadata: templateBlock.metadata,
          })
        }
      }
    }

    // Update project's current step
    await ctx.db.patch(session.projectId, {
      currentStep: nextStepIndex,
      updatedAt: now,
    })

    return { sessionId: newSessionId, created: true }
  },
})
