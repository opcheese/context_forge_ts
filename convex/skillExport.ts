/**
 * Export data queries for skill packages.
 *
 * Returns raw session/block data. Client-side hook handles
 * title extraction, SKILL.md generation, and ZIP packaging.
 */

import { query } from "./_generated/server"
import { v } from "convex/values"
import { canAccessSession } from "./lib/auth"

export const getExportData = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessSession(ctx, args.sessionId)
    if (!hasAccess) return null

    const session = await ctx.db.get(args.sessionId)
    if (!session) return null

    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session_zone", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    // Sort by zone order (PERMANENT, STABLE, WORKING) then position
    const zoneOrder = { PERMANENT: 0, STABLE: 1, WORKING: 2 }
    blocks.sort((a, b) => {
      const za = zoneOrder[a.zone as keyof typeof zoneOrder] ?? 1
      const zb = zoneOrder[b.zone as keyof typeof zoneOrder] ?? 1
      if (za !== zb) return za - zb
      return a.position - b.position
    })

    return {
      session: {
        _id: session._id,
        name: session.name,
        projectId: session.projectId,
        stepNumber: session.stepNumber,
      },
      blocks: blocks.map((b) => ({
        _id: b._id,
        content: b.content,
        type: b.type,
        zone: b.zone,
        position: b.position,
        metadata: b.metadata,
      })),
    }
  },
})
