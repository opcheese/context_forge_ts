# Anna Branch Integration — Design

**Date:** 2026-04-04  
**Scope:** Cherry-pick fixes and feature gaps from TressTrai/context_forge_ts:new-functions into main. Not a full merge — only items that fix real gaps or bugs.

---

## What We're Taking (and Why)

After comparing Anna's 9 commits against our codebase, the items worth integrating fall into three categories:

| # | Item | Category | Priority |
|---|------|----------|----------|
| 1 | Memory injection for Ollama/OpenRouter | Feature gap | High |
| 2 | `findDuplicate` user scoping | Security bug | High |
| 3 | `contentHash` in all block creation paths | Data integrity | Medium |
| 4 | `cascadeDeleteSessions` 16MB fix | Reliability | Medium |
| 5 | `sourceTemplateId` field + findDuplicate skip | UX fix | Medium |
| 6 | `by_ref_block` index on blocks | Performance | Low |
| 7 | Auth field validation + password visibility | UX polish | Low |
| 8 | Validate button: default prompt + `hasCriteria` gate | UX polish | Low |

**Not taking:** Entry questions (new feature), Resolve→ button (new feature), template preview modal, copy-to-clipboard, language instruction in draft prompt, Convex version bump (separate concern).

---

## 1. Memory Injection for Ollama/OpenRouter

### Problem

`sendMessageOllama` and `sendMessageOpenRouter` in `useBrainstorm.ts` build context client-side and never inject memory. Claude gets memory via the backend action (`claudeNode.ts:183-192`). Ollama/OpenRouter users get no memory context at all.

### Design

Add a frontend mirror of `renderMemoryBlock` at `src/lib/llm/memoryRendering.ts` (same logic as `convex/lib/memoryRendering.ts` — format markdown from entries, score by tags, prioritize pinned).

In `useBrainstorm.ts`:
- Add `useQuery(api.sessions.getById, { sessionId })` to get session projectId, sessionTags, pinnedMemories.
- Add `useQuery(api.memoryEntries.listByProject, { projectId })` — only runs when projectId exists.
- Compute `renderedMemory = renderMemoryBlock(entries, sessionTags, pinnedEntries)` outside the send functions (reactive to query results).
- Pass `renderedMemory` into `sendMessageOllama` and `sendMessageOpenRouter`.
- In each, append rendered memory to system prompt (after `extractSystemPromptFromBlocks`):
  ```
  const systemPromptContent = [systemPrompt, renderedMemory].filter(Boolean).join("\n\n")
  ```

No schema changes. No new mutations. Pure query + frontend logic.

**Gotcha:** The session query may not exist as a public query. Check `convex/sessions.ts` for an existing `getById` or equivalent before adding one.

---

## 2. `findDuplicate` User Scoping

### Problem

`findDuplicate` in `convex/blocks.ts` finds the first block matching a content hash regardless of owner. Content from other users' sessions can be surfaced as "Link?" suggestions — an information leak.

### Design

After finding a match, verify the matched block's session belongs to the current user:

```typescript
handler: async (ctx, args) => {
  const userId = await getOptionalUserId(ctx)
  if (!args.contentHash) return null
  const match = await ctx.db
    .query("blocks")
    .withIndex("by_content_hash", (q) => q.eq("contentHash", args.contentHash))
    .first()
  if (!match || match.sessionId === args.excludeSessionId) return null
  const session = await ctx.db.get(match.sessionId)
  if (!session || session.userId !== userId) return null  // ← new
  return { blockId: match._id, sessionId: match.sessionId, sessionName: session.name ?? "Untitled" }
}
```

No schema changes.

---

## 3. `contentHash` in All Block Creation Paths

### Problem

`create()` mutation sets `contentHash`. Six other block insert sites do not. The "Link?" duplicate detection feature silently fails for blocks saved via brainstorm, from templates, or via workflow step advancement.

### Affected sites

| File | Function | Lines |
|------|----------|-------|
| `convex/generations.ts` | `saveBrainstormMessage` | ~375-391 |
| `convex/templates.ts` | `applyToSession` | ~237-247 |
| `convex/sessions.ts` | `goToNextStep` WORKING copy | ~521-533 |
| `convex/sessions.ts` | `goToNextStep` ref block | ~536-549 |
| `convex/workflows.ts` | `advanceStep` WORKING copy | ~463-475 |
| `convex/workflows.ts` | `advanceStep` template insert | ~517-527 |

### Design

Each insert site that has a `content` value gets `contentHash: computeContentHash(content)` added. `computeContentHash` is already imported in files that use it (verify import in each file before patching).

Reference blocks (content: `""`) also get `contentHash: computeContentHash("")` — consistent, not harmful.

The `workflows.ts` `startProject` path (~373-382) also creates blocks from templates — add contentHash there too.

---

## 4. `cascadeDeleteSessions` 16MB Fix

### Problem

`cascadeDeleteSessions` in `convex/sessions.ts` (lines 55-56) does:
```typescript
const allBlocks = await ctx.db.query("blocks").collect()
const allSnapshots = await ctx.db.query("snapshots").collect()
const allGenerations = await ctx.db.query("generations").collect()
```

Three full-table scans. As the database grows, these hit Convex's 16MB document read limit.

### Design

All three tables have `by_session` indexes. Replace full-table scans with per-session index queries:

```typescript
for (const sessionId of sessionIds) {
  await promoteReferencesForSession(ctx, sessionId)

  const blocks = await ctx.db.query("blocks")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId)).collect()
  for (const block of blocks) { await ctx.db.delete(block._id); deletedBlocks++ }

  const snapshots = await ctx.db.query("snapshots")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId)).collect()
  for (const snapshot of snapshots) { await ctx.db.delete(snapshot._id); deletedSnapshots++ }

  const generations = await ctx.db.query("generations")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId)).collect()
  for (const generation of generations) { await ctx.db.delete(generation._id); deletedGenerations++ }
}
```

The comment about "3 queries total" in the original function header becomes incorrect — update it to document the new per-session pattern.

---

## 5. `sourceTemplateId` Field + `findDuplicate` Skip

### Problem

Blocks created from the same template have identical content → same contentHash → "Link?" is offered between them. These are not meaningful duplicates; they exist because a template was applied.

### Design

**Schema change** — add optional field to blocks table:
```typescript
sourceTemplateId: v.optional(v.id("templates")),
```

**Set it** in all template application paths (same sites as contentHash in §3 — the template insert paths specifically):
- `convex/templates.ts` `applyToSession` — `sourceTemplateId: args.templateId`
- `convex/sessions.ts` `goToNextStep` template blocks — `sourceTemplateId: step.templateId` (if applicable)
- `convex/workflows.ts` `advanceStep` template inserts — `sourceTemplateId: templateId`
- `convex/workflows.ts` `startProject` template blocks — `sourceTemplateId: templateId`

**Use in `findDuplicate`** — after confirming user ownership, also check:
```typescript
if (match.sourceTemplateId && match.sourceTemplateId === args.sourceTemplateId) return null
```

`findDuplicate` args gain an optional `sourceTemplateId?: Id<"templates">` parameter.

---

## 6. `by_ref_block` Index

### Problem

`promoteReferencesForSession` in `convex/sessions.ts` (line 21-23) queries references to a block using `.filter()`:
```typescript
const refs = await ctx.db.query("blocks")
  .filter((q) => q.eq(q.field("refBlockId"), block._id))
  .collect()
```

This is a full table scan on every block in the session being deleted. With a `by_ref_block` index this becomes a fast index lookup.

### Design

Add to blocks table in `convex/schema.ts`:
```typescript
.index("by_ref_block", ["refBlockId"])
```

Update `promoteReferencesForSession` to use the index:
```typescript
const refs = await ctx.db.query("blocks")
  .withIndex("by_ref_block", (q) => q.eq("refBlockId", block._id))
  .collect()
```

Also update `convex/blocks.ts` `update` mutation if it has a similar filter (check lines ~437-440).

---

## 7. Auth UX: Field Validation + Password Visibility

### Problem

`src/routes/app/login.tsx` shows a single generic error banner. Auth errors aren't mapped to the field that caused them. Passwords can't be revealed.

### Design

**State additions:**
```typescript
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
const [showPassword, setShowPassword] = useState(false)
```

**`mapAuthError(error)`** — parse Convex Auth error codes into `{ field, message }`:
- `InvalidAccountId` / `InvalidSecret` → `{ field: "password", message: "Incorrect email or password" }`
- `AccountAlreadyExists` → `{ field: "email", message: "An account with this email already exists" }`
- `InvalidEmail` → `{ field: "email", message: "Invalid email address" }`
- Default → `{ field: "form", message: error.message }`

Errors clear on input change (`onChange` on each field calls `setFieldErrors({})`). Reset entirely on mode switch (sign in ↔ sign up).

**Password field:**
- `type={showPassword ? "text" : "password"}`
- Eye/EyeOff icon button positioned absolutely at right edge (use `relative` wrapper + `absolute right-2`)
- Uses `Eye` and `EyeOff` from `lucide-react` (already a project dependency)

**Error display:** Small red text below each field (`<p className="text-xs text-destructive mt-1">`). Generic form-level errors go in the existing error banner.

---

## 8. Validate Button UX

### Problem

The Validate button in `BrainstormDialog` requires non-empty input (disabled otherwise). There's no gate on whether any criteria blocks actually exist, so the button is offered even when validation would be meaningless.

### Design

**`hasCriteria` in `useBrainstorm.ts`** — computed in hook return:
```typescript
hasCriteria: (blocks ?? []).some(
  (b) => (b.contextMode ?? "default") === "validation" && !b.isDraft
),
```

Exposed via `BrainstormPanel` → `BrainstormDialog` as `hasCriteria` prop (already has `onSendValidation` gating the button — replace with `hasCriteria`).

**Default prompt fallback in `handleValidate`:**
```typescript
const handleValidate = useCallback(async () => {
  if (isStreaming || !onSendValidation) return
  const content = inputValue.trim() || "Validate the artifacts against the criteria."
  setInputValue("")
  await onSendValidation(content)
}, [inputValue, isStreaming, onSendValidation])
```

Button disabled condition: `!isProviderAvailable || !hasCriteria` (remove `!inputValue.trim()` — allow empty).

---

## Implementation Order

Items are independent and can be done in any order. Suggested grouping by risk:

**Batch A (backend, no schema change):**
- §2 findDuplicate user scoping
- §3 contentHash propagation
- §4 cascadeDelete fix

**Batch B (schema change):**
- §5 sourceTemplateId + findDuplicate skip
- §6 by_ref_block index

**Batch C (frontend only):**
- §1 Memory injection for Ollama/OpenRouter
- §7 Auth UX
- §8 Validate button UX

Batch B requires a Convex schema migration (deploy touches schema). Do it in one commit with both §5 and §6 to avoid two schema deploys.

---

## Testing

- **Memory injection:** Start Ollama/OpenRouter brainstorm on a session in a project with memory entries. Verify LLM response references memory content.
- **findDuplicate:** Create two blocks with identical content in different users' sessions. Verify "Link?" is not offered across users.
- **contentHash:** Save a brainstorm message as a block, then create a block with identical content — verify "Link?" is offered.
- **cascadeDelete:** Delete a project with 100+ sessions — verify no 16MB error.
- **sourceTemplateId:** Apply the same template to two sessions — verify "Link?" is not offered between them.
- **Auth:** Enter wrong password — verify per-field error. Toggle password visibility.
- **Validate:** Mark no blocks as Criteria — verify button disabled. Mark one — verify button enabled. Click with empty input — verify default prompt used.
