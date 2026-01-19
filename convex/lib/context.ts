import type { Doc } from "../_generated/dataModel"
import type { Zone } from "./validators"

export type { Zone }

export interface ContextMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Assemble blocks into messages for LLM.
 * Order: PERMANENT → STABLE → WORKING (critical for provider caching)
 *
 * Cache-friendly structure:
 * - PERMANENT zone becomes system message (highest cache priority)
 * - STABLE zone as reference material
 * - WORKING zone as current context (dynamic, not cached)
 * - User prompt always last
 */
export function assembleContext(
  blocks: Doc<"blocks">[],
  userPrompt: string,
  systemPrompt?: string
): ContextMessage[] {
  const messages: ContextMessage[] = []

  // Group blocks by zone
  const byZone: Record<Zone, Doc<"blocks">[]> = {
    PERMANENT: [],
    STABLE: [],
    WORKING: [],
  }

  for (const block of blocks) {
    const zone = block.zone as Zone
    if (byZone[zone]) {
      byZone[zone].push(block)
    }
  }

  // Sort each zone by position (ascending)
  for (const zone of Object.keys(byZone) as Zone[]) {
    byZone[zone].sort((a, b) => a.position - b.position)
  }

  // 1. PERMANENT zone as system message (most stable, cached first)
  const permanentContent = byZone.PERMANENT.map((b) => b.content).join("\n\n")
  if (permanentContent) {
    messages.push({
      role: "system",
      content: permanentContent,
    })
  }

  // 2. Optional system prompt from user (added after permanent context)
  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt,
    })
  }

  // 3. STABLE zone as reference material
  const stableContent = byZone.STABLE.map((b) => b.content).join("\n\n")
  if (stableContent) {
    messages.push({
      role: "user",
      content: `Reference Material:\n\n${stableContent}`,
    })
  }

  // 4. WORKING zone as current context (dynamic, changes frequently)
  const workingContent = byZone.WORKING.map((b) => b.content).join("\n\n")
  if (workingContent) {
    messages.push({
      role: "user",
      content: `Current Context:\n\n${workingContent}`,
    })
  }

  // 5. Current user prompt (always last)
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
    const zone = block.zone.toLowerCase() as "permanent" | "stable" | "working"
    stats[zone].count++
    stats[zone].chars += block.content.length
    stats.total.count++
    stats.total.chars += block.content.length
  }

  return stats
}
