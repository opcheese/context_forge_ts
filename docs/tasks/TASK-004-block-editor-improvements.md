# TASK-004: Block Editor Improvements (Space Usage & Markdown Support)

## Overview

Improve the block/note editing experience by maximizing space usage and adding markdown support with live preview, matching the Python ContextForge implementation.

## Problem

From bug report Items 4, 6, and 18:
- "Notes editing window is too small. Needs to be bigger, text is hard to read."
- "Window for adding new notes is also too small."
- "Enlarge brainstorm input window"

Additionally, markdown support is needed for better content formatting.

## Requirements

### Core Behavior
- Block editor should use full available space (not a small modal)
- Split-pane layout: editor on left, live preview on right
- Markdown syntax highlighting in editor
- Real-time markdown preview
- Keyboard shortcuts for common actions

### Reference Implementation
The Python ContextForge has the exact implementation we need. Key files:
- `ContextForge/frontend/src/components/editor/SplitPaneEditor.tsx`
- `ContextForge/frontend/src/components/editor/MarkdownPreview.tsx`
- `ContextForge/frontend/src/components/editor/CodeEditor.tsx`
- `ContextForge/frontend/src/pages/BlockEditor.tsx`

---

## Technical Implementation

### Phase 1: Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "streamdown": "^1.6.10",
    "@uiw/react-textarea-code-editor": "^3.1.1"
  }
}
```

Ensure Tailwind prose plugin is configured for markdown styling.

---

### Phase 2: Create Editor Components

#### 2.1 Create `src/components/editor/MarkdownPreview.tsx`

Renders markdown content using Streamdown library:

```typescript
import Streamdown from "streamdown"

interface MarkdownPreviewProps {
  content: string
  parseIncompleteMarkdown?: boolean  // true for streaming, false for static
}

export function MarkdownPreview({ content, parseIncompleteMarkdown = false }: MarkdownPreviewProps) {
  if (!content) {
    return (
      <div className="text-muted-foreground italic">
        Preview will appear here...
      </div>
    )
  }

  return (
    <div className="markdown-preview-content prose prose-sm max-w-none ...">
      <Streamdown text={content} parseIncompleteMarkdown={parseIncompleteMarkdown} />
    </div>
  )
}
```

**Prose styling classes:**
- `prose-headings:font-semibold`
- `prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg`
- `prose-p:text-gray-700 prose-p:leading-relaxed`
- `prose-pre:bg-gray-900 prose-pre:text-gray-100`
- `prose-code:text-sm prose-code:bg-gray-200 prose-code:px-1 prose-code:rounded`
- `prose-a:text-blue-600 hover:prose-a:underline`
- `prose-ul:list-disc prose-ol:list-decimal`

#### 2.2 Create `src/components/editor/CodeEditor.tsx`

Syntax-highlighted markdown editor:

```typescript
import CodeEditor from "@uiw/react-textarea-code-editor"

interface EditorProps {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export function MarkdownEditor({ value, onChange, autoFocus }: EditorProps) {
  return (
    <CodeEditor
      value={value}
      language="markdown"
      onChange={(e) => onChange(e.target.value)}
      autoFocus={autoFocus}
      style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 14,
        backgroundColor: "#1e1e1e",
        color: "#d4d4d4",
        minHeight: "100%",
      }}
      padding={16}
    />
  )
}
```

#### 2.3 Create `src/components/editor/SplitPaneEditor.tsx`

Split-pane layout with editor and preview:

```typescript
interface SplitPaneEditorProps {
  content: string
  onChange: (content: string) => void
}

export function SplitPaneEditor({ content, onChange }: SplitPaneEditorProps) {
  return (
    <div className="grid grid-cols-[1fr_2px_1fr] h-full">
      {/* Editor Pane */}
      <div className="flex flex-col overflow-hidden">
        <div className="px-4 py-3 bg-muted border-b text-sm font-medium">
          Editor
        </div>
        <div className="flex-1 overflow-auto">
          <MarkdownEditor value={content} onChange={onChange} autoFocus />
        </div>
      </div>

      {/* Divider */}
      <div className="bg-border hover:bg-primary cursor-col-resize" />

      {/* Preview Pane */}
      <div className="flex flex-col overflow-hidden">
        <div className="px-4 py-3 bg-muted border-b text-sm font-medium">
          Preview
        </div>
        <div className="flex-1 overflow-auto p-4 bg-background">
          <MarkdownPreview content={content} />
        </div>
      </div>
    </div>
  )
}
```

---

### Phase 3: Update Block Editor Page

#### 3.1 Full-Height Layout

The block editor page should use full viewport height:

```css
.block-editor-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.block-editor-header {
  /* Fixed height header */
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.block-editor-main {
  flex: 1;
  overflow: hidden;  /* Let children handle overflow */
}
```

#### 3.2 Page Structure

```typescript
function BlockEditorPage() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBack}>← Back</Button>
          <span className="text-sm text-muted-foreground">
            Editing: {blockTitle}
          </span>
          {hasUnsavedChanges && (
            <span className="text-sm text-amber-500">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      {/* Main Editor */}
      <main className="flex-1 overflow-hidden">
        <SplitPaneEditor content={content} onChange={setContent} />
      </main>
    </div>
  )
}
```

#### 3.3 Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd/Ctrl + S = Save
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault()
      handleSave()
    }
    // Esc = Cancel (only if no unsaved changes)
    if (e.key === "Escape" && !hasUnsavedChanges) {
      handleCancel()
    }
  }

  window.addEventListener("keydown", handleKeyDown)
  return () => window.removeEventListener("keydown", handleKeyDown)
}, [hasUnsavedChanges])
```

---

### Phase 4: File Drag-Drop (Optional Enhancement)

Allow users to drag markdown files into the editor:

```typescript
const [isDragging, setIsDragging] = useState(false)

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  setIsDragging(false)

  const file = e.dataTransfer?.files[0]
  if (!file) return

  // Validate file type
  const validTypes = [".md", ".txt", ".markdown"]
  if (!validTypes.some(ext => file.name.endsWith(ext))) {
    alert("Only .md, .txt, and .markdown files are supported")
    return
  }

  // Validate size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    alert("File too large (max 10MB)")
    return
  }

  // Confirm before replacing
  if (content && !confirm("Replace current content with file?")) {
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => setContent(e.target?.result as string)
  reader.readAsText(file)
}
```

---

## File Checklist

### New Files
- [ ] `src/components/editor/MarkdownPreview.tsx`
- [ ] `src/components/editor/CodeEditor.tsx` (or MarkdownEditor)
- [ ] `src/components/editor/SplitPaneEditor.tsx`
- [ ] `src/components/editor/index.ts`

### Files to Modify
- [ ] `package.json` - Add streamdown and code editor dependencies
- [ ] Block editor page/route - Use full-height layout with SplitPaneEditor
- [ ] Tailwind config - Ensure prose plugin is configured
- [ ] BrainstormDialog - Use MarkdownPreview for AI responses (parseIncompleteMarkdown=true)

---

## Testing Checklist

- [ ] Editor uses full viewport height
- [ ] Split pane shows editor on left, preview on right
- [ ] Markdown syntax is highlighted in editor
- [ ] Preview updates in real-time as user types
- [ ] Cmd/Ctrl+S saves changes
- [ ] Esc cancels (when no unsaved changes)
- [ ] Unsaved changes indicator shows when content modified
- [ ] All markdown elements render correctly:
  - [ ] Headings (H1-H3)
  - [ ] Bold, italic
  - [ ] Lists (ordered, unordered)
  - [ ] Code blocks and inline code
  - [ ] Links
  - [ ] Tables (if supported by Streamdown)
- [ ] Editor is scrollable for long content
- [ ] Preview is scrollable independently

---

## UI Reference

```
┌────────────────────────────────────────────────────────────────┐
│ ← Back    Editing: Game Mechanics    [Unsaved]    Cancel  Save │
├────────────────────────────────────────────────────────────────┤
│                              │                                 │
│  Editor                      │  Preview                        │
│  ───────                     │  ───────                        │
│                              │                                 │
│  # Heading                   │  Heading                        │
│                              │  ═══════                        │
│  Some **bold** text          │                                 │
│                              │  Some bold text                 │
│  - List item 1               │                                 │
│  - List item 2               │  • List item 1                  │
│                              │  • List item 2                  │
│  ```code```                  │                                 │
│                              │  ┌──────────┐                   │
│                              │  │ code     │                   │
│                              │  └──────────┘                   │
│                              │                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Related Items

- Item 4: Notes editing window too small
- Item 6: Add notes window too small
- Item 18: Brainstorm input too small
- Item 16: Table rendering in responses (may be addressed by Streamdown)

---

## Notes

- Port implementation from Python ContextForge for consistency
- Streamdown handles streaming markdown for brainstorm responses
- Consider making divider draggable for resizable panes (future enhancement)
- Mobile layout may need single-pane mode (future enhancement)
