/**
 * Shared validators for Convex functions.
 *
 * Centralizes common validators to avoid duplication across modules.
 */

import { v } from "convex/values"

/**
 * Zone validator for the three-zone context system.
 * - PERMANENT: Core instructions, rarely changes
 * - STABLE: Reference material, occasionally changes
 * - WORKING: Current task context, frequently changes
 */
export const zoneValidator = v.union(
  v.literal("PERMANENT"),
  v.literal("STABLE"),
  v.literal("WORKING")
)

export type Zone = "PERMANENT" | "STABLE" | "WORKING"
