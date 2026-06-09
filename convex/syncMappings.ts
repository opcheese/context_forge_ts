import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { getAuthUserId } from "./auth"
import type { Id } from "./_generated/dataModel"

export const getSyncMapping = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const mapping = await ctx.db
      .query("syncMappings")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", projectId))
      .first()

    if (!mapping) return null

    const blocks = await ctx.db
      .query("syncBlocks")
      .withIndex("by_mapping", (q) => q.eq("syncMappingId", mapping._id))
      .collect()

    return { ...mapping, blocks }
  },
})

export const upsertSyncMapping = mutation({
  args: {
    projectId: v.id("projects"),
    provider: v.union(v.literal("github"), v.literal("gitlab")),
    repoUrl: v.string(),
    branch: v.string(),
    folder: v.string(),
  },
  handler: async (ctx, { projectId, provider, repoUrl, branch, folder }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const existing = await ctx.db
      .query("syncMappings")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", projectId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { provider, repoUrl, branch, folder, lastSyncedAt: Date.now() })
      return existing._id
    }

    return ctx.db.insert("syncMappings", { projectId, userId, provider, repoUrl, branch, folder, lastSyncedAt: Date.now() })
  },
})

export const upsertSyncBlock = mutation({
  args: {
    syncMappingId: v.id("syncMappings"),
    blockId: v.id("blocks"),
    path: v.string(),
  },
  handler: async (ctx, { syncMappingId, blockId, path }) => {
    const block = await ctx.db.get(blockId)
    const syncedContentHash = block?.contentHash ?? undefined

    const existing = await ctx.db
      .query("syncBlocks")
      .withIndex("by_block", (q) => q.eq("blockId", blockId))
      .first()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, { path, syncMappingId, syncedAt: now, syncedContentHash })
      return existing._id
    }

    return ctx.db.insert("syncBlocks", { syncMappingId, blockId, path, syncedAt: now, syncedContentHash })
  },
})

export const removeSyncBlock = mutation({
  args: { blockId: v.id("blocks") },
  handler: async (ctx, { blockId }) => {
    const existing = await ctx.db
      .query("syncBlocks")
      .withIndex("by_block", (q) => q.eq("blockId", blockId))
      .first()
    if (existing) await ctx.db.delete(existing._id)
  },
})

export const setRejectedContent = mutation({
  args: { blockId: v.id("blocks"), content: v.string() },
  handler: async (ctx, { blockId, content }) => {
    const syncBlock = await ctx.db
      .query("syncBlocks")
      .withIndex("by_block", (q) => q.eq("blockId", blockId))
      .first()
    if (syncBlock) await ctx.db.patch(syncBlock._id, { rejectedRemoteContent: content })
  },
})

export const touchLastSyncedAt = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return
    const mapping = await ctx.db
      .query("syncMappings")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", projectId))
      .first()
    if (mapping) await ctx.db.patch(mapping._id, { lastSyncedAt: Date.now() })
  },
})

export const clearRejectedContent = mutation({
  args: { blockId: v.id("blocks") },
  handler: async (ctx, { blockId }) => {
    const syncBlock = await ctx.db
      .query("syncBlocks")
      .withIndex("by_block", (q) => q.eq("blockId", blockId))
      .first()
    if (syncBlock) await ctx.db.patch(syncBlock._id, { rejectedRemoteContent: undefined })
  },
})

export const getSyncMappingBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const session = await ctx.db.get(sessionId)
    if (!session?.projectId) return null

    const mapping = await ctx.db
      .query("syncMappings")
      .withIndex("by_user_project", (q) => q.eq("userId", userId).eq("projectId", session.projectId!))
      .first()

    if (!mapping) return null

    const sessionBlocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect()
    const sessionBlockIds = new Set(sessionBlocks.map((b) => b._id))

    const allSyncBlocks = await ctx.db
      .query("syncBlocks")
      .withIndex("by_mapping", (q) => q.eq("syncMappingId", mapping._id))
      .collect()

    const blocks = allSyncBlocks.filter((sb) => sessionBlockIds.has(sb.blockId))

    return { ...mapping, blocks }
  },
})

