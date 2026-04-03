/**
 * Feature flags exposed to the frontend.
 */

import { query } from "./_generated/server"
import { FEATURES } from "./lib/featureFlags"

/**
 * Get current feature flag values.
 * Safe to expose to frontend - these are deployment-level settings, not secrets.
 */
export const getFlags = query({
  args: {},
  handler: async () => {
    return {
      claudeCodeEnabled: FEATURES.CLAUDE_CODE_ENABLED,
      oauthEnabled: FEATURES.OAUTH_ENABLED,
      skillScanEnabled: FEATURES.SKILL_SCAN_ENABLED,
      localResearchEnabled: FEATURES.LOCAL_RESEARCH_ENABLED,
    }
  },
})
