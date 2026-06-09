import { query } from "./_generated/server"
import { getOptionalUserId } from "./lib/auth"

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx)
    if (!userId) return null
    const user = await ctx.db.get(userId)
    if (!user) return null
    return { email: user.email ?? null, name: user.name ?? null }
  },
})
