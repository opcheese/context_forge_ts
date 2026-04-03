/**
 * Feature flags for ContextForge.
 *
 * These control which features are available in different deployments:
 * - Local: Claude Code enabled, OAuth disabled (password auth only)
 * - Cloud: Claude Code disabled, OAuth enabled
 *
 * Ollama and OpenRouter are always client-side and don't need feature flags.
 */

/**
 * Check if Claude Code is enabled.
 * Defaults to false (disabled) if not explicitly set to "true".
 * Typically enabled for local development only.
 */
export function isClaudeCodeEnabled(): boolean {
  return process.env.CLAUDE_CODE_ENABLED === "true"
}

/**
 * Check if OAuth providers (GitHub, Google) are enabled.
 * Defaults to false (disabled) if not explicitly set to "true".
 * Typically enabled for cloud deployment only (requires public callback URLs).
 */
export function isOAuthEnabled(): boolean {
  return process.env.OAUTH_ENABLED === "true"
}

/**
 * Check if local skill folder scanning is enabled.
 * Defaults to false (disabled) if not explicitly set to "true".
 * Typically enabled for local development only (requires filesystem access).
 */
export function isSkillScanEnabled(): boolean {
  return process.env.SKILL_SCAN_ENABLED === "true"
}

/**
 * Check if local filesystem research is enabled.
 * Defaults to false (disabled) if not explicitly set to "true".
 * Disabled on cloud deployments — local paths are not accessible from Convex cloud.
 * Typically enabled for self-hosted deployments only.
 */
export function isLocalResearchEnabled(): boolean {
  return process.env.LOCAL_RESEARCH_ENABLED === "true"
}

/**
 * All feature flags.
 */
export const FEATURES = {
  get CLAUDE_CODE_ENABLED() {
    return isClaudeCodeEnabled()
  },
  get OAUTH_ENABLED() {
    return isOAuthEnabled()
  },
  get SKILL_SCAN_ENABLED() {
    return isSkillScanEnabled()
  },
  get LOCAL_RESEARCH_ENABLED() {
    return isLocalResearchEnabled()
  },
}
