/**
 * Client-side memory rendering — mirrors convex/lib/memoryRendering.ts.
 * Used to inject project memory into Ollama and OpenRouter context.
 */

export interface MemoryEntry {
  type: string
  title: string
  content: string
  tags: string[]
}

/**
 * Score an entry's relevance to a session by counting tag overlaps.
 */
export function scoreEntryByTags(sessionTags: string[], entryTags: string[]): number {
  if (sessionTags.length === 0 || entryTags.length === 0) return 0
  const sessionSet = new Set(sessionTags)
  return entryTags.filter((t) => sessionSet.has(t)).length
}

/**
 * Render memory entries as a markdown block for injection into system prompts.
 * Pinned entries always appear first; remaining entries sorted by tag relevance.
 * Returns empty string if no entries.
 */
export function renderMemoryBlock(
  entries: MemoryEntry[],
  sessionTags: string[],
  pinnedEntries: MemoryEntry[]
): string {
  if (entries.length === 0) return ""

  const pinnedSet = new Set(pinnedEntries.map((e) => e.title + e.content))

  // Group non-pinned entries by type with relevance scores
  const byType: Record<string, { entry: MemoryEntry; score: number }[]> = {}
  for (const entry of entries) {
    if (pinnedSet.has(entry.title + entry.content)) continue
    if (!byType[entry.type]) byType[entry.type] = []
    byType[entry.type].push({ entry, score: scoreEntryByTags(sessionTags, entry.tags) })
  }

  // Sort types by total relevance score descending
  const sortedTypes = Object.entries(byType).sort(
    ([, a], [, b]) =>
      b.reduce((s, x) => s + x.score, 0) - a.reduce((s, x) => s + x.score, 0)
  )

  const lines: string[] = ["## Project Memory"]

  // Pinned entries first
  if (pinnedEntries.length > 0) {
    lines.push("\n**Pinned**")
    for (const entry of pinnedEntries) {
      lines.push(`- **${entry.title}** — ${entry.content}`)
    }
  }

  // Remaining entries by type
  for (const [type, items] of sortedTypes) {
    lines.push(`\n**${type}**`)
    for (const { entry } of items) {
      lines.push(`- **${entry.title}** — ${entry.content}`)
    }
  }

  return lines.join("\n")
}
