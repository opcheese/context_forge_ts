# TASK-013: Draft Blocks — Exclude from Context Without Deleting

## Problem
PM feedback: "Several times I needed some files to not be included in the context, but I didn't want to delete them. These were mainly files I saved in Working, but I needed to look at a different version of that file."

## Solution
Add `isDraft` boolean flag to blocks. Draft blocks remain visible in the UI but are excluded from LLM context assembly.

## Implementation

### 1. Schema
- Add `isDraft: v.optional(v.boolean())` to blocks table in `convex/schema.ts`

### 2. Backend mutation
- Add `toggleDraft` mutation in `convex/blocks.ts` — flips `isDraft` between `true` and `undefined`

### 3. Context assembly filter
- `convex/lib/context.ts`: skip blocks where `isDraft === true` in `assembleContext`, `assembleContextWithConversation`, and `extractSystemPromptFromBlocks`
- `src/lib/llm/context.ts`: same filter in client-side versions

### 4. UI — BlockCard
- Draft blocks: reduced opacity, "Draft" badge next to type badge
- Token count dimmed/excluded from display
- Add "Mark as Draft" / "Undraft" toggle to hover actions

### 5. Zone token totals
- Exclude draft blocks from zone token sums (if applicable)

## What stays the same
- Draft blocks remain in their zone, keep position, are draggable
- Still editable, deletable, movable between zones
- Queries return drafts — no query changes
- Token count preserved on block (restored when undrafted)
