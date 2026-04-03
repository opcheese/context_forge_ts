/**
 * Client-side context assembly for LLM conversations.
 * Assembles blocks into messages for OpenRouter/Ollama.
 */

import type { Zone } from "@/components/dnd/types"

/**
 * Anti-agent suffix to append to system prompts.
 * Prevents the model from pretending to have tool access.
 */
export const NO_TOOLS_SUFFIX = `

IMPORTANT: In this conversation you do NOT have access to tools, files, or code execution. Do NOT say "let me read that file" or "I'll search for that" - work only with information provided in this conversation.`

export interface ContextMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ConversationMessage {
  role: "user" | "assistant"
  content: string
}

/**
 * Minimal block interface for context assembly.
 * Works with blocks from Convex queries.
 */
export interface Block {
  content: string
  type: string
  zone: Zone | string
  position: number
  contextMode?: "default" | "draft" | "validation"
}

/**
 * Check if a block should be excluded from context assembly.
 * Draft blocks are always excluded. Validation blocks are only included in validation mode.
 */
function isBlockExcluded(
  block: { contextMode?: string; type: string },
  mode: "brainstorm" | "validation" = "brainstorm"
): boolean {
  const contextMode = block.contextMode ?? "default"
  if (contextMode === "draft") return true
  if (contextMode === "validation" && mode !== "validation") return true
  return false
}

/**
 * Extract the active system prompt from blocks.
 * The first system_prompt block in the PERMANENT zone (by position) is active.
 *
 * @returns The active system prompt content, or undefined if none exists
 */
export function extractSystemPromptFromBlocks(blocks: Block[], mode: "brainstorm" | "validation" = "brainstorm"): string | undefined {
  const systemPromptBlocks = blocks
    .filter((b) => b.type === "system_prompt" && b.zone === "PERMANENT" && !isBlockExcluded(b, mode))
    .sort((a, b) => a.position - b.position)

  return systemPromptBlocks[0]?.content
}

/**
 * Assemble blocks into user context messages for LLM.
 * Order: PERMANENT -> STABLE -> WORKING -> User prompt
 *
 * IMPORTANT: This function does NOT include system_prompt blocks in output.
 * Callers should use extractSystemPromptFromBlocks() separately and pass
 * the system prompt to the provider via provider-specific options.
 *
 * @param blocks - All blocks for the session
 * @param userPrompt - The current user message
 */
export function assembleContext(blocks: Block[], userPrompt: string, mode: "brainstorm" | "validation" = "brainstorm"): ContextMessage[] {
  const messages: ContextMessage[] = []

  // Group blocks by zone, excluding system_prompt blocks
  const byZone: Record<Zone, Block[]> = {
    PERMANENT: [],
    STABLE: [],
    WORKING: [],
  }

  for (const block of blocks) {
    if (block.type === "system_prompt" || isBlockExcluded(block, mode)) {
      continue
    }
    const zone = block.zone as Zone
    if (byZone[zone]) {
      byZone[zone].push(block)
    }
  }

  // Sort each zone by position (ascending)
  for (const zone of Object.keys(byZone) as Zone[]) {
    byZone[zone].sort((a, b) => a.position - b.position)
  }

  // 1. PERMANENT zone as system message (most stable, cached)
  const permanentContent = byZone.PERMANENT.map((b) => b.content).join("\n\n")
  if (permanentContent) {
    messages.push({
      role: "system",
      content: permanentContent,
    })
  }

  // 2. STABLE zone as reference material
  const stableContent = byZone.STABLE.map((b) => b.content).join("\n\n")
  if (stableContent) {
    messages.push({
      role: "user",
      content: `Reference Material:\n\n${stableContent}`,
    })
  }

  // 3. WORKING zone as current context (dynamic, changes frequently)
  const workingContent = byZone.WORKING.map((b) => b.content).join("\n\n")
  if (workingContent) {
    messages.push({
      role: "user",
      content: `Current Context:\n\n${workingContent}`,
    })
  }

  // 4. Current user prompt (always last)
  messages.push({
    role: "user",
    content: userPrompt,
  })

  return messages
}

/**
 * Assemble blocks and conversation history into messages for brainstorming.
 * Order: PERMANENT -> STABLE -> WORKING -> Active Skills -> Conversation history -> New message
 *
 * Active skills are injected after WORKING to preserve prompt caching
 * (toggling a skill only invalidates the conversation suffix).
 *
 * @param blocks - All blocks for the session
 * @param conversationHistory - Previous messages in the conversation
 * @param newMessage - The new user message
 * @param activeSkillsContent - Optional formatted skill text to inject
 */
export function assembleContextWithConversation(
  blocks: Block[],
  conversationHistory: ConversationMessage[],
  newMessage: string,
  activeSkillsContent?: string,
  mode: "brainstorm" | "validation" = "brainstorm"
): ContextMessage[] {
  const messages: ContextMessage[] = []

  // Group blocks by zone, excluding system_prompt blocks
  const byZone: Record<Zone, Block[]> = {
    PERMANENT: [],
    STABLE: [],
    WORKING: [],
  }

  for (const block of blocks) {
    if (block.type === "system_prompt" || isBlockExcluded(block, mode)) {
      continue
    }
    const zone = block.zone as Zone
    if (byZone[zone]) {
      byZone[zone].push(block)
    }
  }

  // Sort each zone by position (ascending)
  for (const zone of Object.keys(byZone) as Zone[]) {
    byZone[zone].sort((a, b) => a.position - b.position)
  }

  // 1. PERMANENT zone as system message
  const permanentContent = byZone.PERMANENT.map((b) => b.content).join("\n\n")
  if (permanentContent) {
    messages.push({
      role: "system",
      content: permanentContent,
    })
  }

  // 2. STABLE zone as reference material
  const stableContent = byZone.STABLE.map((b) => b.content).join("\n\n")
  if (stableContent) {
    messages.push({
      role: "user",
      content: `Reference Material:\n\n${stableContent}`,
    })
  }

  // 3. WORKING zone as current context
  const workingContent = byZone.WORKING.map((b) => b.content).join("\n\n")
  if (workingContent) {
    messages.push({
      role: "user",
      content: `Current Context:\n\n${workingContent}`,
    })
  }

  // 4. Active skills (after WORKING, before conversation — cache-friendly)
  if (activeSkillsContent) {
    messages.push({
      role: "user",
      content: `Active Skills:\n\n${activeSkillsContent}`,
    })
  }

  // 5. Conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    })
  }

  // 6. New user message (always last)
  messages.push({
    role: "user",
    content: newMessage,
  })

  return messages
}

/**
 * Calculate approximate token count for context.
 * Uses rough estimate of 4 characters per token.
 */
export function estimateTokenCount(messages: ContextMessage[]): number {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
  return Math.ceil(totalChars / 4)
}

/**
 * Get context stats by zone.
 */
export function getContextStats(blocks: Block[], mode: "brainstorm" | "validation" = "brainstorm"): {
  permanent: { count: number; chars: number }
  stable: { count: number; chars: number }
  working: { count: number; chars: number }
  total: { count: number; chars: number }
} {
  const stats = {
    permanent: { count: 0, chars: 0 },
    stable: { count: 0, chars: 0 },
    working: { count: 0, chars: 0 },
    total: { count: 0, chars: 0 },
  }

  for (const block of blocks) {
    if (isBlockExcluded(block, mode)) continue
    const zone = (block.zone as string).toLowerCase() as "permanent" | "stable" | "working"
    if (stats[zone]) {
      stats[zone].count++
      stats[zone].chars += block.content.length
    }
    stats.total.count++
    stats.total.chars += block.content.length
  }

  return stats
}
