# Claude Code Caching Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Switch from one-shot subprocess per brainstorm turn to SDK session resume, enabling Anthropic's prompt caching (90% cost reduction on cached prefix).

**Architecture:** Store Claude Agent SDK session ID on the Convex `sessions` table. Turn 1 sends full context + message; turns 2+ send `resume: sessionId` with only the new message. Editing PERMANENT/STABLE blocks clears the session ID, forcing a fresh session on the next turn.

**Tech Stack:** Convex (schema, mutations, actions), Claude Agent SDK v0.2.x (`query()` with `resume`), Vitest for unit tests.

**Design doc:** `docs/plans/2026-03-10-claude-code-caching-rewrite-design.md`

---

### Task 1: Add `claudeSessionId` to sessions schema

**Files:**
- Modify: `convex/schema.ts:28-50`

**Step 1: Add field to sessions table**

In `convex/schema.ts`, add `claudeSessionId` to the sessions table definition, after the `systemPrompt` field:

```ts
    // System prompt for LLM interactions
    systemPrompt: v.optional(v.string()),
    // Claude Agent SDK session ID for resume (enables prompt caching)
    claudeSessionId: v.optional(v.string()),
```

**Step 2: Run Convex dev to verify schema push**

Run: `pnpm convex dev` (should apply schema change with no errors)

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add claudeSessionId field to sessions schema"
```

---

### Task 2: Add internal mutation to store/clear Claude session ID

**Files:**
- Modify: `convex/generations.ts` (add two internal mutations)

**Step 1: Add `setClaudeSessionId` internal mutation**

Add at the bottom of `convex/generations.ts`, before the `saveBrainstormMessage` mutation:

```ts
/**
 * Internal mutation to store Claude Agent SDK session ID on a session.
 * Called by the streaming action after the first turn creates a session.
 */
export const setClaudeSessionId = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    claudeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      claudeSessionId: args.claudeSessionId,
    })
  },
})
```

**Step 2: Add `clearClaudeSessionId` internal mutation**

```ts
/**
 * Internal mutation to clear Claude Agent SDK session ID.
 * Called when PERMANENT/STABLE blocks change, forcing a fresh session on next turn.
 */
export const clearClaudeSessionId = internalMutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      claudeSessionId: undefined,
    })
  },
})
```

**Step 3: Add internal query to get session (for reading claudeSessionId in action)**

```ts
/**
 * Internal query to get session by ID.
 * Used by the streaming action to read claudeSessionId.
 */
export const getSessionInternal = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId)
  },
})
```

Note: `internalQuery` import may already exist; check top of file. If not, add it to the import from `./_generated/server`.

**Step 4: Verify build**

Run: `pnpm convex dev` (should compile cleanly)

**Step 5: Commit**

```bash
git add convex/generations.ts
git commit -m "feat: add internal mutations for Claude session ID management"
```

---

### Task 3: Modify `streamBrainstormMessage` to use session resume

This is the core change. The action needs to:
1. Check if a `claudeSessionId` exists on the session
2. If yes (turn 2+): send only `newMessage` as prompt, pass `resume: claudeSessionId`
3. If no (turn 1): send full assembled context, capture `session_id` from result, store it

**Files:**
- Modify: `convex/claudeNode.ts:137-417`

**Step 1: Add import for `getSessionInternal` and `setClaudeSessionId`**

The `internal` import already exists. No new imports needed — internal mutations/queries are accessed via `internal.generations.setClaudeSessionId` etc.

**Step 2: Read `claudeSessionId` from session at the start of the handler**

After `const preventSelfTalk = args.preventSelfTalk ?? true` (line 158), add:

```ts
    // Check for existing Claude session (enables prompt caching on turn 2+)
    const session = await ctx.runQuery(internal.generations.getSessionInternal, {
      sessionId: args.sessionId,
    })
    const existingClaudeSessionId = session?.claudeSessionId
```

**Step 3: Conditionally assemble context or use just new message**

Replace the entire context assembly block (lines 160-193) with:

```ts
    let systemPrompt: string | undefined
    let prompt: string

    if (existingClaudeSessionId) {
      // Turn 2+: SDK has full prior context cached, send only new message
      // System prompt must still be passed (SDK validates it matches the session)
      systemPrompt = assembleSystemPromptWithContext(blocks)
      if (disableAgentBehavior) {
        systemPrompt = (systemPrompt ?? "") + NO_TOOLS_SUFFIX
      }
      if (preventSelfTalk) {
        systemPrompt = (systemPrompt ?? "") + NO_SELF_TALK_SUFFIX
      }
      prompt = args.newMessage
    } else {
      // Turn 1: assemble full context as prompt
      systemPrompt = assembleSystemPromptWithContext(blocks)
      if (disableAgentBehavior) {
        systemPrompt = (systemPrompt ?? "") + NO_TOOLS_SUFFIX
      }
      if (preventSelfTalk) {
        systemPrompt = (systemPrompt ?? "") + NO_SELF_TALK_SUFFIX
      }

      const activeSkillsContent = args.activeSkillIds?.length
        ? getActiveSkillsContent(args.activeSkillIds)
        : undefined

      const messages = assembleContextWithConversation(
        blocks,
        args.conversationHistory,
        args.newMessage,
        activeSkillsContent
      )
      const nonSystemMessages = messages.filter((m) => m.role !== "system")
      prompt = formatPromptForSDK(nonSystemMessages)
    }
```

**Step 4: Update `claudeQuery()` call to use `resume`**

Replace the `claudeQuery()` options (lines 251-266) with:

```ts
      for await (const message of claudeQuery({
        prompt,
        options: {
          abortController,
          allowedTools: [], // Text-only mode
          maxTurns: 1,
          systemPrompt,
          model: args.model,
          pathToClaudeCodeExecutable: getClaudeCodePath(),
          includePartialMessages: true,
          maxBudgetUsd: 0.50,
          // Session resume: use existing session if available
          ...(existingClaudeSessionId ? { resume: existingClaudeSessionId } : {}),
          stderr: (data: string) => {
            stderrChunks.push(data)
          },
        },
      })) {
```

Note: `persistSession` is removed (defaults to `true`).

**Step 5: Capture session ID from result and store it**

In the result message handler (around line 331), after capturing `costUsd`, add:

```ts
          // Capture and store Claude session ID for future resume
          const sessionId = msg.session_id as string | undefined
          if (sessionId && !existingClaudeSessionId) {
            await ctx.runMutation(internal.generations.setClaudeSessionId, {
              sessionId: args.sessionId,
              claudeSessionId: sessionId,
            })
          }
```

**Step 6: Handle resume failure gracefully**

In the catch block (line 383), before the existing error handling, add a check for resume-related errors. If resume fails, clear the session ID so the next turn starts fresh:

```ts
      // If resume failed, clear session ID so next turn starts fresh
      if (existingClaudeSessionId) {
        console.warn("[Claude Brainstorm] Session resume may have failed, clearing claudeSessionId")
        await ctx.runMutation(internal.generations.clearClaudeSessionId, {
          sessionId: args.sessionId,
        })
      }
```

**Step 7: Verify build**

Run: `pnpm convex dev`

**Step 8: Commit**

```bash
git add convex/claudeNode.ts
git commit -m "feat: use SDK session resume for prompt caching in brainstorm"
```

---

### Task 4: Invalidate Claude session when context blocks change

When PERMANENT or STABLE blocks are created, updated, or deleted, clear the `claudeSessionId` so the next brainstorm turn starts a fresh session with updated context.

**Files:**
- Modify: `convex/blocks.ts`

**Step 1: Add import for internal API**

At the top of `convex/blocks.ts`, ensure `internal` is imported:

```ts
import { internal } from "./_generated/api"
```

If it's not already imported, add it alongside the existing `api` import.

**Step 2: Add helper function to conditionally clear session**

Add near the top of the file, after imports:

```ts
/**
 * Clear Claude session ID when PERMANENT or STABLE blocks change.
 * This forces a fresh session on the next brainstorm turn so updated
 * context is included.
 */
async function invalidateClaudeSession(
  ctx: { runMutation: (ref: any, args: any) => Promise<void> },
  sessionId: any,
  zone: string
) {
  if (zone === "PERMANENT" || zone === "STABLE") {
    await ctx.runMutation(internal.generations.clearClaudeSessionId, {
      sessionId,
    })
  }
}
```

**Step 3: Add invalidation calls to `create` mutation**

In the `create` mutation handler, after the `ctx.db.insert("blocks", ...)` call, add:

```ts
    await invalidateClaudeSession(ctx, args.sessionId, args.zone)
```

**Step 4: Add invalidation calls to `update` mutation**

In the `update` mutation handler, after the `ctx.db.patch(args.id, ...)` call, add:

```ts
    // Invalidate if content changed and block is in PERMANENT/STABLE
    if (args.content !== undefined) {
      await invalidateClaudeSession(ctx, block.sessionId, block.zone)
    }
    // Also invalidate if zone changed TO or FROM PERMANENT/STABLE
    if (args.zone !== undefined && (args.zone === "PERMANENT" || args.zone === "STABLE" || block.zone === "PERMANENT" || block.zone === "STABLE")) {
      await invalidateClaudeSession(ctx, block.sessionId, block.zone)
    }
```

**Step 5: Add invalidation calls to `remove` mutation**

In the `remove` mutation handler, before the `ctx.db.delete(args.id)` call, add:

```ts
    await invalidateClaudeSession(ctx, block.sessionId, block.zone)
```

**Step 6: Verify build**

Run: `pnpm convex dev`

**Step 7: Commit**

```bash
git add convex/blocks.ts
git commit -m "feat: invalidate Claude session on PERMANENT/STABLE block changes"
```

---

### Task 5: Write unit tests for context assembly changes

The context assembly functions themselves don't change — the branching logic is in `claudeNode.ts`. But we should test the new pattern: "turn 1 sends full context, turn 2+ sends just the message."

**Files:**
- Modify: `convex/lib/context.test.ts`

**Step 1: Add tests for the resume prompt pattern**

Add a new `describe` block at the end of the test file:

```ts
describe("session resume prompt pattern", () => {
  it("turn 1: assembles full context with conversation", () => {
    const blocks = [
      createBlock({ content: "System rules", zone: "PERMANENT", type: "system_prompt", position: 0 }),
      createBlock({ content: "Reference doc", zone: "STABLE", position: 0 }),
      createBlock({ content: "Current draft", zone: "WORKING", position: 0 }),
    ]
    const history = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there" },
    ]

    const messages = assembleContextWithConversation(blocks, history, "New question")
    const nonSystem = messages.filter((m) => m.role !== "system")
    const prompt = formatPromptForSDK(nonSystem)

    // Full context should include STABLE, WORKING, history, and new message
    expect(prompt).toContain("Reference doc")
    expect(prompt).toContain("Current draft")
    expect(prompt).toContain("Hello")
    expect(prompt).toContain("Hi there")
    expect(prompt).toContain("New question")
  })

  it("turn 2+: only new message needed (context is in SDK session)", () => {
    // When resuming, we send just the new message as prompt
    const resumePrompt = "Follow-up question"

    // This is the raw string sent to claudeQuery on resume
    // No formatting needed — it's a plain user message
    expect(resumePrompt).toBe("Follow-up question")
    expect(resumePrompt).not.toContain("Reference Material")
    expect(resumePrompt).not.toContain("Current Context")
  })
})
```

**Step 2: Run tests**

Run: `pnpm vitest run convex/lib/context.test.ts`
Expected: All tests pass (including the new ones)

**Step 3: Commit**

```bash
git add convex/lib/context.test.ts
git commit -m "test: add tests for session resume prompt pattern"
```

---

### Task 6: Update client to stop sending conversation history on resume

Currently the client always sends the full `conversationHistory` array. With session resume, this is redundant on turn 2+ (the SDK has it). However, since the branching logic is server-side (the action decides whether to use the history or just `newMessage`), no client change is strictly needed — the server ignores the history when resuming.

**This is a no-op task.** The server-side branching handles it. Keeping the client sending history is harmless (it's just not used on resume) and provides a fallback if the session is invalidated.

Document this decision in a code comment.

**Files:**
- Modify: `convex/claudeNode.ts` (add comment only)

**Step 1: Add clarifying comment**

In the action args, above `conversationHistory`, add:

```ts
    // Note: conversationHistory is used only on turn 1 (no existing claudeSessionId).
    // On turn 2+ with resume, the SDK has the full conversation cached.
    // We still accept it here as fallback if the session is invalidated mid-conversation.
    conversationHistory: v.array(
```

**Step 2: Commit**

```bash
git add convex/claudeNode.ts
git commit -m "docs: clarify conversationHistory usage with session resume"
```

---

### Task 7: Manual verification

No automated test can verify that Anthropic's server-side caching is working — we need to observe the token usage.

**Step 1: Start the dev server**

Run: `pnpm dev` (starts both Convex and Vite)

**Step 2: Open a brainstorm session with some STABLE context**

1. Create or open a session
2. Add at least one STABLE block with ~1K+ tokens of reference material
3. Add a PERMANENT block with a system prompt

**Step 3: Send first brainstorm message**

1. Type a question and send
2. Wait for response
3. Check the generation record in Convex dashboard: note `inputTokens` value

**Step 4: Send second message (should use resume)**

1. Type a follow-up and send
2. Wait for response
3. Check generation record: `inputTokens` should be significantly lower than turn 1

**Step 5: Edit a STABLE block**

1. Edit the content of the STABLE block
2. Send another message
3. Check generation record: `inputTokens` should be high again (fresh session)

**Step 6: Check Convex dashboard for `claudeSessionId`**

1. Open the sessions table
2. Verify `claudeSessionId` is set after turn 1
3. Verify it's cleared after editing a STABLE block

**Step 7: Commit verification guide**

```bash
git add docs/plans/2026-03-10-claude-code-caching-rewrite.md
git commit -m "docs: add caching rewrite implementation plan with verification"
```

---

## Summary

| Task | Files | Change |
|------|-------|--------|
| 1 | `convex/schema.ts` | Add `claudeSessionId` field |
| 2 | `convex/generations.ts` | Add set/clear/get internal mutations |
| 3 | `convex/claudeNode.ts` | Core: session resume logic |
| 4 | `convex/blocks.ts` | Invalidate session on block changes |
| 5 | `convex/lib/context.test.ts` | Unit tests for resume pattern |
| 6 | `convex/claudeNode.ts` | Comment only (no-op) |
| 7 | Manual | Verification guide |
