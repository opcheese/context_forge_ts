# TASK-003: Session Deletion from UI

## Overview

Add the ability to delete sessions from the session selector dropdown in the header.

## Problem

From bug report Item 3:
- Users asked "How to delete sessions? What happens if there are too many?"
- Session deletion exists in backend (`sessions.remove`) but is not exposed in the UI
- Users have no way to clean up old or unused sessions

## Requirements

### Core Behavior
- Users can delete sessions from the session selector
- Delete action requires confirmation (per TASK-002)
- When deleting the currently selected session, switch to another session or clear selection
- Show clear indication of which session will be deleted

### UI Approach
Replace simple `<select>` with a custom dropdown that shows:
- Session name/ID
- Delete button (trash icon) for each session
- Clicking session name switches to it
- Clicking delete shows confirmation dialog

### Out of Scope
- Bulk session deletion (use existing `removeAll` mutation from settings if needed)
- Session archiving/hiding
- Session search/filter

---

## Technical Implementation

### Phase 1: Create Session Dropdown Component

#### 1.1 Create `src/components/sessions/SessionDropdown.tsx`

Replace the simple `<select>` with a custom dropdown:

```typescript
import { useState, useRef, useEffect } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Trash2, ChevronDown } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

interface SessionDropdownProps {
  sessions: Doc<"sessions">[]
  currentSessionId: Id<"sessions"> | null
  onSelectSession: (id: Id<"sessions">) => void
  onCreateSession: () => void
  isLoading?: boolean
}

export function SessionDropdown({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  isLoading,
}: SessionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<Doc<"sessions"> | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const removeSession = useMutation(api.sessions.remove)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const currentSession = sessions.find(s => s._id === currentSessionId)
  const displayName = currentSession?.name ??
    (currentSessionId ? `Session ${currentSessionId.slice(-6)}` : "Select session...")

  const handleDelete = async () => {
    if (!sessionToDelete) return

    setIsDeleting(true)
    try {
      await removeSession({ id: sessionToDelete._id })

      // If we deleted the current session, clear selection or switch
      if (sessionToDelete._id === currentSessionId) {
        const remaining = sessions.filter(s => s._id !== sessionToDelete._id)
        if (remaining.length > 0) {
          onSelectSession(remaining[0]._id)
        }
        // If no sessions left, the parent should handle this
      }

      setSessionToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
      >
        <span className="max-w-[200px] truncate">{displayName}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 rounded-md border border-border bg-background shadow-lg z-50">
          <div className="max-h-60 overflow-y-auto py-1">
            {sessions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No sessions yet
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session._id}
                  className={`flex items-center justify-between px-2 py-1.5 hover:bg-accent group ${
                    session._id === currentSessionId ? "bg-accent/50" : ""
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectSession(session._id)
                      setIsOpen(false)
                    }}
                    className="flex-1 text-left text-sm truncate pr-2"
                  >
                    {session.name ?? `Session ${session._id.slice(-6)}`}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSessionToDelete(session)
                    }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                    title="Delete session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Create new session button */}
          <div className="border-t border-border p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onCreateSession()
                setIsOpen(false)
              }}
              className="w-full justify-start"
            >
              + New Session
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={sessionToDelete !== null}
        onOpenChange={(open) => !open && setSessionToDelete(null)}
        title="Delete this session?"
        description={`"${sessionToDelete?.name ?? `Session ${sessionToDelete?._id.slice(-6)}`}" and all its blocks will be permanently deleted.`}
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </div>
  )
}
```

### Phase 2: Update Session Selector

#### 2.1 Update `src/routes/__root.tsx`

Replace the `<select>` with the new `SessionDropdown`:

```typescript
// In SessionSelector component:
import { SessionDropdown } from "@/components/sessions/SessionDropdown"

// Replace the select with:
<SessionDropdown
  sessions={sessions}
  currentSessionId={sessionId}
  onSelectSession={switchSession}
  onCreateSession={handleCreateSession}
  isLoading={isLoading}
/>
```

---

## File Checklist

### New Files
- [ ] `src/components/sessions/SessionDropdown.tsx`

### Files to Modify
- [ ] `src/routes/__root.tsx` - Use SessionDropdown instead of select

### Dependencies
- [ ] TASK-002 (ConfirmDialog component) must be completed first

---

## Testing Checklist

- [ ] Dropdown shows all user's sessions
- [ ] Clicking session name switches to it
- [ ] Trash icon appears on hover
- [ ] Clicking trash shows confirmation dialog
- [ ] Confirming delete removes the session
- [ ] Deleting current session switches to another session
- [ ] Cancel on dialog closes without deleting
- [ ] "+ New Session" button creates a new session
- [ ] Clicking outside closes dropdown
- [ ] Dropdown scrolls when many sessions

---

## UI Copy

| Action | Title | Description |
|--------|-------|-------------|
| Delete Session | "Delete this session?" | "[name]" and all its blocks will be permanently deleted. |

---

## Notes

- Depends on TASK-002 for ConfirmDialog component
- Uses existing `sessions.remove` mutation (already handles cascade delete)
- Consider adding keyboard navigation in future enhancement
