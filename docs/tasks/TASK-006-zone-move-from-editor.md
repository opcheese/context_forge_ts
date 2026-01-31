# TASK-006: Zone Move from Block Editor

## Overview

Allow users to change a block's zone (PERMANENT/STABLE/WORKING) directly from the block editor without exiting edit mode.

## Problem

From bug report Item 9:
- "Maybe should add ability to move to stable/permanent/working from notes editing mode"
- Currently users must: exit editor → find block → move to zone → re-enter editor
- Interrupts workflow, especially when deciding zone during content creation

## Requirements

### Core Behavior
- Zone selector visible in block editor header
- Changing zone updates block immediately (or on save)
- Visual feedback confirms zone change
- Works with both new blocks and existing blocks

---

## Technical Implementation

### Phase 1: Add Zone Selector to Editor Header

#### 1.1 Update Block Editor Page

Add zone selector in the header alongside other block metadata:

```typescript
function BlockEditorPage() {
  const [zone, setZone] = useState<Zone>(block.zone)
  const moveBlock = useMutation(api.blocks.move)

  const handleZoneChange = async (newZone: Zone) => {
    setZone(newZone)
    // Option A: Move immediately
    await moveBlock({ id: block._id, zone: newZone })
    // Option B: Move on save (track as pending change)
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBack}>← Back</Button>

          {/* Block info */}
          <span className="text-sm text-muted-foreground">
            Editing: {blockTitle}
          </span>

          {/* Zone selector */}
          <select
            value={zone}
            onChange={(e) => handleZoneChange(e.target.value as Zone)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="PERMANENT">📌 Permanent</option>
            <option value="STABLE">📋 Stable</option>
            <option value="WORKING">✏️ Working</option>
          </select>

          {/* Type selector (existing) */}
          <TypeSelector value={type} onChange={setType} />
        </div>

        {/* Save/Cancel buttons */}
      </header>

      {/* Editor content */}
    </div>
  )
}
```

#### 1.2 Zone Selector Component (Optional)

Create reusable component if needed elsewhere:

```typescript
interface ZoneSelectorProps {
  value: Zone
  onChange: (zone: Zone) => void
  disabled?: boolean
}

export function ZoneSelector({ value, onChange, disabled }: ZoneSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Zone)}
      disabled={disabled}
      className="text-sm border rounded px-2 py-1 bg-background"
    >
      <option value="PERMANENT">📌 Permanent</option>
      <option value="STABLE">📋 Stable</option>
      <option value="WORKING">✏️ Working</option>
    </select>
  )
}
```

---

### Phase 2: Behavior Options

#### Option A: Move Immediately

Zone change takes effect immediately, independent of content save.

**Pros:**
- Instant feedback
- Zone and content are separate concerns

**Cons:**
- If user cancels edit, zone change persists
- Extra mutation call

#### Option B: Move on Save

Zone change is part of the save operation.

**Pros:**
- Atomic - cancel reverts everything
- Single mutation call

**Cons:**
- Need to track zone as "pending change"
- Slightly delayed feedback

**Recommendation:** Option A (immediate) - zone and content are logically separate, and users expect zone changes to be instant like drag-drop.

---

## File Checklist

### New Files
- [ ] `src/components/ZoneSelector.tsx` (optional, if reusable)

### Files to Modify
- [ ] Block editor page - add zone selector to header

---

## Testing Checklist

- [ ] Zone selector shows current block zone
- [ ] Changing zone updates block in database
- [ ] Block appears in new zone after navigation back
- [ ] Zone change works for new blocks (during creation)
- [ ] Zone change works for existing blocks (during edit)
- [ ] Visual feedback confirms change (optional toast)

---

## UI Reference

```
┌────────────────────────────────────────────────────────────────┐
│ ← Back │ Editing: Elena │ [📋 Stable ▼] │ [🎮 CHARACTER ▼] │ Save │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Editor                      │  Preview                        │
│  ...                         │  ...                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Related

- Bug Report Item 9: "Maybe should add ability to move to stable/permanent/working from notes editing mode"
- TASK-004: Block Editor Improvements (this integrates into the editor header)

## Notes

- Small feature, can be implemented alongside TASK-004
- Consider adding to "Add Block" flow as well (choose zone when creating)
- Emojis in zone options help visual recognition
