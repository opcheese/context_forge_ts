# TASK-010: Compression System

## Overview

Implement block compression to reduce token usage while preserving semantic meaning. Users can compress single blocks (in-place), merge multiple selected blocks into one compressed block, or compress entire zones.

## Design Reference

See [DESIGN-compression-system.md](../design/DESIGN-compression-system.md) for full architectural details.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Trigger | Manual only |
| Architecture | Hybrid (client-side BYOK + backend Claude Code) |
| Granularity | Single block, multi-select merge, zone merge |
| Rehydration | Deferred |
| Stubs/Unload | Deferred |

---

## Implementation Phases

### Phase 1: Schema & Types

**Goal:** Add compression fields to schema and create TypeScript types.

#### 1.1 Update Convex Schema

```typescript
// convex/schema.ts - Add to blocks table

// Compression state
isCompressed: v.optional(v.boolean()),
originalTokens: v.optional(v.number()),
currentTokens: v.optional(v.number()),
compressionStrategy: v.optional(v.string()),
compressionRatio: v.optional(v.number()),
compressedAt: v.optional(v.number()),

// Merge tracking
mergedFromCount: v.optional(v.number()),
```

#### 1.2 Create Type Definitions

Create `src/lib/compression/types.ts`:
- `CompressionStrategy` type: `"semantic" | "structural" | "statistical"`
- `CompressionRequest` interface
- `CompressionResult` interface

**Files:**
- [ ] `convex/schema.ts` - Add compression fields
- [ ] `src/lib/compression/types.ts` - NEW

---

### Phase 2: Convex Mutations

**Goal:** Add backend mutations for persisting compression results.

#### 2.1 Single Block Compression Mutation

```typescript
// convex/blocks.ts

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
    // Update block in-place with compressed content
  },
})
```

#### 2.2 Merge Compression Mutation

```typescript
export const compressAndMerge = mutation({
  args: {
    blockIds: v.array(v.id("blocks")),
    compressedContent: v.string(),
    originalTokens: v.number(),
    compressedTokens: v.number(),
    compressionRatio: v.number(),
    strategy: v.string(),
    targetZone: v.string(),
    targetType: v.string(),
    targetPosition: v.number(),
  },
  handler: async (ctx, args) => {
    // Create new merged block
    // Delete all original blocks
  },
})
```

**Files:**
- [ ] `convex/blocks.ts` - Add `compress` and `compressAndMerge` mutations

---

### Phase 3: Compression Service

**Goal:** Create client-side compression service with provider routing.

#### 3.1 Semantic Compression Strategy

Create `src/lib/compression/strategies/semantic.ts`:
- LLM-based summarization
- Prompt template for compression
- Provider-specific API calls (Ollama, OpenRouter)

#### 3.2 Core Compression Service

Create `src/lib/compression/compressionService.ts`:
- `CompressionService` class
- `compressBlock(block, strategy)` - single block
- `compressText(content, strategy)` - raw text (for merges)
- Provider routing (Ollama client-side, OpenRouter client-side)
- Token counting (approximate: chars / 4)

**Files:**
- [ ] `src/lib/compression/strategies/semantic.ts` - NEW
- [ ] `src/lib/compression/compressionService.ts` - NEW

---

### Phase 4: React Hook

**Goal:** Create `useCompression` hook for components.

```typescript
export function useCompression() {
  return {
    compressSingle: (block, strategy) => Promise<Result>,
    compressAndMerge: (blocks, options) => Promise<Result>,
    isCompressing: boolean,
    result: CompressionResult | null,
    error: Error | null,
    reset: () => void,
  }
}
```

**Files:**
- [ ] `src/hooks/useCompression.ts` - NEW

---

### Phase 5: UI - Single Block Compression

**Goal:** Add compression action to block card menu and editor.

#### 5.1 Block Card Menu Action

Add "Compress" action to `BlockActions.tsx`:
- Shows only for blocks >= 100 tokens
- Shows only for non-compressed blocks
- Opens confirmation dialog

#### 5.2 Compression Badge on Block Card

In `BlockCard.tsx`:
- Show compression ratio badge (e.g., "2.3x")
- Show "Merged from N" indicator if applicable

#### 5.3 Block Editor Header Button

Add Compress button to block editor header (if applicable).

**Files:**
- [ ] `src/components/Block/BlockActions.tsx` - Add Compress action
- [ ] `src/components/Block/BlockCard.tsx` - Add compression badge

---

### Phase 6: UI - Multi-Block Merge Compression

**Goal:** Allow selecting multiple blocks and merging into one compressed block.

#### 6.1 Multi-Select Mode

Add multi-select capability to zone view:
- Checkbox on each block card
- Or Shift+click selection
- Selected blocks highlighted

#### 6.2 Floating Action Bar

When blocks selected, show floating bar:
- "Compress & Merge (N)" button
- "Cancel" to deselect all

#### 6.3 Merge Configuration Dialog

Dialog content:
- List of selected blocks (title, zone, tokens)
- Drag handles to reorder before merge
- Target zone selector
- Target block type selector
- Strategy selector
- Total tokens before/after estimate
- "Compress & Merge" / "Cancel" buttons

**Files:**
- [ ] `src/components/Compression/CompressionDialog.tsx` - NEW
- [ ] `src/components/Layout/MultiSelectBar.tsx` - NEW or modify existing
- [ ] `src/components/Block/BlockCard.tsx` - Add selection checkbox

---

### Phase 7: UI - Zone Compression

**Goal:** Add zone-level compression that merges all blocks in zone.

#### 7.1 Zone Header Button

Add compress icon (Minimize2) to zone header in `ZoneColumn.tsx`.

#### 7.2 Zone Compression Dialog

Dialog content:
- Zone name and summary
- Total blocks in zone
- Total tokens
- Warning: "All blocks will be merged into 1"
- New block title input (optional)
- Strategy selector
- "Compress Zone" / "Cancel" buttons

**Files:**
- [ ] `src/components/Layout/ZoneColumn.tsx` - Add compress button
- [ ] `src/components/Compression/CompressionDialog.tsx` - Support zone mode

---

### Phase 8: Notifications & Polish

**Goal:** Add toast notifications and improve UX.

#### 8.1 Toast Notifications

- "Compressed: saved X tokens"
- "Merged N blocks, saved X tokens"
- "Compression failed: [error]"

#### 8.2 Loading States

- Disable compress button during compression
- Show spinner in dialog
- Show progress for zone compression

**Files:**
- [ ] Various components - Add loading states
- [ ] Add toast notifications

---

## File Checklist

### New Files
- [ ] `src/lib/compression/types.ts`
- [ ] `src/lib/compression/compressionService.ts`
- [ ] `src/lib/compression/strategies/semantic.ts`
- [ ] `src/hooks/useCompression.ts`
- [ ] `src/components/Compression/CompressionDialog.tsx`
- [ ] `src/components/Layout/MultiSelectBar.tsx` (if not exists)

### Files to Modify
- [ ] `convex/schema.ts` - Add compression fields
- [ ] `convex/blocks.ts` - Add mutations
- [ ] `src/components/Block/BlockCard.tsx` - Badge + selection
- [ ] `src/components/Block/BlockActions.tsx` - Compress action
- [ ] `src/components/Layout/ZoneColumn.tsx` - Zone compress button

---

## Testing Checklist

### Single Block
- [ ] Compress single block via card menu
- [ ] Block content replaced with compressed version
- [ ] Compression badge shows ratio
- [ ] Error for blocks < 100 tokens
- [ ] Error for already compressed blocks

### Multi-Block Merge
- [ ] Select multiple blocks → action bar appears
- [ ] Dialog shows block list with reordering
- [ ] Merged content combines all blocks
- [ ] Original blocks deleted after merge
- [ ] New block appears in target zone
- [ ] "Merged from N" indicator shown

### Zone Compression
- [ ] Compress zone via header icon
- [ ] All zone blocks merged into one
- [ ] Zone token count updates

### General
- [ ] Works with Ollama provider
- [ ] Works with OpenRouter provider
- [ ] Error handling for failed LLM calls
- [ ] Loading states during compression
- [ ] Toast notifications

---

## Out of Scope (Future)

- Structural compression strategy (pattern extraction)
- Statistical compression strategy (deduplication)
- Block type-aware strategy auto-selection
- Preservation levels (CRITICAL blocks can't be compressed)
- Rehydration (restore original content)
- Stubs/Unload (show placeholder, load on demand)
- Automatic compression triggers

---

## Priority

Medium - Enhances context management for large sessions

## Related

- [DESIGN-compression-system.md](../design/DESIGN-compression-system.md)
- Python implementation: `src/context_manager/compression/`
- Cloud deployment plan (BYOK architecture)

## Notes

- Start with semantic (LLM) compression only
- Token counting: approximate with `content.length / 4`
- Consider tiktoken for accurate counting later
- Minimum 100 tokens to compress (avoid overhead for small blocks)
- Minimum 1.2x ratio for compression to be "effective"
