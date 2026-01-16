/**
 * Testing utilities for E2E tests.
 *
 * These functions are only meant to be used in development/testing.
 * The HTTP endpoint checks for a test environment before allowing reset.
 */

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
