# Validation & Save-to-Memory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add block context modes (default/draft/validation), a Validate button in brainstorm, and LLM-assisted save-to-memory from brainstorm responses.

**Architecture:** Replace `isDraft: boolean` with `contextMode: "default" | "draft" | "validation"` on blocks. Context assembly filters blocks based on brainstorm vs validation mode. Save-to-memory uses a separate lightweight LLM call to draft memory entries from selected text.

**Tech Stack:** Convex (schema, mutations, actions), React (brainstorm panel, block UI), Claude Agent SDK (validation suffix), Vitest (tests)

**Design Doc:** `docs/plans/2026-03-11-validation-and-save-to-memory-design.md`

---

## Task 1: Schema — Replace isDraft with contextMode

**Files:**
- Modify: `convex/schema.ts:131` (blocks table)
- Modify: `convex/schema.ts:199` (snapshots table)

**Step 1: Update blocks table schema**

In `convex/schema.ts`, replace `isDraft` with `contextMode`:

```ts
// Before (line 131):
isDraft: v.optional(v.boolean()),

// After:
// Context mode: controls when this block is included in LLM context
// "default" (or undefined) = always included
// "draft" = never included (work in progress)
// "validation" = included only in validation mode
contextMode: v.optional(v.union(v.literal("default"), v.literal("draft"), v.literal("validation"))),
```

**Step 2: Update snapshots table schema**

In `convex/schema.ts`, same replacement in the snapshots blocks array (line 199):

```ts
// Before:
isDraft: v.optional(v.boolean()),

// After:
contextMode: v.optional(v.union(v.literal("default"), v.literal("draft"), v.literal("validation"))),
```

**Step 3: Verify types**

Run: `pnpm tsc --noEmit`
Expected: FAIL — many files still reference `isDraft`. This is expected; we fix them in subsequent tasks.

**Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(validation): replace isDraft with contextMode in schema"
```

---

## Task 2: Backend — Migrate isDraft References in blocks.ts

**Files:**
- Modify: `convex/blocks.ts`

**Step 1: Replace toggleDraft with setContextMode**

Find the `toggleDraft` mutation (lines 491-511) and replace:

```ts
// Replace the entire toggleDraft mutation with:
export const setContextMode = mutation({
  args: {
    id: v.id("blocks"),
    contextMode: v.union(v.literal("default"), v.literal("draft"), v.literal("validation")),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    if (!block) throw new Error("Block not found")

    await requireSessionAccess(ctx, block.sessionId)

    const now = Date.now()
    // Store "default" as undefined for backwards compatibility
    const modeValue = args.contextMode === "default" ? undefined : args.contextMode
    await ctx.db.patch(args.id, {
      contextMode: modeValue,
      updatedAt: now,
    })
    await ctx.db.patch(block.sessionId, { updatedAt: now })

    // Context mode changes affect what's included in LLM context
    await invalidateClaudeSession(ctx, block.sessionId, block.zone)

    return args.id
  },
})
```

**Step 2: Check for any other isDraft references in blocks.ts**

Search for `isDraft` in blocks.ts. If block creation mutations set `isDraft`, update them to use `contextMode` instead.

**Step 3: Verify types**

Run: `pnpm tsc --noEmit`
Expected: Still failing (other files), but blocks.ts should compile.

**Step 4: Commit**

```bash
git add convex/blocks.ts
git commit -m "feat(validation): replace toggleDraft with setContextMode mutation"
```

---

## Task 3: Backend — Migrate Context Assembly (Server-Side)

**Files:**
- Modify: `convex/lib/context.ts`
- Modify: `convex/lib/context.test.ts`

**Step 1: Add helper function for block filtering**

At the top of `convex/lib/context.ts`, add:

```ts
/**
 * Check if a block should be excluded from context assembly.
 * @param block - The block to check
 * @param mode - "brainstorm" includes default blocks only; "validation" includes default + validation blocks
 */
function isBlockExcluded(
  block: { contextMode?: string; type: string },
  mode: "brainstorm" | "validation" = "brainstorm"
): boolean {
  const contextMode = block.contextMode ?? "default"
  if (contextMode === "draft") return true
  if (contextMode === "validation" && mode !== "validation") return true
  return false
}
```

**Step 2: Replace all isDraft checks with isBlockExcluded**

Replace each `isDraft` reference:

1. `extractSystemPromptFromBlocks` — add optional `mode` parameter:
```ts
export function extractSystemPromptFromBlocks(
  blocks: Doc<"blocks">[],
  mode: "brainstorm" | "validation" = "brainstorm"
): string | undefined {
  const systemPromptBlocks = blocks
    .filter((b) => b.type === "system_prompt" && b.zone === "PERMANENT" && !isBlockExcluded(b, mode))
    .sort((a, b) => a.position - b.position)
```

2. `assembleContext` — add optional `mode` parameter:
```ts
export function assembleContext(
  blocks: Doc<"blocks">[],
  userPrompt: string,
  mode: "brainstorm" | "validation" = "brainstorm"
): ContextMessage[] {
  // ... in the loop:
  if (block.type === "system_prompt" || isBlockExcluded(block, mode)) {
    continue
  }
```

3. `assembleContextWithConversation` — add optional `mode` parameter:
```ts
export function assembleContextWithConversation(
  blocks: Doc<"blocks">[],
  conversationHistory: ConversationMessage[],
  newMessage: string,
  activeSkillsContent?: string,
  mode: "brainstorm" | "validation" = "brainstorm"
): ContextMessage[] {
  // ... in the loop:
  if (block.type === "system_prompt" || isBlockExcluded(block, mode)) {
    continue
  }
```

4. `assembleSystemPromptWithContext` — add optional `mode` parameter:
```ts
export function assembleSystemPromptWithContext(
  blocks: Doc<"blocks">[],
  renderedMemory?: string,
  mode: "brainstorm" | "validation" = "brainstorm"
): string | undefined {
  const permanentBlocks = blocks
    .filter((b) => b.zone === "PERMANENT" && !isBlockExcluded(b, mode))
    .sort((a, b) => a.position - b.position)
```

5. `getContextStats` — add optional `mode` parameter:
```ts
export function getContextStats(
  blocks: Doc<"blocks">[],
  mode: "brainstorm" | "validation" = "brainstorm"
) {
  // ... in the loop:
  if (isBlockExcluded(block, mode)) continue
```

**Step 3: Update tests**

In `convex/lib/context.test.ts`, update the draft filtering test suite:

1. Rename suite from "draft block filtering" to "context mode filtering"
2. Update test blocks from `isDraft: true` to `contextMode: "draft" as any` (the `as any` is needed because `createBlock` may not have the new field typed yet — update the helper too)
3. Add new tests for validation mode:

```ts
describe("context mode filtering", () => {
  it("excludes draft blocks from brainstorm context", () => {
    const blocks = [
      createBlock({ content: "Active", zone: "WORKING", position: 0 }),
      createBlock({ content: "Draft", zone: "WORKING", position: 1, contextMode: "draft" }),
    ]
    const result = assembleContext(blocks, "test")
    expect(result.some((m) => m.content.includes("Active"))).toBe(true)
    expect(result.some((m) => m.content.includes("Draft"))).toBe(false)
  })

  it("excludes validation blocks from brainstorm context", () => {
    const blocks = [
      createBlock({ content: "Active", zone: "WORKING", position: 0 }),
      createBlock({ content: "Criteria", zone: "STABLE", position: 0, contextMode: "validation" }),
    ]
    const result = assembleContext(blocks, "test", "brainstorm")
    expect(result.some((m) => m.content.includes("Active"))).toBe(true)
    expect(result.some((m) => m.content.includes("Criteria"))).toBe(false)
  })

  it("includes validation blocks in validation context", () => {
    const blocks = [
      createBlock({ content: "Active", zone: "WORKING", position: 0 }),
      createBlock({ content: "Criteria", zone: "STABLE", position: 0, contextMode: "validation" }),
    ]
    const result = assembleContext(blocks, "test", "validation")
    expect(result.some((m) => m.content.includes("Active"))).toBe(true)
    expect(result.some((m) => m.content.includes("Criteria"))).toBe(true)
  })

  it("excludes draft blocks from validation context", () => {
    const blocks = [
      createBlock({ content: "Draft", zone: "WORKING", position: 0, contextMode: "draft" }),
    ]
    const result = assembleContext(blocks, "test", "validation")
    expect(result.some((m) => m.content.includes("Draft"))).toBe(false)
  })

  it("treats undefined contextMode as default (included everywhere)", () => {
    const blocks = [
      createBlock({ content: "Normal", zone: "WORKING", position: 0 }),
    ]
    const brainstorm = assembleContext(blocks, "test", "brainstorm")
    const validation = assembleContext(blocks, "test", "validation")
    expect(brainstorm.some((m) => m.content.includes("Normal"))).toBe(true)
    expect(validation.some((m) => m.content.includes("Normal"))).toBe(true)
  })
})
```

**Step 4: Run tests**

Run: `pnpm vitest run convex/lib/context.test.ts`
Expected: All tests PASS

**Step 5: Verify types**

Run: `pnpm tsc --noEmit`
Expected: May still fail on other files.

**Step 6: Commit**

```bash
git add convex/lib/context.ts convex/lib/context.test.ts
git commit -m "feat(validation): add context mode filtering to context assembly"
```

---

## Task 4: Backend — Migrate Remaining isDraft References

**Files:**
- Modify: `convex/metrics.ts` (3 locations)
- Modify: `convex/context.ts` (1 location)
- Modify: `convex/snapshots.ts` (2 locations)

**Step 1: Update convex/metrics.ts**

Replace all 3 `isDraft` references with `contextMode` checks:

```ts
// In getZoneMetrics (line ~68):
// Before: if (!block.isDraft) {
// After:
if ((block.contextMode ?? "default") !== "draft") {

// In checkBudget (line ~135):
// Before: block.isDraft ? sum : sum + ...
// After:
(block.contextMode ?? "default") === "draft" ? sum : sum + ...

// In getBudgetStatus (line ~211):
// Before: if (block.isDraft) continue
// After:
if ((block.contextMode ?? "default") === "draft") continue
```

**Step 2: Update convex/context.ts**

```ts
// Line ~152:
// Before: const activeBlocks = blocks.filter((b) => !b.isDraft)
// After:
const activeBlocks = blocks.filter((b) => (b.contextMode ?? "default") !== "draft")
```

**Step 3: Update convex/snapshots.ts**

```ts
// In create (line ~85):
// Before: isDraft: block.isDraft,
// After:
contextMode: block.contextMode,

// In restore (line ~136):
// Before: isDraft: blockData.isDraft,
// After:
contextMode: blockData.contextMode,
```

**Step 4: Verify types**

Run: `pnpm tsc --noEmit`
Expected: May still fail on frontend files.

**Step 5: Commit**

```bash
git add convex/metrics.ts convex/context.ts convex/snapshots.ts
git commit -m "feat(validation): migrate isDraft to contextMode in metrics, context preview, snapshots"
```

---

## Task 5: Backend — Migrate Client-Side Context Assembly

**Files:**
- Modify: `src/lib/llm/context.ts`

**Step 1: Update Block interface**

```ts
// Before:
export interface Block {
  content: string
  type: string
  zone: Zone | string
  position: number
  isDraft?: boolean
}

// After:
export interface Block {
  content: string
  type: string
  zone: Zone | string
  position: number
  contextMode?: "default" | "draft" | "validation"
}
```

**Step 2: Add isBlockExcluded helper (same as server-side)**

```ts
function isBlockExcluded(
  block: { contextMode?: string; type: string },
  mode: "brainstorm" | "validation" = "brainstorm"
): boolean {
  const contextMode = block.contextMode ?? "default"
  if (contextMode === "draft") return true
  if (contextMode === "validation" && mode !== "validation") return true
  return false
}
```

**Step 3: Replace all isDraft references**

Same pattern as server-side: replace `block.isDraft` checks with `isBlockExcluded(block, mode)`. Add optional `mode` parameter to all assembly functions.

**Step 4: Verify types**

Run: `pnpm tsc --noEmit`
Expected: May still fail on UI files.

**Step 5: Commit**

```bash
git add src/lib/llm/context.ts
git commit -m "feat(validation): migrate client-side context assembly to contextMode"
```

---

## Task 6: Frontend — Block Context Mode UI

**Files:**
- Modify: `src/routes/app/index.tsx` (BlockCard component)

**Step 1: Replace isDraft prop with contextMode**

In the BlockCard component:

```tsx
// Replace isDraft prop:
// Before: isDraft?: boolean
// After:
contextMode?: "default" | "draft" | "validation"
```

**Step 2: Update visual rendering**

Replace the draft badge and opacity logic:

```tsx
// Opacity (replace isDraft && "opacity-50"):
(contextMode === "draft") && "opacity-50",
(contextMode === "validation") && "opacity-75 border-l-2 border-l-blue-400",

// Badge (replace the isDraft badge span):
{contextMode === "draft" && (
  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
    Draft
  </span>
)}
{contextMode === "validation" && (
  <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
    Criteria
  </span>
)}
```

**Step 3: Replace toggle button with context mode selector**

Replace the "Draft"/"Undraft" button with a 3-option selector:

```tsx
// Replace the single toggle button with:
<select
  value={contextMode ?? "default"}
  onChange={(e) => {
    const mode = e.target.value as "default" | "draft" | "validation"
    setContextMode({ id: block._id, contextMode: mode })
  }}
  className="px-1.5 py-0.5 text-[10px] rounded bg-transparent border border-border hover:bg-muted cursor-pointer"
>
  <option value="default">Active</option>
  <option value="draft">Draft</option>
  <option value="validation">Criteria</option>
</select>
```

**Step 4: Update prop passing**

Where `isDraft={block.isDraft}` is passed to BlockCard, change to `contextMode={block.contextMode}`.

**Step 5: Update mutation call**

Replace `toggleDraft` mutation usage with `setContextMode`:

```tsx
const setContextModeMutation = useMutation(api.blocks.setContextMode)
// Replace handleToggleDraft with the select onChange above
```

**Step 6: Verify types**

Run: `pnpm tsc --noEmit`
Expected: PASS — all isDraft references should be gone.

**Step 7: Run all tests**

Run: `pnpm vitest run`
Expected: All tests PASS.

**Step 8: Commit**

```bash
git add src/routes/app/index.tsx
git commit -m "feat(validation): add context mode selector to block UI"
```

---

## Task 7: Backend — Validation Mode in Brainstorm Action

**Files:**
- Modify: `convex/generations.ts` (startBrainstormGeneration)
- Modify: `convex/claudeNode.ts` (streamBrainstormMessage)
- Modify: `convex/lib/context.ts` (add VALIDATION_SUFFIX)

**Step 1: Add validation suffix to context.ts**

```ts
export const VALIDATION_SUFFIX = `
VALIDATION MODE: You are evaluating artifacts against criteria. Blocks marked as validation criteria define what "good" looks like. For each criterion, state whether the artifacts meet it. Be specific — quote the artifact where it meets or fails the criterion. Summarize with a clear PASS / PARTIAL / FAIL verdict.`
```

**Step 2: Add isValidation arg to startBrainstormGeneration**

In `convex/generations.ts`, add the arg and pass it through:

```ts
export const startBrainstormGeneration = mutation({
  args: {
    // ... existing args
    isValidation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // ... existing code
    await ctx.scheduler.runAfter(0, api.claudeNode.streamBrainstormMessage, {
      // ... existing args
      isValidation: args.isValidation,
    })
    return { generationId }
  },
})
```

**Step 3: Add isValidation to streamBrainstormMessage**

In `convex/claudeNode.ts`, add the arg:

```ts
export const streamBrainstormMessage = action({
  args: {
    // ... existing args
    isValidation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const isValidation = args.isValidation ?? false
    const contextMode = isValidation ? "validation" : "brainstorm"
    // ...
```

**Step 4: Pass mode through context assembly calls**

In `streamBrainstormMessage`, update the context assembly calls:

```ts
// System prompt assembly (around line 191):
let systemPrompt: string | undefined = assembleSystemPromptWithContext(blocks, renderedMemory, contextMode)

// Check for validation prompt override in PERMANENT blocks:
if (isValidation) {
  const validationPromptBlock = blocks.find(
    (b) => b.type === "validation_prompt" && b.zone === "PERMANENT" && (b.contextMode ?? "default") !== "draft"
  )
  if (validationPromptBlock) {
    systemPrompt = (systemPrompt ?? "") + "\n\n" + validationPromptBlock.content
  } else {
    systemPrompt = (systemPrompt ?? "") + VALIDATION_SUFFIX
  }
}

// Full context assembly for turn 1 (around line 210):
const messages = assembleContextWithConversation(
  blocks,
  args.conversationHistory,
  args.newMessage,
  activeSkillsContent,
  contextMode
)
```

**Step 5: Verify types**

Run: `pnpm tsc --noEmit`
Expected: PASS

**Step 6: Run tests**

Run: `pnpm vitest run`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add convex/generations.ts convex/claudeNode.ts convex/lib/context.ts
git commit -m "feat(validation): add validation mode to brainstorm action with suffix and override"
```

---

## Task 8: Frontend — Validate Button in Brainstorm Panel

**Files:**
- Modify: `src/hooks/useBrainstorm.ts`
- Modify: `src/components/BrainstormDialog.tsx`

**Step 1: Add validation send to useBrainstorm**

In `useBrainstorm.ts`, add a `sendValidation` method that wraps `sendMessage` with `isValidation: true`:

```ts
// In the Claude-specific send function, add isValidation parameter:
const sendMessageClaude = useCallback(
  async (content: string, conversationHistory, isValidation = false) => {
    const activeSkillIds = Object.entries(activeSkills)
      .filter(([, enabled]) => enabled)
      .map(([id]) => id)

    const result = await startBrainstormGeneration({
      sessionId,
      conversationHistory,
      newMessage: content,
      disableAgentBehavior,
      preventSelfTalk,
      activeSkillIds,
      model: model ?? undefined,
      isValidation,
    })
    setGenerationId(result.generationId)
  },
  // ... dependencies
)

// Update sendMessage to accept isValidation:
const sendMessage = useCallback(
  async (content: string, isValidation = false) => {
    // ... existing message creation logic
    // Pass isValidation to the provider-specific handler
    if (provider === "claude") {
      await sendMessageClaude(content, conversationForSend, isValidation)
    } else {
      // For non-Claude providers, isValidation is ignored for now
      await sendMessageOllama(content, conversationForSend) // or OpenRouter
    }
  },
  // ... dependencies
)

// Expose in return:
return {
  // ... existing returns
  sendMessage,
  // sendValidation is just sendMessage with isValidation=true
  sendValidation: useCallback(
    (content: string) => sendMessage(content, true),
    [sendMessage]
  ),
}
```

**Step 2: Add Validate button to BrainstormDialog**

In `BrainstormDialog.tsx`, next to the Send button (around line 703-720):

```tsx
{/* Validate button — next to Send */}
{!isStreaming && (
  <Button
    variant="secondary"
    size="sm"
    onClick={handleValidate}
    disabled={!inputValue.trim() || !isProviderAvailable}
    title="Send with validation criteria included"
  >
    <CheckCircle className="w-4 h-4 mr-1" />
    Validate
  </Button>
)}
```

Add the handler:

```tsx
const handleValidate = useCallback(async () => {
  if (!inputValue.trim() || isStreaming) return
  const content = inputValue.trim()
  setInputValue("")
  await onSendValidation(content)
}, [inputValue, isStreaming, onSendValidation])
```

Add `onSendValidation` to the dialog props interface, passed from the parent.

**Step 3: Wire in BrainstormPanel**

In `BrainstormPanel.tsx`, pass `sendValidation` from the hook to the dialog:

```tsx
<BrainstormDialog
  // ... existing props
  onSendValidation={brainstorm.sendValidation}
/>
```

**Step 4: Verify types**

Run: `pnpm tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useBrainstorm.ts src/components/BrainstormDialog.tsx src/components/BrainstormPanel.tsx
git commit -m "feat(validation): add Validate button to brainstorm panel"
```

---

## Task 9: Backend — Memory Draft Action

**Files:**
- Create: `convex/memoryDraft.ts`

**Step 1: Create the memory draft action**

Create `convex/memoryDraft.ts`:

```ts
"use node"

import { v } from "convex/values"
import { action } from "./_generated/server"
import { internal } from "./_generated/api"
import { query as claudeQuery } from "@anthropic-ai/claude-agent-sdk"

// Re-use getClaudeCodePath from claudeNode
import { getClaudeCodePath } from "./claudeNode"

/**
 * Draft a memory entry from selected text using a lightweight LLM call.
 * Uses the project's memory schema and existing entries to suggest
 * type, title, content, and tags.
 */
export const draftMemoryEntry = action({
  args: {
    projectId: v.id("projects"),
    selectedText: v.string(),
  },
  handler: async (ctx, args): Promise<{
    type: string
    title: string
    content: string
    tags: string[]
    duplicateWarning?: string
  }> => {
    // Fetch schema and existing entries
    const schema = await ctx.runQuery(internal.memorySchemas.getByProjectInternal, {
      projectId: args.projectId,
    })
    const entries = await ctx.runQuery(internal.memoryEntries.listByProjectInternal, {
      projectId: args.projectId,
    })

    if (!schema) {
      throw new Error("No memory schema configured for this project")
    }

    const typesDescription = schema.types
      .map((t) => `- ${t.name} (${t.icon}): use for ${t.name}-related knowledge`)
      .join("\n")

    const existingEntriesText = entries.length > 0
      ? entries.map((e) => `[${e.type}] "${e.title}" — ${e.content}\n  Tags: ${e.tags.join(", ")}`).join("\n\n")
      : "(no existing entries)"

    const systemPrompt = `You are a memory entry drafting assistant. Given selected text from a conversation, create a structured memory entry for the project's knowledge base.

Available memory types:
${typesDescription}

Existing entries:
${existingEntriesText}

Rules:
- Pick the most appropriate type from the available types
- Write a concise, specific title (not just the first line of the selection)
- Distill the content — extract the insight, don't just copy the text verbatim
- Reuse existing tags where they fit. Use lowercase, #-prefixed tags
- If a very similar entry already exists, include a duplicateWarning suggesting the user update that entry instead

Respond with ONLY valid JSON (no markdown, no explanation):
{"type": "...", "title": "...", "content": "...", "tags": ["#...", "#..."], "duplicateWarning": "..." or null}`

    const prompt = `Draft a memory entry from this selected text:\n\n${args.selectedText}`

    let responseText = ""

    for await (const message of claudeQuery({
      prompt,
      options: {
        systemPrompt,
        allowedTools: [],
        maxTurns: 1,
        maxBudgetUsd: 0.05,
        pathToClaudeCodeExecutable: getClaudeCodePath(),
        // Use configured draft model or default
        model: process.env.MEMORY_DRAFT_MODEL || undefined,
      },
    })) {
      const msgType = (message as Record<string, unknown>).type as string
      if (msgType === "assistant") {
        const msg = message as Record<string, unknown>
        const msgMessage = msg.message as Record<string, unknown>
        const content = msgMessage.content as Array<Record<string, unknown>>
        responseText = content
          .filter((block) => block.type === "text")
          .map((block) => block.text as string)
          .join("")
      }
    }

    // Parse JSON response
    try {
      // Strip markdown code fences if present
      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      const parsed = JSON.parse(cleaned)
      return {
        type: parsed.type ?? schema.types[0]?.name ?? "note",
        title: parsed.title ?? "Untitled",
        content: parsed.content ?? args.selectedText,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        duplicateWarning: parsed.duplicateWarning ?? undefined,
      }
    } catch {
      // Fallback: return raw selection with best-guess type
      return {
        type: schema.types[0]?.name ?? "note",
        title: args.selectedText.slice(0, 60).split("\n")[0],
        content: args.selectedText,
        tags: [],
      }
    }
  },
})
```

**Step 2: Add internal query for memorySchemas**

In `convex/memorySchemas.ts`, add an internal query (if not already present):

```ts
import { internalQuery } from "./_generated/server"

export const getByProjectInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memorySchemas")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first()
  },
})
```

**Step 3: Export getClaudeCodePath from claudeNode.ts**

If `getClaudeCodePath` is not exported from `convex/claudeNode.ts`, make it exported:

```ts
// Before: function getClaudeCodePath()
// After:
export function getClaudeCodePath()
```

**Step 4: Verify types**

Run: `pnpm tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/memoryDraft.ts convex/memorySchemas.ts convex/claudeNode.ts
git commit -m "feat(validation): add LLM-assisted memory entry draft action"
```

---

## Task 10: Frontend — Save-to-Memory Button in Brainstorm

**Files:**
- Modify: `src/components/BrainstormDialog.tsx`
- Modify: `src/hooks/useBrainstorm.ts`
- Create: `src/components/SaveToMemoryDialog.tsx`

**Step 1: Create SaveToMemoryDialog**

Create `src/components/SaveToMemoryDialog.tsx`:

```tsx
import { useState, useEffect } from "react"
import { useAction } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { CreateEntryForm } from "@/components/memory/CreateEntryForm"

interface SaveToMemoryDialogProps {
  projectId: Id<"projects">
  selectedText: string
  schemaTypes: Array<{ name: string; color: string; icon: string }>
  onSave: (args: {
    projectId: Id<"projects">
    type: string
    title: string
    content: string
    tags: string[]
  }) => Promise<unknown>
  onClose: () => void
}

export function SaveToMemoryDialog({
  projectId,
  selectedText,
  schemaTypes,
  onSave,
  onClose,
}: SaveToMemoryDialogProps) {
  const draftMemoryEntry = useAction(api.memoryDraft.draftMemoryEntry)
  const [isDrafting, setIsDrafting] = useState(true)
  const [draft, setDraft] = useState<{
    type: string
    title: string
    content: string
    tags: string[]
    duplicateWarning?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchDraft() {
      try {
        const result = await draftMemoryEntry({ projectId, selectedText })
        if (!cancelled) {
          setDraft(result)
          setIsDrafting(false)
        }
      } catch (err) {
        if (!cancelled) {
          // Fallback to manual entry
          setDraft({
            type: schemaTypes[0]?.name ?? "note",
            title: selectedText.slice(0, 60).split("\n")[0],
            content: selectedText,
            tags: [],
          })
          setError("Could not generate draft. Fill in manually.")
          setIsDrafting(false)
        }
      }
    }
    fetchDraft()
    return () => { cancelled = true }
  }, [projectId, selectedText, draftMemoryEntry, schemaTypes])

  if (isDrafting) {
    return (
      <div className="border border-border rounded-lg p-4 bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">Drafting memory entry...</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-yellow-600">{error}</p>
      )}
      {draft?.duplicateWarning && (
        <p className="text-xs text-blue-600">Note: {draft.duplicateWarning}</p>
      )}
      <CreateEntryForm
        projectId={projectId}
        types={schemaTypes}
        onSubmit={onSave}
        onCancel={onClose}
        initialValues={draft ?? undefined}
      />
    </div>
  )
}
```

**Step 2: Add initialValues to CreateEntryForm**

In `src/components/memory/CreateEntryForm.tsx`, add optional `initialValues` prop:

```tsx
interface CreateEntryFormProps {
  // ... existing props
  initialValues?: {
    type: string
    title: string
    content: string
    tags: string[]
  }
}

export function CreateEntryForm({ projectId, types, onSubmit, onCancel, initialValues }: CreateEntryFormProps) {
  const [type, setType] = useState(initialValues?.type ?? types[0]?.name ?? "note")
  const [title, setTitle] = useState(initialValues?.title ?? "")
  const [content, setContent] = useState(initialValues?.content ?? "")
  const [tagsInput, setTagsInput] = useState(initialValues?.tags?.join(", ") ?? "")
  // ... rest unchanged
```

**Step 3: Add save-to-memory button to BrainstormDialog**

In `BrainstormDialog.tsx`, next to the existing Save dropdown on each message, add a memory icon button:

```tsx
// Import
import { BookMarked } from "lucide-react"

// In message actions area (near the Save dropdown):
{onSaveToMemory && (
  <Button
    variant="ghost"
    size="sm"
    className="h-7 px-2"
    disabled={!window.getSelection()?.toString()}
    onClick={() => {
      const selection = window.getSelection()?.toString()
      if (selection) onSaveToMemory(selection)
    }}
    title="Save selection to memory"
  >
    <BookMarked className="w-3.5 h-3.5" />
  </Button>
)}
```

**Step 4: Add onSaveToMemory prop and state**

Add to BrainstormDialog props and wire up the SaveToMemoryDialog:

```tsx
// Props:
onSaveToMemory?: (selectedText: string) => void

// State in dialog:
const [memoryDraftText, setMemoryDraftText] = useState<string | null>(null)

// In the dialog body, when memoryDraftText is set:
{memoryDraftText && projectId && schemaTypes && (
  <SaveToMemoryDialog
    projectId={projectId}
    selectedText={memoryDraftText}
    schemaTypes={schemaTypes}
    onSave={async (args) => {
      await createMemoryEntry(args)
      setMemoryDraftText(null)
    }}
    onClose={() => setMemoryDraftText(null)}
  />
)}
```

**Step 5: Wire from BrainstormPanel**

Pass the necessary props (projectId, schema types, createEntry mutation) from BrainstormPanel through to BrainstormDialog.

**Step 6: Verify types**

Run: `pnpm tsc --noEmit`
Expected: PASS

**Step 7: Commit**

```bash
git add src/components/SaveToMemoryDialog.tsx src/components/memory/CreateEntryForm.tsx src/components/BrainstormDialog.tsx src/components/BrainstormPanel.tsx
git commit -m "feat(validation): add save-to-memory button with LLM-assisted drafting"
```

---

## Task 11: Backend — Data Migration

**Files:**
- Create: `convex/migrations/migrateIsDraftToContextMode.ts`

**Step 1: Write migration**

Create a one-time migration that converts existing blocks:

```ts
import { internalMutation } from "../_generated/server"

/**
 * One-time migration: convert isDraft boolean to contextMode enum.
 * Run via: npx convex run migrations/migrateIsDraftToContextMode:migrate
 */
export const migrate = internalMutation({
  handler: async (ctx) => {
    const blocks = await ctx.db.query("blocks").collect()
    let migrated = 0

    for (const block of blocks) {
      // Only migrate blocks that still have isDraft
      const raw = block as Record<string, unknown>
      if (raw.isDraft !== undefined) {
        await ctx.db.patch(block._id, {
          contextMode: raw.isDraft ? "draft" : undefined,
          // Clear the old field — Convex will ignore fields not in schema
        })
        migrated++
      }
    }

    // Also migrate snapshots
    const snapshots = await ctx.db.query("snapshots").collect()
    let snapshotsMigrated = 0
    for (const snapshot of snapshots) {
      const needsUpdate = snapshot.blocks.some(
        (b: Record<string, unknown>) => b.isDraft !== undefined
      )
      if (needsUpdate) {
        const updatedBlocks = snapshot.blocks.map((b: Record<string, unknown>) => ({
          ...b,
          contextMode: b.isDraft ? "draft" : undefined,
          isDraft: undefined,
        }))
        await ctx.db.patch(snapshot._id, { blocks: updatedBlocks })
        snapshotsMigrated++
      }
    }

    return { migrated, snapshotsMigrated }
  },
})
```

**Note:** The old `isDraft` field will be silently ignored by Convex once removed from the schema. Existing blocks with `isDraft: true` that haven't been migrated will simply lose the field — they'll become `contextMode: undefined` (default). The migration ensures draft blocks keep their draft status.

**Step 2: Commit**

```bash
git add convex/migrations/migrateIsDraftToContextMode.ts
git commit -m "feat(validation): add isDraft to contextMode migration script"
```

---

## Task 12: Integration — Run All Tests and Verify

**Files:**
- No new files

**Step 1: Run all tests**

Run: `pnpm vitest run`
Expected: All tests PASS

**Step 2: Type check**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Verify no remaining isDraft references in source code**

Run: `grep -r "isDraft" --include="*.ts" --include="*.tsx" convex/ src/ | grep -v node_modules | grep -v ".test." | grep -v "migration"`
Expected: No matches in production code (only in tests checking backwards compat, migrations, and docs)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(validation): integration fixes from full test run"
```

---

## Task 13: Deploy and Test on VPN

**Step 1: Push to remote**

```bash
git push origin main
```

**Step 2: Run migration on VPN**

```bash
ssh ubuntu@192.168.87.58 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd ~/contextforge/ContextForgeTS && export CONVEX_SELF_HOSTED_URL=http://192.168.87.58:3210 && export CONVEX_SELF_HOSTED_ADMIN_KEY="<key>" && npx convex run migrations/migrateIsDraftToContextMode:migrate'
```

**Step 3: Deploy Convex functions**

```bash
ssh ubuntu@192.168.87.58 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd ~/contextforge/ContextForgeTS && git pull && pnpm install && export CONVEX_SELF_HOSTED_URL=http://192.168.87.58:3210 && export CONVEX_SELF_HOSTED_ADMIN_KEY="<key>" && npx convex deploy --yes'
```

**Step 4: Build and restart frontend**

```bash
ssh ubuntu@192.168.87.58 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd ~/contextforge/ContextForgeTS && VITE_CONVEX_URL=http://192.168.87.58:3210 pnpm build:standalone && pm2 restart contextforge-frontend'
```

**Step 5: Manual verification**

1. Open a project session
2. Create a block, verify context mode selector shows Active/Draft/Criteria
3. Set a block to Draft — verify it's dimmed and excluded from brainstorm
4. Set a block to Criteria — verify blue badge, excluded from brainstorm
5. Click Validate — verify criteria block is included, response has PASS/PARTIAL/FAIL
6. Select text in a brainstorm response, click Save to Memory — verify LLM draft appears
7. Verify existing draft blocks still work (migration preserved their status)
