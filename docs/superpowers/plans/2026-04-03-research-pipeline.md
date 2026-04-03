# Research Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `research` block type. User writes a research spec as the block content, clicks Run Research, Claude uses WebSearch+WebFetch and replaces the content with findings.

**Architecture:** `type: "research"` is just a human label — no new schema fields. Block content = spec before running, result after. `convex/research.ts` handles startResearch + fill mutations. `runResearchAction` added to `claudeNode.ts`. `ResearchBlock.tsx` renders spec-editing and result states.

**Tech Stack:** Convex, Claude Agent SDK (`allowedTools: ["WebSearch","WebFetch"]`, `maxTurns: 10`), React + shadcn/ui

---

## File Map

| File | Change |
|---|---|
| `convex/research.ts` | New — `startResearch` mutation, `fillResearchBlock` internal mutation, `getResearchBlock` query, `getResearchBlockInternal` internal query |
| `convex/claudeNode.ts` | Add `runResearchAction`, import `RESEARCH_SUFFIX` |
| `convex/lib/context.ts` | Add `RESEARCH_SUFFIX` constant |
| `src/components/ResearchBlock.tsx` | New — spec / running / result states |
| Session block renderer | Render `ResearchBlock` for `type === "research"` + Add Research button |

No schema changes. No migrations.

---

### Task 1: RESEARCH_SUFFIX in context.ts

**Files:**
- Modify: `convex/lib/context.ts`

- [ ] **Step 1: Add constant after `VALIDATION_SUFFIX`**

```typescript
export const RESEARCH_SUFFIX = `

RESEARCH MODE: You have access to WebSearch and WebFetch tools. Use them to thoroughly research the user's request before responding. Synthesize findings into a clear, structured report. Cite sources inline. If you cannot find something, say so explicitly.`
```

- [ ] **Step 2: Verify compile**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add convex/lib/context.ts
git commit -m "feat(research): add RESEARCH_SUFFIX constant"
```

---

### Task 2: convex/research.ts

**Files:**
- Create: `convex/research.ts`

- [ ] **Step 1: Create the file**

```typescript
import { mutation, internalMutation, query, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

/** Public query — returns the research block for a session (null if none). */
export const getResearchBlock = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("type"), "research"))
      .first()
  },
})

/** Internal query — same as above, callable from actions. */
export const getResearchBlockInternal = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("type"), "research"))
      .first()
  },
})

/** Internal mutation — writes research result into block content. */
export const fillResearchBlock = internalMutation({
  args: { blockId: v.id("blocks"), content: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.blockId, {
      content: args.content,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Start a research generation.
 * Reads block content as the research spec, replaces it with results when done.
 * Enforces: research block must exist and have a non-empty spec.
 */
export const startResearch = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const researchBlock = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("type"), "research"))
      .first()

    if (!researchBlock) {
      throw new Error("No research block found for this session")
    }
    if (!researchBlock.content.trim()) {
      throw new Error("Write a research spec in the block before running")
    }

    // Check not already running
    const activeGen = await ctx.db
      .query("generations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first()
    if (activeGen?.status === "streaming") {
      throw new Error("A generation is already in progress")
    }

    const now = Date.now()
    const generationId = await ctx.db.insert("generations", {
      sessionId: args.sessionId,
      provider: "claude",
      status: "streaming",
      text: "",
      createdAt: now,
      updatedAt: now,
    })

    await ctx.scheduler.runAfter(0, internal.claudeNode.runResearchAction, {
      generationId,
      sessionId: args.sessionId,
      blockId: researchBlock._id,
      spec: researchBlock.content,
    })

    return { generationId, blockId: researchBlock._id }
  },
})
```

- [ ] **Step 2: Deploy**

```bash
npx convex dev --once
```

Expected: no errors, `research` module registered.

- [ ] **Step 3: Commit**

```bash
git add convex/research.ts convex/_generated/api.d.ts
git commit -m "feat(research): add research.ts with startResearch mutation"
```

---

### Task 3: runResearchAction in claudeNode.ts

**Files:**
- Modify: `convex/claudeNode.ts`

- [ ] **Step 1: Add RESEARCH_SUFFIX to import**

```typescript
import {
  assembleContextWithConversation,
  assembleSystemPromptWithContext,
  formatPromptForSDK,
  NO_TOOLS_SUFFIX,
  NO_SELF_TALK_SUFFIX,
  VALIDATION_SUFFIX,
  RESEARCH_SUFFIX,
} from "./lib/context"
```

- [ ] **Step 2: Add runResearchAction after the closing `})` of `streamBrainstormMessage`**

```typescript
export const runResearchAction = action({
  args: {
    generationId: v.id("generations"),
    sessionId: v.id("sessions"),
    blockId: v.id("blocks"),
    spec: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const startTime = Date.now()

    const blocks = await ctx.runQuery(internal.blocks.listBySessionInternal, {
      sessionId: args.sessionId,
    })
    let systemPrompt = assembleSystemPromptWithContext(blocks, undefined, "brainstorm")
    systemPrompt = (systemPrompt ?? "") + RESEARCH_SUFFIX

    const trace = createGeneration(
      "claude-research",
      { sessionId: args.sessionId, provider: "claude", model: "claude-code" },
      { systemPrompt, prompt: args.spec }
    )

    let buffer = ""
    let fullText = ""
    let lastFlush = Date.now()
    const throttleMs = 100
    let inputTokens: number | undefined
    let outputTokens: number | undefined
    let costUsd: number | undefined
    let resolvedModel: string | undefined
    const abortController = new AbortController()
    const stderrChunks: string[] = []

    const isCancelled = async (): Promise<boolean> => {
      const gen = await ctx.runQuery(internal.generations.getInternal, {
        generationId: args.generationId,
      })
      return gen?.status === "cancelled"
    }

    const flushBuffer = async () => {
      if (buffer.length > 0) {
        await ctx.runMutation(internal.generations.appendChunk, {
          generationId: args.generationId,
          chunk: buffer,
        })
        buffer = ""
        lastFlush = Date.now()
      }
    }

    try {
      let hasReceivedStreamEvents = false

      for await (const message of claudeQuery({
        prompt: args.spec,
        options: {
          abortController,
          allowedTools: ["WebSearch", "WebFetch"],
          maxTurns: 10,
          systemPrompt,
          pathToClaudeCodeExecutable: getClaudeCodePath(),
          includePartialMessages: true,
          maxBudgetUsd: 1.00,
          stderr: (data: string) => { stderrChunks.push(data) },
        },
      })) {
        const msgType = (message as Record<string, unknown>).type as string

        if (msgType === "stream_event") {
          const event = (message as Record<string, unknown>).event as Record<string, unknown> | undefined
          if (event?.type === "content_block_delta") {
            const delta = event.delta as Record<string, unknown> | undefined
            if (delta?.type === "text_delta" && typeof delta.text === "string") {
              hasReceivedStreamEvents = true
              buffer += delta.text
              fullText += delta.text
              if (Date.now() - lastFlush >= throttleMs) {
                await flushBuffer()
                if (await isCancelled()) { abortController.abort(); break }
              }
            }
          }
        }

        if (msgType === "assistant" && !resolvedModel) {
          const msgContent = ((message as Record<string, unknown>).message as Record<string, unknown> | undefined)
          if (typeof msgContent?.model === "string") resolvedModel = msgContent.model
        }

        if (msgType === "assistant" && !hasReceivedStreamEvents) {
          const content = (((message as Record<string, unknown>).message as Record<string, unknown> | undefined)
            ?.content) as Array<Record<string, unknown>> | undefined
          if (content) {
            for (const blk of content) {
              if (blk.type === "text" && typeof blk.text === "string") {
                buffer += blk.text; fullText += blk.text
                await flushBuffer()
              }
            }
          }
        }

        if (msgType === "result") {
          const msg = message as Record<string, unknown>
          const usage = msg.usage as Record<string, unknown> | undefined
          if (usage) {
            inputTokens = usage.input_tokens as number | undefined
            outputTokens = usage.output_tokens as number | undefined
          }
          costUsd = msg.total_cost_usd as number | undefined
        }
      }

      await flushBuffer()

      const durationMs = Date.now() - startTime
      const gen = await ctx.runQuery(internal.generations.getInternal, { generationId: args.generationId })

      if (gen?.status === "cancelled") {
        trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs, resolvedModel })
        await flushLangfuse()
        return
      }

      await ctx.runMutation(internal.research.fillResearchBlock, {
        blockId: args.blockId,
        content: fullText,
      })
      await ctx.runMutation(internal.generations.completeWithUsage, {
        generationId: args.generationId,
        inputTokens, outputTokens, costUsd, durationMs,
      })
      trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs, resolvedModel })
      await flushLangfuse()
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        await flushBuffer()
        trace.complete({ text: fullText, inputTokens, outputTokens, costUsd, durationMs: Date.now() - startTime, resolvedModel })
        await flushLangfuse()
        return
      }
      const errorMessage = error instanceof Error ? error.message : String(error)
      const stderrOutput = stderrChunks.join("").trim()
      await flushBuffer()
      const fullError = stderrOutput ? `Research error: ${errorMessage}\nstderr: ${stderrOutput}` : `Research error: ${errorMessage}`
      await ctx.runMutation(internal.generations.fail, { generationId: args.generationId, error: fullError })
      trace.error(fullError)
      await flushLangfuse()
    }
  },
})
```

- [ ] **Step 3: Deploy**

```bash
npx convex dev --once
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add convex/claudeNode.ts convex/_generated/api.d.ts
git commit -m "feat(research): add runResearchAction to claudeNode.ts"
```

---

### Task 4: ResearchBlock component

**Files:**
- Create: `src/components/ResearchBlock.tsx`

- [ ] **Step 1: Create ResearchBlock.tsx**

```typescript
import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"

interface ResearchBlockProps {
  blockId: Id<"blocks">
  sessionId: Id<"sessions">
  content: string
}

export function ResearchBlock({ blockId, sessionId, content }: ResearchBlockProps) {
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateBlock = useMutation(api.blocks.update)
  const startResearch = useMutation(api.research.startResearch)
  const cancelGeneration = useMutation(api.generations.cancel)

  // Subscribe to active generation — shows streaming progress while running
  const latestGen = useQuery(api.generations.getLatestForSession, { sessionId })
  const isRunning = latestGen?.status === "streaming"
  const streamingText = isRunning ? latestGen.text : null

  const handleRun = async () => {
    setIsStarting(true)
    setError(null)
    try {
      await startResearch({ sessionId })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start research")
    } finally {
      setIsStarting(false)
    }
  }

  const handleCancel = async () => {
    if (latestGen?._id) await cancelGeneration({ generationId: latestGen._id })
  }

  const handleContentChange = async (value: string) => {
    await updateBlock({ id: blockId, content: value })
  }

  // Running — show streaming progress
  if (isRunning) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground animate-pulse">Researching...</p>
        {streamingText && (
          <div className="text-sm whitespace-pre-wrap opacity-70">{streamingText}</div>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    )
  }

  // Has result — show content with Re-run option
  if (content.trim()) {
    return (
      <div className="space-y-2">
        <div className="text-sm whitespace-pre-wrap">{content}</div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleRun}
          disabled={isStarting}
        >
          Re-run Research
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // Empty — spec editing mode
  return (
    <div className="space-y-2">
      <textarea
        className="w-full min-h-24 text-sm border rounded p-2 resize-y bg-background"
        placeholder="Describe what to research and what format the output should take..."
        defaultValue={content}
        onBlur={(e) => handleContentChange(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleRun}
          disabled={isStarting || !content.trim()}
        >
          {isStarting ? "Starting..." : "Run Research"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `getLatestForSession` query to generations.ts if it doesn't exist**

```bash
grep -n "getLatestForSession" convex/generations.ts
```

If not found, add to `convex/generations.ts`:

```typescript
export const getLatestForSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first()
  },
})
```

- [ ] **Step 3: Verify compile**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ResearchBlock.tsx convex/generations.ts convex/_generated/api.d.ts
git commit -m "feat(research): add ResearchBlock component"
```

---

### Task 5: Wire ResearchBlock into session view

**Files:**
- Modify: block renderer + wherever zone add-block buttons live

- [ ] **Step 1: Find the block renderer**

```bash
grep -rn "block\.type\|\"system_prompt\"\|\"validation_prompt\"" src/ --include="*.tsx" -l
```

- [ ] **Step 2: Add ResearchBlock rendering**

In the file that maps over blocks and renders them by type, add:

```typescript
import { ResearchBlock } from "@/components/ResearchBlock"

// Inside block render map:
if (block.type === "research") {
  return (
    <ResearchBlock
      key={block._id}
      blockId={block._id}
      sessionId={sessionId}
      content={block.content}
    />
  )
}
```

- [ ] **Step 3: Add "Add Research Block" button in WORKING zone**

Find the WORKING zone add-block controls. Import and use the query:

```typescript
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"

const researchBlock = useQuery(api.research.getResearchBlock, { sessionId })
const createBlock = useMutation(api.blocks.create)

// Button:
<Button
  variant="ghost"
  size="sm"
  className="h-6 text-xs"
  disabled={researchBlock != null}
  onClick={() => createBlock({ sessionId, content: "", type: "research", zone: "WORKING" })}
>
  + Research
</Button>
```

- [ ] **Step 4: Build**

```bash
pnpm build 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat(research): wire ResearchBlock into session view"
```

---

### Task 6: Manual verification

- [ ] **Happy path**
  1. Open a session → click `+ Research` in WORKING zone — block appears empty
  2. Type a spec: `"Research AI coding assistants in 2026. Output: 3-5 key findings with sources."`
  3. Click **Run Research** — block shows "Researching..." with streaming text
  4. Wait for completion — block content replaced with research report
  5. Open brainstorm — research report is available in context

- [ ] **Re-run path**
  1. On a filled block, click **Re-run Research** — new run starts, content replaced

- [ ] **Error path**
  1. Click **Run Research** on empty block → button is disabled (content.trim() is empty)
  2. Click **Run Research** while one is running → shows "A generation is already in progress"

- [ ] **Template path**
  1. Save session as template — research block (with spec as content) is captured
  2. Apply template to new session — get research block with spec, ready to run
