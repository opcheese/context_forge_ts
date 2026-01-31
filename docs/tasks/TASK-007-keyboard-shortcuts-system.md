# TASK-007: Keyboard Shortcuts System

## Overview

Create a centralized, configurable keyboard shortcuts system with user settings.

## Problem

From bug report Item 15:
- "Should add setting for which keys send message in brainstorm (every site has different convention)"
- Users expect different shortcuts (Enter vs Ctrl+Enter vs Shift+Enter)
- No way to customize shortcuts
- No central registry of shortcuts

---

## Current State

### Existing Shortcuts (Hardcoded)

| Shortcut | Location | Action |
|----------|----------|--------|
| `Ctrl/Cmd+Enter` | GeneratePanel.tsx | Submit generation prompt |
| `Ctrl/Cmd+Enter` | BrainstormDialog.tsx | Send message |
| `Ctrl/Cmd+Enter` | BrainstormDialog.tsx | Confirm message edit |
| `Escape` | BrainstormDialog.tsx | Close dialog |
| `Escape` | BrainstormDialog.tsx | Cancel message edit |

### Missing Shortcuts

| Component | Missing Shortcut | Suggested |
|-----------|------------------|-----------|
| Block Editor | Save | `Ctrl/Cmd+S` |
| Block Editor | Cancel | `Escape` |
| SaveTemplateDialog | Submit | `Ctrl/Cmd+Enter` |
| ApplyTemplateDialog | Submit | `Ctrl/Cmd+Enter` |
| AddToProjectDialog | Submit | `Ctrl/Cmd+Enter` |
| Global | Help/Shortcuts list | `?` or `Ctrl+/` |

### Consistency Issues

- ✅ `Ctrl+Enter` used consistently for submit
- ✅ `Escape` used consistently for close/cancel
- ❌ No `Ctrl+S` for save actions
- ❌ Dialogs lack keyboard submit
- ❌ No way to use plain `Enter` to send (user preference)

---

## Requirements

### Phase 1: Centralized Shortcuts Registry

Create a single source of truth for all shortcuts.

### Phase 2: Configurable Send Shortcut

Allow users to choose between:
- `Ctrl+Enter` (default, current behavior)
- `Enter` (plain Enter sends, Shift+Enter for newline)
- `Shift+Enter` (Shift+Enter sends)

### Phase 3: Settings UI

Add keyboard shortcuts section to settings page.

### Phase 4: Expand Coverage

Add shortcuts to all dialogs and editors.

---

## Technical Implementation

### Phase 1: Shortcuts Registry

#### 1.1 Create `src/lib/shortcuts.ts`

```typescript
export type ShortcutAction =
  | "send_message"
  | "save"
  | "cancel"
  | "close_dialog"
  | "show_help"

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description: string
}

// Default shortcuts
export const DEFAULT_SHORTCUTS: Record<ShortcutAction, ShortcutConfig> = {
  send_message: {
    key: "Enter",
    ctrl: true,
    description: "Send message / Submit",
  },
  save: {
    key: "s",
    ctrl: true,
    description: "Save changes",
  },
  cancel: {
    key: "Escape",
    description: "Cancel / Close",
  },
  close_dialog: {
    key: "Escape",
    description: "Close dialog",
  },
  show_help: {
    key: "/",
    ctrl: true,
    description: "Show keyboard shortcuts",
  },
}

export function matchesShortcut(
  event: KeyboardEvent | React.KeyboardEvent,
  config: ShortcutConfig
): boolean {
  const ctrlOrMeta = event.ctrlKey || event.metaKey

  return (
    event.key === config.key &&
    (config.ctrl ? ctrlOrMeta : !ctrlOrMeta) &&
    (config.shift ? event.shiftKey : !event.shiftKey) &&
    (config.alt ? event.altKey : !event.altKey)
  )
}
```

#### 1.2 Create `src/hooks/useShortcut.ts`

```typescript
import { useEffect, useCallback } from "react"
import { useShortcutSettings } from "./useShortcutSettings"
import { matchesShortcut, type ShortcutAction } from "@/lib/shortcuts"

export function useShortcut(
  action: ShortcutAction,
  handler: () => void,
  options?: { enabled?: boolean; global?: boolean }
) {
  const { shortcuts } = useShortcutSettings()
  const config = shortcuts[action]

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (options?.enabled === false) return
      if (matchesShortcut(event, config)) {
        event.preventDefault()
        handler()
      }
    },
    [config, handler, options?.enabled]
  )

  useEffect(() => {
    if (options?.global) {
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown, options?.global])

  // Return handler for component-level use
  return handleKeyDown
}
```

#### 1.3 Create `src/hooks/useShortcutSettings.ts`

```typescript
import { useState, useEffect } from "react"
import { DEFAULT_SHORTCUTS, type ShortcutAction, type ShortcutConfig } from "@/lib/shortcuts"

const STORAGE_KEY = "keyboard-shortcuts"

export function useShortcutSettings() {
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setShortcuts({ ...DEFAULT_SHORTCUTS, ...parsed })
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, [])

  const updateShortcut = (action: ShortcutAction, config: Partial<ShortcutConfig>) => {
    setShortcuts((prev) => {
      const updated = {
        ...prev,
        [action]: { ...prev[action], ...config },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const resetToDefaults = () => {
    localStorage.removeItem(STORAGE_KEY)
    setShortcuts(DEFAULT_SHORTCUTS)
  }

  return { shortcuts, updateShortcut, resetToDefaults }
}
```

---

### Phase 2: Send Message Options

#### 2.1 Preset Options

```typescript
export type SendShortcutPreset = "ctrl_enter" | "enter" | "shift_enter"

export const SEND_PRESETS: Record<SendShortcutPreset, ShortcutConfig> = {
  ctrl_enter: {
    key: "Enter",
    ctrl: true,
    description: "Ctrl+Enter to send",
  },
  enter: {
    key: "Enter",
    description: "Enter to send (Shift+Enter for newline)",
  },
  shift_enter: {
    key: "Enter",
    shift: true,
    description: "Shift+Enter to send",
  },
}
```

#### 2.2 Handle Newline When Enter Sends

When "Enter to send" is selected, Shift+Enter inserts newline:

```typescript
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  const sendConfig = shortcuts.send_message

  // If "Enter to send" mode and user presses Shift+Enter, allow newline
  if (sendConfig.key === "Enter" && !sendConfig.ctrl && !sendConfig.shift) {
    if (e.key === "Enter" && e.shiftKey) {
      // Allow default (newline)
      return
    }
  }

  if (matchesShortcut(e, sendConfig)) {
    e.preventDefault()
    handleSend()
  }
}
```

---

### Phase 3: Settings UI

#### 3.1 Add to Settings Page

```typescript
// In settings.tsx

<section className="space-y-4">
  <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>

  {/* Send message shortcut */}
  <div className="space-y-2">
    <Label>Send Message</Label>
    <select
      value={sendPreset}
      onChange={(e) => setSendPreset(e.target.value as SendShortcutPreset)}
      className="w-full border rounded px-3 py-2"
    >
      <option value="ctrl_enter">Ctrl+Enter (default)</option>
      <option value="enter">Enter (Shift+Enter for newline)</option>
      <option value="shift_enter">Shift+Enter</option>
    </select>
    <p className="text-sm text-muted-foreground">
      Choose how to send messages in Brainstorm and Generate panels
    </p>
  </div>

  {/* All shortcuts reference */}
  <div className="space-y-2">
    <Label>All Shortcuts</Label>
    <div className="border rounded p-4 space-y-2 text-sm">
      {Object.entries(shortcuts).map(([action, config]) => (
        <div key={action} className="flex justify-between">
          <span className="text-muted-foreground">{config.description}</span>
          <kbd className="px-2 py-0.5 bg-muted rounded text-xs">
            {formatShortcut(config)}
          </kbd>
        </div>
      ))}
    </div>
  </div>

  <Button variant="outline" onClick={resetToDefaults}>
    Reset to Defaults
  </Button>
</section>
```

#### 3.2 Format Shortcut Display

```typescript
function formatShortcut(config: ShortcutConfig): string {
  const parts: string[] = []
  if (config.ctrl) parts.push("Ctrl")
  if (config.shift) parts.push("Shift")
  if (config.alt) parts.push("Alt")
  parts.push(config.key === " " ? "Space" : config.key)
  return parts.join("+")
}
```

---

### Phase 4: Update Components

#### 4.1 Update BrainstormDialog

```typescript
// Before
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    handleSend()
  }
}

// After
const { shortcuts } = useShortcutSettings()
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (matchesShortcut(e, shortcuts.send_message)) {
    e.preventDefault()
    handleSend()
  }
}
```

#### 4.2 Update All Components

Apply same pattern to:
- GeneratePanel.tsx
- Block editor (add save shortcut)
- All dialogs (add submit shortcut)

---

## File Checklist

### New Files
- [ ] `src/lib/shortcuts.ts` - Shortcut definitions and utilities
- [ ] `src/hooks/useShortcut.ts` - Hook for binding shortcuts
- [ ] `src/hooks/useShortcutSettings.ts` - Settings management
- [ ] `src/components/ShortcutsHelp.tsx` - Help dialog (optional)

### Files to Modify
- [ ] `src/routes/settings.tsx` - Add shortcuts section
- [ ] `src/components/BrainstormDialog.tsx` - Use shortcut system
- [ ] `src/components/GeneratePanel.tsx` - Use shortcut system
- [ ] Block editor - Add Ctrl+S save
- [ ] All dialogs - Add Ctrl+Enter submit

---

## Testing Checklist

- [ ] Default shortcuts work (Ctrl+Enter sends)
- [ ] Changing to "Enter to send" works
- [ ] Shift+Enter creates newline in "Enter to send" mode
- [ ] Settings persist after page reload
- [ ] Reset to defaults works
- [ ] Shortcuts display correctly in settings
- [ ] All updated components respect settings
- [ ] Mac Cmd key works same as Ctrl

---

## UI Reference

**Settings Section:**
```
┌─────────────────────────────────────────────────────┐
│ Keyboard Shortcuts                                  │
├─────────────────────────────────────────────────────┤
│ Send Message                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Ctrl+Enter (default)                          ▼ │ │
│ └─────────────────────────────────────────────────┘ │
│ Choose how to send messages in Brainstorm           │
│                                                     │
│ All Shortcuts                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Send message / Submit          [Ctrl+Enter]    │ │
│ │ Save changes                   [Ctrl+S]        │ │
│ │ Cancel / Close                 [Escape]        │ │
│ │ Show keyboard shortcuts        [Ctrl+/]        │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [Reset to Defaults]                                 │
└─────────────────────────────────────────────────────┘
```

---

## Future Enhancements

- Custom shortcut editor (capture any key combination)
- Vim-style shortcuts mode
- Per-component shortcut overrides
- Export/import shortcut settings
- Conflict detection

## Related

- Bug Report Item 15: "Should add setting for which keys send message"
- TASK-004: Block Editor (needs Ctrl+S save shortcut)

## Priority

Medium - Improves power user experience

## Notes

- Start with send message customization (most requested)
- Add other shortcuts incrementally
- Keep defaults familiar (Ctrl+Enter is common)
