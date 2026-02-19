# Linked Blocks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow a block to exist in multiple sessions — editing content in one updates it everywhere. Per-session zone/position/draft stay independent.

**Architecture:** Add optional `refBlockId` and `contentHash` fields to the blocks table. Reference blocks delegate content to a canonical block. A `resolveBlocks()` helper hydrates content before it reaches context assembly, templates, snapshots, or the UI. Content hash enables automatic duplicate detection on create/edit.

**Tech Stack:** Convex (schema, mutations, queries), React (UI components), Vitest (unit tests), shadcn/ui (Popover, Command), framer-motion (animations), lucide-react (Link2 icon)

**Constraint:** DnD code is OFF LIMITS for changes.

**Design doc:** [linked-blocks-shaping.md](./2026-02-19-linked-blocks-shaping.md)

---

## Task 1: Schema — add refBlockId, contentHash, and index

**Files:**
- Modify: `convex/schema.ts:110-138` (blocks table)

**Step 1: Add fields to blocks table**

Add after the `metadata` field (line 134):

```typescript
// Linked block reference — points to canonical block in another session
refBlockId: v.optional(v.id("blocks")),
// Content hash for duplicate detection (SHA-256 hex, first 16 chars)
contentHash: v.optional(v.string()),
```

Add new index after `by_session_zone` (line 138):

```typescript
.index("by_content_hash", ["contentHash"])
```

**Step 2: Verify build passes**

Run: `pnpm build`
Expected: Success (no type errors — fields are optional)

**Step 3: Deploy schema**

Run: `npx convex dev` (if running) will auto-deploy, or `npx convex deploy --yes` for prod

**Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(linked-blocks): add refBlockId, contentHash fields and index"
```

---

## Task 2: Content resolution helper — resolveBlocks()

**Files:**
- Create: `convex/lib/resolve.ts`
- Test: `convex/lib/resolve.test.ts`

**Step 1: Write the unit test**

Create `convex/lib/resolve.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { resolveBlockContent } from "./resolve"

// Mock block shapes (not full Convex docs, just the fields we need)
const makeBlock = (overrides: Record<string, unknown> = {}) => ({
  _id: "block1" as any,
  content: "original content",
  refBlockId: undefined as any,
  ...overrides,
})

describe("resolveBlockContent", () => {
  it("returns own content for regular blocks", () => {
    const block = makeBlock({ content: "hello" })
    const result = resolveBlockContent(block, new Map())
    expect(result).toBe("hello")
  })

  it("returns canonical content for linked blocks", () => {
    const canonical = makeBlock({ _id: "canonical1", content: "canonical content" })
    const ref = makeBlock({ _id: "ref1", content: "", refBlockId: "canonical1" })
    const lookup = new Map([["canonical1", canonical]])
    const result = resolveBlockContent(ref, lookup)
    expect(result).toBe("canonical content")
  })

  it("returns empty string if canonical not found (dangling ref)", () => {
    const ref = makeBlock({ _id: "ref1", content: "", refBlockId: "deleted1" })
    const result = resolveBlockContent(ref, new Map())
    expect(result).toBe("")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run convex/lib/resolve.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `convex/lib/resolve.ts`:

```typescript
import type { Doc } from "../_generated/dataModel"

/**
 * Resolve a single block's effective content.
 * If it has a refBlockId, look up the canonical block in the provided map.
 * Pure function — no DB access. Caller must pre-fetch canonical blocks.
 */
export function resolveBlockContent(
  block: Pick<Doc<"blocks">, "content" | "refBlockId">,
  canonicalLookup: Map<string, Pick<Doc<"blocks">, "content">>
): string {
  if (!block.refBlockId) {
    return block.content
  }
  const canonical = canonicalLookup.get(block.refBlockId as string)
  return canonical?.content ?? ""
}

/**
 * Resolve content for an array of blocks.
 * Returns new array with content replaced by canonical content where applicable.
 * Does NOT mutate input blocks.
 */
export function resolveBlocks<T extends Pick<Doc<"blocks">, "content" | "refBlockId">>(
  blocks: T[],
  canonicalLookup: Map<string, Pick<Doc<"blocks">, "content">>
): (T & { content: string })[] {
  return blocks.map((block) => ({
    ...block,
    content: resolveBlockContent(block, canonicalLookup),
  }))
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run convex/lib/resolve.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/lib/resolve.ts convex/lib/resolve.test.ts
git commit -m "feat(linked-blocks): add resolveBlocks content resolution helper"
```

---

## Task 3: Content hash utility

**Files:**
- Create: `convex/lib/contentHash.ts`
- Test: `convex/lib/contentHash.test.ts`

**Step 1: Write the test**

Create `convex/lib/contentHash.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { computeContentHash } from "./contentHash"

describe("computeContentHash", () => {
  it("returns consistent hash for same content", () => {
    const h1 = computeContentHash("hello world")
    const h2 = computeContentHash("hello world")
    expect(h1).toBe(h2)
  })

  it("returns different hash for different content", () => {
    const h1 = computeContentHash("hello world")
    const h2 = computeContentHash("hello world!")
    expect(h1).not.toBe(h2)
  })

  it("returns 16-char hex string", () => {
    const h = computeContentHash("test content")
    expect(h).toMatch(/^[0-9a-f]{16}$/)
  })

  it("returns empty string for empty content", () => {
    const h = computeContentHash("")
    expect(h).toBe("")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run convex/lib/contentHash.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create `convex/lib/contentHash.ts`:

```typescript
/**
 * Compute a content hash for duplicate detection.
 * Uses a simple DJB2-based hash (no crypto dependency needed in Convex).
 * Returns first 16 hex chars for compact storage + index efficiency.
 * Returns empty string for empty content (no hash for empty blocks).
 */
export function computeContentHash(content: string): string {
  if (!content) return ""

  // DJB2 hash — fast, good distribution, no dependencies
  let h1 = 0x811c9dc5 // FNV offset basis
  let h2 = 0x01000193 // FNV prime seed
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    h1 = ((h1 ^ c) * 0x01000193) >>> 0
    h2 = ((h2 ^ c) * 0x811c9dc5) >>> 0
  }

  // Combine into 16-char hex
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run convex/lib/contentHash.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/lib/contentHash.ts convex/lib/contentHash.test.ts
git commit -m "feat(linked-blocks): add content hash utility for duplicate detection"
```

---

## Task 4: Server-side resolution in block queries

**Files:**
- Modify: `convex/blocks.ts` (list, listByZone, get queries)

This is the key change — queries return resolved content so all clients get correct data without any client-side changes.

**Step 1: Add fetchCanonicalLookup helper to blocks.ts**

Add after the imports (around line 8):

```typescript
import { resolveBlocks } from "./lib/resolve"

// Fetch canonical blocks for a set of linked blocks, returns lookup map
async function fetchCanonicalLookup(
  ctx: { db: any },
  blocks: Doc<"blocks">[]
): Promise<Map<string, Pick<Doc<"blocks">, "content">>> {
  const refIds = blocks
    .filter((b) => b.refBlockId)
    .map((b) => b.refBlockId!)
  const uniqueIds = [...new Set(refIds.map(String))]

  const lookup = new Map<string, Pick<Doc<"blocks">, "content">>()
  await Promise.all(
    uniqueIds.map(async (id) => {
      const canonical = await ctx.db.get(id as Id<"blocks">)
      if (canonical) {
        lookup.set(id, { content: canonical.content })
      }
    })
  )
  return lookup
}
```

**Step 2: Update the `list` query**

In the `list` handler (around line 62), after fetching blocks, add resolution:

```typescript
// Before return:
const lookup = await fetchCanonicalLookup(ctx, blocks)
return resolveBlocks(blocks, lookup)
```

**Step 3: Update the `listByZone` query**

Same pattern — resolve before returning.

**Step 4: Update the `get` query**

For single block: if `block.refBlockId`, fetch canonical and replace content.

**Step 5: Update `listBySessionInternal`**

Same pattern — resolve before returning.

**Step 6: Verify build passes**

Run: `pnpm build`
Expected: Success

**Step 7: Commit**

```bash
git add convex/blocks.ts
git commit -m "feat(linked-blocks): resolve refBlockId content in all block queries"
```

---

## Task 5: Block mutations — createLinked, update guard, delete safety

**Files:**
- Modify: `convex/blocks.ts`

**Step 1: Add `createLinked` mutation**

New mutation to create a reference block in a target session:

```typescript
export const createLinked = mutation({
  args: {
    sessionId: v.id("sessions"),
    refBlockId: v.id("blocks"),
    zone: v.optional(zoneValidator),
  },
  handler: async (ctx, args) => {
    await requireSessionAccess(ctx, args.sessionId)
    const session = await ctx.db.get(args.sessionId)
    if (!session) throw new Error("Session not found")

    // Fetch canonical block to get type, tokens, metadata
    const canonical = await ctx.db.get(args.refBlockId)
    if (!canonical) throw new Error("Referenced block not found")

    const zone = args.zone ?? canonical.zone as Zone
    const position = await getNextPosition(ctx, args.sessionId, zone)
    const now = Date.now()

    await ctx.db.patch(args.sessionId, { updatedAt: now })

    return await ctx.db.insert("blocks", {
      sessionId: args.sessionId,
      content: "", // Empty — content comes from canonical
      type: canonical.type,
      zone,
      position,
      createdAt: now,
      updatedAt: now,
      refBlockId: args.refBlockId,
      tokens: canonical.tokens,
      originalTokens: canonical.originalTokens,
      tokenModel: canonical.tokenModel,
    })
  },
})
```

**Step 2: Update `update` mutation to follow refs**

In the `update` handler, after fetching the block, add:

```typescript
// If this is a linked block, update the canonical instead
let targetId = args.id
if (block.refBlockId) {
  const canonical = await ctx.db.get(block.refBlockId)
  if (!canonical) throw new Error("Canonical block not found")
  targetId = canonical._id
}
```

Then use `targetId` for the patch. Also update tokens on canonical AND refresh tokens on all referencing blocks.

**Step 3: Update `remove` to handle dangling refs**

In the `remove` handler, before deleting, add:

```typescript
// Promote any blocks that reference this one
const referencingBlocks = await ctx.db
  .query("blocks")
  .filter((q) => q.eq(q.field("refBlockId"), args.id))
  .collect()
for (const ref of referencingBlocks) {
  await ctx.db.patch(ref._id, {
    content: block.content,
    refBlockId: undefined,
    tokens: block.tokens,
    originalTokens: block.originalTokens,
    tokenModel: block.tokenModel,
  })
}
```

**Step 4: Add `unlink` mutation**

```typescript
export const unlink = mutation({
  args: { id: v.id("blocks") },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    if (!block) throw new Error("Block not found")
    if (!block.refBlockId) throw new Error("Block is not linked")

    await requireSessionAccess(ctx, block.sessionId)

    const canonical = await ctx.db.get(block.refBlockId)
    const content = canonical?.content ?? ""
    const tokens = canonical?.tokens ?? countTokens(content)

    await ctx.db.patch(args.id, {
      content,
      refBlockId: undefined,
      tokens,
      originalTokens: tokens,
      tokenModel: DEFAULT_TOKEN_MODEL,
      updatedAt: Date.now(),
    })
  },
})
```

**Step 5: Guard `compress` mutation**

At the top of the compress handler, add:

```typescript
if (block.refBlockId) throw new Error("Cannot compress a linked block — unlink first")
```

**Step 6: Verify build passes**

Run: `pnpm build`
Expected: Success

**Step 7: Commit**

```bash
git add convex/blocks.ts
git commit -m "feat(linked-blocks): add createLinked, unlink mutations; update/delete safety"
```

---

## Task 6: Session delete — promote references before cascade

**Files:**
- Modify: `convex/sessions.ts`

**Step 1: Add promoteReferences helper**

Add a helper function that finds and promotes all blocks referencing blocks in a given session:

```typescript
async function promoteReferencesForSession(
  ctx: MutationCtx,
  sessionId: Id<"sessions">
) {
  const sessionBlocks = await ctx.db
    .query("blocks")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect()

  for (const block of sessionBlocks) {
    const refs = await ctx.db
      .query("blocks")
      .filter((q) => q.eq(q.field("refBlockId"), block._id))
      .collect()
    for (const ref of refs) {
      await ctx.db.patch(ref._id, {
        content: block.content,
        refBlockId: undefined,
        tokens: block.tokens,
        originalTokens: block.originalTokens,
        tokenModel: block.tokenModel,
      })
    }
  }
}
```

**Step 2: Call before cascade delete in `remove`**

In the `remove` handler, before the block deletion loop, add:

```typescript
await promoteReferencesForSession(ctx, args.id)
```

**Step 3: Call in `clear` and `cascadeDeleteSessions`**

Same pattern — call before deleting blocks.

**Step 4: Verify build**

Run: `pnpm build`

**Step 5: Commit**

```bash
git add convex/sessions.ts
git commit -m "feat(linked-blocks): promote references before session delete"
```

---

## Task 7: Context assembly — resolve before assembling

**Files:**
- Modify: `convex/lib/context.ts`

The context functions are pure (take `Doc<"blocks">[]`). The callers must pass resolved blocks. But to be safe, add a note and ensure callers resolve.

**Step 1: Check all callers of assembleContext**

Find them with grep: `assembleContext(` — these are in `convex/http.ts` and `convex/claudeNode.ts`. Each fetches blocks via query, then calls `assembleContext`. The blocks are already resolved by the query (Task 4).

**Step 2: Verify internal callers use resolved queries**

Check `convex/http.ts` and `convex/claudeNode.ts` — they use `ctx.runQuery(internal.blocks.listBySessionInternal, ...)`. Since we resolved in that query (Task 4), context assembly gets correct content. No changes needed to context.ts itself.

**Step 3: Add JSDoc note**

Add to `assembleContext` and `assembleContextWithConversation`:

```typescript
/** @param blocks - All blocks for the session. Must have resolved content (refBlockId blocks hydrated). */
```

**Step 4: Commit**

```bash
git add convex/lib/context.ts
git commit -m "docs(linked-blocks): add resolved content requirement to context assembly"
```

---

## Task 8: Template + snapshot save — resolve before baking

**Files:**
- Modify: `convex/templates.ts` (`createFromSession`)
- Modify: `convex/snapshots.ts` (`create`)

**Step 1: Update templates.ts createFromSession**

After fetching blocks (around line 113), resolve them:

```typescript
import { resolveBlocks } from "./lib/resolve"
// ... inside handler:
const lookup = await fetchCanonicalLookup(ctx, blocks)
const resolved = resolveBlocks(blocks, lookup)
// Use `resolved` instead of `blocks` in the map below
```

**Step 2: Update snapshots.ts create**

Same pattern — resolve blocks before serializing.

**Step 3: Verify build**

Run: `pnpm build`

**Step 4: Commit**

```bash
git add convex/templates.ts convex/snapshots.ts
git commit -m "feat(linked-blocks): resolve content before template/snapshot save"
```

---

## Task 9: Workflow carry-forward — link PERMANENT/STABLE, copy WORKING

**Files:**
- Modify: `convex/sessions.ts` (`goToNextStep`)
- Modify: `convex/workflows.ts` (`advanceStep`)

**Step 1: Update goToNextStep carry-forward logic**

In the block carry loop, change the insert to:

```typescript
for (const block of blocksToCarry) {
  // Resolve the canonical ID — if block is itself a ref, follow the chain
  const canonicalId = block.refBlockId ?? block._id

  if (block.zone === "WORKING") {
    // WORKING: copy content (independent per step)
    const content = block.refBlockId
      ? (await ctx.db.get(block.refBlockId))?.content ?? block.content
      : block.content
    await ctx.db.insert("blocks", {
      sessionId: newSessionId,
      content,
      type: block.type, zone: block.zone, position: block.position,
      createdAt: now, updatedAt: now,
      tokens: block.tokens, originalTokens: block.originalTokens, tokenModel: block.tokenModel,
      metadata: block.metadata,
    })
  } else {
    // PERMANENT/STABLE: create reference (edits propagate across steps)
    await ctx.db.insert("blocks", {
      sessionId: newSessionId,
      content: "",
      type: block.type, zone: block.zone, position: block.position,
      createdAt: now, updatedAt: now,
      refBlockId: canonicalId,
      tokens: block.tokens, originalTokens: block.originalTokens, tokenModel: block.tokenModel,
      metadata: block.metadata,
    })
  }
}
```

**Step 2: Same change in workflows.ts advanceStep**

Mirror the same logic.

**Step 3: Verify build**

Run: `pnpm build`

**Step 4: Commit**

```bash
git add convex/sessions.ts convex/workflows.ts
git commit -m "feat(linked-blocks): workflow carry-forward creates refs for PERM/STABLE"
```

---

## Task 10: Visual treatment — teal border + Link2 icon + tooltip

**Files:**
- Modify: `src/routes/app/index.tsx` (BlockCard component)

**Step 1: Add refBlockId to BlockCard props**

Add to the props type:

```typescript
refBlockId?: string
```

**Step 2: Add visual indicators inside BlockCard**

After the type badge in the header row, add:

```tsx
{refBlockId && (
  <span title="Linked block — used in multiple sessions" className="inline-flex">
    <Link2 className="w-2.5 h-2.5 text-muted-foreground" />
  </span>
)}
```

Add left border to the card wrapper:

```tsx
className={`rounded-lg border bg-card p-2.5 ... ${refBlockId ? "border-l-2 border-l-[oklch(0.65_0.08_220)]" : ""}`}
```

**Step 3: Pass refBlockId from ZoneColumn to BlockCard**

In the ZoneColumn block mapping, add:

```tsx
refBlockId={block.refBlockId}
```

**Step 4: Import Link2**

Add `Link2` to the lucide-react import.

**Step 5: Verify build**

Run: `pnpm build`

**Step 6: Commit**

```bash
git add src/routes/app/index.tsx
git commit -m "feat(linked-blocks): visual treatment — teal border + link icon"
```

---

## Task 11: Unlink hover action

**Files:**
- Modify: `src/routes/app/index.tsx` (BlockCard hover actions)

**Step 1: Add unlink button to hover actions**

In BlockCard's hover actions area, add (only shown for linked blocks):

```tsx
{refBlockId && (
  <DebouncedButton
    variant="ghost"
    size="sm"
    className="h-5 px-1 text-[10px]"
    onClick={() => unlinkBlock({ id })}
    title="Unlink — make independent copy"
  >
    <Unlink className="w-3 h-3" />
  </DebouncedButton>
)}
```

**Step 2: Add useMutation for unlink**

```typescript
const unlinkBlock = useMutation(api.blocks.unlink)
```

**Step 3: Import Unlink icon**

Add `Unlink` to lucide-react imports.

**Step 4: Verify build**

Run: `pnpm build`

**Step 5: Commit**

```bash
git add src/routes/app/index.tsx
git commit -m "feat(linked-blocks): add unlink hover action on linked blocks"
```

---

## Task 12: Manual link flow — "Link block" popover

**Files:**
- Create: `src/components/LinkBlockPopover.tsx`
- Modify: `src/routes/app/index.tsx` (ZoneColumn header)

**Step 1: Create LinkBlockPopover component**

```tsx
// src/components/LinkBlockPopover.tsx
import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Link2 } from "lucide-react"
import { BLOCK_TYPES } from "@/lib/blockTypes"

interface LinkBlockPopoverProps {
  sessionId: Id<"sessions">
  zone: "PERMANENT" | "STABLE" | "WORKING"
  children: React.ReactNode
}

export function LinkBlockPopover({ sessionId, zone, children }: LinkBlockPopoverProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedSessionId, setSelectedSessionId] = useState<Id<"sessions"> | null>(null)
  const sessions = useQuery(api.sessions.list)
  const blocks = useQuery(
    api.blocks.listByZone,
    selectedSessionId ? { sessionId: selectedSessionId, zone: "PERMANENT" } : "skip"
  )
  // Also fetch STABLE and WORKING
  const blocksStable = useQuery(
    api.blocks.listByZone,
    selectedSessionId ? { sessionId: selectedSessionId, zone: "STABLE" } : "skip"
  )
  const blocksWorking = useQuery(
    api.blocks.listByZone,
    selectedSessionId ? { sessionId: selectedSessionId, zone: "WORKING" } : "skip"
  )
  const createLinked = useMutation(api.blocks.createLinked)

  const otherSessions = sessions?.filter((s) => s._id !== sessionId) ?? []
  const filteredSessions = search
    ? otherSessions.filter((s) => (s.name ?? "").toLowerCase().includes(search.toLowerCase()))
    : otherSessions

  const allBlocks = [
    ...(blocks ?? []).map((b) => ({ ...b, _zone: "PERMANENT" as const })),
    ...(blocksStable ?? []).map((b) => ({ ...b, _zone: "STABLE" as const })),
    ...(blocksWorking ?? []).map((b) => ({ ...b, _zone: "WORKING" as const })),
  ]

  const handleLink = async (refBlockId: Id<"blocks">) => {
    await createLinked({ sessionId, refBlockId, zone })
    setOpen(false)
    setSelectedSessionId(null)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {!selectedSessionId ? (
          <div className="p-2 space-y-1">
            <Input
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto">
              {filteredSessions.map((s) => (
                <button
                  key={s._id}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent truncate"
                  onClick={() => setSelectedSessionId(s._id)}
                >
                  {s.name ?? "Untitled"}
                </button>
              ))}
              {filteredSessions.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground text-center">
                  No other sessions
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <button
              className="text-xs text-muted-foreground hover:text-foreground mb-1"
              onClick={() => setSelectedSessionId(null)}
            >
              ← Back to sessions
            </button>
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {allBlocks.map((b) => {
                const typeMeta = BLOCK_TYPES[b.type] ?? BLOCK_TYPES.note
                const firstLine = b.content.split("\n")[0]?.slice(0, 60) ?? ""
                return (
                  <button
                    key={b._id}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-center gap-1.5"
                    onClick={() => handleLink(b._id)}
                  >
                    <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${typeMeta.color}`}>
                      {typeMeta.label}
                    </span>
                    <span className="text-xs truncate text-foreground">{firstLine || "(empty)"}</span>
                  </button>
                )
              })}
              {allBlocks.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground text-center">
                  No blocks in this session
                </p>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
```

**Step 2: Add Link button to ZoneColumn header**

In ZoneColumn, add a Link2 button next to the "Add block" area:

```tsx
<LinkBlockPopover sessionId={sessionId} zone={zone}>
  <button
    className="w-5 h-5 rounded border border-dashed border-border hover:border-foreground/30 flex items-center justify-center transition-colors"
    title="Link a block from another session"
  >
    <Link2 className="w-3 h-3 text-muted-foreground" />
  </button>
</LinkBlockPopover>
```

**Step 3: Verify build**

Run: `pnpm build`

**Step 4: Commit**

```bash
git add src/components/LinkBlockPopover.tsx src/routes/app/index.tsx
git commit -m "feat(linked-blocks): manual link flow — session picker + block browser popover"
```

---

## Task 13: Content hash — compute on create and edit

**Files:**
- Modify: `convex/blocks.ts` (create and update mutations)

**Step 1: Import contentHash**

```typescript
import { computeContentHash } from "./lib/contentHash"
```

**Step 2: Update `create` mutation**

After `const tokens = countTokens(args.content)`, add:

```typescript
const contentHash = computeContentHash(args.content)
```

Add `contentHash` to the insert object.

**Step 3: Update `update` mutation**

When content changes, recompute hash:

```typescript
if (args.content !== undefined) {
  updates.contentHash = computeContentHash(args.content)
}
```

**Step 4: Verify build**

Run: `pnpm build`

**Step 5: Commit**

```bash
git add convex/blocks.ts
git commit -m "feat(linked-blocks): compute content hash on block create and edit"
```

---

## Task 14: Auto-suggest — duplicate detection query + client prompt

**Files:**
- Modify: `convex/blocks.ts` (add `findDuplicate` query)
- Modify: `src/routes/app/index.tsx` (BlockCard — show link suggestion)

**Step 1: Add findDuplicate query**

```typescript
export const findDuplicate = query({
  args: {
    contentHash: v.string(),
    excludeSessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    if (!args.contentHash) return null
    const match = await ctx.db
      .query("blocks")
      .withIndex("by_content_hash", (q) => q.eq("contentHash", args.contentHash))
      .first()
    if (!match || match.sessionId === args.excludeSessionId) return null
    // Get session name for display
    const session = await ctx.db.get(match.sessionId)
    return {
      blockId: match._id,
      sessionId: match.sessionId,
      sessionName: session?.name ?? "Untitled",
    }
  },
})
```

**Step 2: Return contentHash from create mutation**

Modify `create` to return `{ blockId, contentHash }` so the client can check for duplicates.

**Step 3: Add link suggestion to BlockCard**

This will be a small banner below the block that appears when a duplicate is detected. The client calls `findDuplicate` after creating a block with the returned `contentHash`. If a match is found, show:

```tsx
<div className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent/50 text-[10px] text-muted-foreground mt-1">
  <Link2 className="w-3 h-3" />
  <span>Same as block in {matchSessionName}.</span>
  <button
    className="text-primary hover:underline font-medium"
    onClick={() => handleLinkInstead(matchBlockId)}
  >
    Link instead?
  </button>
</div>
```

The exact implementation depends on how the parent manages this state. A pragmatic approach: use `useQuery(api.blocks.findDuplicate, ...)` with the block's `contentHash` prop, and render the suggestion if a match is found.

**Step 4: Verify build**

Run: `pnpm build`

**Step 5: Commit**

```bash
git add convex/blocks.ts src/routes/app/index.tsx
git commit -m "feat(linked-blocks): auto-suggest linking when duplicate content detected"
```

---

## Task 15: Block editor — handle linked blocks

**Files:**
- Modify: `src/routes/app/blocks.$blockId.tsx`

**Step 1: Detect linked block in editor**

After fetching the block, check `refBlockId`. If set, the content is already resolved by the query (Task 4), so the editor works normally. But add a visual indicator:

```tsx
{block.refBlockId && (
  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[oklch(0.65_0.08_220_/_10%)] border border-[oklch(0.65_0.08_220_/_20%)] text-sm">
    <Link2 className="w-4 h-4 text-[oklch(0.65_0.08_220)]" />
    <span>Linked block — edits will update all sessions using this block.</span>
  </div>
)}
```

**Step 2: Verify build**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/routes/app/blocks.\$blockId.tsx
git commit -m "feat(linked-blocks): show linked block indicator in editor"
```

---

## Task 16: Final build + type check + manual verification

**Step 1: Full type check**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 2: Unit tests**

Run: `pnpm vitest run`
Expected: All pass

**Step 3: Build**

Run: `pnpm build`
Expected: Success

**Step 4: Manual verification checklist**

1. Create a block in Session A with some content
2. Use "Link block" popover in Session B to link it
3. Verify teal border + Link2 icon appear on linked block
4. Edit the linked block in Session B — switch to Session A, verify content updated
5. Unlink the block in Session B — verify it becomes regular (no teal border)
6. Create a block with identical content in Session B — verify "Link instead?" prompt
7. Delete Session A (which has canonical blocks) — verify linked blocks in Session B are promoted to regular blocks with content preserved
8. Save a template from a session with linked blocks — verify template has resolved content
9. Start a workflow — verify PERMANENT blocks carry forward as linked references

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(linked-blocks): complete V1+V2 implementation"
```
