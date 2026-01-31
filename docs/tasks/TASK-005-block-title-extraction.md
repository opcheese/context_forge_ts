# TASK-005: Block Title Extraction and Collapsible Cards

## Overview

Improve block identification by extracting titles from content and adding collapsible card functionality, matching the Python ContextForge implementation.

## Problem

From bug report Item 8:
- "Maybe should add titles/headers to notes for identification"
- Blocks are hard to distinguish when viewing a list

## Solution: Content-Driven Titles (No Schema Change)

Following the Python ContextForge approach:
- Extract title dynamically from first line of content
- No explicit `title` field needed in schema
- Collapsible cards show title when collapsed, full content when expanded

---

## Technical Implementation

### Phase 1: Title Extraction Utility

#### 1.1 Create `src/utils/extractTitle.ts`

Port from Python version:

```typescript
/**
 * Extract title from block content
 *
 * Uses the first non-empty line as the card title when collapsed.
 * Handles edge cases:
 * - Content starting with blank lines
 * - Very long first lines (truncates to 100 chars)
 * - Content with no newlines
 * - Empty content
 */
export function extractTitle(content: string): string {
  // Handle empty or whitespace-only content
  const trimmed = content.trim()
  if (!trimmed) {
    return "Untitled Block"
  }

  // Split by newlines and find first non-empty line
  const lines = trimmed.split("\n")
  const firstNonEmpty = lines.find(line => line.trim().length > 0)

  if (!firstNonEmpty) {
    return "Untitled Block"
  }

  // Strip markdown heading prefix if present
  let title = firstNonEmpty.trim()
  if (title.startsWith("#")) {
    title = title.replace(/^#+\s*/, "")
  }

  // Truncate if too long (max 100 chars)
  if (title.length > 100) {
    return title.slice(0, 97) + "..."
  }

  return title
}

/**
 * Check if content has multiple non-empty lines
 * Used to determine if collapse toggle should be shown
 */
export function hasMultipleLines(content: string): boolean {
  const lines = content.trim().split("\n")
  const nonEmptyLines = lines.filter(line => line.trim().length > 0)
  return nonEmptyLines.length > 1
}
```

---

### Phase 2: Collapsible Block Cards

#### 2.1 Update BlockCard Component

Add collapsed state with title-only view:

```typescript
interface BlockCardProps {
  // ... existing props
  defaultCollapsed?: boolean  // STABLE zone passes true
}

function BlockCard({ defaultCollapsed = false, ...props }: BlockCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  const title = extractTitle(block.content)
  const canCollapse = hasMultipleLines(block.content)

  return (
    <div className={cn("block-card", isCollapsed && "collapsed")}>
      <BlockHeader>
        {/* Type icon, token count, etc. */}

        {/* Collapse toggle - only show if content has multiple lines */}
        {canCollapse && (
          <button onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <ChevronDown /> : <ChevronUp />}
          </button>
        )}
      </BlockHeader>

      <BlockContent>
        {isCollapsed ? (
          // Collapsed: show only title
          <p className="font-medium truncate">{title}</p>
        ) : (
          // Expanded: show full content preview
          <div className="whitespace-pre-wrap">
            {block.content.length > 200
              ? block.content.slice(0, 200) + "..."
              : block.content}
          </div>
        )}
      </BlockContent>

      {/* Actions only visible when expanded */}
      {!isCollapsed && <BlockActions />}
    </div>
  )
}
```

#### 2.2 Zone-Based Default Collapse

In the zone/list component:

```typescript
// STABLE zone blocks start collapsed by default
const defaultCollapsed = zone === "STABLE"

{sortedBlocks.map(block => (
  <BlockCard
    key={block._id}
    block={block}
    defaultCollapsed={defaultCollapsed}
  />
))}
```

---

### Phase 3: Visual Design

#### 3.1 Collapsed Card Styling

```css
.block-card.collapsed {
  /* More compact when collapsed */
  padding: 8px 12px;
}

.block-card.collapsed .block-content {
  /* Single line with truncation */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

#### 3.2 Expand on Selection (Optional)

Auto-expand when user selects a block for editing:

```typescript
const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

// Auto-expand when selected
useEffect(() => {
  if (isSelected && isCollapsed) {
    setIsCollapsed(false)
  }
}, [isSelected])
```

---

## File Checklist

### New Files
- [ ] `src/utils/extractTitle.ts`

### Files to Modify
- [ ] BlockCard component - add collapse state and title extraction
- [ ] Zone rendering - pass defaultCollapsed based on zone type

---

## Testing Checklist

- [ ] Title extracted from first non-empty line
- [ ] Markdown headings stripped (# removed from title)
- [ ] Long titles truncated at 100 chars with ellipsis
- [ ] Empty content shows "Untitled Block"
- [ ] Collapse toggle only appears for multi-line content
- [ ] STABLE zone blocks start collapsed
- [ ] Other zones start expanded
- [ ] Click toggle expands/collapses
- [ ] Selected block auto-expands
- [ ] Actions visible only when expanded

---

## UI Reference

**Collapsed card:**
```
┌─────────────────────────────────────────────────┐
│ 🎮 CHARACTER  │ 245 tokens │ ▼                  │
├─────────────────────────────────────────────────┤
│ Elena - The Protagonist                          │
└─────────────────────────────────────────────────┘
```

**Expanded card:**
```
┌─────────────────────────────────────────────────┐
│ 🎮 CHARACTER  │ 245 tokens │ ▲    2m ago       │
├─────────────────────────────────────────────────┤
│ Elena - The Protagonist                          │
│                                                  │
│ A former mechanic turned pilot, Elena grew up   │
│ in the lower districts of Neo-Tokyo...          │
├─────────────────────────────────────────────────┤
│                        [Edit] [Move] [Delete]   │
└─────────────────────────────────────────────────┘
```

---

## Related

- Bug Report Item 8: "Maybe should add titles/headers to notes for identification"
- TASK-004: Block Editor Improvements (markdown support helps with structured titles)

## Notes

- No schema change needed - title is derived from content
- Users naturally title blocks by starting with a heading
- Collapsible cards help manage visual clutter in STABLE zone
- Consider persisting collapse state per-block in localStorage (future enhancement)
