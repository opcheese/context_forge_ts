/**
 * Testing utilities for E2E tests.
 *
 * These functions are only meant to be used in development/testing.
 * The HTTP endpoint checks for a test environment before allowing reset.
 */

import { v } from "convex/values"
import { internalMutation, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"

// List all sessions (for testing/admin)
export const listAllSessions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sessions").collect()
  },
})

// List all snapshots (for testing/admin)
export const listAllSnapshots = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("snapshots").collect()
  },
})

// Reset test blocks - for use in E2E tests
// Deletes blocks where:
// - testData === true, OR
// - content starts with "E2E Test:" (for UI-created blocks)
export const resetBlocks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const blocks = await ctx.runQuery(internal.blocks.listAll)
    const testBlocks = blocks.filter(
      (b) => b.testData === true || b.content.startsWith("E2E Test:")
    )
    for (const block of testBlocks) {
      await ctx.runMutation(internal.blocks.removeInternal, { id: block._id })
    }
    return { deleted: testBlocks.length }
  },
})

// Reset test sessions - deletes sessions named "Test Session" or starting with "E2E"
export const resetSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.runQuery(internal.testing.listAllSessions)
    const testSessions = sessions.filter(
      (s) => s.name === "Test Session" || s.name?.startsWith("E2E")
    )

    let deletedBlocks = 0
    let deletedSnapshots = 0

    for (const session of testSessions) {
      // Delete all blocks in this session
      const blocks = await ctx.db
        .query("blocks")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect()
      for (const block of blocks) {
        await ctx.db.delete(block._id)
        deletedBlocks++
      }

      // Delete all snapshots for this session
      const snapshots = await ctx.db
        .query("snapshots")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect()
      for (const snapshot of snapshots) {
        await ctx.db.delete(snapshot._id)
        deletedSnapshots++
      }

      // Delete the session
      await ctx.db.delete(session._id)
    }

    return {
      deletedSessions: testSessions.length,
      deletedBlocks,
      deletedSnapshots,
    }
  },
})

// Reset all auth data - clears users, sessions, accounts, etc.
export const resetAuth = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "authSessions",
      "authAccounts",
      "authRefreshTokens",
      "authVerificationCodes",
      "authVerifiers",
      "users",
    ]

    const results: Record<string, number> = {}

    for (const table of tables) {
      try {
        // @ts-expect-error - dynamic table access
        const docs = await ctx.db.query(table).collect()
        for (const doc of docs) {
          await ctx.db.delete(doc._id)
        }
        results[table] = docs.length
      } catch {
        results[table] = 0 // Table might not exist
      }
    }

    return results
  },
})

// Clean up all data for a user by email. Leaves the user account intact.
// Usage: npx convex run testing:cleanupUserData '{"email":"demo2@contextforge.com"}'
export const cleanupUserData = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    // Find user by email via authAccounts
    const accounts = await ctx.db.query("authAccounts").collect()
    const account = accounts.find(
      (a) => (a as any).providerAccountId === email
    )
    if (!account) {
      return { error: `No account found for ${email}` }
    }

    const userId = account.userId

    // Delete all sessions owned by this user + cascade
    const sessions = await ctx.db.query("sessions").collect()
    const userSessions = sessions.filter((s) => s.userId === userId)

    let deletedBlocks = 0
    let deletedSnapshots = 0
    let deletedGenerations = 0

    for (const session of userSessions) {
      const blocks = await ctx.db
        .query("blocks")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect()
      for (const block of blocks) {
        await ctx.db.delete(block._id)
        deletedBlocks++
      }

      const snapshots = await ctx.db
        .query("snapshots")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect()
      for (const snapshot of snapshots) {
        await ctx.db.delete(snapshot._id)
        deletedSnapshots++
      }

      const generations = await ctx.db
        .query("generations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect()
      for (const generation of generations) {
        await ctx.db.delete(generation._id)
        deletedGenerations++
      }

      await ctx.db.delete(session._id)
    }

    // Delete templates, projects, workflows owned by user
    let deletedTemplates = 0
    let deletedProjects = 0
    let deletedWorkflows = 0

    const templates = await ctx.db.query("templates").collect()
    for (const t of templates.filter((t) => t.userId === userId)) {
      await ctx.db.delete(t._id)
      deletedTemplates++
    }

    const projects = await ctx.db.query("projects").collect()
    for (const p of projects.filter((p) => p.userId === userId)) {
      await ctx.db.delete(p._id)
      deletedProjects++
    }

    const workflows = await ctx.db.query("workflows").collect()
    for (const w of workflows.filter((w) => w.userId === userId)) {
      await ctx.db.delete(w._id)
      deletedWorkflows++
    }

    return {
      userId,
      deletedSessions: userSessions.length,
      deletedBlocks,
      deletedSnapshots,
      deletedGenerations,
      deletedTemplates,
      deletedProjects,
      deletedWorkflows,
    }
  },
})

// Reset all test data
export const resetAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Reset test sessions (also deletes their blocks and snapshots)
    const sessionResult = await ctx.runMutation(internal.testing.resetSessions)

    // Reset any remaining test blocks (orphaned or from non-test sessions)
    const blockResult = await ctx.runMutation(internal.testing.resetBlocks)

    return {
      deleted: blockResult.deleted + sessionResult.deletedBlocks,
      deletedSessions: sessionResult.deletedSessions,
      deletedSnapshots: sessionResult.deletedSnapshots,
    }
  },
})
