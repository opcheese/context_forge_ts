# BUG-004: Save Dropdown Positioning

## Overview

The zone selector dropdown in BrainstormDialog opens downward and gets cut off when saving the last message at the bottom of the conversation.

## Problem

From bug report Item 22:
- "Можно пропустить случайно раскрывающееся окошко при save реза brainstorm"
- Save dropdown is partially or fully hidden for messages near bottom of scroll area
- User must scroll down to see zone options
- Easy to accidentally dismiss by clicking outside

## Root Cause

The `ZoneSelector` component uses fixed downward positioning:

```tsx
// Current implementation (BrainstormDialog.tsx:68)
<div className="absolute right-0 top-full mt-1 z-10 ...">
```

This always opens below the button regardless of available space.

---

## Solution: Use Radix DropdownMenu

Replace custom `ZoneSelector` with Radix DropdownMenu which has built-in collision detection.

### Implementation

#### 1. Install Radix (if not already present)

```bash
npm install @radix-ui/react-dropdown-menu
```

#### 2. Replace ZoneSelector with DropdownMenu

```tsx
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"

// In MessageBubble component, replace the save button + ZoneSelector with:

<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-6 px-2 text-xs",
        message.savedAsBlockId && "text-green-600"
      )}
    >
      {message.savedAsBlockId ? "Saved" : "Save"}
    </Button>
  </DropdownMenu.Trigger>

  <DropdownMenu.Portal>
    <DropdownMenu.Content
      className="z-50 min-w-[120px] bg-card border border-border rounded-md shadow-lg p-1"
      sideOffset={4}
      align="end"
      // Collision detection - will flip to top if no space below
      collisionPadding={8}
    >
      <div className="text-xs text-muted-foreground px-2 py-1">
        Save to zone:
      </div>

      <DropdownMenu.Item
        className="px-2 py-1.5 text-sm rounded cursor-pointer hover:bg-accent outline-none"
        onSelect={() => onSave("WORKING")}
      >
        Working
      </DropdownMenu.Item>

      <DropdownMenu.Item
        className="px-2 py-1.5 text-sm rounded cursor-pointer hover:bg-accent outline-none"
        onSelect={() => onSave("STABLE")}
      >
        Stable
      </DropdownMenu.Item>

      <DropdownMenu.Item
        className="px-2 py-1.5 text-sm rounded cursor-pointer hover:bg-accent outline-none"
        onSelect={() => onSave("PERMANENT")}
      >
        Permanent
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
```

#### 3. Remove ZoneSelector Component

Delete the `ZoneSelector` function component (lines 54-89) as it's no longer needed.

#### 4. Remove State Management

Remove from `MessageBubble`:
```tsx
// Delete these lines
const [showZoneSelector, setShowZoneSelector] = useState(false)
```

Radix DropdownMenu handles open/close state internally.

---

## Benefits of Radix DropdownMenu

1. **Collision Detection** - Automatically flips to top/bottom based on available space
2. **Portal Rendering** - Renders outside scroll container, never clipped
3. **Keyboard Navigation** - Arrow keys, Enter, Escape work out of the box
4. **Focus Management** - Proper focus trapping and restoration
5. **Accessibility** - ARIA attributes handled automatically
6. **Click Outside** - Closes on click outside (configurable)

---

## File Checklist

### Files to Modify
- [ ] `src/components/BrainstormDialog.tsx`
  - Import DropdownMenu from Radix
  - Replace ZoneSelector usage with DropdownMenu
  - Remove ZoneSelector component
  - Remove showZoneSelector state from MessageBubble

### Dependencies
- [ ] `@radix-ui/react-dropdown-menu` (may already be installed via shadcn/ui)

---

## Testing Checklist

- [ ] Save button on FIRST message - dropdown opens normally
- [ ] Save button on LAST message - dropdown opens UPWARD (not clipped)
- [ ] Dropdown closes when clicking a zone option
- [ ] Dropdown closes when clicking outside
- [ ] Dropdown closes when pressing Escape
- [ ] Keyboard navigation works (arrow keys to select zone)
- [ ] Works correctly when dialog is scrolled to bottom

---

## UI Reference

**Before (cut off at bottom):**
```
┌─────────────────────────────────────────┐
│ [Message content...]                    │
│                                         │
│              [Copy] [Save] [Retry]      │
│                      ┌─────────┐        │
│                      │ Save to:│        │
│                      │ Working │ ← Partially visible
└──────────────────────┴─────────┴────────┘
```

**After (opens upward when needed):**
```
┌─────────────────────────────────────────┐
│ [Message content...]                    │
│                      ┌──────────┐       │
│                      │ Save to: │       │
│                      │ Working  │       │
│                      │ Stable   │       │
│                      │ Permanent│       │
│                      └──────────┘       │
│              [Copy] [Save] [Retry]      │
└─────────────────────────────────────────┘
```

---

## Related

- Bug Report Item 22: "Save dropdown easy to miss"
- BrainstormDialog already uses Radix Dialog (likely)

## Priority

Medium - Frustrating UX but workaround exists (scroll down)

## Status

✅ **Fixed** — 2026-02-11 (commit `9faf79f`)

Replaced custom `ZoneSelector` with Radix `DropdownMenu` which has built-in collision detection. Dropdown now flips upward when there's insufficient space below.

## Notes

- Used existing shadcn/ui DropdownMenu component
- Same pattern could improve other dropdowns in the app
