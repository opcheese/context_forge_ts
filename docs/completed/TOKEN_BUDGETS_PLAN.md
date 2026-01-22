# Token Counting & Zone Budgets Implementation Plan

> **✅ COMPLETED**
>
> This feature has been fully implemented. All core phases are complete.
> See [ROADMAP.md](../ROADMAP.md) for current status.

## Overview

This document outlines the implementation plan for token counting, zone budgets, and usage tracking in ContextForgeTS. These features bring parity with the Python ContextForge implementation.

**Status:** ✅ Complete
**Priority:** High - Required for production context management
**Dependencies:** Basic LLM generation (completed)

---

## Current State

### What's Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Ollama streaming generation | ✅ Done | HTTP streaming via `/api/chat` |
| Claude Code streaming | ✅ Done | Convex reactive queries with `stream_event` handling |
| Context assembly | ✅ Done | Zone ordering: PERMANENT → STABLE → WORKING |
| Auto-save to WORKING | ✅ Done | Generated content saved as ASSISTANT block |
| Rough token estimation | ✅ Done | 4 chars/token approximation in `convex/lib/context.ts` |

### Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Per-block token counting | ✅ Done | `block.tokens`, `block.originalTokens` in schema |
| Zone token budgets | ✅ Done | `session.budgets` with per-zone limits |
| Generation usage tracking | ✅ Done | `inputTokens`, `outputTokens`, `costUsd` on generations |
| Budget enforcement/warnings | ✅ Done | `checkBudget` query, warning/danger status |
| Accurate tokenizer | ✅ Done | `js-tiktoken` in `convex/lib/tokenizer.ts` |
| UI Components | ✅ Done | ZoneHeader, BlockTokenBadge, SessionMetrics |
| Compression support | ⏳ Not implemented | `is_compressed` flag (future enhancement) |

---

## Python Implementation Reference

### Zone Configuration (Python)

From `ContextForge/backend/src/services/context_service.py`:

```python
def _get_default_config(self) -> ManagerConfig:
    zone_config = ZoneConfig()
    zone_config.permanent_budget = 50_000    # Core instructions
    zone_config.stable_budget = 100_000      # Reference material
    zone_config.working_budget = 100_000     # Current work

    return ManagerConfig(
        zone_config=zone_config,
        max_context_tokens=500_000,          # Total context limit
    )
```

### Per-Block Token Fields (Python)

Each block stores:
```python
{
    "original_tokens": int,      # Tokens when first added
    "current_tokens": int,       # Current tokens (may differ if compressed)
    "compressed": bool,          # Whether content has been compressed
    "token_model": str,          # Model used for token counting
}
```

### Token Counting (Python)

Uses `litellm.token_counter()` which wraps `tiktoken`:
```python
import litellm
new_tokens = litellm.token_counter(model=self.manager.model, text=content)
```

---

## Implementation Plan

### Phase 1: Schema Updates

**Goal:** Add token and budget fields to database schema.

#### 1.1 Update `blocks` table

```typescript
// convex/schema.ts
blocks: defineTable({
  // ... existing fields
  sessionId: v.id("sessions"),
  content: v.string(),
  type: v.string(),
  zone: zoneValidator,
  position: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),

  // NEW: Token tracking
  tokens: v.optional(v.number()),           // Current token count
  originalTokens: v.optional(v.number()),   // Original token count (before compression)
  tokenModel: v.optional(v.string()),       // Model used for counting (e.g., "cl100k_base")
})
```

#### 1.2 Update `sessions` table

```typescript
// convex/schema.ts
sessions: defineTable({
  // ... existing fields
  name: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),

  // NEW: Budget configuration
  budgets: v.optional(v.object({
    permanent: v.number(),   // Default: 50000
    stable: v.number(),      // Default: 100000
    working: v.number(),     // Default: 100000
    total: v.number(),       // Default: 500000
  })),
})
```

#### 1.3 Update `generations` table

```typescript
// convex/schema.ts
generations: defineTable({
  // ... existing fields
  sessionId: v.id("sessions"),
  provider: v.string(),
  status: v.union(v.literal("streaming"), v.literal("complete"), v.literal("error")),
  text: v.string(),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),

  // NEW: Usage tracking
  inputTokens: v.optional(v.number()),
  outputTokens: v.optional(v.number()),
  totalTokens: v.optional(v.number()),
  costUsd: v.optional(v.number()),
  durationMs: v.optional(v.number()),
})
```

---

### Phase 2: Token Counting Library

**Goal:** Implement accurate token counting for Convex environment.

#### 2.1 Evaluate tokenizer options

| Library | Bundle Size | Convex Compatible | Accuracy |
|---------|-------------|-------------------|----------|
| `js-tiktoken` | ~100KB | ✅ Yes | High (tiktoken port) |
| `gpt-tokenizer` | ~50KB | ✅ Yes | Medium (approximation) |
| `tiktoken` (WASM) | ~2MB | ⚠️ Maybe | Exact |
| 4 chars/token | 0 | ✅ Yes | Low (~75% accurate) |

**Recommendation:** Use `js-tiktoken` for accuracy with reasonable bundle size.

#### 2.2 Create tokenizer module

**File:** `convex/lib/tokenizer.ts`

```typescript
import { encodingForModel, getEncoding } from "js-tiktoken"

// Cache encodings to avoid repeated initialization
const encodingCache = new Map<string, ReturnType<typeof getEncoding>>()

/**
 * Get token count for text using appropriate encoding.
 *
 * @param text - Text to count tokens for
 * @param model - Model name (defaults to cl100k_base for Claude/GPT-4)
 * @returns Token count
 */
export function countTokens(text: string, model?: string): number {
  const encodingName = model ? getEncodingForModel(model) : "cl100k_base"

  let encoding = encodingCache.get(encodingName)
  if (!encoding) {
    encoding = getEncoding(encodingName)
    encodingCache.set(encodingName, encoding)
  }

  return encoding.encode(text).length
}

/**
 * Map model names to tiktoken encodings.
 */
function getEncodingForModel(model: string): string {
  // Claude models use cl100k_base (same as GPT-4)
  if (model.includes("claude")) return "cl100k_base"
  if (model.includes("gpt-4")) return "cl100k_base"
  if (model.includes("gpt-3.5")) return "cl100k_base"

  // Default to cl100k_base
  return "cl100k_base"
}

/**
 * Estimate tokens using fast approximation (4 chars/token).
 * Use when speed matters more than accuracy.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
```

#### 2.3 Install dependency

```bash
pnpm add js-tiktoken
```

---

### Phase 3: Block Token Tracking

**Goal:** Count and store tokens when blocks are created or updated.

#### 3.1 Update block creation

**File:** `convex/blocks.ts`

```typescript
import { countTokens } from "./lib/tokenizer"

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    type: v.string(),
    zone: zoneValidator,
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Count tokens
    const tokens = countTokens(args.content)

    // Get max position in zone
    const existingBlocks = await ctx.db
      .query("blocks")
      .withIndex("by_session_zone", (q) =>
        q.eq("sessionId", args.sessionId).eq("zone", args.zone)
      )
      .collect()
    const maxPosition = existingBlocks.reduce((max, b) => Math.max(max, b.position), -1)

    return await ctx.db.insert("blocks", {
      sessionId: args.sessionId,
      content: args.content,
      type: args.type,
      zone: args.zone,
      position: maxPosition + 1,
      createdAt: now,
      updatedAt: now,
      // NEW: Token tracking
      tokens,
      originalTokens: tokens,
      tokenModel: "cl100k_base",
    })
  },
})
```

#### 3.2 Update block content mutation

```typescript
export const updateContent = mutation({
  args: {
    blockId: v.id("blocks"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.blockId)
    if (!block) throw new Error("Block not found")

    // Recalculate tokens
    const tokens = countTokens(args.content)

    await ctx.db.patch(args.blockId, {
      content: args.content,
      tokens,
      updatedAt: Date.now(),
    })
  },
})
```

---

### Phase 4: Zone Budget Tracking

**Goal:** Calculate and expose zone-level token usage.

#### 4.1 Create metrics query

**File:** `convex/metrics.ts`

```typescript
import { query } from "./_generated/server"
import { v } from "convex/values"

// Default budgets (matches Python implementation)
const DEFAULT_BUDGETS = {
  permanent: 50_000,
  stable: 100_000,
  working: 100_000,
  total: 500_000,
}

export const getZoneMetrics = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Get session for custom budgets
    const session = await ctx.db.get(args.sessionId)
    const budgets = session?.budgets ?? DEFAULT_BUDGETS

    // Get all blocks for session
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    // Calculate per-zone metrics
    const zones = {
      PERMANENT: { blocks: 0, tokens: 0, budget: budgets.permanent },
      STABLE: { blocks: 0, tokens: 0, budget: budgets.stable },
      WORKING: { blocks: 0, tokens: 0, budget: budgets.working },
    }

    let totalTokens = 0

    for (const block of blocks) {
      const zone = block.zone as keyof typeof zones
      const tokens = block.tokens ?? 0

      zones[zone].blocks++
      zones[zone].tokens += tokens
      totalTokens += tokens
    }

    return {
      zones,
      total: {
        blocks: blocks.length,
        tokens: totalTokens,
        budget: budgets.total,
      },
      budgets,
    }
  },
})
```

#### 4.2 Add budget validation helper

```typescript
/**
 * Check if adding content would exceed zone budget.
 */
export const checkBudget = query({
  args: {
    sessionId: v.id("sessions"),
    zone: v.string(),
    additionalTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const metrics = await getZoneMetrics(ctx, { sessionId: args.sessionId })
    const zoneMetrics = metrics.zones[args.zone as keyof typeof metrics.zones]

    const newTotal = zoneMetrics.tokens + args.additionalTokens
    const wouldExceed = newTotal > zoneMetrics.budget

    return {
      currentTokens: zoneMetrics.tokens,
      additionalTokens: args.additionalTokens,
      newTotal,
      budget: zoneMetrics.budget,
      wouldExceed,
      percentUsed: Math.round((newTotal / zoneMetrics.budget) * 100),
    }
  },
})
```

---

### Phase 5: Generation Usage Tracking

**Goal:** Capture and store token usage from LLM responses.

#### 5.1 Update Claude streaming to capture usage

The Claude SDK returns usage stats in the `result` message. Update `convex/claudeNode.ts`:

```typescript
export const streamGenerateWithContext = action({
  // ... existing args
  handler: async (ctx, args): Promise<void> => {
    // ... existing setup

    let inputTokens: number | undefined
    let outputTokens: number | undefined
    let costUsd: number | undefined
    let durationMs: number | undefined
    const startTime = Date.now()

    try {
      for await (const message of claudeQuery({ /* ... */ })) {
        // ... existing stream_event handling

        // Capture usage from result message
        if (message.type === "result") {
          inputTokens = message.usage?.input_tokens
          outputTokens = message.usage?.output_tokens
          costUsd = message.total_cost_usd
          durationMs = Date.now() - startTime
        }
      }

      // Final flush
      await flushBuffer()

      // Mark complete with usage stats
      await ctx.runMutation(internal.generations.completeWithUsage, {
        generationId: args.generationId,
        inputTokens,
        outputTokens,
        costUsd,
        durationMs,
      })
    } catch (error) {
      // ... error handling
    }
  },
})
```

#### 5.2 Add completeWithUsage mutation

**File:** `convex/generations.ts`

```typescript
export const completeWithUsage = internalMutation({
  args: {
    generationId: v.id("generations"),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId)
    if (!generation) throw new Error("Generation not found")

    await ctx.db.patch(args.generationId, {
      status: "complete",
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: (args.inputTokens ?? 0) + (args.outputTokens ?? 0),
      costUsd: args.costUsd,
      durationMs: args.durationMs,
      updatedAt: Date.now(),
    })
  },
})
```

#### 5.3 Update Ollama to capture usage

Ollama returns `prompt_eval_count` and `eval_count` in the final response. Update `convex/lib/ollama.ts`:

```typescript
export interface OllamaStreamResult {
  text: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  durationMs?: number
}

export async function generateStreaming(
  messages: OllamaMessage[],
  options?: StreamOptions
): Promise<OllamaStreamResult> {
  // ... existing streaming logic

  // Capture final stats
  if (chunk.done && chunk.prompt_eval_count) {
    return {
      text: fullText,
      promptTokens: chunk.prompt_eval_count,
      completionTokens: chunk.eval_count,
      totalTokens: chunk.prompt_eval_count + chunk.eval_count,
      durationMs: Date.now() - startTime,
    }
  }
}
```

---

### Phase 6: UI Components

**Goal:** Display token usage and budget status in the UI.

#### 6.1 Zone header with token display

**File:** `src/components/ZoneHeader.tsx`

```typescript
interface ZoneHeaderProps {
  zone: string
  blockCount: number
  tokens: number
  budget: number
}

export function ZoneHeader({ zone, blockCount, tokens, budget }: ZoneHeaderProps) {
  const percentUsed = Math.round((tokens / budget) * 100)
  const isWarning = percentUsed > 80
  const isDanger = percentUsed > 95

  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="font-semibold">{zone}</h3>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {blockCount} blocks
        </span>
        <span className={cn(
          "font-mono",
          isDanger && "text-destructive",
          isWarning && !isDanger && "text-yellow-600",
        )}>
          {tokens.toLocaleString()} / {budget.toLocaleString()} tokens
        </span>
        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              isDanger ? "bg-destructive" : isWarning ? "bg-yellow-500" : "bg-primary"
            )}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
```

#### 6.2 Block token badge

**File:** `src/components/BlockTokenBadge.tsx`

```typescript
interface BlockTokenBadgeProps {
  tokens: number | null | undefined
}

export function BlockTokenBadge({ tokens }: BlockTokenBadgeProps) {
  if (tokens == null) return null

  return (
    <span className="text-xs text-muted-foreground font-mono">
      {tokens.toLocaleString()} tokens
    </span>
  )
}
```

#### 6.3 Generation usage summary

**File:** `src/components/GenerationUsage.tsx`

```typescript
interface GenerationUsageProps {
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  durationMs?: number
}

export function GenerationUsage({
  inputTokens,
  outputTokens,
  costUsd,
  durationMs
}: GenerationUsageProps) {
  if (!inputTokens && !outputTokens) return null

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      {inputTokens != null && (
        <span>Input: {inputTokens.toLocaleString()}</span>
      )}
      {outputTokens != null && (
        <span>Output: {outputTokens.toLocaleString()}</span>
      )}
      {costUsd != null && (
        <span>Cost: ${costUsd.toFixed(4)}</span>
      )}
      {durationMs != null && (
        <span>Time: {(durationMs / 1000).toFixed(1)}s</span>
      )}
    </div>
  )
}
```

#### 6.4 Session metrics panel

**File:** `src/components/SessionMetrics.tsx`

```typescript
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"

export function SessionMetrics({ sessionId }: { sessionId: Id<"sessions"> }) {
  const metrics = useQuery(api.metrics.getZoneMetrics, { sessionId })

  if (!metrics) return null

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-semibold mb-3">Context Budget</h3>

      <div className="space-y-2">
        {Object.entries(metrics.zones).map(([zone, data]) => (
          <ZoneHeader
            key={zone}
            zone={zone}
            blockCount={data.blocks}
            tokens={data.tokens}
            budget={data.budget}
          />
        ))}

        <div className="pt-2 border-t">
          <ZoneHeader
            zone="TOTAL"
            blockCount={metrics.total.blocks}
            tokens={metrics.total.tokens}
            budget={metrics.total.budget}
          />
        </div>
      </div>
    </div>
  )
}
```

---

### Phase 7: Budget Warnings & Validation

**Goal:** Warn users when approaching limits, prevent exceeding budgets.

#### 7.1 Pre-add budget check

Before adding a block, check if it would exceed the zone budget:

```typescript
// In AddBlockForm component
const handleSubmit = async () => {
  // Estimate tokens for new content
  const estimatedTokens = estimateTokens(content)

  // Check budget
  const budgetCheck = await checkBudget({
    sessionId,
    zone: selectedZone,
    additionalTokens: estimatedTokens,
  })

  if (budgetCheck.wouldExceed) {
    setWarning(`This would exceed the ${selectedZone} budget (${budgetCheck.percentUsed}% used)`)
    return
  }

  // Proceed with add
  await createBlock({ ... })
}
```

#### 7.2 Real-time budget warnings

Show warnings when zones are approaching limits:

```typescript
// In ZoneLayout component
{metrics.zones.WORKING.tokens / metrics.zones.WORKING.budget > 0.9 && (
  <Alert variant="warning">
    WORKING zone is at {Math.round((metrics.zones.WORKING.tokens / metrics.zones.WORKING.budget) * 100)}% capacity
  </Alert>
)}
```

---

## Migration Strategy

### Existing Data

For existing blocks without token counts:

```typescript
// One-time migration action
export const migrateBlockTokens = action({
  args: {},
  handler: async (ctx) => {
    const blocks = await ctx.runQuery(api.blocks.listAll)

    for (const block of blocks) {
      if (block.tokens == null) {
        const tokens = countTokens(block.content)
        await ctx.runMutation(api.blocks.updateTokens, {
          blockId: block._id,
          tokens,
          originalTokens: tokens,
          tokenModel: "cl100k_base",
        })
      }
    }
  },
})
```

---

## Testing Plan

### Unit Tests

- [ ] `countTokens()` returns accurate counts for various text lengths
- [ ] `estimateTokens()` returns reasonable approximations
- [ ] Zone metrics calculation is correct
- [ ] Budget validation works correctly

### Integration Tests

- [ ] Block creation stores token counts
- [ ] Block updates recalculate tokens
- [ ] Generation captures usage stats
- [ ] UI displays token information correctly

### E2E Tests

- [ ] Budget warnings appear when approaching limits
- [ ] Metrics panel shows correct values
- [ ] Token counts update in real-time

---

## Dependencies

```json
{
  "dependencies": {
    "js-tiktoken": "^1.0.0"
  }
}
```

---

## Implementation Order

```
Phase 1: Schema Updates
    │
    ├── Phase 2: Token Counting Library
    │       │
    │       └── Phase 3: Block Token Tracking
    │               │
    │               └── Phase 4: Zone Budget Tracking
    │                       │
    │                       ├── Phase 5: Generation Usage Tracking
    │                       │
    │                       └── Phase 6: UI Components
    │                               │
    │                               └── Phase 7: Budget Warnings
    │
    └── Migration: Backfill existing blocks
```

Phases 2-4 can be developed in parallel with Phase 5.
Phase 6 depends on Phases 4 and 5.
Phase 7 depends on Phase 6.

---

## Success Criteria

1. **Token Accuracy:** Token counts within 5% of Python implementation
2. **Performance:** Token counting adds < 10ms per block operation
3. **Budget Visibility:** Users can see budget usage at a glance
4. **Budget Enforcement:** Warnings at 80% and 95% usage
5. **Usage Tracking:** All generations capture input/output tokens

---

## Future Enhancements (Out of Scope)

- Auto-eviction when budgets exceeded
- Compression to reduce token usage
- Model-specific tokenizers
- Cost estimation before generation
- Historical usage analytics
