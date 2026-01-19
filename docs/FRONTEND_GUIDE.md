# Frontend Architecture Guide

A guide for developers familiar with traditional React setups (Create React App, React Router, Redux, React Query) to understand ContextForgeTS's frontend architecture.

---

## Coming from Traditional React Apps

### Quick Reference

| Traditional Stack | ContextForgeTS | Why Different |
|-------------------|----------------|---------------|
| React Router | TanStack Router | Type-safe, file-based routing |
| React Query / SWR | Convex `useQuery` | Real-time sync, no manual caching |
| Redux / Zustand | Convex + Context | Server state = Convex, UI state = Context |
| Axios / fetch | Convex `useMutation` | Type-safe RPC, automatic retries |
| Manual caching | None needed | Convex handles all caching |
| WebSocket setup | None needed | Convex handles real-time |

---

## Where is React Router?

We use **TanStack Router** instead of React Router.

### Why TanStack Router?

1. **Type-safe routes** - Route params are typed, no `useParams<{ id: string }>()`
2. **File-based routing** - Routes auto-generated from `src/routes/` structure
3. **Better DX** - Compile-time route checking, auto-complete for paths

### Route Structure

```
src/routes/
├── __root.tsx           # Layout wrapper (header, providers)
├── index.tsx            # "/" - Home page with zones
└── blocks/
    └── $blockId.tsx     # "/blocks/:blockId" - Block editor
```

### How Routes Work

```typescript
// src/routes/__root.tsx - Layout for all pages
export const Route = createRootRoute({
  component: () => (
    <SessionProvider>
      <DndProvider>
        <Header />
        <Outlet />  {/* Child routes render here */}
      </DndProvider>
    </SessionProvider>
  ),
})

// src/routes/index.tsx - Home page
export const Route = createFileRoute("/")({
  component: HomePage,
})

// src/routes/blocks/$blockId.tsx - Dynamic route
export const Route = createFileRoute("/blocks/$blockId")({
  component: BlockEditor,
})

// Accessing params (fully typed!)
function BlockEditor() {
  const { blockId } = Route.useParams()  // blockId: string, not any
}
```

### Navigation

```typescript
import { Link, useNavigate } from "@tanstack/react-router"

// Declarative
<Link to="/blocks/$blockId" params={{ blockId: "123" }}>Edit</Link>

// Programmatic
const navigate = useNavigate()
navigate({ to: "/blocks/$blockId", params: { blockId: "123" } })
```

---

## Where is React Query?

**You don't need it.** Convex provides everything React Query does, plus real-time sync.

### Comparison

```typescript
// ❌ React Query way
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ["blocks", sessionId],
  queryFn: () => fetch(`/api/blocks?session=${sessionId}`).then(r => r.json()),
  staleTime: 5000,
  refetchOnWindowFocus: true,
})

// ✅ Convex way
const blocks = useQuery(api.blocks.list, { sessionId })
// That's it. Real-time, cached, type-safe.
```

### What Convex Handles Automatically

| Feature | React Query | Convex |
|---------|-------------|--------|
| Caching | Manual `queryKey` | Automatic |
| Invalidation | Manual `invalidateQueries` | Automatic on mutation |
| Real-time updates | Polling or manual WebSocket | Built-in subscriptions |
| Optimistic updates | Manual `onMutate` | Automatic |
| Retry logic | Configurable | Built-in |
| Deduplication | Automatic | Automatic |
| Background refetch | Configurable | Always live |

### The Mental Model

```
┌─────────────────────────────────────────────────────────────────┐
│  React Query                                                     │
│                                                                  │
│  Component ──useQuery──► Cache ──fetch──► Server                │
│                            │                                     │
│                    (stale after 5s)                             │
│                            │                                     │
│                    Manual invalidation                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Convex                                                          │
│                                                                  │
│  Component ══useQuery══► WebSocket ══► Convex DB                │
│                            ║                                     │
│                    (always live)                                │
│                            ║                                     │
│                    Auto-updates on change                       │
└─────────────────────────────────────────────────────────────────┘
```

When another user (or your own mutation) changes data, **all subscribers update instantly**. No refetch, no invalidation, no stale data.

---

## Where is Caching?

**Convex handles it.** You never configure cache keys, TTL, or invalidation.

```typescript
// These two components share the same subscription
function ZoneA() {
  const blocks = useQuery(api.blocks.list, { sessionId })  // ← Same query
}

function ZoneB() {
  const blocks = useQuery(api.blocks.list, { sessionId })  // ← Deduplicated
}
```

Convex deduplicates queries with the same function + args. When the data changes, both components update.

### "But I Need to Refetch!"

You probably don't. Convex queries are live subscriptions. But if you need to skip a query conditionally:

```typescript
// Skip query when no ID
const block = useQuery(
  api.blocks.get,
  blockId ? { id: blockId } : "skip"
)
```

---

## Where is Redux / Zustand?

**Server state lives in Convex.** For UI-only state, use React Context or local state.

### State Categories

| State Type | Where It Lives | Example |
|------------|----------------|---------|
| Server data | Convex DB | Blocks, sessions, generations |
| Session selection | Context + localStorage | Current session ID |
| UI state | Component state | Modal open, form values |
| Drag state | DnD Context | Currently dragging item |

### SessionContext Example

```typescript
// src/contexts/SessionContext.tsx
const SessionContext = createContext<SessionContextType | null>(null)

export function SessionProvider({ children }) {
  // Persist to localStorage
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(() => {
    const stored = localStorage.getItem("contextforge-session-id")
    return stored ? (stored as Id<"sessions">) : null
  })

  // Sync to localStorage on change
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("contextforge-session-id", sessionId)
    }
  }, [sessionId])

  return (
    <SessionContext.Provider value={{ sessionId, setSessionId, ... }}>
      {children}
    </SessionContext.Provider>
  )
}

// Usage
function MyComponent() {
  const { sessionId } = useSession()
  const blocks = useQuery(api.blocks.list, sessionId ? { sessionId } : "skip")
}
```

---

## Custom Hooks

We have three main custom hooks:

### 1. useFileDrop - File Upload

Handles native file drops to create blocks from `.txt` and `.md` files.

```typescript
// Usage in a zone component
function Zone({ zone }) {
  const { isDragOver, dropProps } = useFileDrop({
    sessionId,
    zone,
    onDrop: (files) => console.log(`Dropped ${files.length} files`),
  })

  return (
    <div {...dropProps} data-drag-over={isDragOver}>
      {/* Zone content */}
    </div>
  )
}
```

### 2. useGenerate - Ollama Streaming (HTTP)

Streams LLM responses from Ollama via HTTP Server-Sent Events.

```typescript
const { generate, isGenerating, streamedText, error, stop } = useGenerate({
  sessionId,
  onComplete: (text) => console.log("Done:", text),
})

// Trigger generation
await generate("Write a poem about TypeScript")

// Stop mid-generation
stop()
```

**How it works:**
1. POST to `/api/chat` (port 3211)
2. Streams SSE chunks via `ReadableStream`
3. Updates `streamedText` on each chunk
4. Auto-saves result to WORKING zone

### 3. useClaudeGenerate - Claude Streaming (Convex Reactive)

Streams Claude responses via Convex reactive queries.

```typescript
const { generate, isGenerating, streamedText, error, stop } = useClaudeGenerate({
  sessionId,
  onComplete: (text) => console.log("Done:", text),
})
```

**How it works:**
1. Calls `startClaudeGeneration` mutation → creates generation record
2. Node.js action calls Claude API, writes chunks to DB
3. `useQuery(api.generations.get)` subscribes to updates
4. `useEffect` detects new text, triggers `onChunk`
5. Auto-saves to blocks when complete

```
┌──────────────────────────────────────────────────────────────┐
│  Claude Streaming Flow                                        │
│                                                               │
│  1. useMutation(startGeneration) ──► Creates generation doc  │
│                                                               │
│  2. Node.js action ──► Claude API ──► Writes chunks to DB    │
│                                                               │
│  3. useQuery(generations.get) ◄══ Live updates from DB       │
│                                                               │
│  4. Component sees streamedText grow in real-time            │
└──────────────────────────────────────────────────────────────┘
```

---

## UI Libraries

### Tailwind CSS v4

Utility-first CSS framework. No separate config file in v4 - configured in CSS:

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  /* ... theme variables ... */
}

.dark {
  --color-background: oklch(0.145 0 0);
  --color-foreground: oklch(0.985 0 0);
}
```

**Usage:**
```tsx
<div className="rounded-lg border border-border bg-card p-4 hover:bg-muted">
  <h2 className="text-xl font-semibold text-foreground">Title</h2>
</div>
```

### shadcn/ui

Not a component library you install - it's copy-paste components you own.

**We have:** `src/components/ui/button.tsx`

```typescript
// Uses class-variance-authority for variants
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium ...",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground ...",
        outline: "border border-input bg-background hover:bg-accent ...",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
  }
)

// Usage
<Button variant="destructive" size="sm">Delete</Button>
<Button variant="ghost" size="icon"><TrashIcon /></Button>
```

**Adding more components:** `npx shadcn@latest add dialog` copies the component to your project.

### cn() Utility

Combines `clsx` + `tailwind-merge` for conditional classes:

```typescript
import { cn } from "@/lib/utils"

<div className={cn(
  "p-4 rounded-lg",                    // Base classes
  isActive && "bg-primary",            // Conditional
  isDragging && "opacity-50",          // Conditional
  className                            // Props override
)} />
```

### dnd-kit

Drag-and-drop library for block reordering and zone transfers.

**Architecture:**
```
DndProvider (in __root.tsx)
├── DroppableZone (PERMANENT)
│   ├── SortableBlock
│   ├── SortableBlock
│   └── SortableBlock
├── DroppableZone (STABLE)
│   └── SortableBlock
├── DroppableZone (WORKING)
│   ├── SortableBlock
│   └── SortableBlock
└── BlockDragOverlay (portal, shows during drag)
```

**Key Components:**

```typescript
// DndProvider - Context and sensors
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  {children}
  <DragOverlay>
    {activeBlock && <BlockDragOverlay block={activeBlock} />}
  </DragOverlay>
</DndContext>

// DroppableZone - Drop target
function DroppableZone({ zone, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: zone })
  return (
    <div ref={setNodeRef} data-drop-active={isOver}>
      <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  )
}

// SortableBlock - Draggable item
function SortableBlock({ block }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: block._id,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
      className={cn(isDragging && "opacity-50")}
      {...attributes}
      {...listeners}
    >
      <BlockCard block={block} />
    </div>
  )
}
```

**Fractional Positioning:**

Instead of reindexing all blocks on reorder, we use fractional positions:

```typescript
// positioning.ts
export function getPositionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1
  if (before === null) return after! / 2
  if (after === null) return before + 1
  return (before + after) / 2
}

// Example: Insert between position 2 and 3
// Result: 2.5 (no other blocks need updating)
```

---

## Convex Integration Patterns

### Provider Setup

```typescript
// src/main.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <RouterProvider router={router} />
    </ConvexProvider>
  </StrictMode>
)
```

### Query Patterns

```typescript
// Basic query
const sessions = useQuery(api.sessions.list)

// Query with args
const blocks = useQuery(api.blocks.list, { sessionId })

// Conditional query (skip when no sessionId)
const blocks = useQuery(
  api.blocks.list,
  sessionId ? { sessionId } : "skip"
)

// Loading state
if (blocks === undefined) return <Spinner />

// Data ready
return blocks.map(block => <BlockCard key={block._id} block={block} />)
```

### Mutation Patterns

```typescript
const createBlock = useMutation(api.blocks.create)
const moveBlock = useMutation(api.blocks.move)

// Fire and forget
await createBlock({ sessionId, content: "Hello", type: "NOTE", zone: "WORKING" })

// With optimistic update (Convex handles this, but you can add local feedback)
const handleCreate = async () => {
  setIsCreating(true)
  try {
    await createBlock({ ... })
    // No need to refetch - Convex updates automatically
  } finally {
    setIsCreating(false)
  }
}
```

### Action Patterns (for side effects)

```typescript
// Actions are for external API calls, not database operations
const checkHealth = useAction(api.claudeNode.checkHealth)

const status = await checkHealth({})
// { ok: true, version: "claude-3-sonnet" }
```

---

## File Structure

```
src/
├── main.tsx                    # App entry, providers
├── index.css                   # Tailwind + theme
├── routes/                     # TanStack Router pages
│   ├── __root.tsx              # Layout (header, DnD, session)
│   ├── index.tsx               # Home page
│   └── blocks/
│       └── $blockId.tsx        # Block editor
├── components/
│   ├── ui/                     # shadcn components
│   │   └── button.tsx
│   ├── dnd/                    # Drag-and-drop
│   │   ├── DndProvider.tsx
│   │   ├── DroppableZone.tsx
│   │   ├── SortableBlock.tsx
│   │   └── BlockDragOverlay.tsx
│   └── GeneratePanel.tsx       # LLM generation UI
├── contexts/
│   └── SessionContext.tsx      # Session state
├── hooks/
│   ├── useFileDrop.ts          # File drop handling
│   ├── useGenerate.ts          # Ollama streaming
│   └── useClaudeGenerate.ts    # Claude streaming
└── lib/
    ├── utils.ts                # cn() helper
    └── positioning.ts          # Fractional positions
```

---

## Common Questions

### "How do I add a new page?"

Create a file in `src/routes/`:

```typescript
// src/routes/settings.tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  return <div>Settings</div>
}
```

The route is automatically registered. Link to it: `<Link to="/settings">Settings</Link>`

### "How do I add global state?"

For server data: Add a Convex table and query it.

For UI state: Create a context:

```typescript
// src/contexts/ThemeContext.tsx
const ThemeContext = createContext<{ theme: string; toggle: () => void }>()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light")
  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme(t => t === "light" ? "dark" : "light") }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

### "How do I add a new shadcn component?"

```bash
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add input
```

Components are copied to `src/components/ui/`.

### "How do I make an API call to an external service?"

Use a Convex action (runs on Node.js), not the frontend:

```typescript
// convex/externalApi.ts
export const fetchWeather = action({
  args: { city: v.string() },
  handler: async (ctx, args) => {
    const response = await fetch(`https://api.weather.com/${args.city}`)
    return response.json()
  },
})

// Frontend
const fetchWeather = useAction(api.externalApi.fetchWeather)
const weather = await fetchWeather({ city: "Tokyo" })
```

### "Where do environment variables go?"

- Frontend: `.env.local` with `VITE_` prefix
- Convex: `npx convex env set KEY value`

```bash
# .env.local (frontend)
VITE_CONVEX_URL=https://your-project.convex.cloud

# Convex dashboard or CLI (backend)
npx convex env set ANTHROPIC_API_KEY sk-...
```

---

## Summary

| Concern | Solution |
|---------|----------|
| Routing | TanStack Router (file-based, type-safe) |
| Server state | Convex `useQuery` / `useMutation` |
| UI state | React Context or component state |
| Caching | Convex (automatic) |
| Real-time | Convex (automatic) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (copy-paste, you own them) |
| Drag-and-drop | dnd-kit |
| LLM streaming | Custom hooks (HTTP for Ollama, Convex for Claude) |

The key insight: **Convex replaces React Query, Redux, and WebSocket setup.** Your frontend becomes simpler because server state management is handled by the platform.
