/**
 * Memory rendering — assembles memory entries into structured text for LLM context.
 *
 * Entries are scored by tag overlap with session tags.
 * Pinned entries always included (score = Infinity).
 * Output grouped by type, types ordered by total relevance score.
 */

export interface MemoryEntry {
  type: string
  title: string
  content: string
  tags: string[]
}

/**
 * Score an entry's relevance by counting tag overlaps with session tags.
 */
export function scoreEntryByTags(sessionTags: string[], entryTags: string[]): number {
  if (sessionTags.length === 0 || entryTags.length === 0) return 0
  const sessionSet = new Set(sessionTags)
  return entryTags.filter((t) => sessionSet.has(t)).length
}

/**
 * Render matched memory entries into structured text for LLM context.
 *
 * Pinned entries can be identified either by reference equality (test convenience)
 * or by passing a Set of pinned indices/IDs separately.
 *
 * @param entries All project memory entries
 * @param sessionTags Tags from the current session (for auto-selection)
 * @param pinnedEntries Entries that are pinned (always included) — matched by reference
 * @returns Formatted markdown string, or empty string if no matches
 */
export function renderMemoryBlock(
  entries: MemoryEntry[],
  sessionTags: string[],
  pinnedEntries: MemoryEntry[]
): string {
  if (entries.length === 0) return ""

  const pinnedSet = new Set(pinnedEntries)

  // Score and filter entries
  const scored = entries
    .map((entry) => ({
      entry,
      score: pinnedSet.has(entry) ? Infinity : scoreEntryByTags(sessionTags, entry.tags),
    }))
    .filter((s) => s.score > 0)

  if (scored.length === 0) return ""

  // Group by type
  const byType = new Map<string, Array<{ entry: MemoryEntry; score: number }>>()
  for (const s of scored) {
    const existing = byType.get(s.entry.type) ?? []
    existing.push(s)
    byType.set(s.entry.type, existing)
  }

  // Sort types by total score (most relevant first)
  const sortedTypes = [...byType.entries()].sort((a, b) => {
    const scoreA = a[1].reduce((sum, s) => sum + (s.score === Infinity ? 1000 : s.score), 0)
    const scoreB = b[1].reduce((sum, s) => sum + (s.score === Infinity ? 1000 : s.score), 0)
    return scoreB - scoreA
  })

  // Render
  const parts: string[] = ["## Project Memory"]

  for (const [type, items] of sortedTypes) {
    // Sort entries within type by score descending
    items.sort((a, b) => {
      if (a.score === Infinity && b.score === Infinity) return 0
      if (a.score === Infinity) return -1
      if (b.score === Infinity) return 1
      return b.score - a.score
    })

    parts.push(`\n### ${type} (${items.length} matched)`)
    for (const { entry } of items) {
      parts.push(`**${entry.title}** — ${entry.content}`)
    }
  }

  return parts.join("\n")
}
