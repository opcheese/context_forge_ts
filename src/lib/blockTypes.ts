/**
 * Centralized block type definitions for ContextForge.
 *
 * This file defines the 12 rationalized block types used throughout
 * the application, replacing the previous ad-hoc type definitions.
 */

import type { Zone } from "@/components/dnd/types"

/**
 * The 12 block types organized by category.
 */
export const BLOCK_TYPES = [
  // Core/System
  "system_prompt",
  "note",
  "code",
  // Document Types
  "guideline",
  "template",
  "reference",
  "document",
  // Conversation Types
  "user_message",
  "assistant_message",
  "instruction",
  // Meta Types
  "persona",
  "framework",
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

/**
 * Block type metadata including display name, description, default zone, and icon.
 */
export interface BlockTypeMetadata {
  /** Human-readable display name */
  displayName: string
  /** Short description of what this type is for */
  description: string
  /** Default zone when creating blocks of this type */
  defaultZone: Zone
  /** Category for grouping in UI */
  category: "core" | "document" | "conversation" | "meta"
  /** Lucide icon name */
  icon: string
  /** Color for the type badge (Tailwind class) */
  color: string
}

/**
 * Metadata for each block type.
 */
export const BLOCK_TYPE_METADATA: Record<BlockType, BlockTypeMetadata> = {
  // Core/System
  system_prompt: {
    displayName: "System Prompt",
    description: "LLM behavior instructions (one active per session)",
    defaultZone: "PERMANENT",
    category: "core",
    icon: "Cpu",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  },
  note: {
    displayName: "Note",
    description: "General-purpose notes and annotations",
    defaultZone: "WORKING",
    category: "core",
    icon: "StickyNote",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  },
  code: {
    displayName: "Code",
    description: "Source code, scripts, config files",
    defaultZone: "WORKING",
    category: "core",
    icon: "Code",
    color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  },

  // Document Types
  guideline: {
    displayName: "Guideline",
    description: "Instructions for creating outputs",
    defaultZone: "PERMANENT",
    category: "document",
    icon: "BookOpen",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  },
  template: {
    displayName: "Template",
    description: "Reusable document templates",
    defaultZone: "STABLE",
    category: "document",
    icon: "FileText",
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300",
  },
  reference: {
    displayName: "Reference",
    description: "Sample docs, examples, style guides",
    defaultZone: "STABLE",
    category: "document",
    icon: "Library",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
  },
  document: {
    displayName: "Document",
    description: "Generated or authored documents",
    defaultZone: "WORKING",
    category: "document",
    icon: "FileEdit",
    color: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  },

  // Conversation Types
  user_message: {
    displayName: "User Message",
    description: "Saved user prompts from brainstorm",
    defaultZone: "WORKING",
    category: "conversation",
    icon: "User",
    color: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
  },
  assistant_message: {
    displayName: "Assistant Message",
    description: "Saved LLM responses",
    defaultZone: "WORKING",
    category: "conversation",
    icon: "Bot",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  instruction: {
    displayName: "Instruction",
    description: "Task-specific instructions",
    defaultZone: "WORKING",
    category: "conversation",
    icon: "ListChecks",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  },

  // Meta Types
  persona: {
    displayName: "Persona",
    description: "AI persona definitions",
    defaultZone: "PERMANENT",
    category: "meta",
    icon: "UserCog",
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
  },
  framework: {
    displayName: "Framework",
    description: "Methodology frameworks",
    defaultZone: "STABLE",
    category: "meta",
    icon: "Network",
    color: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300",
  },
}

/**
 * Get block types grouped by category.
 */
export function getBlockTypesByCategory(): Record<string, BlockType[]> {
  const categories: Record<string, BlockType[]> = {
    core: [],
    document: [],
    conversation: [],
    meta: [],
  }

  for (const type of BLOCK_TYPES) {
    const meta = BLOCK_TYPE_METADATA[type]
    categories[meta.category].push(type)
  }

  return categories
}

/**
 * Get metadata for a block type.
 * Falls back to "note" metadata for unknown types.
 */
export function getBlockTypeMetadata(type: string): BlockTypeMetadata {
  if (type in BLOCK_TYPE_METADATA) {
    return BLOCK_TYPE_METADATA[type as BlockType]
  }
  // Fallback for unknown types (legacy data)
  return {
    displayName: type,
    description: "Unknown block type",
    defaultZone: "WORKING",
    category: "core",
    icon: "HelpCircle",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  }
}

/**
 * Check if a string is a valid block type.
 */
export function isValidBlockType(type: string): type is BlockType {
  return BLOCK_TYPES.includes(type as BlockType)
}

/**
 * Category display names for UI.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  core: "Core",
  document: "Documents",
  conversation: "Conversation",
  meta: "Meta",
}
