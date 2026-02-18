import type { Doc } from "../_generated/dataModel"
import type { Zone } from "./validators"

export type { Zone }

/**
 * Anti-agent suffix to append to system prompts when using Claude Code provider.
 * Prevents the model from pretending to have tool access.
 */
export const NO_TOOLS_SUFFIX = `

IMPORTANT: In this conversation you do NOT have access to tools, files, or code execution. Do NOT say "let me read that file" or "I'll search for that" - work only with information provided in this conversation.`

/**
 * Anti-self-talk suffix to prevent the model from simulating user messages.
 * The XML-formatted conversation is passed as a single prompt string to the SDK,
 * so the model might continue the XML pattern by generating <user> tags.
 */
export const NO_SELF_TALK_SUFFIX = `

IMPORTANT: Generate ONLY your single assistant response. Do NOT simulate, generate, or continue with any user messages. Do NOT write <user> tags or pretend to be the user. Stop after your response is complete.`

export interface ContextMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ConversationMessage {
  role: "user" | "assistant"
  content: string
}

/**
 * Extract the active system prompt from blocks.
 * The first system_prompt block in the PERMANENT zone (by position) is active.
 *
 * @returns The active system prompt content, or undefined if none exists
 */
export function extractSystemPromptFromBlocks(
  blocks: Doc<"blocks">[]
): string | undefined {
  const systemPromptBlocks = blocks
    .filter((b) => b.type === "system_prompt" && b.zone === "PERMANENT" && !b.isDraft)
    .sort((a, b) => a.position - b.position)

  return systemPromptBlocks[0]?.content
}

/**
 * Assemble blocks into user context messages for LLM.
 * Order: PERMANENT → STABLE → WORKING → User prompt
 *
 * IMPORTANT: This function does NOT include system_prompt blocks in output.
 * Callers should use extractSystemPromptFromBlocks() separately and pass
 * the system prompt to the provider via provider-specific options.
 *
 * Cache-friendly structure:
 * - PERMANENT zone as system message (cached)
 * - STABLE zone as reference material
 * - WORKING zone as current context (dynamic, not cached)
 * - User prompt always last
 *
 * @param blocks - All blocks for the session
 * @param userPrompt - The current user message
 */
export function assembleContext(
  blocks: Doc<"blocks">[],
  userPrompt: string
): ContextMessage[] {
  const messages: ContextMessage[] = []

  // Group blocks by zone, excluding system_prompt blocks (handled separately by caller)
  const byZone: Record<Zone, Doc<"blocks">[]> = {
    PERMANENT: [],
    STABLE: [],
    WORKING: [],
  }

  for (const block of blocks) {
    // Skip system_prompt blocks - caller extracts them via extractSystemPromptFromBlocks()
    if (block.type === "system_prompt" || block.isDraft) {
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
 * Calculate approximate token count for context.
 * Uses rough estimate of 4 characters per token.
 * For accurate counting, use a proper tokenizer.
 */
export function estimateTokenCount(messages: ContextMessage[]): number {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
  return Math.ceil(totalChars / 4)
}

/**
 * Get context stats by zone.
 */
export function getContextStats(blocks: Doc<"blocks">[]): {
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
    if (block.isDraft) continue
    const zone = block.zone.toLowerCase() as "permanent" | "stable" | "working"
    stats[zone].count++
    stats[zone].chars += block.content.length
    stats.total.count++
    stats.total.chars += block.content.length
  }

  return stats
}

/**
 * Assemble blocks and conversation history into messages for brainstorming.
 * Order: PERMANENT → STABLE → WORKING → Active Skills → Conversation history → New message
 *
 * IMPORTANT: This function does NOT include system_prompt blocks in output.
 * Callers should use extractSystemPromptFromBlocks() separately and pass
 * the system prompt to the provider via provider-specific options.
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
  blocks: Doc<"blocks">[],
  conversationHistory: ConversationMessage[],
  newMessage: string,
  activeSkillsContent?: string
): ContextMessage[] {
  const messages: ContextMessage[] = []

  // Group blocks by zone, excluding system_prompt blocks (handled separately by caller)
  const byZone: Record<Zone, Doc<"blocks">[]> = {
    PERMANENT: [],
    STABLE: [],
    WORKING: [],
  }

  for (const block of blocks) {
    // Skip system_prompt blocks - caller extracts them via extractSystemPromptFromBlocks()
    if (block.type === "system_prompt" || block.isDraft) {
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

  // 4. Active skills (after WORKING, before conversation — cache-friendly)
  if (activeSkillsContent) {
    messages.push({
      role: "user",
      content: `Active Skills:\n\n${activeSkillsContent}`,
    })
  }

  // 5. Conversation history (alternating user/assistant messages)
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
