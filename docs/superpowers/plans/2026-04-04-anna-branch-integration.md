# Anna Branch Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cherry-pick 8 targeted fixes from TressTrai/context_forge_ts:new-functions — covering a security bug, data integrity gaps, a reliability fix, and frontend polish.

**Architecture:** Backend tasks touch Convex mutations/queries (no new files). Frontend tasks add one new utility file (`src/lib/llm/memoryRendering.ts`) and modify three existing components. Schema changes happen in one commit to avoid multiple Convex deploys.

**Tech Stack:** Convex (TypeScript), React, Vitest

---

## File Map

| File | Change |
|------|--------|
| `convex/blocks.ts` | findDuplicate: add user scoping + sourceTemplateId arg |
| `convex/generations.ts` | saveBrainstormMessage: add contentHash |
| `convex/templates.ts` | applyToSession: add contentHash + sourceTemplateId |
| `convex/sessions.ts` | cascadeDeleteSessions: fix global collects; goToNextStep: add contentHash |
| `convex/workflows.ts` | advanceStep + startProject: add contentHash + sourceTemplateId |
| `convex/schema.ts` | Add `sourceTemplateId` field + `by_ref_block` index to blocks |
| `src/lib/llm/memoryRendering.ts` | **New** — frontend mirror of renderMemoryBlock |
| `src/lib/llm/memoryRendering.test.ts` | **New** — unit tests |
| `src/hooks/useBrainstorm.ts` | Memory injection for Ollama/OpenRouter + hasCriteria |
| `src/routes/app/login.tsx` | Field-level errors + password visibility toggle |
| `src/components/BrainstormDialog.tsx` | Validate: default prompt + hasCriteria-gated disable |

---

## Task 1: findDuplicate — user scoping (security fix)

**Files:** Modify `convex/blocks.ts`

- [ ] **Read the current findDuplicate implementation** at `convex/blocks.ts:168-188` to confirm the exact code before patching.

- [ ] **Update the import line** at `convex/blocks.ts:8`:

```typescript
import { canAccessSession, requireSessionAccess, getOptionalUserId } from "./lib/auth"
```

- [ ] **Replace the findDuplicate handler** at `convex/blocks.ts:173-187` with the user-scoped version:

```typescript
    handler: async (ctx, args) => {
      const userId = await getOptionalUserId(ctx)
      if (!args.contentHash) return null
      const match = await ctx.db
        .query("blocks")
        .withIndex("by_content_hash", (q) => q.eq("contentHash", args.contentHash))
        .first()
      if (!match || match.sessionId === args.excludeSessionId) return null
      // Security: only surface duplicates from sessions owned by the current user
      const session = await ctx.db.get(match.sessionId)
      if (!session || session.userId !== userId) return null
      return {
        blockId: match._id,
        sessionId: match.sessionId,
        sessionName: session.name ?? "Untitled",
      }
    },
```

- [ ] **Verify TypeScript compiles:**

```bash
cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors.

- [ ] **Commit:**

```bash
git add convex/blocks.ts
git commit -m "fix(blocks): scope findDuplicate results to current user's sessions"
```

---

## Task 2: contentHash in all block creation paths

**Files:** Modify `convex/generations.ts`, `convex/templates.ts`, `convex/sessions.ts`, `convex/workflows.ts`

- [ ] **Add `computeContentHash` import to `convex/generations.ts`** (after the existing `countTokens` import on line ~13):

```typescript
import { countTokens, DEFAULT_TOKEN_MODEL } from "./lib/tokenizer"
import { computeContentHash } from "./lib/contentHash"
```

- [ ] **Add contentHash to `saveBrainstormMessage` insert** in `convex/generations.ts` (~line 375). Find the `ctx.db.insert("blocks", {` call and add the field:

```typescript
return await ctx.db.insert("blocks", {
  sessionId: args.sessionId,
  content: args.content,
  type: blockType,
  zone: args.zone,
  position: maxPosition + 1,
  createdAt: now,
  updatedAt: now,
  tokens,
  originalTokens: tokens,
  tokenModel: DEFAULT_TOKEN_MODEL,
  contentHash: computeContentHash(args.content),  // ← add this line
})
```

- [ ] **Add `computeContentHash` import to `convex/templates.ts`** (add after existing imports):

```typescript
import { computeContentHash } from "./lib/contentHash"
```

- [ ] **Add contentHash to `applyToSession` block insert** in `convex/templates.ts` (~line 237):

```typescript
await ctx.db.insert("blocks", {
  sessionId: args.sessionId,
  content: blockData.content,
  type: blockData.type,
  zone: blockData.zone,
  position,
  createdAt: now,
  updatedAt: now,
  metadata: blockData.metadata,
  contentHash: computeContentHash(blockData.content),  // ← add this line
})
```

- [ ] **Add `computeContentHash` import to `convex/sessions.ts`** (add after existing imports):

```typescript
import { computeContentHash } from "./lib/contentHash"
```

- [ ] **Add contentHash to `goToNextStep` WORKING zone copy** in `convex/sessions.ts` (~line 521):

```typescript
await ctx.db.insert("blocks", {
  sessionId: newSessionId,
  content,
  type: block.type,
  zone: block.zone,
  position: block.position,
  createdAt: now,
  updatedAt: now,
  tokens: block.tokens,
  originalTokens: block.originalTokens,
  tokenModel: block.tokenModel,
  metadata: block.metadata,
  contentHash: computeContentHash(content),  // ← add this line
})
```

- [ ] **Add contentHash to `goToNextStep` PERMANENT/STABLE ref block** in `convex/sessions.ts` (~line 536). These use `content: ""` so hash is consistent:

```typescript
await ctx.db.insert("blocks", {
  sessionId: newSessionId,
  content: "",
  type: block.type,
  zone: block.zone,
  position: block.position,
  createdAt: now,
  updatedAt: now,
  refBlockId: canonicalId,
  tokens: block.tokens,
  originalTokens: block.originalTokens,
  tokenModel: block.tokenModel,
  metadata: block.metadata,
  contentHash: computeContentHash(""),  // ← add this line
})
```

- [ ] **Add `computeContentHash` import to `convex/workflows.ts`** (add after existing imports):

```typescript
import { computeContentHash } from "./lib/contentHash"
```

- [ ] **Add contentHash to `advanceStep` WORKING zone copy** in `convex/workflows.ts` (~line 463):

```typescript
await ctx.db.insert("blocks", {
  sessionId,
  content,
  type: block.type,
  zone: block.zone,
  position: block.position,
  createdAt: now,
  updatedAt: now,
  tokens: block.tokens,
  originalTokens: block.originalTokens,
  tokenModel: block.tokenModel,
  metadata: block.metadata,
  contentHash: computeContentHash(content),  // ← add this line
})
```

- [ ] **Add contentHash to `advanceStep` template block insert** in `convex/workflows.ts` (~line 517):

```typescript
await ctx.db.insert("blocks", {
  sessionId,
  content: blockData.content,
  type: blockData.type,
  zone: blockData.zone,
  position,
  createdAt: now,
  updatedAt: now,
  metadata: blockData.metadata,
  contentHash: computeContentHash(blockData.content),  // ← add this line
})
```

- [ ] **Add contentHash to `startProject` template block insert** in `convex/workflows.ts` (~line 373):

```typescript
await ctx.db.insert("blocks", {
  sessionId,
  content: blockData.content,
  type: blockData.type,
  zone: blockData.zone,
  position: blockData.position,
  createdAt: now,
  updatedAt: now,
  contentHash: computeContentHash(blockData.content),  // ← add this line
})
```

- [ ] **Verify TypeScript compiles:**

```bash
cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors.

- [ ] **Commit:**

```bash
git add convex/generations.ts convex/templates.ts convex/sessions.ts convex/workflows.ts
git commit -m "fix(blocks): propagate contentHash to all block creation paths for duplicate detection"
```

---

## Task 3: cascadeDeleteSessions 16MB fix

**Files:** Modify `convex/sessions.ts`

- [ ] **Read the current `cascadeDeleteSessions` function** at `convex/sessions.ts:42-83` to confirm the exact code before patching.

- [ ] **Replace the function body** of `cascadeDeleteSessions` (lines 44-83). Keep the signature and return type identical, replace only the body:

```typescript
async function cascadeDeleteSessions(
  ctx: MutationCtx,
  sessionIds: Set<Id<"sessions">>
): Promise<{ deletedBlocks: number; deletedSnapshots: number; deletedGenerations: number }> {
  let deletedBlocks = 0
  let deletedSnapshots = 0
  let deletedGenerations = 0

  // Query per session using indexes instead of full-table scans.
  // Full-table collect() fails with 16MB limit on large databases.
  for (const sessionId of sessionIds) {
    await promoteReferencesForSession(ctx, sessionId)

    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect()
    for (const block of blocks) {
      await ctx.db.delete(block._id)
      deletedBlocks++
    }

    const snapshots = await ctx.db
      .query("snapshots")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect()
    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id)
      deletedSnapshots++
    }

    const generations = await ctx.db
      .query("generations")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect()
    for (const generation of generations) {
      await ctx.db.delete(generation._id)
      deletedGenerations++
    }
  }

  return { deletedBlocks, deletedSnapshots, deletedGenerations }
}
```

- [ ] **Verify TypeScript compiles:**

```bash
cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors.

- [ ] **Commit:**

```bash
git add convex/sessions.ts
git commit -m "fix(sessions): replace full-table scans in cascadeDeleteSessions with indexed queries"
```

---

## Task 4: Schema — by_ref_block index + sourceTemplateId field

**Files:** Modify `convex/schema.ts`, `convex/sessions.ts`

*This is the schema-change commit. Do Tasks 4 and 5 before deploying.*

- [ ] **Read the blocks table definition** at `convex/schema.ts:119-153` to confirm exact current state.

- [ ] **Add `sourceTemplateId` field and `by_ref_block` index** to the blocks table in `convex/schema.ts`. After the `contentHash` field (~line 148) and after the existing indexes (~line 153):

```typescript
    // Content hash for duplicate detection (DJB2 hex, first 16 chars)
    contentHash: v.optional(v.string()),
    // Template this block was created from — suppresses "Link?" for same-template siblings
    sourceTemplateId: v.optional(v.id("templates")),
  })
    .index("by_zone", ["zone", "position"])
    .index("by_session", ["sessionId"])
    .index("by_session_zone", ["sessionId", "zone", "position"])
    .index("by_content_hash", ["contentHash"])
    .index("by_ref_block", ["refBlockId"]),
```

- [ ] **Update `promoteReferencesForSession` in `convex/sessions.ts`** to use the new index instead of `.filter()`. Replace lines 21-23:

```typescript
    // Use index for efficient reference lookup instead of full-table filter
    const refs = await ctx.db
      .query("blocks")
      .withIndex("by_ref_block", (q) => q.eq("refBlockId", block._id))
      .collect()
```

- [ ] **Check if `convex/blocks.ts` has a similar `.filter()` call on `refBlockId`** around lines 437-440. If found, replace it with the same index pattern:

```typescript
    const refs = await ctx.db
      .query("blocks")
      .withIndex("by_ref_block", (q) => q.eq("refBlockId", block._id))
      .collect()
```

- [ ] **Verify TypeScript compiles:**

```bash
cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors.

- [ ] **Commit (do not deploy yet — Task 5 must be in the same schema commit):**

```bash
git add convex/schema.ts convex/sessions.ts convex/blocks.ts
git commit -m "feat(schema): add sourceTemplateId field and by_ref_block index to blocks"
```

---

## Task 5: sourceTemplateId propagation + findDuplicate skip

**Files:** Modify `convex/templates.ts`, `convex/sessions.ts`, `convex/workflows.ts`, `convex/blocks.ts`

- [ ] **Add `sourceTemplateId` to `applyToSession` block insert** in `convex/templates.ts` (~line 237). The function receives `args.templateId` — use it:

```typescript
await ctx.db.insert("blocks", {
  sessionId: args.sessionId,
  content: blockData.content,
  type: blockData.type,
  zone: blockData.zone,
  position,
  createdAt: now,
  updatedAt: now,
  metadata: blockData.metadata,
  contentHash: computeContentHash(blockData.content),
  sourceTemplateId: args.templateId,  // ← add this line
})
```

- [ ] **Check `goToNextStep` in `convex/sessions.ts`** (~line 517 area) for the template block insert path. If it inserts template blocks (look for `blockData.content` pattern), add `sourceTemplateId`. If the step has a `templateId`, use it; otherwise skip. Only add if `templateId` is available in scope:

```typescript
  sourceTemplateId: step.templateId ?? undefined,  // only if step.templateId exists in scope
```

- [ ] **Add `sourceTemplateId` to `advanceStep` template block insert** in `convex/workflows.ts` (~line 517). The function should have a `templateId` in scope from the step definition:

```typescript
await ctx.db.insert("blocks", {
  sessionId,
  content: blockData.content,
  type: blockData.type,
  zone: blockData.zone,
  position,
  createdAt: now,
  updatedAt: now,
  metadata: blockData.metadata,
  contentHash: computeContentHash(blockData.content),
  sourceTemplateId: step.templateId ?? undefined,  // ← add (verify step.templateId is in scope)
})
```

- [ ] **Add `sourceTemplateId` to `startProject` template block insert** in `convex/workflows.ts` (~line 373). Look for the template block insert and add:

```typescript
  sourceTemplateId: step.templateId ?? undefined,  // ← add (verify step.templateId is in scope)
```

- [ ] **Update `findDuplicate` in `convex/blocks.ts`** to accept and use `sourceTemplateId`. Add the arg and the skip condition:

```typescript
export const findDuplicate = query({
  args: {
    contentHash: v.string(),
    excludeSessionId: v.id("sessions"),
    sourceTemplateId: v.optional(v.id("templates")),  // ← add
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalUserId(ctx)
    if (!args.contentHash) return null
    const match = await ctx.db
      .query("blocks")
      .withIndex("by_content_hash", (q) => q.eq("contentHash", args.contentHash))
      .first()
    if (!match || match.sessionId === args.excludeSessionId) return null
    const session = await ctx.db.get(match.sessionId)
    if (!session || session.userId !== userId) return null
    // Skip same-template siblings — identical content by design, not duplication
    if (args.sourceTemplateId && match.sourceTemplateId === args.sourceTemplateId) return null
    return {
      blockId: match._id,
      sessionId: match.sessionId,
      sessionName: session.name ?? "Untitled",
    }
  },
})
```

- [ ] **Verify TypeScript compiles:**

```bash
cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors.

- [ ] **Commit:**

```bash
git add convex/templates.ts convex/sessions.ts convex/workflows.ts convex/blocks.ts
git commit -m "feat(blocks): add sourceTemplateId tracking to suppress Link? for same-template siblings"
```

---

## Task 6: Frontend memoryRendering.ts

**Files:** Create `src/lib/llm/memoryRendering.ts`, `src/lib/llm/memoryRendering.test.ts`

- [ ] **Write the failing test** at `src/lib/llm/memoryRendering.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { renderMemoryBlock, scoreEntryByTags, type MemoryEntry } from "./memoryRendering"

describe("scoreEntryByTags", () => {
  it("returns 0 when no overlap", () => {
    expect(scoreEntryByTags(["#ch1"], ["#ch2"])).toBe(0)
  })

  it("counts overlapping tags", () => {
    expect(scoreEntryByTags(["#ch1", "#renn"], ["#ch1", "#renn", "#plot"])).toBe(2)
  })

  it("handles empty arrays", () => {
    expect(scoreEntryByTags([], ["#ch1"])).toBe(0)
    expect(scoreEntryByTags(["#ch1"], [])).toBe(0)
  })
})

describe("renderMemoryBlock", () => {
  const entries: MemoryEntry[] = [
    { type: "character", title: "Renn", content: "Chief engineer", tags: ["#ch1"] },
    { type: "tension", title: "Conflict A", content: "Unresolved", tags: [] },
  ]

  it("returns a string starting with ## Project Memory", () => {
    expect(renderMemoryBlock(entries, [], [])).toMatch(/^## Project Memory/)
  })

  it("groups entries by type", () => {
    const result = renderMemoryBlock(entries, [], [])
    expect(result).toContain("character")
    expect(result).toContain("tension")
  })

  it("places pinned entries first", () => {
    const result = renderMemoryBlock(entries, [], [entries[1]])
    const tensionIndex = result.indexOf("Conflict A")
    const characterIndex = result.indexOf("Renn")
    expect(tensionIndex).toBeLessThan(characterIndex)
  })

  it("returns empty string for empty entries", () => {
    expect(renderMemoryBlock([], [], [])).toBe("")
  })
})
```

- [ ] **Run test to verify it fails:**

```bash
cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm test:run src/lib/llm/memoryRendering.test.ts 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module './memoryRendering'"

- [ ] **Create `src/lib/llm/memoryRendering.ts`** — exact mirror of `convex/lib/memoryRendering.ts` logic, using the frontend Block type:

```typescript
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
```

- [ ] **Run tests to verify they pass:**

```bash
cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm test:run src/lib/llm/memoryRendering.test.ts 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Commit:**

```bash
git add src/lib/llm/memoryRendering.ts src/lib/llm/memoryRendering.test.ts
git commit -m "feat(memory): add client-side renderMemoryBlock for Ollama/OpenRouter injection"
```

---

## Task 7: Memory injection in useBrainstorm (Ollama + OpenRouter)

**Files:** Modify `src/hooks/useBrainstorm.ts`

- [ ] **Add imports** at the top of `src/hooks/useBrainstorm.ts`. After the existing context imports (around line 7-11):

```typescript
import { renderMemoryBlock, type MemoryEntry } from "@/lib/llm/memoryRendering"
```

- [ ] **Add memory queries** in `useBrainstorm` function body, after the blocks query. Find where `const { sessionId } = options` (or where sessionId is destructured, around line 144+) and after the blocks useQuery, add:

```typescript
  // Fetch session and memory for Ollama/OpenRouter injection (Claude uses server-side memory)
  const session = useQuery(api.sessions.get, { id: sessionId })
  const projectId = session?.projectId
  const memoryEntries = useQuery(
    api.memoryEntries.listByProject,
    projectId ? { projectId } : "skip"
  )
```

- [ ] **Compute `renderedMemory`** as a derived value (not in a useEffect — compute inline, it's cheap):

```typescript
  const renderedMemory: string | undefined = (() => {
    if (!memoryEntries?.length || !session) return undefined
    const pinnedIds = new Set(session.pinnedMemories ?? [])
    const asEntries: MemoryEntry[] = memoryEntries.map((e) => ({
      type: e.type,
      title: e.title,
      content: e.content,
      tags: e.tags,
    }))
    const pinnedEntries = asEntries.filter((_, i) => pinnedIds.has(memoryEntries[i]._id))
    const result = renderMemoryBlock(asEntries, session.sessionTags ?? [], pinnedEntries)
    return result || undefined
  })()
```

- [ ] **Update `sendMessageOllama`** to inject memory into the system prompt. Find the system prompt block (~lines 388-393):

```typescript
      // Add system prompt with memory injection (if any)
      const systemPromptContent = [systemPrompt, renderedMemory].filter(Boolean).join("\n\n")
      if (systemPromptContent) {
        ollamaMessages.push({
          role: "system",
          content: systemPromptContent,
        })
      }
```

Replace the existing `if (systemPrompt) { ollamaMessages.push(...) }` block with the above.

- [ ] **Update `sendMessageOpenRouter`** similarly (~lines 454-459):

```typescript
      // Add system prompt with memory injection (if any)
      const systemPromptContent = [systemPrompt, renderedMemory].filter(Boolean).join("\n\n")
      if (systemPromptContent) {
        openrouterMessages.push({
          role: "system",
          content: systemPromptContent + NO_TOOLS_SUFFIX,
        })
      }
```

Replace the existing `if (systemPrompt) { openrouterMessages.push(...) }` block with the above.

- [ ] **Verify TypeScript compiles:**

```bash
cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors.

- [ ] **Manual test:** Open the app with Ollama or OpenRouter selected. In a session that belongs to a project with memory entries, send a message that references the memory content. Verify the LLM response acknowledges/uses the memory.

- [ ] **Commit:**

```bash
git add src/hooks/useBrainstorm.ts
git commit -m "feat(memory): inject project memory into Ollama and OpenRouter context"
```

---

## Task 8: Auth UX — field validation + password visibility

**Files:** Modify `src/routes/app/login.tsx`

- [ ] **Read `src/routes/app/login.tsx`** in full to understand the current form state and error display pattern before patching.

- [ ] **Add state declarations** inside the component, after the existing `const [error, setError]` line:

```typescript
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
```

- [ ] **Add `mapAuthError` function** before the component (outside the function body, as a pure utility):

```typescript
function mapAuthError(err: Error): { field: string; message: string } {
  const msg = err.message ?? ""
  if (msg.includes("InvalidAccountId") || msg.includes("InvalidSecret") || msg.includes("not found")) {
    return { field: "password", message: "Incorrect email or password." }
  }
  if (msg.includes("AccountAlreadyExists") || msg.includes("already exists")) {
    return { field: "email", message: "An account with this email already exists." }
  }
  if (msg.includes("InvalidEmail") || msg.includes("invalid email")) {
    return { field: "email", message: "Enter a valid email address." }
  }
  if (msg.includes("PasswordTooShort") || msg.includes("too short")) {
    return { field: "password", message: "Password must be at least 8 characters." }
  }
  return { field: "form", message: msg || "Something went wrong. Please try again." }
}
```

- [ ] **Update `handlePasswordAuth`** to use `mapAuthError` and set field-level errors. Find the catch block and replace `setError(...)` with:

```typescript
  } catch (err) {
    const mapped = mapAuthError(err as Error)
    if (mapped.field === "form") {
      setError(mapped.message)
    } else {
      setFieldErrors({ [mapped.field]: mapped.message })
    }
  }
```

- [ ] **Clear errors on input change.** On each input's `onChange`, add `setFieldErrors({})`. For the email input:

```typescript
  onChange={(e) => { setEmail(e.target.value); setFieldErrors({}) }}
```

For the password input:

```typescript
  onChange={(e) => { setPassword(e.target.value); setFieldErrors({}) }}
```

For the name input (sign-up only), same pattern.

- [ ] **Clear errors on mode switch.** Find where `setMode(...)` is called and add reset:

```typescript
  setMode("signIn")        // or "signUp"
  setFieldErrors({})
  setError(null)
```

- [ ] **Add inline error display** below each field. After the email input:

```tsx
  {fieldErrors.email && (
    <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
  )}
```

After the password input:

```tsx
  {fieldErrors.password && (
    <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
  )}
```

- [ ] **Add password visibility toggle.** The `Eye` and `EyeOff` icons are available from `lucide-react` (already a project dep). Add import at the top of the file with other lucide imports (or add new import):

```typescript
import { Eye, EyeOff } from "lucide-react"
```

Wrap the password input in a relative container and add a toggle button:

```tsx
<div className="relative">
  <Input
    type={showPassword ? "text" : "password"}
    placeholder="Password"
    value={password}
    onChange={(e) => { setPassword(e.target.value); setFieldErrors({}) }}
    // keep all other existing props
  />
  <button
    type="button"
    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
    onClick={() => setShowPassword((v) => !v)}
    tabIndex={-1}
    aria-label={showPassword ? "Hide password" : "Show password"}
  >
    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </button>
</div>
```

- [ ] **Verify TypeScript compiles:**

```bash
cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors.

- [ ] **Manual test:** Try signing in with wrong password — verify per-field error appears under password field. Try signing up with existing email — verify per-field error under email. Toggle password visibility — verify it works.

- [ ] **Commit:**

```bash
git add src/routes/app/login.tsx
git commit -m "feat(auth): add field-level validation errors and password visibility toggle"
```

---

## Task 9: Validate button UX — hasCriteria gate + default prompt

**Files:** Modify `src/hooks/useBrainstorm.ts`, `src/components/BrainstormPanel.tsx`, `src/components/BrainstormDialog.tsx`

- [ ] **Add `hasCriteria` to useBrainstorm return value** in `src/hooks/useBrainstorm.ts`. Find the return object (around line 770) and add:

```typescript
    // Whether any criteria (validation-mode) blocks exist — gates the Validate button
    hasCriteria: (blocks ?? []).some(
      (b) => (b.contextMode ?? "default") === "validation" && !b.isDraft
    ),
```

- [ ] **Pass `hasCriteria` through `BrainstormPanel`**. Read `src/components/BrainstormPanel.tsx` to find where `onSendValidation` is passed to `BrainstormDialog`. Add `hasCriteria` alongside it:

```tsx
  hasCriteria={brainstorm.hasCriteria}
```

- [ ] **Add `hasCriteria` prop to `BrainstormDialog`**. Find the `BrainstormDialogProps` interface in `src/components/BrainstormDialog.tsx` and add:

```typescript
  hasCriteria?: boolean
```

Destructure it in the function params with default false:

```typescript
  hasCriteria = false,
```

- [ ] **Update `handleValidate`** in `BrainstormDialog.tsx` to use default prompt when input is empty:

```typescript
  const handleValidate = useCallback(async () => {
    if (isStreaming || !onSendValidation) return
    const content = inputValue.trim() || "Validate the artifacts against the criteria."
    setInputValue("")
    await onSendValidation(content)
  }, [inputValue, isStreaming, onSendValidation])
```

- [ ] **Update the Validate button disabled condition** to use `hasCriteria` instead of `!inputValue.trim()`:

```tsx
  <Button
    variant="secondary"
    size="sm"
    onClick={handleValidate}
    disabled={!isProviderAvailable || !hasCriteria}
    title={hasCriteria ? "Send with validation criteria included" : "Mark blocks as Criteria to enable validation"}
  >
    Validate
  </Button>
```

- [ ] **Verify TypeScript compiles:**

```bash
cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors.

- [ ] **Manual test:** Session with no validation blocks — Validate button is disabled, tooltip says "Mark blocks as Criteria". Mark one block as Criteria — button enables. Click Validate with empty input — LLM receives "Validate the artifacts against the criteria."

- [ ] **Commit:**

```bash
git add src/hooks/useBrainstorm.ts src/components/BrainstormPanel.tsx src/components/BrainstormDialog.tsx
git commit -m "feat(validation): gate Validate button on hasCriteria + allow empty input with default prompt"
```

---

## Self-Review Notes

- Task 5 `sourceTemplateId` in `goToNextStep`/`advanceStep` ref to `step.templateId` — implementer must verify the field name in scope. If the step object doesn't directly expose `templateId`, look for how the template is fetched and adapt accordingly.
- Task 7 `renderedMemory` is computed inline (not memoized). If performance is a concern, wrap in `useMemo` with `[memoryEntries, session?.pinnedMemories, session?.sessionTags]` as deps.
- The `api.sessions.get` query uses `{ id: sessionId }`. Confirm the arg name is `id` (it is — seen at `sessions.ts:113`).
- `api.memoryEntries.listByProject` uses `{ projectId }` (confirmed at `memoryEntries.ts:40`).
