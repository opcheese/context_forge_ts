# BUG-001: Drag-and-Drop Reordering Issues

## Overview

Drag-and-drop reordering of blocks within zones doesn't work reliably. Users report it "could say it doesn't work at all."

## Symptoms

- Reordering blocks within a zone produces unexpected results
- Exact reproduction steps unclear - issue is intermittent or hard to describe

## Investigation Notes

### Current Implementation

**Files:**
- [DndProvider.tsx](../../src/components/dnd/DndProvider.tsx) - Main drag handling logic
- [SortableBlock.tsx](../../src/components/dnd/SortableBlock.tsx) - Makes blocks draggable
- [DroppableZone.tsx](../../src/components/dnd/DroppableZone.tsx) - Zone drop targets
- [positioning.ts](../../src/lib/positioning.ts) - Position calculation utilities

**Libraries:**
- `@dnd-kit/core` and `@dnd-kit/sortable`

### Potential Issues Identified

1. **Visual/Logic Mismatch**: The code uses `@dnd-kit/sortable` for visual feedback during drag, but uses custom position calculations on drop. The drop handler always "inserts before the target block" (DndProvider.tsx:102), which may not match what the user sees during drag.

2. **Collision Detection**: Using `closestCenter` collision detection might cause the drop target to flip between items during drag, causing confusion.

3. **Two-Step Cross-Zone Move**: For cross-zone moves, the code does `moveBlock` then `reorderBlock` as separate mutations (DndProvider.tsx:120-122). Race conditions or stale data could cause issues.

4. **Fractional Position Precision**: After many moves, fractional positions could get very close together, potentially causing sorting issues.

## Suggested Investigation Steps

1. Add console logging to `handleDragEnd` to see:
   - What `over.id` is when drop happens
   - What `newPosition` is calculated
   - What the positions of surrounding blocks are

2. Test specific scenarios:
   - Move block from position 1 to position 3 (down)
   - Move block from position 3 to position 1 (up)
   - Move first block to last
   - Move last block to first

3. Compare behavior with dnd-kit's recommended approach (using `arrayMove` utility)

## Related

- Bug report Item 5: "Reordering in notes column works poorly. Could say it doesn't work at all."

## Priority

Medium - Annoying but workaround exists (delete and recreate block in desired position)

## Status

Not yet fixed - needs reproduction and debugging session
