# Brainstorm Self-Talk Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden ContextForge brainstorm streaming against the self-talk bug (model generates `</assistant>`, `<user>` tags and talks to itself) and improve system prompt handling, all within the Claude Agent SDK constraint (subscription-based auth, no API key).

**Architecture:** Three-layer defense: (1) change prompt format to stop using XML role tags that invite continuation, (2) merge system-level content into `options.systemPrompt` instead of duplicating it as text in the prompt, (3) add runtime streaming detection that aborts on role-marker hallucinations. Keep erroneous text visible so users can report incidents.

**Tech Stack:** Claude Agent SDK (`@anthropic-ai/claude-agent-sdk` v0.2.9), Convex actions, Vitest

---

## Background

The brainstorm feature uses `claudeQuery()` from the Claude Agent SDK, which takes a single `prompt` string (not a structured `messages` array). The current `formatMessagesAsPrompt()` serializes the conversation using `<system>`, `<user>`, `<assistant>` XML tags. This creates a pattern the model continues — generating `</assistant>` to "close" its turn, then `<user>` to simulate the next user message.

Key files:
- `convex/claudeNode.ts` — Node.js action that calls the Agent SDK
- `convex/lib/context.ts` — Context assembly, `NO_SELF_TALK_SUFFIX`, `NO_TOOLS_SUFFIX`
- `convex/lib/context.test.ts` — Unit tests for context assembly
- `src/hooks/useBrainstorm.ts` — Client-side hook (no changes needed)
- `convex/generations.ts` — Generation mutations (no changes needed)

Key constraints:
- Must use Claude Agent SDK (subscription auth via CLI, no API key)
- SDK `query()` takes `{ prompt: string | AsyncIterable<SDKUserMessage>, options: { systemPrompt?, ... } }`
- `SDKUserMessage` only supports `role: "user"` — no way to inject structured assistant history
- SDK does NOT support `temperature`, `stop_sequences`, or structured `messages`
- `options.systemPrompt` supports `string | { type: 'preset', preset: 'claude_code', append: string }`
  - **Plain string replaces Claude Code's entire default system prompt** — correct for brainstorm (no tool instructions leak)
  - **Preset+append preserves the default prompt** which includes tool usage instructions — counterproductive for text-only brainstorm
- `options.persistSession` defaults to `true`; set to `false` for ephemeral brainstorm queries (avoid unnecessary disk writes)
- `options.maxBudgetUsd` available as a safety net against runaway self-talk
- Erroneous self-talk text must remain visible for user reporting
- v2 Session API (`unstable_v2_createSession`) is explicitly unstable/preview — missing `interrupt()`, no session reset, no stabilization timeline. Not suitable for production.

---

### Task 1: Change prompt format to avoid XML role tags

**Files:**
- Modify: `convex/lib/context.ts` — new `formatPromptForSDK()` export
- Modify: `convex/lib/context.test.ts` — tests for new formatter
- Modify: `convex/claudeNode.ts:79-93` — replace `formatMessagesAsPrompt` usage

The current XML format (`<user>...</user>`, `<assistant>...</assistant>`) creates a strong pattern the model continues. Replace with a format that conveys the same structure but doesn't look like "XML that should be completed."

**Step 1: Write failing tests for the new formatter**

Add to `convex/lib/context.test.ts`:

```ts
import { formatPromptForSDK } from "./context"

describe("formatPromptForSDK", () => {
  it("formats context zones with markdown headers, not XML tags", () => {
    const messages: ContextMessage[] = [
      { role: "system", content: "PM persona instructions" },
      { role: "user", content: "Reference Material:\n\nSome ref" },
      { role: "user", content: "Current Context:\n\nSome context" },
    ]
    const result = formatPromptForSDK(messages)

    // Must NOT contain XML role tags
    expect(result).not.toContain("<system>")
    expect(result).not.toContain("</system>")
    expect(result).not.toContain("<user>")
    expect(result).not.toContain("</user>")
    expect(result).not.toContain("<assistant>")
    expect(result).not.toContain("</assistant>")

    // Must contain content
    expect(result).toContain("PM persona instructions")
    expect(result).toContain("Some ref")
    expect(result).toContain("Some context")
  })

  it("formats conversation history with labeled turns", () => {
    const messages: ContextMessage[] = [
      { role: "user", content: "What about study groups?" },
      { role: "assistant", content: "Great question..." },
      { role: "user", content: "Now the IRD" },
    ]
    const result = formatPromptForSDK(messages)

    expect(result).toContain("What about study groups?")
    expect(result).toContain("Great question...")
    expect(result).toContain("Now the IRD")
    // Uses non-XML delimiters
    expect(result).not.toContain("<user>")
    expect(result).not.toContain("<assistant>")
  })

  it("separates system content from conversation", () => {
    const messages: ContextMessage[] = [
      { role: "system", content: "Instructions" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
      { role: "user", content: "Question" },
    ]
    const result = formatPromptForSDK(messages)
    // System content should come first, clearly separated
    const sysIdx = result.indexOf("Instructions")
    const convIdx = result.indexOf("Hello")
    expect(sysIdx).toBeLessThan(convIdx)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run convex/lib/context.test.ts`
Expected: FAIL — `formatPromptForSDK` is not exported

**Step 3: Implement `formatPromptForSDK`**

Add to `convex/lib/context.ts`:

```ts
/**
 * Format assembled context messages into a prompt string for the Claude Agent SDK.
 *
 * Uses markdown-style delimiters instead of XML tags to prevent the model
 * from continuing the tag pattern (generating </assistant>, <user>, etc.).
 *
 * System-role messages become "Context Instructions" sections.
 * User/assistant conversation uses "USER:" / "ASSISTANT:" labels.
 * These labels are visually distinct but don't invite XML-style completion.
 */
export function formatPromptForSDK(messages: ContextMessage[]): string {
  const parts: string[] = []

  for (const msg of messages) {
    if (msg.role === "system") {
      parts.push(`=== Context Instructions ===\n${msg.content}\n===`)
    } else if (msg.role === "user") {
      parts.push(`USER:\n${msg.content}`)
    } else if (msg.role === "assistant") {
      parts.push(`ASSISTANT:\n${msg.content}`)
    }
  }

  return parts.join("\n\n")
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run convex/lib/context.test.ts`
Expected: PASS

**Step 5: Update `claudeNode.ts` to use the new formatter**

In `convex/claudeNode.ts`:
- Remove the `formatMessagesAsPrompt` function (lines 79-93)
- Import `formatPromptForSDK` from `./lib/context`
- Replace `const prompt = formatMessagesAsPrompt(messages)` (line 215) with `const prompt = formatPromptForSDK(messages)`

**Step 6: Run tests again**

Run: `pnpm vitest run convex/lib/context.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add convex/lib/context.ts convex/lib/context.test.ts convex/claudeNode.ts
git commit -m "fix: replace XML role tags with markdown delimiters in brainstorm prompt

XML tags (<user>, <assistant>) in the prompt string caused the model to
continue the pattern, generating self-talk. Use plain-text delimiters
(USER:, ASSISTANT:, === sections) that don't invite XML completion."
```

---

### Task 2: Merge system content into `options.systemPrompt` + SDK options cleanup

**Files:**
- Modify: `convex/claudeNode.ts:189-215` — merge PERMANENT zone into systemPrompt
- Modify: `convex/claudeNode.ts:270-283` — add `persistSession: false`, `maxBudgetUsd`
- Modify: `convex/lib/context.ts` — new `assembleSystemPromptWithContext()` export
- Modify: `convex/lib/context.test.ts` — tests

Currently, the system prompt from blocks goes to `options.systemPrompt`, but PERMANENT zone blocks also go through `assembleContextWithConversation()` as `role: "system"` messages, then get serialized into the prompt string. This means system-level content appears twice (once properly, once as text).

**Important:** Keep `systemPrompt` as a plain string, NOT `{ type: 'preset', preset: 'claude_code', append: ... }`. The preset mode preserves Claude Code's default system prompt which includes tool usage instructions — counterproductive for a text-only brainstorm session. Plain string replaces the default entirely, which is what we want.

**Step 1: Write failing tests**

Add to `convex/lib/context.test.ts`:

```ts
import { assembleSystemPromptWithContext } from "./context"

describe("assembleSystemPromptWithContext", () => {
  it("combines extracted system prompt with PERMANENT zone content", () => {
    const blocks = [
      createBlock({ content: "System prompt", zone: "PERMANENT", type: "system_prompt", position: 0 }),
      createBlock({ content: "PM persona", zone: "PERMANENT", type: "note", position: 1 }),
      createBlock({ content: "Reference card", zone: "PERMANENT", type: "reference", position: 2 }),
    ]
    const result = assembleSystemPromptWithContext(blocks)
    expect(result).toContain("System prompt")
    expect(result).toContain("PM persona")
    expect(result).toContain("Reference card")
  })

  it("returns only PERMANENT content when no system_prompt block exists", () => {
    const blocks = [
      createBlock({ content: "PM persona", zone: "PERMANENT", type: "note", position: 0 }),
    ]
    const result = assembleSystemPromptWithContext(blocks)
    expect(result).toContain("PM persona")
  })

  it("returns undefined when no PERMANENT blocks exist at all", () => {
    const blocks = [
      createBlock({ content: "Working doc", zone: "WORKING", type: "note", position: 0 }),
    ]
    const result = assembleSystemPromptWithContext(blocks)
    expect(result).toBeUndefined()
  })

  it("excludes draft blocks", () => {
    const blocks = [
      createBlock({ content: "Active", zone: "PERMANENT", type: "note", position: 0 }),
      createBlock({ content: "Draft", zone: "PERMANENT", type: "note", position: 1, isDraft: true }),
    ]
    const result = assembleSystemPromptWithContext(blocks)
    expect(result).toContain("Active")
    expect(result).not.toContain("Draft")
  })

  it("orders by position", () => {
    const blocks = [
      createBlock({ content: "Second", zone: "PERMANENT", type: "note", position: 1 }),
      createBlock({ content: "First", zone: "PERMANENT", type: "system_prompt", position: 0 }),
    ]
    const result = assembleSystemPromptWithContext(blocks)!
    expect(result.indexOf("First")).toBeLessThan(result.indexOf("Second"))
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run convex/lib/context.test.ts`
Expected: FAIL

**Step 3: Implement `assembleSystemPromptWithContext`**

Add to `convex/lib/context.ts`:

```ts
/**
 * Assemble the full system prompt from all PERMANENT zone blocks.
 *
 * Combines the system_prompt block (if any) with all other PERMANENT blocks
 * into a single string suitable for the SDK's `systemPrompt` option.
 * This puts all system-level content into the proper system prompt channel
 * rather than duplicating it as text in the user prompt.
 *
 * @returns Combined system prompt, or undefined if no PERMANENT blocks exist
 */
export function assembleSystemPromptWithContext(
  blocks: Doc<"blocks">[]
): string | undefined {
  const permanentBlocks = blocks
    .filter((b) => b.zone === "PERMANENT" && !b.isDraft)
    .sort((a, b) => a.position - b.position)

  if (permanentBlocks.length === 0) return undefined

  return permanentBlocks.map((b) => b.content).join("\n\n")
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run convex/lib/context.test.ts`
Expected: PASS

**Step 5: Update `claudeNode.ts` to use merged system prompt**

In `convex/claudeNode.ts`, replace lines 189-214:

```ts
// Build unified system prompt: all PERMANENT zone blocks (including system_prompt)
let systemPrompt = assembleSystemPromptWithContext(blocks)

// Append anti-agent suffix if enabled
if (disableAgentBehavior) {
  systemPrompt = (systemPrompt ?? "") + NO_TOOLS_SUFFIX
}

// Append anti-self-talk suffix
if (preventSelfTalk) {
  systemPrompt = (systemPrompt ?? "") + NO_SELF_TALK_SUFFIX
}

// Build active skills content for injection
const activeSkillsContent = args.activeSkillIds?.length
  ? getActiveSkillsContent(args.activeSkillIds)
  : undefined

// Assemble non-system context + conversation history
// excludeSystemRole: true tells it to skip PERMANENT blocks (they're in systemPrompt now)
const messages = assembleContextWithConversation(
  blocks,
  args.conversationHistory,
  args.newMessage,
  activeSkillsContent
)

// Filter out system-role messages — they're already in options.systemPrompt
const nonSystemMessages = messages.filter((m) => m.role !== "system")
const prompt = formatPromptForSDK(nonSystemMessages)
```

Update the imports at the top of `claudeNode.ts`:

```ts
import {
  assembleContextWithConversation,
  assembleSystemPromptWithContext,
  formatPromptForSDK,
  NO_TOOLS_SUFFIX,
  NO_SELF_TALK_SUFFIX,
} from "./lib/context"
```

Remove the old import of `extractSystemPromptFromBlocks`.

**Step 6: Add `persistSession: false` and `maxBudgetUsd` to SDK options**

In `convex/claudeNode.ts`, in the `claudeQuery()` call options, add:

```ts
const result = await claudeClient.query({
  prompt,
  options: {
    systemPrompt,
    allowedTools: [],
    maxTurns: 1,
    includePartialMessages: true,
    persistSession: false,       // Ephemeral brainstorm — no disk writes
    maxBudgetUsd: 0.50,          // Safety net against runaway self-talk
    signal: abortController.signal,
  },
})
```

`persistSession: false` prevents the SDK from writing session state to disk for these ephemeral queries. `maxBudgetUsd` caps spending per query as a last-resort defense if the streaming detector misses something.

**Step 7: Run tests**

Run: `pnpm vitest run convex/lib/context.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add convex/lib/context.ts convex/lib/context.test.ts convex/claudeNode.ts
git commit -m "fix: merge all PERMANENT zone content into SDK systemPrompt

Previously the system_prompt block went to options.systemPrompt while
other PERMANENT blocks were serialized as <system> tags in the prompt
string. Now all PERMANENT content goes through options.systemPrompt
(the proper channel), eliminating duplication and reducing prompt text.

Also adds persistSession: false (ephemeral queries don't need disk state)
and maxBudgetUsd: 0.50 (safety net against runaway self-talk)."
```

---

### Task 3: Add streaming self-talk detection with abort

**Files:**
- Create: `convex/lib/selfTalkDetector.ts` — detector class
- Create: `convex/lib/selfTalkDetector.test.ts` — unit tests
- Modify: `convex/claudeNode.ts:288-308` — integrate detector into streaming loop

**Step 1: Write failing tests for the detector**

Create `convex/lib/selfTalkDetector.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { SelfTalkDetector } from "./selfTalkDetector"

describe("SelfTalkDetector", () => {
  it("detects </assistant> in a single chunk", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("Here is my answer.</assistant>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("</assistant>")
    expect(result!.cleanText).toBe("Here is my answer.")
  })

  it("detects <user> in a single chunk", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("Done with response.\n\n<user>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("<user>")
    expect(result!.cleanText).toBe("Done with response.\n\n")
  })

  it("detects </assistant> split across two chunks", () => {
    const detector = new SelfTalkDetector()
    expect(detector.feed("Here is my answer.</assis")).toBeNull()
    const result = detector.feed("tant>And now the user says")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("</assistant>")
  })

  it("detects <user> split across multiple chunks", () => {
    const detector = new SelfTalkDetector()
    expect(detector.feed("answer complete\n\n<")).toBeNull()
    expect(detector.feed("us")).toBeNull()
    const result = detector.feed("er>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("<user>")
  })

  it("returns null for normal text", () => {
    const detector = new SelfTalkDetector()
    expect(detector.feed("This is normal text")).toBeNull()
    expect(detector.feed(" with multiple chunks")).toBeNull()
    expect(detector.feed(" and no markers.")).toBeNull()
  })

  it("does not false-positive on partial tag-like text", () => {
    const detector = new SelfTalkDetector()
    // Text that contains < but not a role marker
    expect(detector.feed("Use <div> for layout")).toBeNull()
    expect(detector.feed(" and <span> for inline")).toBeNull()
  })

  it("detects <assistant> (opening tag) as self-talk", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("fake user message\n\n<assistant>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("<assistant>")
  })

  it("detects </user> as self-talk", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("simulated input</user>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("</user>")
  })

  it("detects <system> as self-talk", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("Now injecting\n<system>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("<system>")
  })

  it("detects ###Human: legacy training marker", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("End of response.###Human: fake input")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("###Human:")
  })

  it("detects \\n\\nHuman: legacy training marker", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("End of response.\n\nHuman: fake input")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("\n\nHuman:")
  })

  it("detects \\n\\nUSER:\\n new format marker mid-response", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("End of response.\n\nUSER:\nfake input")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("\n\nUSER:\n")
  })

  it("reports position of marker in accumulated text", () => {
    const detector = new SelfTalkDetector()
    detector.feed("First chunk. ")
    detector.feed("Second chunk. ")
    const result = detector.feed("End.</assistant>More")
    expect(result).not.toBeNull()
    expect(result!.position).toBe("First chunk. Second chunk. End.".length)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run convex/lib/selfTalkDetector.test.ts`
Expected: FAIL — module not found

**Step 3: Implement `SelfTalkDetector`**

Create `convex/lib/selfTalkDetector.ts`:

```ts
/**
 * Streaming self-talk detector.
 *
 * Scans text deltas for role-marker tokens that indicate the model
 * is hallucinating conversation turns. Handles markers split across
 * multiple streaming chunks via a rolling tail buffer.
 *
 * Detected markers:
 * - XML role tags: </assistant>, <assistant>, <user>, </user>, <system>, </system>
 * - Legacy training markers: ###Human:, ###Assistant:, \n\nHuman:, \n\nAssistant:
 * - Our new format markers (when appearing mid-response): \n\nUSER:\n
 */

const ROLE_MARKERS = [
  "</assistant>",
  "<assistant>",
  "</user>",
  "<user>",
  "</system>",
  "<system>",
  "###Human:",
  "###Assistant:",
  "\n\nHuman:",
  "\n\nAssistant:",
  "\n\nUSER:\n",
] as const

// Longest marker is "</assistant>" = 12 chars
const MAX_MARKER_LENGTH = Math.max(...ROLE_MARKERS.map((m) => m.length))

export interface SelfTalkDetection {
  /** The marker that was detected */
  marker: string
  /** Text before the marker (from the current chunk) */
  cleanText: string
  /** Position in the total accumulated text where the marker starts */
  position: number
}

export class SelfTalkDetector {
  private tailBuffer = ""
  private totalLength = 0

  /**
   * Feed a new text chunk to the detector.
   *
   * @returns Detection info if a role marker was found, null otherwise
   */
  feed(chunk: string): SelfTalkDetection | null {
    // Combine tail buffer with new chunk for cross-boundary detection
    const searchWindow = this.tailBuffer + chunk

    for (const marker of ROLE_MARKERS) {
      const idx = searchWindow.indexOf(marker)
      if (idx !== -1) {
        // Calculate position in total text
        // idx is relative to searchWindow, tailBuffer.length is the offset
        const positionInTotal = this.totalLength - this.tailBuffer.length + idx

        // cleanText: the part of the current chunk before the marker
        const markerStartInChunk = idx - this.tailBuffer.length
        const cleanText = markerStartInChunk > 0 ? chunk.slice(0, markerStartInChunk) : ""

        return { marker, cleanText, position: positionInTotal }
      }
    }

    // Update state
    this.totalLength += chunk.length
    // Keep only enough tail to catch markers split across chunks
    this.tailBuffer = searchWindow.slice(-MAX_MARKER_LENGTH)

    return null
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run convex/lib/selfTalkDetector.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/lib/selfTalkDetector.ts convex/lib/selfTalkDetector.test.ts
git commit -m "feat: add streaming self-talk detector for role-marker hallucinations

Detects </assistant>, <user>, <system> and their variants in streaming
text deltas. Handles markers split across chunk boundaries via a rolling
tail buffer."
```

---

### Task 4: Integrate detector into the streaming loop

**Files:**
- Modify: `convex/claudeNode.ts:267-348` — add detector, log detection, abort

**Step 1: Add detector to the streaming action**

In `convex/claudeNode.ts`, add import at the top:

```ts
import { SelfTalkDetector } from "./lib/selfTalkDetector"
```

In the `streamBrainstormMessage` handler, after the `stderrChunks` declaration (line 245), add:

```ts
// Self-talk detection (when preventSelfTalk is enabled)
const selfTalkDetector = preventSelfTalk ? new SelfTalkDetector() : null
```

**Step 2: Modify the streaming delta handler**

Replace the `content_block_delta` handler (around lines 291-306) with:

```ts
if (delta && delta.type === "text_delta" && typeof delta.text === "string") {
  hasReceivedStreamEvents = true

  // Check for self-talk markers before buffering
  if (selfTalkDetector) {
    const detection = selfTalkDetector.feed(delta.text)
    if (detection) {
      // Add the clean portion before the marker
      if (detection.cleanText) {
        buffer += detection.cleanText
        fullText += detection.cleanText
      }
      // Flush what we have, then abort
      console.warn(
        `[Claude Brainstorm] Self-talk detected: model generated "${detection.marker}" ` +
        `at position ${detection.position}. Aborting stream.`
      )
      await flushBuffer()
      abortController.abort()
      break
    }
  }

  buffer += delta.text
  fullText += delta.text

  // Throttle writes + check cancellation
  const now = Date.now()
  if (now - lastFlush >= throttleMs) {
    await flushBuffer()
    if (await isCancelled()) {
      abortController.abort()
      break
    }
  }
}
```

**Step 3: Run the unit tests**

Run: `pnpm vitest run convex/lib/selfTalkDetector.test.ts && pnpm vitest run convex/lib/context.test.ts`
Expected: PASS

**Step 4: Type-check the full project**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add convex/claudeNode.ts
git commit -m "feat: abort brainstorm stream on self-talk detection

When preventSelfTalk is enabled (default), the streaming loop now scans
text deltas for role-marker hallucinations (</assistant>, <user>, etc).
On detection, the clean text before the marker is flushed, the marker
and subsequent text remain visible for user reporting, and the stream
is aborted. Logs a warning for server-side observability."
```

---

### Task 5: Update NO_SELF_TALK_SUFFIX for new format

**Files:**
- Modify: `convex/lib/context.ts` — update suffix text to reference new format
- Modify: `convex/lib/context.test.ts` — update suffix test

**Step 1: Update the suffix**

In `convex/lib/context.ts`, replace `NO_SELF_TALK_SUFFIX`:

```ts
/**
 * Anti-self-talk suffix to prevent the model from simulating user messages.
 * Appended to the system prompt when using the Claude Agent SDK.
 */
export const NO_SELF_TALK_SUFFIX = `

IMPORTANT: Generate ONLY your single assistant response. Do NOT simulate, generate, or continue with any user messages. Do NOT write "USER:" or pretend to be the user. Your response ends when your answer is complete — do not continue the conversation pattern.`
```

**Step 2: Update the test**

In `convex/lib/context.test.ts`, update the `NO_SELF_TALK_SUFFIX` describe block (or add one if only `NO_TOOLS_SUFFIX` is tested):

```ts
describe("NO_SELF_TALK_SUFFIX", () => {
  it("contains anti-self-talk instructions", () => {
    expect(NO_SELF_TALK_SUFFIX).toContain("ONLY your single assistant response")
    expect(NO_SELF_TALK_SUFFIX).toContain("Do NOT")
  })
})
```

**Step 3: Run tests**

Run: `pnpm vitest run convex/lib/context.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add convex/lib/context.ts convex/lib/context.test.ts
git commit -m "fix: update anti-self-talk suffix for new prompt format

References USER: labels instead of XML tags, matching the new
formatPromptForSDK delimiter style."
```

---

### Task 6: Final integration test and type-check

**Step 1: Run all unit tests**

Run: `pnpm vitest run`
Expected: PASS

**Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Manual verification**

1. Start dev server: `pnpm dev`
2. Open brainstorm dialog, select Claude provider
3. Send a message, verify response streams normally
4. Verify system prompt contains PERMANENT zone content (check Langfuse trace)
5. Verify prompt string does NOT contain `<user>` or `<assistant>` tags (check Langfuse trace)
6. If self-talk occurs, verify the erroneous text is visible and the stream stops

**Step 4: Final commit**

```bash
git add -A
git commit -m "docs: add self-talk hardening research and plan"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `convex/lib/context.ts` | Add `formatPromptForSDK()`, `assembleSystemPromptWithContext()`, update `NO_SELF_TALK_SUFFIX` |
| `convex/lib/context.test.ts` | Tests for new functions and updated suffix |
| `convex/lib/selfTalkDetector.ts` | **NEW** — streaming role-marker detector with cross-chunk buffering |
| `convex/lib/selfTalkDetector.test.ts` | **NEW** — unit tests for detector |
| `convex/claudeNode.ts` | Use new formatter, merge system prompt, integrate detector, remove `formatMessagesAsPrompt` |

## What This Does NOT Fix

- **Temperature**: The Agent SDK doesn't support it. CLI defaults to 1.0. No workaround within the SDK constraint.
- **Stop sequences**: The Agent SDK doesn't support them. The streaming detector is our substitute.
- **Structural role boundaries**: The SDK takes a single prompt string; we can't send a structured `messages` array. The format change (Task 1) mitigates but doesn't eliminate the risk. `AsyncIterable<SDKUserMessage>` only supports `role: "user"` — no assistant history injection.
- **The CLI subprocess overhead**: Remains. Would need direct Anthropic SDK + API key to eliminate.
- **v2 Session API**: `unstable_v2_createSession` is explicitly preview/unstable. Missing `interrupt()` (Issue #120), no session reset (Issue #133), no stabilization timeline. Revisit when it stabilizes.

## Review Corrections Applied (2026-03-07)

1. **Kept plain string `systemPrompt`** — preset+append mode would inject Claude Code's tool instructions into a text-only brainstorm session
2. **Added `persistSession: false`** — ephemeral brainstorm queries don't need disk state
3. **Added `maxBudgetUsd: 0.50`** — safety net against runaway self-talk burning credits
4. **Expanded detector markers** — added `###Human:`, `\n\nHuman:`, `###Assistant:`, `\n\nAssistant:`, `\n\nUSER:\n` alongside the XML markers
5. **Documented v2 Session API status** — explicitly unstable, not suitable for production
6. **Noted `AsyncIterable<SDKUserMessage>`** — only supports `role: "user"`, doesn't solve the structural boundaries problem
