# Research Pipeline Design

**Status**: Design (v2.0 — revised)
**Date**: 2026-04-03
**Scope**: Add placeholder block type + web-search research to populate it (research → brainstorm → formalize → verify)

---

## Problem

The ContextForge pipeline starts at brainstorm. There is no way to ground ideas in current information before brainstorming. Users must research externally and manually paste findings into blocks.

The solution is a **placeholder block** — a new general-purpose block type where the user writes a spec (what they want), and an automated action fills it. The first use case for placeholders is web research.

## Placeholder Block Concept

A placeholder block has two fields:
- **`placeholderSpec`**: what the user wrote — the request/spec. Preserved permanently.
- **`content`**: the filled result. Initially empty; populated by an action.
- **`placeholderStatus`**: `"empty"` | `"running"` | `"filled"` — explicit state for UI.

The type is `"placeholder"`. Future uses (beyond research) will reuse this same type with different spec formats and different filling actions.

## Research Workflow

1. User creates a `placeholder` block in WORKING zone
2. User writes research spec in `placeholderSpec`: topic, output format, depth
3. User clicks **Run Research** → triggers one generation per session
4. Claude uses WebSearch + WebFetch to research the spec
5. Result streams into the generation record (visible as progress)
6. On complete: result written to block `content`, status → `"filled"`
7. Session is now ready for brainstorm with research grounded context

**Constraint: exactly 1 placeholder block per session.** Enforced at mutation level.

---

## Architecture

### Schema changes (`convex/schema.ts`)

Two new optional fields on the `blocks` table:

```typescript
placeholderSpec: v.optional(v.string()),
placeholderStatus: v.optional(v.union(
  v.literal("empty"),
  v.literal("running"),
  v.literal("filled")
)),
```

No change to the `type` field — it's already `v.string()`.

### New action: `runResearchAction` in `convex/claudeNode.ts`

Args: `{ generationId, sessionId, blockId }`

Behavior:
- Reads placeholder block's `placeholderSpec`
- Assembles system prompt from PERMANENT blocks (persona, constraints)
- Calls Claude SDK with `allowedTools: ["WebSearch", "WebFetch"]`, `maxTurns: 10`
- Streams into generation record (same buffer/flush/cancellation pattern as brainstorm)
- On complete: writes final text to block `content` via internal mutation, sets `placeholderStatus: "filled"`
- On error: sets `placeholderStatus: "empty"` (reset for retry)
- No session resume (research is always fresh)
- No `NO_TOOLS_SUFFIX`, no `NO_SELF_TALK_SUFFIX`
- Appends `RESEARCH_SUFFIX` to system prompt

### New constant in `convex/lib/context.ts`

```typescript
export const RESEARCH_SUFFIX = `
RESEARCH MODE: You have access to WebSearch and WebFetch tools. Use them to thoroughly research the user's request before responding. Synthesize findings into a clear, structured report. Cite sources inline. If you cannot find something, say so explicitly.`
```

### Context assembly update in `convex/lib/context.ts`

`isBlockExcluded` adds one rule: placeholder blocks with empty `content` are excluded.

```typescript
if (block.type === "placeholder" && !block.content) return true
```

### New mutation: `startResearch` in `convex/research.ts` (new file)

Args: `{ sessionId }`

Steps:
1. Find placeholder block for session — error if none or if `placeholderSpec` is empty
2. Error if another research generation is currently `"streaming"` for this session
3. Create generation record (`provider: "claude"`, `status: "streaming"`)
4. Set `placeholderStatus: "running"` on block
5. Schedule `runResearchAction`
6. Return `{ generationId, blockId }`

### New internal mutation: `fillPlaceholderBlock` in `convex/research.ts`

Args: `{ blockId, content }` — called by `runResearchAction` on completion.

Sets `content`, `placeholderStatus: "filled"`, `updatedAt` on block.

### New query: `getPlaceholderBlock` in `convex/research.ts`

Args: `{ sessionId }` — returns the placeholder block for the session (or null).

### New frontend component: `PlaceholderBlock.tsx`

Renders based on `placeholderStatus`:

- **`empty` (no spec)**: textarea to write spec + "Save" button
- **`empty` (has spec)**: shows spec + "Run Research" button
- **`running`**: shows spec + streaming progress (subscribes to active generation) + cancel button
- **`filled`**: shows content (research report) + collapsible spec + "Re-run" button

### Session view integration

The existing block list checks `block.type === "placeholder"` and renders `<PlaceholderBlock>` instead of the default block renderer.

An "Add Placeholder" button in the WORKING zone header — disabled if a placeholder already exists for the session.

---

## Data Flow

```
User writes spec → saves to placeholderSpec
User clicks Run Research
  → startResearch mutation
    → creates generation
    → sets placeholderStatus: "running"
    → schedules runResearchAction
  → runResearchAction
    → reads placeholderSpec
    → assembles system prompt from PERMANENT blocks
    → SDK: allowedTools=["WebSearch","WebFetch"], maxTurns=10
    → streams text → generation.text updates
  → PlaceholderBlock subscribes to generation
    → shows streaming text in real time
  → generation completes
    → fillPlaceholderBlock: block.content = result, status = "filled"
    → generation.status = "complete"
  → PlaceholderBlock re-renders in filled state
  → Content is now available in brainstorm context (WORKING zone)
```

---

## Error Handling

| Error | Behavior |
|---|---|
| No placeholder block | `startResearch` throws "No placeholder block found" |
| Empty spec | `startResearch` throws "Placeholder spec is required" |
| Research already running | `startResearch` throws "Research already in progress" |
| SDK error | `placeholderStatus` reset to `"empty"`, generation marked error |
| Tool call failure | Claude reports inline in text, generation completes normally |
| maxTurns exceeded | SDK stops, whatever was generated is saved |

---

## What's Explicitly Out of Scope

- Multiple placeholder blocks per session
- Research for Ollama/OpenRouter providers
- Auto-triggering research on session load
- Storing web search queries/URLs separately from the report
- New `contextMode` for placeholder blocks (handled by `isBlockExcluded` logic)
- Snapshot/template support for placeholder blocks (they serialize as any other block)
