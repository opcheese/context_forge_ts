# TASK-002: Delete Confirmation Dialogs

## Overview

Add confirmation dialogs to all destructive delete actions to prevent accidental data loss.

## Problem

User testing revealed that:
- Delete button is too easy to accidentally click
- No confirmation before deletion
- User lost important blocks multiple times by misclicking

## Requirements

### Core Behavior
- All delete actions must show a confirmation dialog before proceeding
- Dialog should clearly state what will be deleted
- Dialog should have "Cancel" (default/highlighted) and "Delete" buttons
- Delete button should be styled as destructive (red)
- Pressing Escape or clicking outside should cancel

### Affected Actions
1. Delete block (note)
2. Delete session
3. Delete workflow
4. Delete template
5. Delete snapshot

### Out of Scope
- Undo functionality (future enhancement)
- Soft delete / trash (future enhancement)
- Bulk delete confirmation

---

## Technical Implementation

### Phase 1: Create Reusable Confirmation Dialog Component

#### 1.1 Create `src/components/ui/ConfirmDialog.tsx`

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  destructive?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = true,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {loading ? "Deleting..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

#### 1.2 Create `src/hooks/useConfirmDelete.ts`

Reusable hook for delete confirmation pattern:

```typescript
import { useState, useCallback } from "react"

interface UseConfirmDeleteOptions<T> {
  onDelete: (item: T) => Promise<void>
  getTitle?: (item: T) => string
  getDescription?: (item: T) => string
}

export function useConfirmDelete<T>({
  onDelete,
  getTitle = () => "Delete item?",
  getDescription = () => "This action cannot be undone.",
}: UseConfirmDeleteOptions<T>) {
  const [itemToDelete, setItemToDelete] = useState<T | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const requestDelete = useCallback((item: T) => {
    setItemToDelete(item)
  }, [])

  const cancelDelete = useCallback(() => {
    setItemToDelete(null)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!itemToDelete) return

    setIsDeleting(true)
    try {
      await onDelete(itemToDelete)
      setItemToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }, [itemToDelete, onDelete])

  return {
    itemToDelete,
    isDeleting,
    isOpen: itemToDelete !== null,
    title: itemToDelete ? getTitle(itemToDelete) : "",
    description: itemToDelete ? getDescription(itemToDelete) : "",
    requestDelete,
    cancelDelete,
    confirmDelete,
  }
}
```

---

### Phase 2: Add Confirmation to Each Delete Action

#### 2.1 Block (Note) Delete

Location: `src/components/Block/BlockActions.tsx` or similar

Before:
```typescript
const handleDelete = () => {
  deleteBlock({ id: block._id })
}
```

After:
```typescript
const {
  isOpen,
  isDeleting,
  title,
  description,
  requestDelete,
  cancelDelete,
  confirmDelete,
} = useConfirmDelete({
  onDelete: async (block) => {
    await deleteBlock({ id: block._id })
  },
  getTitle: (block) => "Delete this block?",
  getDescription: (block) => {
    const preview = block.content.slice(0, 50)
    return `"${preview}${block.content.length > 50 ? '...' : ''}" will be permanently deleted.`
  },
})

// In JSX:
<Button onClick={() => requestDelete(block)}>
  <Trash2 className="h-4 w-4" />
</Button>

<ConfirmDialog
  open={isOpen}
  onOpenChange={(open) => !open && cancelDelete()}
  title={title}
  description={description}
  onConfirm={confirmDelete}
  loading={isDeleting}
/>
```

#### 2.2 Session Delete

Location: Session list or session page

```typescript
const deleteConfirm = useConfirmDelete({
  onDelete: async (session) => {
    await deleteSession({ id: session._id })
  },
  getTitle: () => "Delete this session?",
  getDescription: (session) =>
    `"${session.name}" and all its blocks will be permanently deleted.`,
})
```

#### 2.3 Workflow Delete

Location: Workflow list or workflow editor

```typescript
const deleteConfirm = useConfirmDelete({
  onDelete: async (workflow) => {
    await deleteWorkflow({ id: workflow._id })
  },
  getTitle: () => "Delete this workflow?",
  getDescription: (workflow) =>
    `"${workflow.name}" will be permanently deleted. Sessions created from this workflow will not be affected.`,
})
```

#### 2.4 Template Delete

Location: Template list or template editor

```typescript
const deleteConfirm = useConfirmDelete({
  onDelete: async (template) => {
    await deleteTemplate({ id: template._id })
  },
  getTitle: () => "Delete this template?",
  getDescription: (template) =>
    `"${template.name}" will be permanently deleted.`,
})
```

#### 2.5 Snapshot Delete

Location: Snapshot list

```typescript
const deleteConfirm = useConfirmDelete({
  onDelete: async (snapshot) => {
    await deleteSnapshot({ id: snapshot._id })
  },
  getTitle: () => "Delete this snapshot?",
  getDescription: (snapshot) =>
    `Snapshot "${snapshot.name}" will be permanently deleted.`,
})
```

---

### Phase 3: Button Styling Improvements

#### 3.1 Make Delete Buttons More Visible as Destructive

Update delete button styling to be clearer:

```typescript
// Before: ghost button, easy to miss
<Button variant="ghost" size="icon">
  <Trash2 className="h-4 w-4" />
</Button>

// After: clearer destructive styling on hover
<Button
  variant="ghost"
  size="icon"
  className="hover:bg-destructive/10 hover:text-destructive"
>
  <Trash2 className="h-4 w-4" />
</Button>
```

#### 3.2 Consider Icon + Tooltip

Add tooltip for clarity:

```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" onClick={() => requestDelete(item)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Delete</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## File Checklist

### New Files
- [ ] `src/components/ui/ConfirmDialog.tsx`
- [ ] `src/hooks/useConfirmDelete.ts`

### Files to Modify
- [ ] Block actions component (add confirmation for block delete)
- [ ] Session list/page (add confirmation for session delete)
- [ ] Workflow list/editor (add confirmation for workflow delete)
- [ ] Template list/editor (add confirmation for template delete)
- [ ] Snapshot list (add confirmation for snapshot delete)

---

## Testing Checklist

- [ ] Block delete shows confirmation dialog
- [ ] Session delete shows confirmation dialog
- [ ] Workflow delete shows confirmation dialog
- [ ] Template delete shows confirmation dialog
- [ ] Snapshot delete shows confirmation dialog
- [ ] Cancel button closes dialog without deleting
- [ ] Escape key closes dialog without deleting
- [ ] Click outside closes dialog without deleting
- [ ] Confirm button deletes the item
- [ ] Dialog shows loading state during deletion
- [ ] Delete button has destructive hover styling
- [ ] Dialog description shows item name/preview

---

## Dialog Copy

| Action | Title | Description |
|--------|-------|-------------|
| Delete Block | "Delete this block?" | "[preview]..." will be permanently deleted. |
| Delete Session | "Delete this session?" | "[name]" and all its blocks will be permanently deleted. |
| Delete Workflow | "Delete this workflow?" | "[name]" will be permanently deleted. Sessions created from this workflow will not be affected. |
| Delete Template | "Delete this template?" | "[name]" will be permanently deleted. |
| Delete Snapshot | "Delete this snapshot?" | Snapshot "[name]" will be permanently deleted. |

---

## Future Enhancements (Out of Scope)

- Undo with toast notification
- Soft delete with trash/recovery
- Bulk delete with count confirmation
- Keyboard shortcut (Shift+Delete to skip confirmation)
