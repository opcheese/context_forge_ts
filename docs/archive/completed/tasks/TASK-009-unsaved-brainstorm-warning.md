# TASK-009: Unsaved Brainstorm Warning

## Overview

Warn users before navigating away from a brainstorm session with unsaved conversation/results.

## Problem

From bug report Item 20:
- "Brainstorm is erased when navigating to other tabs, not saved"
- "At minimum show popup warning when trying to navigate with unsaved result"
- Users lose entire brainstorm conversations when clicking navigation links
- No warning before data loss

## Requirements

### Core Behavior
- Detect when brainstorm has unsaved content (messages not saved to blocks)
- Warn user before navigation with confirmation dialog
- Allow user to cancel navigation and return to brainstorm
- Allow user to proceed (discard conversation)

### What Counts as "Unsaved"
- Any messages in the conversation that haven't been saved as blocks
- AI responses that user may want to keep
- User's own messages (context for the conversation)

### Out of Scope (Future)
- Auto-save conversation to localStorage
- Recover conversation after accidental navigation
- Save entire conversation as a block

---

## Technical Implementation

### Phase 1: Track Unsaved State

#### 1.1 Add Unsaved Flag to Brainstorm State

```typescript
// In useBrainstorm.ts or BrainstormDialog.tsx
const [hasUnsavedContent, setHasUnsavedContent] = useState(false)

// Set to true when messages are added
const addMessage = (message: Message) => {
  setMessages(prev => [...prev, message])
  setHasUnsavedContent(true)
}

// Set to false when user saves a result to a block
const handleSaveToBlock = async () => {
  await saveBlock(...)
  // Optionally: setHasUnsavedContent(false) if all content saved
  // Or keep true if conversation continues
}

// Reset when dialog closes (user acknowledged loss)
const handleClose = () => {
  setMessages([])
  setHasUnsavedContent(false)
  onClose()
}
```

### Phase 2: Browser Navigation Warning (beforeunload)

#### 2.1 Warn on Page Refresh/Close

```typescript
// In BrainstormDialog.tsx
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedContent && isOpen) {
      e.preventDefault()
      e.returnValue = "" // Required for Chrome
      return "" // Required for some browsers
    }
  }

  window.addEventListener("beforeunload", handleBeforeUnload)
  return () => window.removeEventListener("beforeunload", handleBeforeUnload)
}, [hasUnsavedContent, isOpen])
```

This shows browser's native "Leave site?" dialog on:
- Page refresh
- Tab close
- Browser close

### Phase 3: In-App Navigation Warning

#### 3.1 Route Guard with TanStack Router

```typescript
// Using TanStack Router's beforeLoad or navigation blocking
import { useBlocker } from "@tanstack/react-router"

function BrainstormDialog({ isOpen, onClose }) {
  const [hasUnsavedContent, setHasUnsavedContent] = useState(false)

  // Block navigation when there's unsaved content
  useBlocker({
    shouldBlock: hasUnsavedContent && isOpen,
    withResolver: true,
  })

  // ... rest of component
}
```

#### 3.2 Custom Confirmation Dialog

If TanStack Router's blocker doesn't fit, use custom approach:

```typescript
// In __root.tsx or navigation wrapper
const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
const [showNavWarning, setShowNavWarning] = useState(false)

const handleNavigation = (to: string) => {
  if (brainstormHasUnsaved) {
    setPendingNavigation(to)
    setShowNavWarning(true)
  } else {
    navigate({ to })
  }
}

// Warning dialog
<ConfirmDialog
  open={showNavWarning}
  onOpenChange={setShowNavWarning}
  title="Unsaved brainstorm"
  description="You have an unsaved brainstorm conversation. If you leave, your conversation will be lost."
  confirmLabel="Leave anyway"
  cancelLabel="Stay"
  destructive
  onConfirm={() => {
    setShowNavWarning(false)
    navigate({ to: pendingNavigation })
    clearBrainstorm()
  }}
/>
```

### Phase 4: Dialog Close Warning

#### 4.1 Warn When Closing Brainstorm Dialog

```typescript
const handleCloseRequest = () => {
  if (hasUnsavedContent) {
    setShowCloseWarning(true)
  } else {
    onClose()
  }
}

// Override Escape key handling
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isOpen) {
      e.preventDefault()
      handleCloseRequest() // Goes through warning check
    }
  }
  // ...
}, [isOpen, hasUnsavedContent])

// Close warning dialog
<ConfirmDialog
  open={showCloseWarning}
  onOpenChange={setShowCloseWarning}
  title="Discard conversation?"
  description="You have unsaved messages. Are you sure you want to close?"
  confirmLabel="Discard"
  cancelLabel="Keep open"
  destructive
  onConfirm={() => {
    setShowCloseWarning(false)
    setMessages([])
    setHasUnsavedContent(false)
    onClose()
  }}
/>
```

---

## File Checklist

### Files to Modify
- [ ] `src/components/BrainstormDialog.tsx` - Add unsaved tracking and warnings
- [ ] `src/hooks/useBrainstorm.ts` - Track unsaved state (if state lives here)

### Dependencies
- [ ] TASK-002 (ConfirmDialog component) - for warning dialogs

---

## Testing Checklist

- [ ] Start brainstorm, send message, try to close dialog → warning shown
- [ ] Start brainstorm, send message, try to navigate → warning shown
- [ ] Start brainstorm, send message, try to refresh page → browser warning shown
- [ ] Click "Stay" / "Keep open" → returns to brainstorm, conversation intact
- [ ] Click "Leave" / "Discard" → navigation proceeds, conversation cleared
- [ ] Save result to block, then close → no warning (content saved)
- [ ] Empty brainstorm (no messages) → no warning on close/navigate

---

## UI Reference

**Close Warning Dialog:**
```
┌─────────────────────────────────────────────────────┐
│ Discard conversation?                               │
├─────────────────────────────────────────────────────┤
│ You have unsaved messages. Are you sure you want    │
│ to close?                                           │
│                                                     │
│                      [Keep open]  [Discard]         │
└─────────────────────────────────────────────────────┘
```

**Navigation Warning Dialog:**
```
┌─────────────────────────────────────────────────────┐
│ Unsaved brainstorm                                  │
├─────────────────────────────────────────────────────┤
│ You have an unsaved brainstorm conversation.        │
│ If you leave, your conversation will be lost.       │
│                                                     │
│                         [Stay]  [Leave anyway]      │
└─────────────────────────────────────────────────────┘
```

---

## Future Enhancements

- Auto-save conversation to localStorage (recoverable)
- "Save conversation" button (save all messages as a block)
- Conversation history (list of past brainstorms)
- Export conversation as markdown

## Related

- Bug Report Item 20: "Brainstorm erased when navigating"
- TASK-002: ConfirmDialog component (dependency)

## Priority

High - Data loss issue affecting primary feature

## Notes

- Browser's beforeunload can't be customized (native browser dialog)
- In-app navigation can use custom styled dialog
- Consider "Don't ask again" checkbox for power users (future)
