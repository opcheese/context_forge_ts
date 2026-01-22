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

/**
 * Block type validator for the 12 rationalized block types.
 *
 * Categories:
 * - Core: system_prompt, note, code
 * - Document: guideline, template, reference, document
 * - Conversation: user_message, assistant_message, instruction
 * - Meta: persona, framework
 */
export const blockTypeValidator = v.union(
  // Core/System
  v.literal("system_prompt"),
  v.literal("note"),
  v.literal("code"),
  // Document Types
  v.literal("guideline"),
  v.literal("template"),
  v.literal("reference"),
  v.literal("document"),
  // Conversation Types
  v.literal("user_message"),
  v.literal("assistant_message"),
  v.literal("instruction"),
  // Meta Types
  v.literal("persona"),
  v.literal("framework")
)

export type BlockType =
  | "system_prompt"
  | "note"
  | "code"
  | "guideline"
  | "template"
  | "reference"
  | "document"
  | "user_message"
  | "assistant_message"
  | "instruction"
  | "persona"
  | "framework"
