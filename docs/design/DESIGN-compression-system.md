# Design: Compression System

## Overview

Implement a block compression system that reduces token usage while preserving semantic meaning. The system should be extensible for future enhancements (stubs, automatic triggers, block-type-aware strategies).

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Trigger | Manual only | User controls when to compress |
| Architecture | Hybrid | Client-side for BYOK, backend for Claude Code |
| Granularity | Single, multi-select, zone | Flexible user control |
| Rehydration | Deferred | Focus on one-way compression first |
| Stubs/Unload | Deferred | Focus on core compression first |
| Block type strategies | Deferred | Future enhancement |

---

## Architecture

### Hybrid Compression Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         COMPRESSION FLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User triggers compression (button/menu)                            │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────┐                                                │
│  │ CompressionService │◄── Strategy selection                       │
│  └────────┬────────┘                                                │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │              Provider Router                              │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │        │
│  │  │  Ollama  │  │OpenRouter│  │ Claude Code (local)  │   │        │
│  │  │ (client) │  │ (client) │  │ (Convex action)      │   │        │
│  │  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘   │        │
│  └───────┼─────────────┼───────────────────┼───────────────┘        │
│          │             │                   │                         │
│          ▼             ▼                   ▼                         │
│     Direct API    Direct API        Convex HTTP action              │
│                                                                      │
│           └─────────────┬─────────────────┘                         │
│                         ▼                                            │
│                ┌─────────────────┐                                  │
│                │ CompressionResult │                                 │
│                └────────┬────────┘                                  │
│                         ▼                                            │
│                ┌─────────────────┐                                  │
│                │ Convex Mutation  │  Update block with compressed   │
│                │ blocks.compress  │  content and metadata           │
│                └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Provider Responsibilities

| Provider | Runs On | Use Case |
|----------|---------|----------|
| Ollama | Client (browser) | User's local/LAN Ollama instance |
| OpenRouter | Client (browser) | User's API key, direct to OpenRouter |
| Claude Code | Backend (Convex) | Local development only, feature-flagged |

---

## Step-by-Step Flows

### Flow 1: Single Block Compression

**Trigger:** User clicks "Compress" in block card menu or block editor header

```
Step 1: User Action
├── User opens block card dropdown menu
├── Clicks "Compress" action
└── (Alternative: clicks Compress button in block editor header)

Step 2: Confirmation Dialog
├── Show dialog with block preview (title, current tokens)
├── Strategy selector (default: semantic)
├── Provider indicator (using current provider from settings)
└── "Compress" / "Cancel" buttons

Step 3: Validation
├── Check block.content exists and is non-empty
├── Count tokens (approximate: content.length / 4)
├── If tokens < 100 → show error "Block too small to compress"
└── If already compressed → show warning "Block already compressed"

Step 4: Compression Execution
├── Set loading state (disable button, show spinner)
├── Create CompressionService with current provider config
├── Call service.compressBlock(block, strategy)
│   ├── Build compression prompt with content
│   ├── Route to provider (Ollama/OpenRouter/Claude)
│   ├── Await LLM response
│   └── Parse compressed content
└── Receive CompressionResult

Step 5: Validation of Result
├── Count compressed tokens
├── Calculate ratio = originalTokens / compressedTokens
├── If ratio < 1.2 → show error "Compression not effective"
└── If ratio >= 1.2 → proceed to save

Step 6: Persist to Convex
├── Call blocks.compress mutation with:
│   ├── blockId
│   ├── compressedContent
│   ├── originalTokens
│   ├── compressedTokens
│   ├── compressionRatio
│   └── strategy
├── Mutation updates block.content with compressed version
└── Sets isCompressed = true, compression metadata

Step 7: UI Update
├── Close dialog
├── Block card shows compression badge (e.g., "2.3x")
├── Toast notification: "Compressed: saved X tokens"
└── Token counts in zone header update automatically (Convex reactive)
```

---

### Flow 2: Multiple Selected Blocks Compression (Merge & Compress)

**Trigger:** User selects multiple blocks, then clicks "Compress & Merge"

**Key Difference:** Multiple blocks are combined into ONE compressed block, replacing the originals.

```
Step 1: Block Selection
├── User enters multi-select mode (checkbox on each card, or Shift+click)
├── Selected blocks highlighted with checkmarks
├── Floating action bar appears with "Compress & Merge (N)"
└── User clicks "Compress & Merge"

Step 2: Merge Configuration Dialog
├── Show dialog with:
│   ├── List of selected blocks (ordered by position)
│   │   ├── Each shows: title, zone, tokens
│   │   └── Drag handles to reorder before merge
│   ├── Total tokens: sum of all blocks
│   └── Preview of merge order
├── Target zone selector (default: zone of first block)
├── New block type selector (default: NOTE or type of first block)
├── Strategy selector (default: semantic)
├── Provider indicator
└── "Compress & Merge" / "Cancel" buttons

Step 3: Validation
├── Check all blocks belong to same session
├── Calculate combined token count
├── If combined tokens < 100 → show warning (but allow)
└── Show estimated compression: "~15,000 tokens → ~5,000 tokens"

Step 4: Combine Content
├── Concatenate block contents in order
├── Add separators between blocks:
│   └── "---\n## {block.title or first line}\n{block.content}\n"
├── Or simple concatenation with double newlines
└── Combined text ready for compression

Step 5: Compression Execution
├── Set loading state, show spinner
├── Create CompressionService
├── Call service.compressText(combinedContent, strategy)
│   ├── Build compression prompt
│   ├── Route to provider
│   ├── Await LLM response
│   └── Parse compressed content
└── Receive compressed text

Step 6: Validation of Result
├── Count compressed tokens
├── Calculate ratio = originalTokens / compressedTokens
├── If ratio < 1.2 → show warning "Compression not very effective, continue?"
└── User confirms or cancels

Step 7: Persist to Convex (Atomic Operation)
├── Create new compressed block:
│   ├── content: compressedContent
│   ├── zone: selectedTargetZone
│   ├── type: selectedBlockType
│   ├── position: position of first original block
│   ├── isCompressed: true
│   ├── originalTokens: sum of original blocks
│   ├── currentTokens: compressed tokens
│   ├── compressionRatio: ratio
│   ├── compressionStrategy: strategy
│   ├── mergedFromIds: [list of original block IDs]  // Track source blocks
│   └── mergedFromCount: number of blocks merged
├── Delete all original blocks
└── (Ideally in a single transaction)

Step 8: Results Summary
├── Show results in dialog:
│   ├── "Merged 5 blocks into 1"
│   ├── "Tokens before: 15,000"
│   ├── "Tokens after: 4,800"
│   └── "Saved: 10,200 tokens (68%)"
└── "Done" button to close

Step 9: UI Update
├── Close dialog
├── Exit multi-select mode
├── Original blocks disappear
├── New merged block appears in target zone
├── New block shows compression badge + merge indicator
├── Toast: "Merged 5 blocks, saved 10,200 tokens"
└── Zone token counts update
```

---

### Flow 3: Entire Zone Compression (Merge All)

**Trigger:** User clicks compress icon in zone header

**Key Difference:** All eligible blocks in zone are merged into ONE compressed block.

```
Step 1: User Action
├── User clicks compress icon (Minimize2) in zone header
└── Zone: WORKING, STABLE, or PERMANENT

Step 2: Zone Compression Dialog
├── Show dialog with zone summary:
│   ├── Zone name and icon
│   ├── Total blocks in zone: N
│   ├── Already compressed: N blocks (will be included in merge)
│   ├── Total tokens in zone: X
│   └── Preview: "All N blocks will be merged into 1"
├── New block title input (optional, default: "{Zone} Summary")
├── Strategy selector
├── Provider indicator
└── "Compress Zone" / "Cancel" buttons

Step 3: Fetch Zone Blocks
├── Query all blocks where zone === selectedZone
├── Order by position
├── Calculate total tokens
└── Show block list in dialog (expandable)

Step 4: Confirmation
├── If 0 blocks → show "Zone is empty"
├── If only 1 block → suggest "Use single block compression instead"
├── Show warning:
│   └── "This will merge all N blocks into 1 compressed block.
│        Original blocks will be deleted. Continue?"
└── User confirms

Step 5: Combine Content
├── Concatenate all block contents in position order
├── Add separators between blocks:
│   └── "---\n## {block.title or first line}\n{block.content}\n"
├── Calculate combined token count
└── Combined text ready for compression

Step 6: Zone Compression Execution
├── Set loading state with spinner
├── Create CompressionService
├── Call service.compressText(combinedContent, strategy)
│   ├── Build compression prompt
│   ├── Route to provider
│   ├── Await LLM response
│   └── Parse compressed content
└── Receive compressed text

Step 7: Validation of Result
├── Count compressed tokens
├── Calculate ratio = originalTokens / compressedTokens
├── Show preview of compression result
└── If ratio < 1.2 → show warning, allow user to cancel

Step 8: Persist to Convex (Atomic Operation)
├── Create new compressed block:
│   ├── content: compressedContent
│   ├── zone: same zone
│   ├── type: NOTE (or configurable)
│   ├── position: 0 (first in zone)
│   ├── isCompressed: true
│   ├── originalTokens: sum of all zone blocks
│   ├── currentTokens: compressed tokens
│   ├── compressionRatio: ratio
│   ├── compressionStrategy: strategy
│   ├── mergedFromIds: [list of all original block IDs]
│   └── mergedFromCount: number of blocks merged
├── Delete all original blocks in zone
└── (Ideally in a single transaction)

Step 9: Results Summary
├── Show zone compression results:
│   ├── "WORKING zone compressed"
│   ├── "Merged: {N} blocks → 1 block"
│   ├── "Tokens before: 15,000"
│   ├── "Tokens after: 4,200"
│   └── "Saved: 10,800 tokens (72%)"
└── "Done" button

Step 10: UI Update
├── Close dialog
├── Zone now shows single compressed block
├── Block shows compression badge + "Merged from N blocks"
├── Zone header token count updates dramatically
├── Toast: "WORKING zone: merged {N} blocks, saved {X} tokens"
└── (Optional: zone header briefly highlights to show change)
```

---

## Data Model

### Schema Changes (`convex/schema.ts`)

```typescript
// Add to blocks table
blocks: defineTable({
  // ... existing fields ...

  // Compression state
  isCompressed: v.optional(v.boolean()),
  originalTokens: v.optional(v.number()),
  currentTokens: v.optional(v.number()),
  compressionStrategy: v.optional(v.string()),  // "semantic" | "structural" | "statistical"
  compressionRatio: v.optional(v.number()),     // e.g., 2.5 means 2.5x smaller
  compressedAt: v.optional(v.number()),         // Timestamp

  // Merge tracking (for multi-block compression)
  mergedFromCount: v.optional(v.number()),      // Number of blocks that were merged
  // Note: We don't store mergedFromIds since original blocks are deleted
  // If needed for audit, could store as JSON string or separate table

  // Future: preservation level
  // preservationLevel: v.optional(v.string()),  // "critical" | "important" | "normal" | "optional"
})
```

### TypeScript Types

```typescript
// src/lib/compression/types.ts

export type CompressionStrategy = "semantic" | "structural" | "statistical"

export interface CompressionRequest {
  blockIds: string[]                    // One or more blocks
  strategy?: CompressionStrategy        // Auto-select if not specified
  provider: "ollama" | "openrouter" | "claude"
}

export interface CompressionResult {
  success: boolean
  blockId: string
  error?: string

  // Metrics
  originalTokens: number
  compressedTokens: number
  compressionRatio: number
  tokensSaved: number

  // Content
  compressedContent: string
  strategy: CompressionStrategy
}

export interface BatchCompressionResult {
  results: CompressionResult[]
  totalTokensSaved: number
  blocksCompressed: number
  blocksFailed: number
}
```

---

## Compression Strategies

### 1. Semantic Compression (Default)

LLM-based summarization that preserves meaning.

```typescript
// src/lib/compression/strategies/semantic.ts

const SEMANTIC_PROMPT = `You are a compression assistant. Compress the following content while preserving:
- Key facts and information
- Names, numbers, and specific details
- Logical structure and relationships

Original content ({originalTokens} tokens):
---
{content}
---

Provide a compressed version that is approximately {targetRatio}x shorter.
Output ONLY the compressed content, no explanations.`

export async function compressSemantic(
  content: string,
  options: {
    provider: Provider
    targetRatio?: number  // Default 2.0
    model?: string
  }
): Promise<{ compressed: string; tokens: number }>
```

### 2. Structural Compression

Pattern-based extraction for structured content (code, lists, outlines).

```typescript
// src/lib/compression/strategies/structural.ts

export function compressStructural(content: string): { compressed: string } {
  // Remove comments, collapse whitespace, extract structure
  // No LLM needed - purely algorithmic
}
```

### 3. Statistical Compression

Deduplication and redundancy removal.

```typescript
// src/lib/compression/strategies/statistical.ts

export function compressStatistical(content: string): { compressed: string } {
  // Remove duplicate lines
  // Collapse repeated patterns
  // No LLM needed - purely algorithmic
}
```

### Strategy Auto-Selection (Future)

```typescript
// Future: Select strategy based on content type
function selectStrategy(block: Block): CompressionStrategy {
  // Could use block.type, content analysis, or user preference
  // For now: always "semantic"
  return "semantic"
}
```

---

## Implementation

### Core Service

```typescript
// src/lib/compression/compressionService.ts

import { compressSemantic } from "./strategies/semantic"
import { compressStructural } from "./strategies/structural"
import { compressStatistical } from "./strategies/statistical"

export class CompressionService {
  constructor(
    private provider: Provider,
    private providerConfig: ProviderConfig
  ) {}

  async compressBlock(
    block: Block,
    strategy: CompressionStrategy = "semantic"
  ): Promise<CompressionResult> {
    const originalTokens = await this.countTokens(block.content)

    // Skip if too small
    if (originalTokens < 100) {
      return { success: false, error: "Block too small to compress", blockId: block._id }
    }

    // Skip if already compressed
    if (block.isCompressed) {
      return { success: false, error: "Block already compressed", blockId: block._id }
    }

    let compressed: string

    switch (strategy) {
      case "semantic":
        compressed = await this.compressSemantic(block.content)
        break
      case "structural":
        compressed = compressStructural(block.content)
        break
      case "statistical":
        compressed = compressStatistical(block.content)
        break
    }

    const compressedTokens = await this.countTokens(compressed)
    const ratio = originalTokens / compressedTokens

    // Validate compression was effective
    if (ratio < 1.2) {
      return { success: false, error: "Compression ratio too low", blockId: block._id }
    }

    return {
      success: true,
      blockId: block._id,
      originalTokens,
      compressedTokens,
      compressionRatio: ratio,
      tokensSaved: originalTokens - compressedTokens,
      compressedContent: compressed,
      strategy,
    }
  }

  // Compress raw text (used for merge operations)
  async compressText(
    content: string,
    strategy: CompressionStrategy = "semantic"
  ): Promise<string> {
    switch (strategy) {
      case "semantic":
        return this.compressSemantic(content)
      case "structural":
        return compressStructural(content).compressed
      case "statistical":
        return compressStatistical(content).compressed
    }
  }

  private async countTokens(content: string): Promise<number> {
    // Approximate: ~4 chars per token
    return Math.ceil(content.length / 4)
  }

  private async compressSemantic(content: string): Promise<string> {
    // Route to appropriate provider
    switch (this.provider) {
      case "ollama":
        return this.compressWithOllama(content)
      case "openrouter":
        return this.compressWithOpenRouter(content)
      case "claude":
        return this.compressWithClaudeCode(content)
    }
  }

  private async compressWithOllama(content: string): Promise<string> {
    // Client-side direct call to Ollama
    const response = await fetch(`${this.providerConfig.ollamaUrl}/api/generate`, {
      method: "POST",
      body: JSON.stringify({
        model: this.providerConfig.ollamaModel || "llama3.2",
        prompt: SEMANTIC_PROMPT.replace("{content}", content),
        stream: false,
      }),
    })
    const data = await response.json()
    return data.response
  }

  private async compressWithOpenRouter(content: string): Promise<string> {
    // Client-side direct call to OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.providerConfig.openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.providerConfig.openrouterModel || "anthropic/claude-3-haiku",
        messages: [{ role: "user", content: SEMANTIC_PROMPT.replace("{content}", content) }],
      }),
    })
    const data = await response.json()
    return data.choices[0].message.content
  }

  private async compressWithClaudeCode(content: string): Promise<string> {
    // Backend call via Convex action
    // This would call a Convex HTTP action that invokes Claude Code CLI
    throw new Error("Claude Code compression not yet implemented")
  }
}
```

### Convex Mutations

```typescript
// convex/blocks.ts

// Single block compression (in-place update)
export const compress = mutation({
  args: {
    blockId: v.id("blocks"),
    compressedContent: v.string(),
    originalTokens: v.number(),
    compressedTokens: v.number(),
    compressionRatio: v.number(),
    strategy: v.string(),
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.blockId)
    if (!block) throw new Error("Block not found")

    await ctx.db.patch(args.blockId, {
      // Replace content with compressed version
      content: args.compressedContent,

      // Compression metadata
      isCompressed: true,
      originalTokens: args.originalTokens,
      currentTokens: args.compressedTokens,
      compressionRatio: args.compressionRatio,
      compressionStrategy: args.strategy,
      compressedAt: Date.now(),
    })

    return { success: true }
  },
})

// Multi-block compression: merge multiple blocks into one compressed block
export const compressAndMerge = mutation({
  args: {
    blockIds: v.array(v.id("blocks")),          // Blocks to merge (will be deleted)
    compressedContent: v.string(),
    originalTokens: v.number(),                  // Sum of all original blocks
    compressedTokens: v.number(),
    compressionRatio: v.number(),
    strategy: v.string(),
    targetZone: v.string(),                      // Zone for new block
    targetType: v.string(),                      // Type for new block
    targetPosition: v.number(),                  // Position for new block
  },
  handler: async (ctx, args) => {
    // Verify all blocks exist and get session
    const blocks = await Promise.all(
      args.blockIds.map(id => ctx.db.get(id))
    )

    const firstBlock = blocks[0]
    if (!firstBlock) throw new Error("No blocks found")

    // Verify all blocks belong to same session
    const sessionId = firstBlock.sessionId
    for (const block of blocks) {
      if (!block) throw new Error("Block not found")
      if (block.sessionId !== sessionId) {
        throw new Error("All blocks must belong to same session")
      }
    }

    // Create new merged block
    const newBlockId = await ctx.db.insert("blocks", {
      sessionId,
      content: args.compressedContent,
      zone: args.targetZone,
      type: args.targetType,
      position: args.targetPosition,

      // Compression metadata
      isCompressed: true,
      originalTokens: args.originalTokens,
      currentTokens: args.compressedTokens,
      compressionRatio: args.compressionRatio,
      compressionStrategy: args.strategy,
      compressedAt: Date.now(),
      mergedFromCount: args.blockIds.length,

      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Delete all original blocks
    await Promise.all(
      args.blockIds.map(id => ctx.db.delete(id))
    )

    return {
      success: true,
      newBlockId,
      blocksDeleted: args.blockIds.length,
    }
  },
})
```

### React Hook

```typescript
// src/hooks/useCompression.ts

import { useState, useCallback } from "react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { CompressionService } from "@/lib/compression/compressionService"
import { useSettings } from "./useSettings"

interface CompressionResult {
  success: boolean
  originalTokens: number
  compressedTokens: number
  compressionRatio: number
  tokensSaved: number
  blocksProcessed: number
  newBlockId?: string  // For merge operations
}

export function useCompression() {
  const { provider, providerConfig } = useSettings()
  const compressMutation = useMutation(api.blocks.compress)
  const compressAndMergeMutation = useMutation(api.blocks.compressAndMerge)

  const [isCompressing, setIsCompressing] = useState(false)
  const [result, setResult] = useState<CompressionResult | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // Single block compression (in-place)
  const compressSingle = useCallback(async (
    block: Block,
    strategy: CompressionStrategy = "semantic"
  ) => {
    setIsCompressing(true)
    setError(null)

    try {
      const service = new CompressionService(provider, providerConfig)
      const compressionResult = await service.compressBlock(block, strategy)

      if (!compressionResult.success) {
        throw new Error(compressionResult.error)
      }

      // Persist to Convex
      await compressMutation({
        blockId: block._id as Id<"blocks">,
        compressedContent: compressionResult.compressedContent,
        originalTokens: compressionResult.originalTokens,
        compressedTokens: compressionResult.compressedTokens,
        compressionRatio: compressionResult.compressionRatio,
        strategy: compressionResult.strategy,
      })

      const result: CompressionResult = {
        success: true,
        originalTokens: compressionResult.originalTokens,
        compressedTokens: compressionResult.compressedTokens,
        compressionRatio: compressionResult.compressionRatio,
        tokensSaved: compressionResult.tokensSaved,
        blocksProcessed: 1,
      }

      setResult(result)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setIsCompressing(false)
    }
  }, [provider, providerConfig, compressMutation])

  // Multi-block compression: merge into single block
  const compressAndMerge = useCallback(async (
    blocks: Block[],
    options: {
      strategy?: CompressionStrategy
      targetZone: string
      targetType: string
    }
  ) => {
    setIsCompressing(true)
    setError(null)

    try {
      const service = new CompressionService(provider, providerConfig)

      // Combine all block contents
      const combinedContent = blocks
        .map(b => `## ${extractTitle(b.content)}\n\n${b.content}`)
        .join("\n\n---\n\n")

      const originalTokens = blocks.reduce(
        (sum, b) => sum + (b.currentTokens || Math.ceil(b.content.length / 4)),
        0
      )

      // Compress combined content
      const compressed = await service.compressText(
        combinedContent,
        options.strategy || "semantic"
      )

      const compressedTokens = Math.ceil(compressed.length / 4)
      const ratio = originalTokens / compressedTokens

      // Persist: create new block, delete originals
      const mutationResult = await compressAndMergeMutation({
        blockIds: blocks.map(b => b._id as Id<"blocks">),
        compressedContent: compressed,
        originalTokens,
        compressedTokens,
        compressionRatio: ratio,
        strategy: options.strategy || "semantic",
        targetZone: options.targetZone,
        targetType: options.targetType,
        targetPosition: blocks[0].position || 0,
      })

      const result: CompressionResult = {
        success: true,
        originalTokens,
        compressedTokens,
        compressionRatio: ratio,
        tokensSaved: originalTokens - compressedTokens,
        blocksProcessed: blocks.length,
        newBlockId: mutationResult.newBlockId,
      }

      setResult(result)
      return result
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setIsCompressing(false)
    }
  }, [provider, providerConfig, compressAndMergeMutation])

  return {
    compressSingle,
    compressAndMerge,
    isCompressing,
    result,
    error,
    reset: () => { setResult(null); setError(null) },
  }
}

// Helper to extract title from content
function extractTitle(content: string): string {
  const firstLine = content.split("\n")[0]?.trim() || "Untitled"
  // Remove markdown headers
  return firstLine.replace(/^#+\s*/, "").slice(0, 50)
}
```

---

## UI Components

### Compression Dialog

```typescript
// src/components/Compression/CompressionDialog.tsx

interface CompressionDialogProps {
  isOpen: boolean
  onClose: () => void
  blocks: Block[]           // Pre-selected blocks (for single/multi)
  zone?: Zone               // For zone compression
}

export function CompressionDialog({ isOpen, onClose, blocks, zone }: CompressionDialogProps) {
  const { compress, isCompressing, progress, result } = useCompression()
  const [strategy, setStrategy] = useState<CompressionStrategy>("semantic")

  // Determine target blocks
  const targetBlocks = useMemo(() => {
    const source = zone ? blocks.filter(b => b.zone === zone) : blocks
    // Filter eligible blocks
    return source.filter(b => !b.isCompressed && (b.currentTokens || 0) >= 100)
  }, [blocks, zone])

  const skippedBlocks = useMemo(() => {
    const source = zone ? blocks.filter(b => b.zone === zone) : blocks
    return source.filter(b => b.isCompressed || (b.currentTokens || 0) < 100)
  }, [blocks, zone])

  const handleCompress = async () => {
    await compress(targetBlocks, strategy)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {zone ? `Compress ${zone} Zone` : `Compress ${blocks.length} Block(s)`}
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="space-y-2 text-sm">
          <p>Eligible blocks: {targetBlocks.length}</p>
          {skippedBlocks.length > 0 && (
            <p className="text-muted-foreground">
              Skipped: {skippedBlocks.length} (already compressed or too small)
            </p>
          )}
        </div>

        {/* Strategy selector */}
        <div className="space-y-2">
          <Label>Strategy</Label>
          <Select value={strategy} onValueChange={setStrategy}>
            <SelectItem value="semantic">Semantic (LLM-based)</SelectItem>
            <SelectItem value="structural">Structural (patterns)</SelectItem>
            <SelectItem value="statistical">Statistical (dedupe)</SelectItem>
          </Select>
        </div>

        {/* Progress */}
        {isCompressing && progress && (
          <div className="space-y-2">
            <Progress value={(progress.current / progress.total) * 100} />
            <p className="text-sm text-center">
              Compressing {progress.current}/{progress.total}...
            </p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="p-4 bg-muted rounded-md space-y-1">
            <p>Compressed: {result.blocksCompressed} blocks</p>
            <p>Failed: {result.blocksFailed} blocks</p>
            <p className="font-medium">Tokens saved: {result.totalTokensSaved}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && (
            <Button
              onClick={handleCompress}
              disabled={isCompressing || targetBlocks.length === 0}
            >
              {isCompressing ? "Compressing..." : "Compress"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Block Card Indicator

```typescript
// In BlockCard.tsx - show compression state

{block.isCompressed && (
  <Badge variant="secondary" className="text-xs">
    <Minimize2 className="w-3 h-3 mr-1" />
    {block.compressionRatio?.toFixed(1)}x
  </Badge>
)}
```

### Zone Header Action

```typescript
// In ZoneColumn.tsx - add compress zone button

<Button
  variant="ghost"
  size="sm"
  onClick={() => setShowCompressionDialog(true)}
  title="Compress all blocks in zone"
>
  <Minimize2 className="w-4 h-4" />
</Button>
```

---

## Entry Points for Compression

| Location | Trigger | Scope | Operation |
|----------|---------|-------|-----------|
| Block card menu | "Compress" action | Single block | In-place compression |
| Block editor header | "Compress" button | Current block | In-place compression |
| Zone header | Compress icon | All blocks in zone | **Merge into 1 block** |
| Multi-select mode | "Compress & Merge" | Selected blocks | **Merge into 1 block** |

---

## Extensibility Points

### Future: Preservation Levels

```typescript
// Add to block schema
preservationLevel: v.optional(v.string()), // "critical" | "important" | "normal" | "optional"

// In compression service
if (block.preservationLevel === "critical") {
  return { success: false, error: "Cannot compress CRITICAL blocks" }
}
```

### Future: Block Type Strategies

```typescript
// Auto-select strategy based on block type
function selectStrategy(block: Block): CompressionStrategy {
  switch (block.type) {
    case "RULE":
    case "SYSTEM":
      return "structural"  // Preserve structure
    case "NOTE":
    case "LORE":
      return "semantic"    // Summarize content
    case "LOG":
      return "statistical" // Dedupe
    default:
      return "semantic"
  }
}
```

### Future: Automatic Compression

```typescript
// In useBlocks or zone component
useEffect(() => {
  const zoneTokens = blocks.reduce((sum, b) => sum + (b.currentTokens || 0), 0)
  if (zoneTokens > zoneBudget * 0.9) {
    // Show warning or auto-compress OPTIONAL blocks
    showCompressionWarning(zone)
  }
}, [blocks, zoneBudget])
```

### Future: Rehydration

```typescript
// Add to block schema
originalContent: v.optional(v.string()),

// Add decompress mutation to restore original
```

### Future: Stubs/Unload

```typescript
// Add to block schema
isStub: v.optional(v.boolean()),
stubSummary: v.optional(v.string()),  // One-line summary shown in UI

// Stub shows minimal info, full content loaded on demand
```

---

## File Checklist

### New Files
- [ ] `src/lib/compression/types.ts` - Type definitions
- [ ] `src/lib/compression/compressionService.ts` - Core service
- [ ] `src/lib/compression/strategies/semantic.ts` - LLM compression
- [ ] `src/lib/compression/strategies/structural.ts` - Pattern extraction
- [ ] `src/lib/compression/strategies/statistical.ts` - Deduplication
- [ ] `src/hooks/useCompression.ts` - React hook
- [ ] `src/components/Compression/CompressionDialog.tsx` - Main UI

### Files to Modify
- [ ] `convex/schema.ts` - Add compression + merge fields to blocks
- [ ] `convex/blocks.ts` - Add `compress` and `compressAndMerge` mutations
- [ ] `src/components/Block/BlockCard.tsx` - Compression indicator + merge badge
- [ ] `src/components/Block/BlockActions.tsx` - Compress action (single block)
- [ ] `src/components/Layout/ZoneColumn.tsx` - Zone compress button
- [ ] `src/components/Layout/MultiSelectBar.tsx` - "Compress & Merge" action (new or existing)

---

## Testing Checklist

### Single Block Compression
- [ ] Compress single block via card menu
- [ ] Compress single block via editor header
- [ ] Block content is replaced with compressed version
- [ ] Compression badge shows ratio
- [ ] Error for blocks < 100 tokens
- [ ] Error for already compressed blocks

### Multi-Block Merge Compression
- [ ] Select multiple blocks → "Compress & Merge" appears
- [ ] Dialog shows list of blocks to merge
- [ ] Can reorder blocks before merge
- [ ] Merged content combines all blocks
- [ ] Original blocks are deleted after merge
- [ ] New single block appears in target zone
- [ ] New block shows "Merged from N blocks" indicator
- [ ] Token savings calculated correctly

### Zone Compression
- [ ] Compress zone via header icon
- [ ] Dialog shows zone summary
- [ ] All zone blocks merged into one
- [ ] Zone now contains single compressed block
- [ ] Original blocks deleted
- [ ] Zone token count updates

### General
- [ ] Works with Ollama provider
- [ ] Works with OpenRouter provider
- [ ] Error handling for failed LLM calls
- [ ] Loading state shown during compression
- [ ] Toast notifications on completion

---

## Related

- Python implementation: `src/context_manager/compression/`
- BYOK architecture: Cloud deployment plan
- Future: DESIGN-preservation-levels.md
- Future: DESIGN-automatic-compression.md
- Future: DESIGN-rehydration.md

## Priority

Medium - Enhances context management for large sessions

## Notes

- Start with semantic compression only, add structural/statistical later
- Token counting can use tiktoken or approximate (chars / 4)
- Consider compression queue for large batch operations
- Cache compression results to avoid re-compressing same content
