# TASK-012: Stop Generation Button & Cleanup on Close

## Overview

Add a stop button to cancel LLM generation in both Brainstorm and Generate panels, and ensure generation stops when the dialog/window is closed.

## Problem

From bug report #4:
- If a user closes the Brainstorm dialog or navigates away while the LLM is generating, the generation continues running in the background
- Reopening the dialog shows the stale in-progress response from the previous generation
- The LLM sometimes gets stuck in an infinite generation loop with no way to stop it
- The "Send" button shows "Sending..." but there is no stop/cancel button

### Root Cause

Three provider-specific issues:

**Ollama/OpenRouter (client-side streaming):**
- `AbortController` + `stop()` exist in `useGenerate.ts` and `useBrainstorm.ts`
- But Brainstorm dialog has **no stop button in the UI** — only GeneratePanel does
- `close()` aborts client-side streams but doesn't clear state properly for reopen

**Claude (Convex server-side streaming):**
- `useClaudeGenerate.ts:129-133` has a TODO: stop only sets `isGenerating = false` locally
- The backend `claudeNode.ts` action (fire-and-forget via `ctx.scheduler.runAfter`) keeps running
- Chunks continue writing to DB; `useQuery` picks them up on reopen showing stale dialog
- The Claude Agent SDK **does** support `AbortController` via `options.abortController`, but it is not currently wired up

## Requirements

### Core Behavior
- Stop button visible during all active generations (Brainstorm + Generate, all providers)
- Clicking stop cancels the generation immediately
- Closing the Brainstorm dialog stops any in-progress generation
- Closing/refreshing the browser stops generation (best-effort)
- No stale generation shown when reopening the dialog after close-during-generation

### Out of Scope
- Refunding partial token costs on cancellation

---

## Technical Implementation

### Phase 1: Server-Side Cancellation (AbortController + DB Flag)

The Convex action (`claudeNode.ts`) runs as a fire-and-forget scheduled function. We use a **two-layer** cancellation strategy:

1. **Primary: `AbortController`** — The Claude Agent SDK accepts `options.abortController`. When aborted, it kills the spawned Claude CLI subprocess and stops streaming. This gives us real process termination.
2. **Fallback: DB cancellation flag** — The action checks the generation status each flush cycle (~100ms). If `cancelled`, it aborts the controller and breaks the loop. This handles cases where the AbortController has known reliability issues ([#2970](https://github.com/anthropics/claude-code/issues/2970), [#7181](https://github.com/anthropics/claude-code/issues/7181)).

#### 1.1 Add `cancelled` status to schema

`convex/schema.ts` — add `"cancelled"` to the generations status union:

```typescript
status: v.union(
  v.literal("streaming"),
  v.literal("complete"),
  v.literal("error"),
  v.literal("cancelled")  // NEW
),
```

#### 1.2 Add `cancelGeneration` mutation

`convex/generations.ts`:

```typescript
export const cancel = mutation({
  args: { generationId: v.id("generations") },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId)
    if (!generation) return
    if (generation.status !== "streaming") return // Already done

    await ctx.db.patch(args.generationId, {
      status: "cancelled",
      updatedAt: Date.now(),
    })
  },
})
```

Also add an internal version for use from actions:

```typescript
export const cancelInternal = internalMutation({
  args: { generationId: v.id("generations") },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId)
    if (!generation) return
    if (generation.status !== "streaming") return
    await ctx.db.patch(args.generationId, {
      status: "cancelled",
      updatedAt: Date.now(),
    })
  },
})
```

#### 1.3 Wire AbortController + cancellation checks in server streaming loops

`convex/claudeNode.ts` — in both `streamGenerateWithContext` and `streamBrainstormMessage`:

**Create an AbortController and pass it to the SDK:**

```typescript
const abortController = new AbortController()

for await (const message of claudeQuery({
  prompt,
  options: {
    abortController,  // NEW — enables real process termination
    allowedTools: [],
    maxTurns: 1,
    systemPrompt,
    pathToClaudeCodeExecutable: getClaudeCodePath(),
    includePartialMessages: true,
  },
})) {
  // ... handle chunks
}
```

**Add a helper to check the DB cancellation flag:**

```typescript
const isCancelled = async (): Promise<boolean> => {
  const gen = await ctx.runQuery(internal.generations.getInternal, {
    generationId: args.generationId,
  })
  return gen?.status === "cancelled"
}
```

**Inside the for-await loop, after each flush — check flag and abort:**

```typescript
if (now - lastFlush >= throttleMs) {
  await flushBuffer()
  // Check DB cancellation flag every flush cycle (~100ms)
  if (await isCancelled()) {
    abortController.abort()  // Signal SDK to kill the CLI process
    break
  }
}
```

The SDK will throw an `AbortError` when aborted. Catch it gracefully:

```typescript
try {
  for await (const message of claudeQuery({ ... })) {
    // ... chunk handling with cancellation checks
  }
} catch (error) {
  // Handle AbortError gracefully — not a real error
  if (error instanceof Error && error.name === "AbortError") {
    await flushBuffer()
    // Status is already "cancelled" in DB, nothing to update
    trace.complete({ text: fullText, ...stats })
    await flushLangfuse()
    return
  }
  // Re-throw real errors to the existing error handler
  throw error
}
```

**After the loop, check if cancelled before marking complete:**

```typescript
await flushBuffer()

// Only mark complete if not cancelled
const gen = await ctx.runQuery(internal.generations.getInternal, {
  generationId: args.generationId,
})
if (gen?.status === "cancelled") {
  // Already cancelled, don't overwrite status
  trace.complete({ text: fullText, ...stats })
  await flushLangfuse()
  return
}

// Normal completion path...
await ctx.runMutation(internal.generations.completeWithUsage, { ... })
```

#### 1.4 Add internal query for generation status

`convex/generations.ts`:

```typescript
export const getInternal = internalQuery({
  args: { generationId: v.id("generations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.generationId)
  },
})
```

#### 1.5 Update `appendChunk` to respect cancellation

`convex/generations.ts` — already ignores non-streaming statuses (line 53-55), so cancelled chunks will be dropped automatically. No change needed here.

---

### Phase 2: Client-Side Stop Implementation

#### 2.1 Update `useClaudeGenerate.ts`

Replace the TODO stop with real cancellation:

```typescript
const cancelGeneration = useMutation(api.generations.cancel)

const stop = useCallback(() => {
  if (generationId) {
    cancelGeneration({ generationId }).catch(console.error)
  }
  setIsGenerating(false)
  setStreamedText("")
  setGenerationId(null)
}, [generationId, cancelGeneration])
```

Also handle `cancelled` status in the reactive effect:

```typescript
// Handle cancellation (from another tab or stop button)
if (generation.status === "cancelled" && isGenerating) {
  setIsGenerating(false)
  // Keep partial text visible but stop streaming indicator
}
```

#### 2.2 Update `useBrainstorm.ts`

Add Claude cancellation to the hook:

```typescript
const cancelGeneration = useMutation(api.generations.cancel)

// New: stopStreaming function exposed to UI
const stopStreaming = useCallback(() => {
  // Cancel client-side streams (Ollama/OpenRouter)
  abortControllerRef.current?.abort()

  // Cancel server-side generation (Claude)
  if (generationId) {
    cancelGeneration({ generationId }).catch(console.error)
  }

  // Reset streaming state
  setIsStreaming(false)
  setStreamingText("")
  setGenerationId(null)
  prevTextRef.current = ""
}, [generationId, cancelGeneration])
```

Update the `close` callback to stop generation:

```typescript
const close = useCallback(() => {
  setIsOpen(false)
  // Stop any ongoing streaming (all providers)
  abortControllerRef.current?.abort()
  if (generationId) {
    cancelGeneration({ generationId }).catch(console.error)
  }
  setIsStreaming(false)
  setStreamingText("")
  setGenerationId(null)
  prevTextRef.current = ""
}, [generationId, cancelGeneration])
```

Handle `cancelled` status in the Claude streaming effect:

```typescript
if (generation.status === "cancelled" && isStreaming) {
  setIsStreaming(false)
  // Add partial response as message if there's content
  if (generation.text.trim()) {
    const assistantMessage: Message = {
      id: generateId(),
      role: "assistant",
      content: generation.text + "\n\n*(generation stopped)*",
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, assistantMessage])
  }
  setStreamingText("")
  setGenerationId(null)
}
```

Add `stopStreaming` to the return value:

```typescript
return {
  // ...existing
  stopStreaming, // NEW
}
```

#### 2.3 Update `BrainstormDialog.tsx`

Add stop button prop and render it:

```typescript
interface BrainstormDialogProps {
  // ...existing
  onStopStreaming: () => void  // NEW
}
```

Replace the "Sending..." button with a Stop button when streaming:

```typescript
{/* Input area */}
<div className="flex gap-2 items-end">
  <textarea ... />
  {isStreaming ? (
    <Button
      variant="destructive"
      onClick={onStopStreaming}
      className="self-end"
    >
      Stop
    </Button>
  ) : (
    <DebouncedButton
      onClick={handleSend}
      disabled={!inputValue.trim() || !isProviderAvailable}
      className="self-end"
      debounceMs={300}
    >
      Send
    </DebouncedButton>
  )}
</div>
```

Also update close handler to stop streaming before close:

```typescript
// In the Close button onClick:
<Button variant="ghost" size="sm" onClick={() => {
  if (isStreaming) {
    onStopStreaming()
  }
  handleCloseRequest()
}}>
  Close
</Button>
```

#### 2.4 Update `GeneratePanel.tsx`

Verify the existing stop button works for Claude provider. The stop button already exists for Ollama — ensure it also calls the new `cancel` mutation for Claude. Check that `useClaudeGenerate.stop()` is wired to the UI.

#### 2.5 Wire up in parent component

`src/routes/app.tsx` (or wherever BrainstormDialog is mounted) — pass `onStopStreaming` prop:

```typescript
<BrainstormDialog
  ...
  onStopStreaming={brainstorm.stopStreaming}
/>
```

---

### Phase 3: Cleanup on Browser Close

#### 3.1 Add `beforeunload` cancellation

In `useBrainstorm.ts`, add an effect to cancel generation on page unload:

```typescript
// Cancel generation on page close/refresh
useEffect(() => {
  const handleBeforeUnload = () => {
    if (generationId) {
      // Use sendBeacon for reliable delivery during unload
      // Since we can't call Convex mutations in unload, mark via the existing
      // cancel mutation using navigator.sendBeacon is not available for Convex.
      // Instead, rely on the generation expiring or being cancelled on next open.
      cancelGeneration({ generationId }).catch(() => {})
    }
    abortControllerRef.current?.abort()
  }

  window.addEventListener("beforeunload", handleBeforeUnload)
  return () => window.removeEventListener("beforeunload", handleBeforeUnload)
}, [generationId, cancelGeneration])
```

Note: `cancelGeneration` during `beforeunload` is best-effort. The Convex mutation may not complete if the page unloads too fast. The server-side action will eventually complete and mark the generation as `complete` — but the client will ignore it on next open because it won't subscribe to stale generation IDs.

#### 3.2 Clear stale generation on dialog reopen

In `useBrainstorm.ts`, when the dialog opens, do NOT automatically subscribe to the latest generation. The current code only subscribes when `generationId` is set in state, and state is ephemeral — so a fresh page load won't pick up stale generations. This is already correct.

However, if the dialog is closed and reopened *without* a page refresh, ensure `generationId` is cleared on close (already handled in Phase 2.2).

---

## File Checklist

### Files to Modify
- [ ] `convex/schema.ts` — add `"cancelled"` to generations status union
- [ ] `convex/generations.ts` — add `cancel` mutation, `cancelInternal` internal mutation, `getInternal` query
- [ ] `convex/claudeNode.ts` — add AbortController + DB cancellation checks in both streaming action loops, handle AbortError
- [ ] `src/hooks/useClaudeGenerate.ts` — implement real `stop()` with cancel mutation
- [ ] `src/hooks/useBrainstorm.ts` — add `stopStreaming`, update `close`, add `beforeunload` handler, handle `cancelled` status
- [ ] `src/components/BrainstormDialog.tsx` — add Stop button, wire `onStopStreaming` prop, stop on close
- [ ] `src/components/GeneratePanel.tsx` — verify stop works for Claude provider
- [ ] Parent component wiring `onStopStreaming` to BrainstormDialog

### No New Files

---

## Testing Checklist

### Stop Button
- [ ] Stop button appears in Brainstorm during Ollama generation
- [ ] Stop button appears in Brainstorm during Claude generation
- [ ] Stop button appears in Brainstorm during OpenRouter generation
- [ ] Stop button appears in Generate panel during Claude generation
- [ ] Clicking stop halts text output within ~200ms (client-side providers)
- [ ] Clicking stop halts text output within ~1s (Claude — AbortController + next cancellation check cycle)
- [ ] Partial text is preserved after stopping
- [ ] Can send a new message after stopping

### Close = Stop
- [ ] Closing Brainstorm dialog during Ollama streaming stops the stream
- [ ] Closing Brainstorm dialog during Claude streaming cancels the generation
- [ ] Reopening dialog after close-during-generation shows clean state (no stale text)
- [ ] Pressing Escape during streaming stops generation then shows close warning (if unsaved)

### Edge Cases
- [ ] Stopping an already-complete generation is a no-op
- [ ] Stopping when no generation is active is a no-op
- [ ] Two rapid stop clicks don't cause errors
- [ ] Browser refresh during Claude generation — reopening doesn't show stale generation
- [ ] Server action gracefully stops writing chunks after cancellation

---

## UI Copy

| Element | Text |
|---------|------|
| Stop button | "Stop" |
| Stopped partial message suffix | *(generation stopped)* |

---

## Notes

- The Claude Agent SDK supports `options.abortController` which kills the spawned CLI subprocess. This is our primary cancellation mechanism. However, there are known reliability issues ([#2970](https://github.com/anthropics/claude-code/issues/2970), [#69](https://github.com/anthropics/claude-agent-sdk-typescript/issues/69), [#7181](https://github.com/anthropics/claude-code/issues/7181)), so we pair it with a DB cancellation flag as a belt-and-suspenders approach.
- The SDK also has `query.interrupt()` but it only works in streaming input mode (when prompt is `AsyncIterable<SDKUserMessage>`), not our plain string prompt mode.
- The SDK exports an `AbortError` class that is thrown when abort succeeds — catch it to distinguish from real errors.
- Convex scheduled actions cannot be killed externally. The DB flag + AbortController pattern inside the action is the standard workaround.
- `beforeunload` cancellation is best-effort. The mutation may not complete before the page unloads. This is fine because on next open, `generationId` state is null (ephemeral), so the client won't subscribe to the stale generation.
