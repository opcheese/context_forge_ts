# Memory System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a project-scoped knowledge store ("Memory") with a bottom drawer UI, so users can accumulate facts, decisions, and tensions across sessions and auto-inject relevant entries into LLM context.

**Architecture:** Two new Convex tables (`memorySchemas`, `memoryEntries`) store user-defined memory types and entries per project. Two new session fields (`pinnedMemories`, `sessionTags`) control per-session relevance filtering. A rendering function assembles matched entries into a text block injected into PERMANENT zone context. A bottom drawer component provides collapsed/peek/full states for browsing, searching, and editing entries.

**Tech Stack:** Convex (backend), React + Framer Motion (UI), shadcn/ui primitives, existing auth/access patterns

**Design doc:** `docs/plans/2026-03-10-memory-design.md`
**Validation scenarios:** `docs/plans/2026-03-10-memory-validation-scenarios.md`

---

## Task 1: Schema — Add Memory Tables and Session Fields

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/lib/validators.ts` (no changes needed — types are strings, not enums)

**Step 1: Add `memorySchemas` table to schema**

In `convex/schema.ts`, add after the `blocks` table definition:

```ts
// Memory type definitions per project
memorySchemas: defineTable({
  projectId: v.id("projects"),
  types: v.array(
    v.object({
      name: v.string(),
      color: v.string(),
      icon: v.string(),
    })
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_project", ["projectId"]),

// Individual memory entries
memoryEntries: defineTable({
  projectId: v.id("projects"),
  type: v.string(),
  title: v.string(),
  content: v.string(),
  tags: v.array(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_project", ["projectId"])
  .index("by_project_type", ["projectId", "type"]),
```

**Step 2: Add session fields for pins and tags**

In the `sessions` table definition, add after `claudeResolvedModel`:

```ts
// Memory pins (session-scoped — not carried forward)
pinnedMemories: v.optional(v.array(v.id("memoryEntries"))),
// Session tags for memory auto-selection (merged from template defaults + user overrides)
sessionTags: v.optional(v.array(v.string())),
```

**Step 3: Verify schema pushes cleanly**

Run: `pnpm convex dev` (should auto-push schema)
Expected: "Schema validation complete" with no errors

**Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(memory): add memorySchemas, memoryEntries tables and session pin/tag fields"
```

---

## Task 2: Backend — Memory Schema CRUD

**Files:**
- Create: `convex/memorySchemas.ts`
- Test: `convex/memorySchemas.test.ts` (optional — these are simple CRUD, test via UI)

**Step 1: Create `convex/memorySchemas.ts`**

```ts
/**
 * Memory Schemas — user-defined memory types per project.
 *
 * Each project has one schema document with an array of type definitions.
 * Starter templates provide defaults; users can customize.
 */

import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { canAccessProject } from "./lib/auth"

/** Starter templates for common workflows */
const STARTER_TEMPLATES: Record<string, Array<{ name: string; color: string; icon: string }>> = {
  general: [
    { name: "note", color: "#6B7280", icon: "📝" },
    { name: "decision", color: "#3B82F6", icon: "✅" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
  ],
  fiction: [
    { name: "character", color: "#8B5CF6", icon: "👤" },
    { name: "place", color: "#10B981", icon: "📍" },
    { name: "lore_rule", color: "#F59E0B", icon: "📜" },
    { name: "plot_thread", color: "#EC4899", icon: "🧵" },
    { name: "timeline", color: "#6366F1", icon: "📅" },
    { name: "voice_note", color: "#14B8A6", icon: "🎤" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
  ],
  pm: [
    { name: "learning", color: "#3B82F6", icon: "💡" },
    { name: "decision", color: "#10B981", icon: "✅" },
    { name: "stakeholder", color: "#8B5CF6", icon: "👥" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
  ],
  "game-design": [
    { name: "lore_rule", color: "#F59E0B", icon: "📜" },
    { name: "mechanic", color: "#3B82F6", icon: "⚙️" },
    { name: "conflict_resolution", color: "#10B981", icon: "🤝" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
  ],
  "system-architecture": [
    { name: "service", color: "#3B82F6", icon: "🔧" },
    { name: "event", color: "#8B5CF6", icon: "📡" },
    { name: "decision", color: "#10B981", icon: "✅" },
    { name: "constraint", color: "#EF4444", icon: "🚫" },
    { name: "infra_pattern", color: "#F59E0B", icon: "🏗️" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
    { name: "squad_context", color: "#14B8A6", icon: "👥" },
  ],
  dev: [
    { name: "decision", color: "#10B981", icon: "✅" },
    { name: "constraint", color: "#EF4444", icon: "🚫" },
    { name: "pattern", color: "#3B82F6", icon: "🔄" },
    { name: "tension", color: "#EF4444", icon: "⚡" },
  ],
}

/**
 * Get memory schema for a project.
 */
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) return null

    return await ctx.db
      .query("memorySchemas")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first()
  },
})

/**
 * Create or replace memory schema for a project from a starter template.
 */
export const createFromTemplate = mutation({
  args: {
    projectId: v.id("projects"),
    templateName: v.string(),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) throw new Error("Project not found or access denied")

    const types = STARTER_TEMPLATES[args.templateName]
    if (!types) throw new Error(`Unknown template: ${args.templateName}`)

    // Delete existing schema if any
    const existing = await ctx.db
      .query("memorySchemas")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first()
    if (existing) {
      await ctx.db.delete(existing._id)
    }

    const now = Date.now()
    return await ctx.db.insert("memorySchemas", {
      projectId: args.projectId,
      types,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update memory schema types (add, remove, or edit types).
 */
export const updateTypes = mutation({
  args: {
    schemaId: v.id("memorySchemas"),
    types: v.array(
      v.object({
        name: v.string(),
        color: v.string(),
        icon: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const schema = await ctx.db.get(args.schemaId)
    if (!schema) throw new Error("Schema not found")

    const hasAccess = await canAccessProject(ctx, schema.projectId)
    if (!hasAccess) throw new Error("Access denied")

    await ctx.db.patch(args.schemaId, {
      types: args.types,
      updatedAt: Date.now(),
    })
  },
})

/**
 * List available starter template names.
 */
export const listTemplates = query({
  args: {},
  handler: async () => {
    return Object.entries(STARTER_TEMPLATES).map(([name, types]) => ({
      name,
      typeCount: types.length,
      typeNames: types.map((t) => t.name),
    }))
  },
})
```

**Step 2: Verify types**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add convex/memorySchemas.ts
git commit -m "feat(memory): add memory schema CRUD with starter templates"
```

---

## Task 3: Backend — Memory Entry CRUD

**Files:**
- Create: `convex/memoryEntries.ts`

**Step 1: Create `convex/memoryEntries.ts`**

```ts
/**
 * Memory Entries — individual knowledge entries within a project.
 *
 * Entries are project-scoped (visible across all sessions in the project).
 * Tags enable auto-selection for LLM context. Pins are session-scoped (on sessions table).
 */

import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { canAccessProject } from "./lib/auth"

/**
 * List all memory entries for a project.
 */
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) return []

    return await ctx.db
      .query("memoryEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()
  },
})

/**
 * List entries filtered by type.
 */
export const listByType = query({
  args: {
    projectId: v.id("projects"),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) return []

    return await ctx.db
      .query("memoryEntries")
      .withIndex("by_project_type", (q) =>
        q.eq("projectId", args.projectId).eq("type", args.type)
      )
      .collect()
  },
})

/**
 * Get a single entry.
 */
export const get = query({
  args: { id: v.id("memoryEntries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id)
    if (!entry) return null

    const hasAccess = await canAccessProject(ctx, entry.projectId)
    if (!hasAccess) return null

    return entry
  },
})

/**
 * Create a new memory entry.
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) throw new Error("Project not found or access denied")

    if (!args.title.trim()) throw new Error("Title is required")

    const now = Date.now()
    return await ctx.db.insert("memoryEntries", {
      projectId: args.projectId,
      type: args.type,
      title: args.title.trim(),
      content: args.content,
      tags: args.tags.map((t) => t.trim().toLowerCase()),
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update a memory entry.
 */
export const update = mutation({
  args: {
    id: v.id("memoryEntries"),
    type: v.optional(v.string()),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id)
    if (!entry) throw new Error("Entry not found")

    const hasAccess = await canAccessProject(ctx, entry.projectId)
    if (!hasAccess) throw new Error("Access denied")

    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.type !== undefined) updates.type = args.type
    if (args.title !== undefined) {
      if (!args.title.trim()) throw new Error("Title is required")
      updates.title = args.title.trim()
    }
    if (args.content !== undefined) updates.content = args.content
    if (args.tags !== undefined) updates.tags = args.tags.map((t: string) => t.trim().toLowerCase())

    await ctx.db.patch(args.id, updates)
  },
})

/**
 * Delete a memory entry.
 * Also removes it from any session's pinnedMemories.
 */
export const remove = mutation({
  args: { id: v.id("memoryEntries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id)
    if (!entry) throw new Error("Entry not found")

    const hasAccess = await canAccessProject(ctx, entry.projectId)
    if (!hasAccess) throw new Error("Access denied")

    // Clean up pins in sessions that reference this entry
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_project", (q) => q.eq("projectId", entry.projectId))
      .collect()

    for (const session of sessions) {
      if (session.pinnedMemories?.includes(args.id)) {
        await ctx.db.patch(session._id, {
          pinnedMemories: session.pinnedMemories.filter((id) => id !== args.id),
        })
      }
    }

    await ctx.db.delete(args.id)
  },
})

/**
 * Get entry counts grouped by type for a project.
 * Used by the drawer's peek state.
 */
export const countsByType = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const hasAccess = await canAccessProject(ctx, args.projectId)
    if (!hasAccess) return {}

    const entries = await ctx.db
      .query("memoryEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()

    const counts: Record<string, number> = {}
    for (const entry of entries) {
      counts[entry.type] = (counts[entry.type] ?? 0) + 1
    }
    return counts
  },
})
```

**Step 2: Verify types**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add convex/memoryEntries.ts
git commit -m "feat(memory): add memory entry CRUD with pin cleanup on delete"
```

---

## Task 4: Backend — Session Pin and Tag Mutations

**Files:**
- Modify: `convex/sessions.ts`

**Step 1: Add pin toggle and session tag mutations**

Add to `convex/sessions.ts`:

```ts
/**
 * Toggle a memory entry pin for the current session.
 */
export const toggleMemoryPin = mutation({
  args: {
    sessionId: v.id("sessions"),
    entryId: v.id("memoryEntries"),
  },
  handler: async (ctx, args) => {
    await requireSessionAccess(ctx, args.sessionId)

    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    const current = session.pinnedMemories ?? []
    const isPinned = current.includes(args.entryId)

    await ctx.db.patch(args.sessionId, {
      pinnedMemories: isPinned
        ? current.filter((id) => id !== args.entryId)
        : [...current, args.entryId],
      updatedAt: Date.now(),
    })

    return !isPinned // returns new pin state
  },
})

/**
 * Update session tags (for memory auto-selection).
 */
export const updateSessionTags = mutation({
  args: {
    sessionId: v.id("sessions"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSessionAccess(ctx, args.sessionId)

    await ctx.db.patch(args.sessionId, {
      sessionTags: args.tags.map((t) => t.trim().toLowerCase()),
      updatedAt: Date.now(),
    })
  },
})
```

**Step 2: Verify types**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add convex/sessions.ts
git commit -m "feat(memory): add session pin toggle and tag update mutations"
```

---

## Task 5: Backend — Memory Rendering for Context Assembly

**Files:**
- Create: `convex/lib/memoryRendering.ts`
- Create: `convex/lib/memoryRendering.test.ts`
- Modify: `convex/lib/context.ts`

**Step 1: Write the failing test**

Create `convex/lib/memoryRendering.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { renderMemoryBlock, scoreEntryByTags } from "./memoryRendering"

describe("scoreEntryByTags", () => {
  it("returns 0 when no tags overlap", () => {
    expect(scoreEntryByTags(["#ch19", "#renn"], ["#lien", "#ch1"])).toBe(0)
  })

  it("counts overlapping tags", () => {
    expect(scoreEntryByTags(["#ch19", "#renn"], ["#ch19", "#renn", "#plot"])).toBe(2)
  })

  it("handles empty session tags", () => {
    expect(scoreEntryByTags([], ["#ch19"])).toBe(0)
  })

  it("handles empty entry tags", () => {
    expect(scoreEntryByTags(["#ch19"], [])).toBe(0)
  })
})

describe("renderMemoryBlock", () => {
  const entries = [
    { type: "character", title: "Renn", content: "Chief engineer, POV ch 9-19", tags: ["#ch19", "#renn"] },
    { type: "character", title: "Lien", content: "Chief cartographer", tags: ["#ch1"] },
    { type: "tension", title: "Okafor location", content: "Ch 18 med bay vs ch 19 cargo bay", tags: ["#ch19", "#okafor"] },
    { type: "place", title: "Cargo Bay 3", content: "Cavernous, dim emergency lighting", tags: ["#ch19"] },
  ]

  it("groups entries by type and renders markdown", () => {
    const result = renderMemoryBlock(entries, ["#ch19"], [])
    expect(result).toContain("## Project Memory")
    expect(result).toContain("### character")
    expect(result).toContain("**Renn**")
  })

  it("orders types by total tag overlap score (most relevant first)", () => {
    const result = renderMemoryBlock(entries, ["#ch19"], [])
    // character has Renn (#ch19) = 1, tension has Okafor (#ch19) = 1, place has Cargo Bay (#ch19) = 1
    // But character has 2 entries total (more matched content) so it should come first or equal
    expect(result.indexOf("### character")).toBeLessThan(result.indexOf("### place"))
  })

  it("includes pinned entries regardless of tag match", () => {
    // Lien has tag #ch1, session tags are #ch19 — no overlap
    // But if we pin Lien, she should appear
    const lienEntry = entries[1]
    const result = renderMemoryBlock(entries, ["#ch19"], [lienEntry])
    expect(result).toContain("**Lien**")
  })

  it("excludes entries with no tag overlap and not pinned", () => {
    const result = renderMemoryBlock(entries, ["#ch1"], [])
    expect(result).toContain("**Lien**")
    expect(result).not.toContain("**Renn**")
    expect(result).not.toContain("**Okafor**")
  })

  it("returns empty string when no entries match", () => {
    const result = renderMemoryBlock(entries, ["#nomatch"], [])
    expect(result).toBe("")
  })

  it("handles empty entries array", () => {
    const result = renderMemoryBlock([], ["#ch19"], [])
    expect(result).toBe("")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run convex/lib/memoryRendering.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `convex/lib/memoryRendering.ts`:

```ts
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
 * @param entries All project memory entries
 * @param sessionTags Tags from the current session (for auto-selection)
 * @param pinnedEntries Entries that are pinned (always included)
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
      const contentPreview = entry.content.length > 200
        ? entry.content.slice(0, 200) + "..."
        : entry.content
      parts.push(`**${entry.title}** — ${contentPreview}`)
    }
  }

  return parts.join("\n")
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run convex/lib/memoryRendering.test.ts`
Expected: All tests PASS

**Step 5: Add internal query for context assembly**

Add to `convex/memoryEntries.ts`:

```ts
import { internalQuery } from "./_generated/server"

/**
 * Internal query to get all entries for a project.
 * Used by context assembly in scheduled actions (bypasses auth).
 */
export const listByProjectInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memoryEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()
  },
})
```

**Step 6: Commit**

```bash
git add convex/lib/memoryRendering.ts convex/lib/memoryRendering.test.ts convex/memoryEntries.ts
git commit -m "feat(memory): add memory rendering with tag scoring and tests"
```

---

## Task 6: Backend — Integrate Memory into Context Assembly

**Files:**
- Modify: `convex/lib/context.ts`
- Modify: `convex/claudeNode.ts`

**Step 1: Add memory rendering to `assembleSystemPromptWithContext`**

The memory block should be appended to the PERMANENT zone content in the system prompt. Modify `convex/lib/context.ts` to accept optional rendered memory:

```ts
/**
 * Assemble the full system prompt from PERMANENT blocks + optional rendered memory.
 */
export function assembleSystemPromptWithContext(
  blocks: Doc<"blocks">[],
  renderedMemory?: string
): string | undefined {
  const permanentBlocks = blocks
    .filter((b) => b.zone === "PERMANENT" && !b.isDraft)
    .sort((a, b) => a.position - b.position)

  const parts: string[] = permanentBlocks.map((b) => b.content)
  if (renderedMemory) {
    parts.push(renderedMemory)
  }

  if (parts.length === 0) return undefined
  return parts.join("\n\n")
}
```

**Important:** The same function signature change must be reflected in `assembleContext` and `assembleContextWithConversation` — add the optional `renderedMemory` parameter and include it in the PERMANENT zone output.

**Step 2: Fetch and render memory in `claudeNode.ts`**

In `streamBrainstormMessage`, after fetching blocks and before assembling the system prompt:

```ts
// Fetch memory entries if session belongs to a project
let renderedMemory: string | undefined
if (session?.projectId) {
  const memoryEntries = await ctx.runQuery(
    internal.memoryEntries.listByProjectInternal,
    { projectId: session.projectId }
  )
  if (memoryEntries.length > 0) {
    const sessionTags = session.sessionTags ?? []
    const pinnedIds = new Set(session.pinnedMemories ?? [])
    const pinnedEntries = memoryEntries.filter((e) => pinnedIds.has(e._id))

    renderedMemory = renderMemoryBlock(memoryEntries, sessionTags, pinnedEntries)
  }
}

// Pass rendered memory into system prompt assembly
let systemPrompt: string | undefined = assembleSystemPromptWithContext(blocks, renderedMemory)
```

**Step 3: Update existing tests**

Update `convex/lib/context.test.ts` — the `assembleSystemPromptWithContext` calls should still pass since `renderedMemory` is optional. Add one test:

```ts
it("includes rendered memory in system prompt when provided", () => {
  const blocks = [
    makeBlock({ content: "System prompt", type: "system_prompt", zone: "PERMANENT", position: 0 }),
    makeBlock({ content: "Reference doc", type: "note", zone: "PERMANENT", position: 1 }),
  ]
  const result = assembleSystemPromptWithContext(blocks, "## Project Memory\n\n### character\n**Renn** — engineer")
  expect(result).toContain("System prompt")
  expect(result).toContain("Reference doc")
  expect(result).toContain("## Project Memory")
  expect(result).toContain("**Renn**")
})
```

**Step 4: Run all tests**

Run: `pnpm vitest run`
Expected: All tests PASS

**Step 5: Verify types**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add convex/lib/context.ts convex/lib/context.test.ts convex/claudeNode.ts convex/memoryEntries.ts
git commit -m "feat(memory): integrate memory rendering into context assembly and brainstorm action"
```

---

## Task 7: Frontend — useMemory Hook

**Files:**
- Create: `src/hooks/useMemory.ts`

**Step 1: Create the hook**

```ts
/**
 * Hook for memory drawer state and operations.
 *
 * Provides queries and mutations for memory entries + session pins.
 * Requires a projectId (memory is project-scoped).
 */

import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

export function useMemory(
  projectId: Id<"projects"> | undefined,
  sessionId: Id<"sessions"> | undefined
) {
  // Schema
  const schema = useQuery(
    api.memorySchemas.getByProject,
    projectId ? { projectId } : "skip"
  )
  const schemaTemplates = useQuery(api.memorySchemas.listTemplates)
  const createSchemaFromTemplate = useMutation(api.memorySchemas.createFromTemplate)
  const updateSchemaTypes = useMutation(api.memorySchemas.updateTypes)

  // Entries
  const entries = useQuery(
    api.memoryEntries.listByProject,
    projectId ? { projectId } : "skip"
  )
  const createEntry = useMutation(api.memoryEntries.create)
  const updateEntry = useMutation(api.memoryEntries.update)
  const removeEntry = useMutation(api.memoryEntries.remove)

  // Entry counts by type (for peek state)
  const countsByType = useQuery(
    api.memoryEntries.countsByType,
    projectId ? { projectId } : "skip"
  )

  // Session pins
  const togglePin = useMutation(api.sessions.toggleMemoryPin)
  const updateSessionTags = useMutation(api.sessions.updateSessionTags)

  return {
    // Schema
    schema,
    schemaTemplates,
    createSchemaFromTemplate,
    updateSchemaTypes,
    // Entries
    entries: entries ?? [],
    createEntry,
    updateEntry,
    removeEntry,
    countsByType: countsByType ?? {},
    // Session
    togglePin: sessionId
      ? (entryId: Id<"memoryEntries">) => togglePin({ sessionId, entryId })
      : undefined,
    updateSessionTags: sessionId
      ? (tags: string[]) => updateSessionTags({ sessionId, tags })
      : undefined,
  }
}
```

**Step 2: Verify types**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/useMemory.ts
git commit -m "feat(memory): add useMemory hook for drawer state and operations"
```

---

## Task 8: Frontend — MemoryDrawer Component (Collapsed + Peek States)

**Files:**
- Create: `src/components/memory/MemoryDrawer.tsx`
- Modify: `src/routes/app/index.tsx` (add drawer to session page)

**Step 1: Create the drawer component**

Create `src/components/memory/MemoryDrawer.tsx`:

```tsx
/**
 * Bottom drawer for project memory.
 *
 * States:
 * - collapsed: thin bar showing entry count
 * - peek: ~200px showing type summary with counts
 * - full: ~50vh with search, filter, and entry list
 */

import { useState, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { springs } from "@/lib/motion"
import { useMemory } from "@/hooks/useMemory"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, X, Plus, Search, Pin } from "lucide-react"
import type { Id } from "../../../convex/_generated/dataModel"
import { cn } from "@/lib/utils"

interface MemoryDrawerProps {
  projectId: Id<"projects"> | undefined
  sessionId: Id<"sessions"> | undefined
  pinnedMemories?: Id<"memoryEntries">[]
}

export function MemoryDrawer({ projectId, sessionId, pinnedMemories }: MemoryDrawerProps) {
  const [state, setState] = useState<"collapsed" | "peek" | "full">("collapsed")
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const memory = useMemory(projectId, sessionId)
  const pinnedSet = useMemo(
    () => new Set(pinnedMemories ?? []),
    [pinnedMemories]
  )

  // Don't render if no project linked
  if (!projectId) return null

  const totalEntries = memory.entries.length

  // Filter entries for full view
  const filteredEntries = useMemo(() => {
    let filtered = memory.entries
    if (typeFilter) {
      filtered = filtered.filter((e) => e.type === typeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [memory.entries, typeFilter, searchQuery])

  // Type summary for peek view
  const typeSummary = useMemo(() => {
    if (!memory.schema?.types) return []
    return memory.schema.types.map((t) => ({
      ...t,
      count: memory.countsByType[t.name] ?? 0,
    }))
  }, [memory.schema, memory.countsByType])

  return (
    <>
      {/* Collapsed bar */}
      {state === "collapsed" && totalEntries > 0 && (
        <motion.div
          initial={{ y: 48 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 h-10 bg-card/95 backdrop-blur-sm border-t border-border flex items-center justify-center cursor-pointer z-30 hover:bg-accent/50 transition-colors"
          onClick={() => setState("peek")}
        >
          <ChevronUp className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {totalEntries} memor{totalEntries === 1 ? "y" : "ies"}
          </span>
        </motion.div>
      )}

      {/* Peek / Full drawer */}
      <AnimatePresence>
        {(state === "peek" || state === "full") && (
          <>
            {/* Backdrop (full only) */}
            {state === "full" && (
              <motion.div
                className="fixed inset-0 bg-black/20 z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setState("collapsed")}
              />
            )}

            {/* Drawer */}
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-xl z-40 flex flex-col"
              initial={{ y: "100%" }}
              animate={{ y: 0, height: state === "peek" ? 200 : "50vh" }}
              exit={{ y: "100%" }}
              transition={springs.smooth}
            >
              {/* Handle bar + controls */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    Memory ({totalEntries})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {state === "peek" && (
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setState("full")}>
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                  )}
                  {state === "full" && (
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => setState("peek")}>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => setState("collapsed")}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Peek: type summary */}
              {state === "peek" && (
                <div className="flex flex-wrap gap-2 px-4 py-3">
                  {typeSummary.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => {
                        setTypeFilter(t.name)
                        setState("full")
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border hover:bg-accent/50 transition-colors"
                      style={{ borderColor: t.color + "40" }}
                    >
                      <span>{t.icon}</span>
                      <span>{t.name}</span>
                      <span className="text-muted-foreground">({t.count})</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Full: search + filter + entry list */}
              {state === "full" && (
                <div className="flex flex-col flex-1 min-h-0">
                  {/* Search + filter bar */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search memories..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background"
                      />
                    </div>
                    {/* Type filter pills */}
                    <div className="flex gap-1 overflow-x-auto">
                      <button
                        onClick={() => setTypeFilter(null)}
                        className={cn(
                          "text-xs px-2 py-1 rounded-full whitespace-nowrap",
                          !typeFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                        )}
                      >
                        All
                      </button>
                      {typeSummary.map((t) => (
                        <button
                          key={t.name}
                          onClick={() => setTypeFilter(typeFilter === t.name ? null : t.name)}
                          className={cn(
                            "text-xs px-2 py-1 rounded-full whitespace-nowrap",
                            typeFilter === t.name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {t.icon} {t.name} ({t.count})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Entry list */}
                  <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
                    {filteredEntries.map((entry) => (
                      <div
                        key={entry._id}
                        className="group rounded-lg border border-border p-2.5 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-medium">
                                {entry.type}
                              </span>
                              <span className="text-sm font-medium truncate">
                                {entry.title}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {entry.content}
                            </p>
                            {entry.tags.length > 0 && (
                              <div className="flex gap-1 mt-1.5">
                                {entry.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground cursor-pointer hover:bg-accent"
                                    onClick={() => setSearchQuery(tag)}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {memory.togglePin && (
                            <button
                              onClick={() => memory.togglePin!(entry._id)}
                              className={cn(
                                "shrink-0 p-1 rounded hover:bg-accent",
                                pinnedSet.has(entry._id) ? "text-primary" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                              )}
                              title={pinnedSet.has(entry._id) ? "Unpin" : "Pin to this session"}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {filteredEntries.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        {searchQuery || typeFilter ? "No matching entries" : "No memory entries yet"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
```

**Step 2: Add drawer to session page**

In `src/routes/app/index.tsx`, in the `HomePage` component's return:

1. Add import: `import { MemoryDrawer } from "@/components/memory/MemoryDrawer"`
2. Query the session to get `projectId` and `pinnedMemories`:

```tsx
const sessionData = useQuery(api.sessions.get, sessionId ? { id: sessionId } : "skip")
```

3. Add before the closing `</div>` of the main return (after all dialogs, around line 1118):

```tsx
{/* Memory drawer */}
<MemoryDrawer
  projectId={sessionData?.projectId ?? undefined}
  sessionId={sessionId ?? undefined}
  pinnedMemories={sessionData?.pinnedMemories}
/>
```

**Step 3: Verify types**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/memory/MemoryDrawer.tsx src/routes/app/index.tsx
git commit -m "feat(memory): add bottom drawer UI with collapsed/peek/full states"
```

---

## Task 9: Frontend — Create Entry Form

**Files:**
- Create: `src/components/memory/CreateEntryForm.tsx`
- Modify: `src/components/memory/MemoryDrawer.tsx` (add create button + form)

**Step 1: Create the form component**

Create `src/components/memory/CreateEntryForm.tsx`:

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { Id } from "../../../convex/_generated/dataModel"

interface MemoryType {
  name: string
  color: string
  icon: string
}

interface CreateEntryFormProps {
  projectId: Id<"projects">
  types: MemoryType[]
  onSubmit: (args: {
    projectId: Id<"projects">
    type: string
    title: string
    content: string
    tags: string[]
  }) => Promise<unknown>
  onCancel: () => void
}

export function CreateEntryForm({ projectId, types, onSubmit, onCancel }: CreateEntryFormProps) {
  const [type, setType] = useState(types[0]?.name ?? "note")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`))

      await onSubmit({
        projectId,
        type,
        title: title.trim(),
        content: content.trim(),
        tags,
      })
      onCancel() // Close form on success
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded border border-input bg-background px-2 py-1 text-xs"
        >
          {types.map((t) => (
            <option key={t.name} value={t.name}>
              {t.icon} {t.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm"
          autoFocus
        />
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Content..."
        rows={3}
        className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm resize-none"
      />
      <input
        type="text"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        placeholder="Tags (comma-separated): #ch19, #renn, #foundational"
        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
      />
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={!title.trim() || isSubmitting}>
          {isSubmitting ? "Adding..." : "Add Entry"}
        </Button>
      </div>
    </form>
  )
}
```

**Step 2: Wire into MemoryDrawer**

In `MemoryDrawer.tsx`:
1. Add `import { CreateEntryForm } from "./CreateEntryForm"`
2. Add state: `const [isCreating, setIsCreating] = useState(false)`
3. Add a `+` button in the full-state header
4. Show `CreateEntryForm` at the top of the entry list when `isCreating`

```tsx
{/* Add button in full state header */}
{state === "full" && projectId && memory.schema && (
  <Button
    variant="ghost"
    size="sm"
    className="h-7"
    onClick={() => setIsCreating(true)}
  >
    <Plus className="w-4 h-4" />
  </Button>
)}

{/* Create form at top of entry list */}
{isCreating && projectId && memory.schema && (
  <CreateEntryForm
    projectId={projectId}
    types={memory.schema.types}
    onSubmit={(args) => memory.createEntry(args)}
    onCancel={() => setIsCreating(false)}
  />
)}
```

**Step 3: Verify types**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/memory/CreateEntryForm.tsx src/components/memory/MemoryDrawer.tsx
git commit -m "feat(memory): add create entry form in drawer"
```

---

## Task 10: Frontend — Inline Entry Editing + Delete

**Files:**
- Modify: `src/components/memory/MemoryDrawer.tsx` (add edit/delete to entry cards)

**Step 1: Add inline edit state and handlers**

In the entry card rendering within `MemoryDrawer.tsx`, add an editing mode:

- Clicking the entry title/content expands it into editable fields
- State: `const [editingId, setEditingId] = useState<string | null>(null)`
- Each entry card gets an edit button (pencil icon, appears on hover)
- Inline edit: title input, content textarea, type select, tags input
- Save and Cancel buttons
- Delete button with confirmation (use `ConfirmDialog` from `@/components/ui/confirm-dialog`)

**Step 2: Implement delete with confirmation**

```tsx
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

// State
const [deletingId, setDeletingId] = useState<Id<"memoryEntries"> | null>(null)

// In entry card
<button onClick={() => setDeletingId(entry._id)} className="text-destructive ...">
  <Trash2 className="w-3.5 h-3.5" />
</button>

// Dialog at bottom
<ConfirmDialog
  isOpen={!!deletingId}
  onClose={() => setDeletingId(null)}
  onConfirm={async () => {
    if (deletingId) {
      await memory.removeEntry({ id: deletingId })
      setDeletingId(null)
    }
  }}
  title="Delete Memory Entry"
  description="This entry will be permanently removed from the project."
  confirmLabel="Delete"
  variant="destructive"
/>
```

**Step 3: Verify types**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/memory/MemoryDrawer.tsx
git commit -m "feat(memory): add inline editing and delete for memory entries"
```

---

## Task 11: Frontend — Schema Setup (First-Time Experience)

**Files:**
- Modify: `src/components/memory/MemoryDrawer.tsx`

**Step 1: Add schema initialization flow**

When a project has no `memorySchemas` document, the drawer (in peek or full state) shows a setup prompt:

```tsx
{/* No schema yet — show setup */}
{!memory.schema && projectId && (
  <div className="px-4 py-6 text-center space-y-3">
    <p className="text-sm text-muted-foreground">
      Choose a starter template for your memory types:
    </p>
    <div className="flex flex-wrap justify-center gap-2">
      {memory.schemaTemplates?.map((t) => (
        <Button
          key={t.name}
          variant="outline"
          size="sm"
          onClick={() => memory.createSchemaFromTemplate({ projectId, templateName: t.name })}
          className="text-xs"
        >
          {t.name} ({t.typeCount} types)
        </Button>
      ))}
    </div>
  </div>
)}
```

**Step 2: Verify types**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/memory/MemoryDrawer.tsx
git commit -m "feat(memory): add schema template selection for first-time setup"
```

---

## Task 12: Session Tags UI

**Files:**
- Modify: `src/components/memory/MemoryDrawer.tsx`

**Step 1: Add session tags editor in the full-state header**

Below the search bar in full state, add a tags section:

```tsx
{/* Session tags */}
<div className="flex items-center gap-2 px-4 py-1.5 border-b border-border text-xs">
  <span className="text-muted-foreground shrink-0">Session tags:</span>
  <div className="flex gap-1 flex-wrap">
    {(sessionData?.sessionTags ?? []).map((tag) => (
      <span key={tag} className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
        {tag}
      </span>
    ))}
  </div>
  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsEditingTags(true)}>
    Edit
  </Button>
</div>
```

Session tags editor: a text input that accepts comma-separated tags, with a Save button calling `memory.updateSessionTags`.

**Step 2: Pass sessionTags through**

The drawer needs access to current session tags. Add to `MemoryDrawerProps`:

```ts
sessionTags?: string[]
```

And pass from `index.tsx`:

```tsx
sessionTags={sessionData?.sessionTags}
```

**Step 3: Verify types**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/memory/MemoryDrawer.tsx src/routes/app/index.tsx
git commit -m "feat(memory): add session tags editor for memory auto-selection"
```

---

## Task 13: Integration Testing

**Files:**
- No new files — manual testing

**Step 1: Create a test project**

1. Go to Projects page, create "Test Memory Project"
2. Create a session within the project
3. Navigate to the session

**Step 2: Verify drawer appears**

Expected: Bottom bar shows "0 memories" (collapsed state)

**Step 3: Set up memory schema**

1. Click the collapsed bar → peek state
2. See "Choose a starter template" prompt
3. Select "PM" template
4. Verify peek shows: `learning (0) | decision (0) | stakeholder (0) | tension (0)`

**Step 4: Create entries**

1. Expand to full state
2. Click `+` to create entry
3. Create: type=learning, title="Gas fees", content="Cost per transaction on-chain", tags="#blockchain, #costs"
4. Create: type=tension, title="Wallet UX", content="CTO wants on-chain, ops wants simplicity", tags="#ux, #cto"
5. Verify entries appear in list

**Step 5: Test search and filter**

1. Search "gas" → only "Gas fees" entry visible
2. Click "tension" filter → only "Wallet UX" visible
3. Clear filters → both visible

**Step 6: Test pins**

1. Pin "Gas fees" entry
2. Verify pin icon turns blue/primary

**Step 7: Test brainstorm with memory context**

1. Add session tags: `#blockchain, #costs`
2. Open brainstorm dialog
3. Send a message
4. Verify the LLM response acknowledges the memory context (gas fees learning should be in context)

**Step 8: Commit any fixes**

```bash
git add -A
git commit -m "fix(memory): integration test fixes"
```

---

## Task 14: Deploy and Verify on VPN

**Step 1: Push to remote**

```bash
git push origin main
```

**Step 2: Deploy per `deploy/local/README.md`**

```bash
ssh ubuntu@192.168.87.58 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd ~/contextforge/ContextForgeTS && git pull && pnpm install && VITE_CONVEX_URL=http://192.168.87.58:3210 pnpm build:standalone'
# Deploy Convex functions
ssh ubuntu@192.168.87.58 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd ~/contextforge/ContextForgeTS && npx convex deploy --yes'
# Restart frontend
ssh ubuntu@192.168.87.58 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && pm2 restart contextforge-frontend'
```

**Step 3: Verify on VPN**

Open http://192.168.87.58:8080, navigate to a project session, and verify:
- Drawer appears at bottom
- Schema setup works
- Entries can be created/edited/deleted
- Pins toggle correctly
- Check Settings > About for correct build hash
