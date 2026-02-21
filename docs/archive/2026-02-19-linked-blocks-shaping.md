---
shaping: true
---

# Linked Blocks — Shaping

## Source

> "The key big thing that I don't have an elegant solution for right now are linked documents. Meaning when you change it in one session it changes everywhere this file is used."

> "Usually [a PM updates a guideline/persona in one session and expects it everywhere] but [workflow steps sharing common reference files] is not out of the question."

> "Up to this point all decisions were elegant and kinda flowed from one another. Templates from sessions, workflows from templates, etc. File reuse is a nightmare for publishing, for templates. If we can find an elegant solution then I'm all for anchoring it."

> "I am working. I need some document in context. I just DnD it. All good. Natural. Then I am working on a second session and I need the same doc again. The problem becomes apparent. I want with 2 clicks max to have a reference here which fully supports editing, etc. Once in a blue moon I need to break the link."

## Problem

When the same content (guidelines, personas, reference material) is needed across multiple sessions, users must re-create or copy blocks manually. Copies drift as the original is edited. There is no concept of "the same block in two places." This causes:
- Stale guidelines in older sessions
- Manual work to propagate edits
- Uncertainty about which copy is current
- Template/workflow publishing includes diverged copies

## Outcome

A user can place an existing block into another session. Editing the content in either session updates it everywhere. Per-session properties (zone, position, draft status) remain independent. The feature should feel like a natural extension of the existing block model, not a bolted-on system.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Editing a block's content in one session reflects the edit everywhere it's linked | Core goal |
| R1 | Each session controls its own zone, position, and draft status for linked blocks | Must-have |
| R2 | Works with existing zone model (PERMANENT/STABLE/WORKING) — no special zone behavior | Must-have |
| R3 | Works with templates — save resolves to content snapshot, apply creates regular blocks | Must-have |
| R4 | Works with workflows — PERMANENT/STABLE carry-forward creates references, WORKING copies content | Must-have |
| R5 | Works with context assembly — no duplicate tokens, correct zone ordering | Must-have |
| R6 | No migration required — existing blocks work unchanged, new field is optional | Must-have |
| R7 | Unlinking creates an independent copy with current content | Must-have |
| R8 | Deleting a session promotes its canonical blocks to regular blocks in referencing sessions (no data loss) | Must-have |
| R9 | Linking is suggested automatically when duplicate content is detected (via content hash) | Must-have |
| R10 | Manual "pull" flow available as fallback — browse other sessions' blocks with content preview | Should-have |
| R11 | Linked blocks are visually distinguishable from regular blocks (subtle, not heavy) | Must-have |

---

## Shapes

### Shape A: Library table (discarded)

New `library` table. Library items own the content. Blocks get a `libraryId` field. Edit the library item, all referencing blocks see it.

**Discarded because:** Adds a new entity type. Fights Convex's document model (no joins). Every block query becomes a fan-out. Snapshots, templates, workflows all need special handling. Migration required.

### Shape B: Many-to-many join table (discarded)

Remove `sessionId` from blocks. New `blockPlacements` table maps blocks to sessions with per-session zone/position.

**Discarded after lifecycle review:** N+1 reads on every page load and context assembly (Convex has no joins). Snapshot restore is ambiguous (restoring content affects all sessions). Workflow carry-forward has linking-vs-copying ambiguity. Draft/compression flags need to move to join table. Every existing query must be refactored. Full migration required.

### Shape C: Single ownership + reference blocks (selected)

Blocks keep `sessionId` (single owner). New optional `refBlockId` field points to a canonical block. Reference blocks delegate content to the canonical. Each reference controls its own zone, position, draft status.

**Why this wins:**
- One new optional field — no migration, no new tables
- Regular blocks unchanged — zero impact on existing code paths
- Per-session properties stay on the block itself
- Snapshots/templates resolve to content at save time — no ambiguity
- Workflow carry-forward naturally maps: PERMANENT/STABLE create references, WORKING copies
- Delete cascade: promote references before deleting canonicals

---

## Shape C: Single ownership + reference blocks

| Part | Mechanism |
|------|-----------|
| **C1** | **Schema: refBlockId + contentHash** |
| C1.1 | Add `refBlockId?: Id<"blocks">` to blocks table — points to canonical block |
| C1.2 | Add `contentHash?: string` to blocks table — SHA-256 of content, computed on create/edit |
| C1.3 | Add index `by_content_hash` on blocks table for duplicate detection |
| **C2** | **Content resolution** |
| C2.1 | Edit mutation: if block has `refBlockId`, update the canonical block's content instead |
| C2.2 | Read path: if block has `refBlockId`, resolve content from canonical (or use cached content) |
| C2.3 | Context assembly: resolve `refBlockId` before concatenating content |
| **C3** | **Auto-suggest linking (hash-based)** |
| C3.1 | On block create: compute hash, query `by_content_hash` for matches in other sessions |
| C3.2 | If match: return match info to client alongside the new block |
| C3.3 | Client shows inline prompt on new block: "Same as block in [Session X]. Link instead?" |
| C3.4 | On edit/save: recompute hash, check for matches. If match: show quiet toast "Matches block in [Session X]" with Link action. Auto-dismiss 5s. Backfills hash on legacy blocks. |
| C3.5 | "Link instead" action: set `refBlockId` to matched block, clear own content |
| **C4** | **Manual link flow (pull model)** |
| C4.1 | "Link block" button in zone header (alongside existing "Add block") |
| C4.2 | Opens panel: session picker dropdown (searchable) + block list from selected session |
| C4.3 | Block rows show: type badge + first line of content (truncated) + token count, grouped by zone |
| C4.4 | Click block → create reference in current session/zone. Panel closes. Toast confirms. |
| **C5** | **Unlink** |
| C5.1 | Block action menu (hover actions): "Unlink" icon appears only on linked blocks |
| C5.2 | Unlink action: copy canonical content into reference block, clear `refBlockId`, recompute hash |
| **C6** | **Session delete safety** |
| C6.1 | Before cascade-deleting blocks: query all blocks in other sessions where `refBlockId` points to blocks in this session |
| C6.2 | Bulk update: copy canonical content into each reference, clear `refBlockId` |
| C6.3 | Then proceed with normal cascade delete |
| **C7** | **Visual treatment** |
| C7.1 | Linked blocks get 2px left border in muted teal (`oklch(0.65 0.08 220)`) |
| C7.2 | Small `Link2` icon (10px) after type badge in header row |
| C7.3 | Tooltip on link icon: "Used in N sessions" |
| **C8** | **Template/snapshot integration** |
| C8.1 | Save template: resolve reference content, store as regular block snapshot (templates are self-contained) |
| C8.2 | Save snapshot: same — resolve and store content, no `refBlockId` in snapshot data |
| C8.3 | Apply template: creates regular blocks (no linking — template is a point-in-time copy) |
| **C9** | **Workflow carry-forward** |
| C9.1 | PERMANENT/STABLE carry-forward: create reference blocks pointing to originals (edits propagate across steps) |
| C9.2 | WORKING carry-forward: copy content as regular blocks (each step's output is independent) |

---

## Fit Check: R x C

| Req | Requirement | Status | C |
|-----|-------------|--------|---|
| R0 | Editing content reflects everywhere | Core goal | ✅ |
| R1 | Per-session zone, position, draft | Must-have | ✅ |
| R2 | Works with zone model | Must-have | ✅ |
| R3 | Works with templates | Must-have | ✅ |
| R4 | Works with workflows | Must-have | ✅ |
| R5 | Works with context assembly | Must-have | ✅ |
| R6 | No migration required | Must-have | ✅ |
| R7 | Unlinking creates independent copy | Must-have | ✅ |
| R8 | Session delete promotes references | Must-have | ✅ |
| R9 | Auto-suggest via content hash | Must-have | ✅ |
| R10 | Manual pull flow as fallback | Should-have | ✅ |
| R11 | Visual distinction for linked blocks | Must-have | ✅ |

---

## Open Questions

### Q1: Content caching on reference blocks

Two sub-options for how reference blocks serve content:

**C2-A: Always resolve.** Reference block stores no content. Every read follows `refBlockId`. Simple, always consistent. Cost: extra read per reference block.

**C2-B: Cache + sync.** Reference block caches canonical content. Mutation wrapper updates all references when canonical changes. Fast reads.

**Decision: Start with C2-A.** In practice, a session has 2-5 reference blocks. The extra reads are negligible in Convex. Optimize to C2-B later if performance data warrants it.

### Q2: Hash algorithm

SHA-256 of full content is simple and collision-resistant. For large blocks (10K+ chars), hashing is still fast (<1ms). No truncation needed.

Convex string index on the hash enables O(1) duplicate lookup.

### Q3: What if canonical block is edited and hash now matches a *third* block?

Ignore. Hash-based linking suggestions only fire on the block being actively created/edited, not on passive matches elsewhere. This avoids cascade suggestion noise.

### Q4: Compression interaction

If a user compresses a linked block, the compression applies to the canonical content (all references see it). If per-session compression is needed, user should unlink first, then compress. This matches the mental model: "compression changes the content."

---

## UX Summary

### Auto-suggest flow (primary — 1 click)
1. User creates/edits a block
2. System detects matching content hash in another session
3. **On create:** inline prompt on block card — "Same as block in [Session A]. **Link instead?**"
4. **On edit:** quiet toast at bottom — "Matches block in [Session A]" + Link action. Auto-dismiss 5s.
5. Click "Link" → block becomes reference to canonical

### Manual flow (fallback — 2-3 clicks)
1. Click `Link2` button in zone header
2. Searchable session picker → block list with type badge + first line of content
3. Click block → reference created in current zone

### Visual treatment
- 2px left border in muted teal on linked blocks
- Small `Link2` icon after type badge
- Tooltip: "Used in N sessions"

### Unlink
- Hover action on linked blocks: `Unlink` icon
- Copies current content, clears reference, becomes regular block

### Editing
- Edit a linked block inline, same as any block
- Under the hood, the edit goes to the canonical block
- No warnings, no confirmation — editing is editing

---

## Slices

### V1: Schema + manual link + visual + edit resolution

The minimum to see linked blocks work end-to-end.

| Part | What |
|------|------|
| C1.1 | Add `refBlockId` to blocks schema |
| C2.1 | Edit mutation: follow `refBlockId`, update canonical |
| C2.2 | Read path: resolve content from canonical |
| C2.3 | Context assembly: resolve references |
| C7.1 | 2px teal left border on linked blocks |
| C7.2 | `Link2` icon after type badge |
| C7.3 | Tooltip: "Used in N sessions" |
| C4.1-4.4 | Manual link flow: zone header button → session picker → block browser → create reference |
| C5.1-5.2 | Unlink action on hover |

**Demo:** Click "Link block" in zone header. Pick a block from another session. See it appear with teal border. Edit it. Switch to original session — edit is there. Unlink it — becomes regular block.

### V2: Content hash + auto-suggest

The primary UX — system detects duplicates and suggests linking.

| Part | What |
|------|------|
| C1.2 | Add `contentHash` to blocks schema |
| C1.3 | Add `by_content_hash` index |
| C3.1 | Compute hash on create, check for matches |
| C3.2 | Return match info to client |
| C3.3 | Inline prompt on block card: "Same as block in [Session X]. Link instead?" |
| C3.4 | On edit/save: recompute hash, toast suggestion, backfills legacy blocks |
| C3.5 | "Link instead" action: convert to reference |

**Demo:** Create a block in Session A. Switch to Session B, create block with same content. See prompt — "Same as block in Session A. Link instead?" Click it. Block becomes linked. Edit an old block — hash gets computed, future matches work.

### V3: Session delete safety + workflow integration

Protect data integrity and make workflows smarter.

| Part | What |
|------|------|
| C6.1-6.3 | Session delete: promote references before cascade delete |
| C9.1 | Workflow carry-forward: PERMANENT/STABLE create references |
| C9.2 | Workflow carry-forward: WORKING copies content |
| C8.3 | Apply template: creates regular blocks (no linking) |

**Demo:** Link a block across two sessions. Delete the source session. Block in other session still works — now a regular block with content preserved. Start a workflow — guidelines in PERMANENT carry as linked references across steps.

### V4: Template + snapshot resolution

Ensure saved artifacts are self-contained.

| Part | What |
|------|------|
| C8.1 | Save template: resolve reference content into snapshot |
| C8.2 | Save snapshot: resolve reference content into snapshot |

**Demo:** Session has linked blocks. Save as template. All blocks have resolved content, no references. Apply template — regular blocks, no links.

### Slice dependencies

```
V1: Schema + manual link + visual + edit
 │
 ├──→ V2: Hash + auto-suggest
 │
 ├──→ V3: Delete safety + workflows
 │
 └──→ V4: Template/snapshot resolution
```

V2, V3, V4 are independent — all depend only on V1. Can be done in any order or in parallel.

### Effort estimates

| Slice | Effort | Notes |
|-------|--------|-------|
| V1 | 2-3 days | Biggest — schema, resolution, manual UI, visual, unlink |
| V2 | 1-2 days | Hash + duplicate query + client prompts |
| V3 | 1 day | Delete promotion + workflow carry-forward flag |
| V4 | Half day | Resolve refs before serializing |
| **Total** | **5-7 days** | |
