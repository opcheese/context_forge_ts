import { internalMutation } from "../_generated/server"

/**
 * One-time migration: convert isDraft boolean to contextMode enum.
 * Run via: npx convex run migrations/migrateIsDraftToContextMode:migrate
 *
 * - isDraft: true → contextMode: "draft"
 * - isDraft: false/undefined → contextMode removed (defaults to "default")
 * - Also migrates snapshot block arrays
 */
export const migrate = internalMutation({
  handler: async (ctx) => {
    const blocks = await ctx.db.query("blocks").collect()
    let migrated = 0

    for (const block of blocks) {
      const raw = block as Record<string, unknown>
      if (raw.isDraft !== undefined) {
        await ctx.db.patch(block._id, {
          contextMode: raw.isDraft ? ("draft" as const) : undefined,
        })
        migrated++
      }
    }

    // Also migrate snapshots
    const snapshots = await ctx.db.query("snapshots").collect()
    let snapshotsMigrated = 0
    for (const snapshot of snapshots) {
      const needsUpdate = (snapshot.blocks as Array<Record<string, unknown>>).some(
        (b) => b.isDraft !== undefined
      )
      if (needsUpdate) {
        const updatedBlocks = (snapshot.blocks as Array<Record<string, unknown>>).map((b) => {
          const { isDraft, ...rest } = b
          return {
            ...rest,
            contextMode: isDraft ? ("draft" as const) : undefined,
          }
        })
        await ctx.db.patch(snapshot._id, { blocks: updatedBlocks as typeof snapshot.blocks })
        snapshotsMigrated++
      }
    }

    return { migrated, snapshotsMigrated }
  },
})
