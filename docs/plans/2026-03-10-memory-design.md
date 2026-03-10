# ContextForge Memory System — Design Document

Date: 2026-03-10
Status: In Progress (brainstorming)
Scenarios: [2026-03-10-memory-validation-scenarios.md](2026-03-10-memory-validation-scenarios.md)

---

## Problem Statement

ContextForge treats blocks as both documents AND knowledge. Repeating context from one doc to another is wrong. We need a separate knowledge store — an "inventory system" for whole workflows.

---

## Core Design Decisions

| Decision | Rationale |
|----------|-----------|
| Memory is separate from blocks | Blocks = workspace (documents). Memory = knowledge store (index cards). Different concerns. |
| User-defined memory types | PM needs 4 types, fiction needs 7. No single schema works. |
| Starter templates with prebuilt types | Lower barrier to entry. Users can also save custom schemas as templates. |
| Lightweight entries: `{ type, title, content, tags }` | YAGNI. No confidence scores, no evidence chains, no entity linking. |
| Single Memory block in PERMANENT zone | Renders relevant memory entries into LLM context. One integration point. |
| Bottom drawer UI | Collapsed/peek/full states. Shows full project memory, not session-scoped. |

---

## Memory Lifecycle

| Question | Decision | Rationale |
|----------|----------|-----------|
| Staleness/archival | No mechanism — user deletes manually | YAGNI. Only tensions go stale, and user knows when. No TTL, no auto-expiry. |
| Context selection | Tag matching + manual pins | Tags auto-select 80%. Pins handle exceptions. Covers all 4 scenarios. |
| Pin carryover | Clean slate per session | Stale pins are worse than missing pins (waste tokens invisibly). Tags handle cross-session consistency. |

### Tag matching mechanism

Session tags (from template or working blocks) are matched against entry tags. Entries with overlapping tags are auto-selected for the memory block. Pinned entries are always included regardless of tags.

---

## Data Model (Convex Schema)

```ts
// Memory type definitions per project
memorySchemas: defineTable({
  projectId: v.id("projects"),
  types: v.array(v.object({
    name: v.string(),        // "character", "decision", "tension"
    color: v.string(),       // for drawer badges
    icon: v.string(),        // emoji or lucide icon name
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_project", ["projectId"]),

// Individual memory entries
memoryEntries: defineTable({
  projectId: v.id("projects"),
  type: v.string(),           // references memorySchemas.types[].name
  title: v.string(),
  content: v.string(),
  tags: v.array(v.string()),  // ["#ch19", "#renn", "#foundational"]
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_project", ["projectId"])
  .index("by_project_type", ["projectId", "type"]),
```

### Design notes

- **Pins stored on session**, not on entries: `session.pinnedMemories: v.array(v.id("memoryEntries"))` — pins reset per session by not carrying over the array.
- **Tag indexing**: Convex doesn't support array element indexes well. Query `by_project` and filter in JS. With <100 entries per project (all scenarios were 23-63), this is fine.
- **No join tables** for pins or tags. Arrays on existing records. YAGNI.
- **`type` is a string** referencing `memorySchemas.types[].name`, not a foreign key. Allows renaming/deleting types without cascading updates (entries keep the string, UI shows "unknown type" badge if schema changes).

---

## Starter Templates

| Template | Types |
|----------|-------|
| General | `note`, `decision`, `tension` |
| Fiction | `character`, `place`, `lore_rule`, `plot_thread`, `timeline`, `voice_note`, `tension` |
| PM | `learning`, `decision`, `stakeholder`, `tension` |
| Game Design | `lore_rule`, `mechanic`, `conflict_resolution`, `tension` |
| System Architecture | `service`, `event`, `decision`, `constraint`, `infra_pattern`, `tension`, `squad_context` |
| Dev | `decision`, `constraint`, `pattern`, `tension` |

Users can save their custom schema as a new template (same mechanism as saving session templates).

---

## UI: Bottom Drawer

### States

1. **Collapsed** — thin bar at bottom, shows entry count badge: "47 memories"
2. **Peek** — ~200px, shows type summary with counts (like scenario mockups): `character (8) | place (6) | tension (3)`
3. **Full** — ~50% viewport, shows entry list with search/filter

### Features

- **Search bar** — full-text across title + content
- **Type filter** — click type badge to filter
- **Tag filter** — click tag to filter, combinable with type
- **Inline editing** — click entry to expand, edit title/content/tags/type in place
- **Create entry** — "+" button, select type, fill fields
- **Delete entry** — trash icon with confirmation
- **Pin toggle** — pin icon on each entry (session-scoped)
- **Entry count per type** — always visible in peek/full states

### NOT included (YAGNI)

- Drag to reorder entries
- Entry-to-entry links/references
- Bulk operations
- Import/export
- Version history on entries

---

## Memory Block Rendering

The Memory block is a special block type in the PERMANENT zone. It doesn't have user-editable content — its content is auto-generated from memory entries.

### Token budget

No budget. Load all tag-matched and pinned entries. Show a warning in the UI if rendered memory exceeds ~8k tokens. Revisit if projects grow beyond 200 entries.

**Future drop order (not implemented now):** least tag overlap first, pinned entries never dropped.

### Rendering logic

1. Collect session tags: template defaults + user-added session-level tags (merged)
2. Query all project memory entries
3. Score entries by tag overlap with session tags
4. Always include pinned entries (score = infinity)
5. Group entries by type, order types by total tag overlap score (most relevant type first)
6. Within each type, sort entries by tag overlap score descending
7. Render all matched entries as structured text

### Session tags

Template provides default tags, user overrides/adds per session. Tags merge (template defaults + session-specific). No tag removal needed — unmatched template tags are no-ops.

### Rendered format (in LLM context)

Grouped by type, types ordered by relevance. Most tag-matched type first.

```
## Project Memory

### character (3 matched)
**Renn** — chief engineer, POV ch 9-19, speaks in technical metaphors...
**Lien** — chief cartographer, POV ch 1-8, clipped sentences...
**Okafor** — ship medic, POV ch 12-15...

### tension (2 matched)
**Okafor location ch18->19** — Ch 18 ends with Okafor in med bay...

### place (1 matched)
**Cargo Bay 3** — cavernous, dim emergency lighting...
```

---

## Resolved Questions

| # | Question | Decision |
|---|----------|----------|
| 1 | Token budget | No budget — load everything, warn at ~8k tokens |
| 2 | Rendering format | Grouped by type, types ordered by relevance (most tag-matched first) |
| 3 | Drawer vs existing UI | Purely additive — bottom drawer, zero changes to block editor |
| 4 | Session tags | Template defaults + user overrides per session (merged) |
| 5 | Drop order | Future: least tag overlap first, pinned never dropped (not implemented now) |
