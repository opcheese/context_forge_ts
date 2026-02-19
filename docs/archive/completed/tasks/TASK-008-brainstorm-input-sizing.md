# TASK-008: Brainstorm Input Sizing

## Overview

Enlarge the brainstorm message input textarea to make it easier to compose longer messages.

## Problem

From bug report Item 18:
- "Enlarge brainstorm input window"
- Current input area is too small for composing longer prompts
- Users often write multi-paragraph messages to the AI

## Requirements

### Core Behavior
- Input textarea should be larger by default
- Should auto-expand as user types (up to a max height)
- Should not take over entire screen
- Should remain usable on smaller screens

### Options to Consider

1. **Larger fixed height** - Simple, predictable
2. **Auto-expand** - Grows with content, shrinks when empty
3. **Resizable** - User can drag to resize
4. **Expandable** - Button to toggle between compact and expanded mode

---

## Technical Implementation

### Option A: Larger Fixed Minimum Height

Simplest fix - increase min-height:

```typescript
// Before
<textarea
  className="w-full border rounded p-3 resize-none"
  rows={2}
  ...
/>

// After
<textarea
  className="w-full border rounded p-3 resize-none min-h-[120px]"
  rows={4}
  ...
/>
```

### Option B: Auto-Expanding Textarea (Recommended)

Textarea grows with content:

```typescript
import { useRef, useEffect } from "react"

function AutoExpandTextarea({ value, onChange, ...props }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get correct scrollHeight
    textarea.style.height = "auto"

    // Set height to scrollHeight, capped at max
    const maxHeight = 300 // px
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      className="w-full border rounded p-3 resize-none min-h-[80px] max-h-[300px] overflow-y-auto"
      {...props}
    />
  )
}
```

### Option C: Expand/Collapse Toggle

Button to switch between compact and expanded:

```typescript
const [isExpanded, setIsExpanded] = useState(false)

<div className="relative">
  <textarea
    className={cn(
      "w-full border rounded p-3 resize-none transition-all",
      isExpanded ? "min-h-[200px]" : "min-h-[80px]"
    )}
    ...
  />
  <button
    onClick={() => setIsExpanded(!isExpanded)}
    className="absolute top-2 right-2 text-muted-foreground"
    title={isExpanded ? "Collapse" : "Expand"}
  >
    {isExpanded ? <ChevronUp /> : <ChevronDown />}
  </button>
</div>
```

---

## Recommendation

**Option B (Auto-Expand)** provides the best UX:
- No extra clicks needed
- Adapts to content naturally
- Doesn't waste space when empty
- Caps at reasonable max height

---

## File Checklist

### Files to Modify
- [ ] `src/components/BrainstormDialog.tsx` - Update input textarea

### Optional New Files
- [ ] `src/components/ui/AutoExpandTextarea.tsx` - Reusable component (if needed elsewhere)

---

## Testing Checklist

- [ ] Empty textarea shows reasonable default height (~80px)
- [ ] Textarea grows as user types multiple lines
- [ ] Textarea stops growing at max height (~300px)
- [ ] Scrollbar appears when content exceeds max height
- [ ] Textarea shrinks when content is deleted
- [ ] Works on mobile/tablet screens
- [ ] Paste of large text expands correctly

---

## UI Reference

**Compact (empty or short message):**
```
┌─────────────────────────────────────────────────────┐
│ Type your message...                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Expanded (longer message):**
```
┌─────────────────────────────────────────────────────┐
│ I'm working on a game mechanic where players can   │
│ combine different elements to create new abilities. │
│                                                     │
│ The core elements are: Fire, Water, Earth, Air.    │
│                                                     │
│ Can you help me brainstorm interesting combinations │
│ and what effects they might have?                  │
└─────────────────────────────────────────────────────┘
```

---

## Related

- Bug Report Item 18: "Enlarge brainstorm input window"
- Also applies to GeneratePanel input (same pattern)

## Priority

Medium - Quality of life improvement

## Status

✅ **Completed** — 2026-02-11 (commit `9faf79f`)

Implemented Option B (auto-expanding textarea). Textarea grows with content up to max height, then shows scrollbar.

## Notes

- Consider applying same fix to GeneratePanel textarea
- Auto-expand is a common pattern (Slack, Discord, ChatGPT all use it)
