import { query } from "./_generated/server"
import { v } from "convex/values"
import { countTokens } from "./lib/tokenizer"
import { canAccessSession } from "./lib/auth"

// Default budgets (matches Python implementation)
export const DEFAULT_BUDGETS = {
  permanent: 50_000,
  stable: 50_000,
  working: 50_000,
  total: 200_000,
} as const

export type Budgets = typeof DEFAULT_BUDGETS

/**
 * Get token metrics for all zones in a session.
 * Returns current usage, budgets, and percentage used.
 */
export const getZoneMetrics = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Check session access
    const hasAccess = await canAccessSession(ctx, args.sessionId)
    if (!hasAccess) {
      return {
        zones: {
          PERMANENT: { blocks: 0, tokens: 0, budget: DEFAULT_BUDGETS.permanent, percentUsed: 0 },
          STABLE: { blocks: 0, tokens: 0, budget: DEFAULT_BUDGETS.stable, percentUsed: 0 },
          WORKING: { blocks: 0, tokens: 0, budget: DEFAULT_BUDGETS.working, percentUsed: 0 },
        },
        total: { blocks: 0, tokens: 0, budget: DEFAULT_BUDGETS.total, percentUsed: 0 },
        budgets: DEFAULT_BUDGETS,
      }
    }

    // Get session for custom budgets
    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    const budgets = session.budgets ?? DEFAULT_BUDGETS

    // Get all blocks for session
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    // Calculate per-zone metrics
    const zones = {
      PERMANENT: { blocks: 0, tokens: 0, budget: budgets.permanent, percentUsed: 0 },
      STABLE: { blocks: 0, tokens: 0, budget: budgets.stable, percentUsed: 0 },
      WORKING: { blocks: 0, tokens: 0, budget: budgets.working, percentUsed: 0 },
    }

    let totalTokens = 0

    for (const block of blocks) {
      const zone = block.zone as keyof typeof zones
      // Use stored tokens, or count if not yet stored (backwards compat)
      const tokens = block.tokens ?? countTokens(block.content)

      zones[zone].blocks++
      // Draft blocks don't count toward token budgets
      if (!block.isDraft) {
        zones[zone].tokens += tokens
        totalTokens += tokens
      }
    }

    // Calculate percentages
    for (const zone of Object.keys(zones) as (keyof typeof zones)[]) {
      zones[zone].percentUsed = Math.round((zones[zone].tokens / zones[zone].budget) * 100)
    }

    const totalPercentUsed = Math.round((totalTokens / budgets.total) * 100)

    return {
      zones,
      total: {
        blocks: blocks.length,
        tokens: totalTokens,
        budget: budgets.total,
        percentUsed: totalPercentUsed,
      },
      budgets,
    }
  },
})

/**
 * Check if adding content would exceed zone budget.
 * Useful for pre-validation before adding blocks.
 */
export const checkBudget = query({
  args: {
    sessionId: v.id("sessions"),
    zone: v.string(),
    additionalTokens: v.number(),
  },
  handler: async (ctx, args) => {
    // Check session access
    const hasAccess = await canAccessSession(ctx, args.sessionId)
    if (!hasAccess) {
      return {
        currentTokens: 0,
        additionalTokens: args.additionalTokens,
        newTotal: args.additionalTokens,
        budget: DEFAULT_BUDGETS.total,
        wouldExceed: false,
        percentUsed: 0,
        warning: false,
        danger: false,
      }
    }

    // Get session for custom budgets
    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    const budgets = session.budgets ?? DEFAULT_BUDGETS

    // Get current zone tokens
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session_zone", (q) =>
        q.eq("sessionId", args.sessionId).eq("zone", args.zone as "PERMANENT" | "STABLE" | "WORKING")
      )
      .collect()

    const currentTokens = blocks.reduce(
      (sum, block) => block.isDraft ? sum : sum + (block.tokens ?? countTokens(block.content)),
      0
    )

    // Get zone budget
    const zoneBudget = budgets[args.zone.toLowerCase() as keyof Budgets] ?? budgets.total

    const newTotal = currentTokens + args.additionalTokens
    const wouldExceed = newTotal > zoneBudget
    const percentUsed = Math.round((newTotal / zoneBudget) * 100)

    return {
      currentTokens,
      additionalTokens: args.additionalTokens,
      newTotal,
      budget: zoneBudget,
      wouldExceed,
      percentUsed,
      warning: percentUsed > 80 && percentUsed <= 95,
      danger: percentUsed > 95,
    }
  },
})

/**
 * Estimate tokens for content without saving.
 * Useful for showing token count before creating a block.
 */
export const estimateTokens = query({
  args: {
    content: v.string(),
  },
  handler: async (_ctx, args) => {
    const tokens = countTokens(args.content)
    return { tokens }
  },
})

/**
 * Get budget status summary for a session.
 * Returns simple ok/warning/danger status for each zone.
 */
export const getBudgetStatus = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Check session access
    const hasAccess = await canAccessSession(ctx, args.sessionId)
    if (!hasAccess) {
      return {
        permanent: { tokens: 0, budget: DEFAULT_BUDGETS.permanent, status: "ok" as const },
        stable: { tokens: 0, budget: DEFAULT_BUDGETS.stable, status: "ok" as const },
        working: { tokens: 0, budget: DEFAULT_BUDGETS.working, status: "ok" as const },
        total: { tokens: 0, budget: DEFAULT_BUDGETS.total, status: "ok" as const },
      }
    }

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    const budgets = session.budgets ?? DEFAULT_BUDGETS

    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    // Group by zone
    const zoneTotals: Record<string, number> = {
      PERMANENT: 0,
      STABLE: 0,
      WORKING: 0,
    }

    for (const block of blocks) {
      if (block.isDraft) continue
      const tokens = block.tokens ?? countTokens(block.content)
      zoneTotals[block.zone] = (zoneTotals[block.zone] ?? 0) + tokens
    }

    const getStatus = (tokens: number, budget: number) => {
      const percent = (tokens / budget) * 100
      if (percent > 95) return "danger" as const
      if (percent > 80) return "warning" as const
      return "ok" as const
    }

    return {
      permanent: {
        tokens: zoneTotals.PERMANENT,
        budget: budgets.permanent,
        status: getStatus(zoneTotals.PERMANENT, budgets.permanent),
      },
      stable: {
        tokens: zoneTotals.STABLE,
        budget: budgets.stable,
        status: getStatus(zoneTotals.STABLE, budgets.stable),
      },
      working: {
        tokens: zoneTotals.WORKING,
        budget: budgets.working,
        status: getStatus(zoneTotals.WORKING, budgets.working),
      },
      total: {
        tokens: zoneTotals.PERMANENT + zoneTotals.STABLE + zoneTotals.WORKING,
        budget: budgets.total,
        status: getStatus(
          zoneTotals.PERMANENT + zoneTotals.STABLE + zoneTotals.WORKING,
          budgets.total
        ),
      },
    }
  },
})
