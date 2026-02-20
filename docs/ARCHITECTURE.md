# Architecture

Technical design and decisions for ContextForge TypeScript.

## Design Principles

1. **Simple over overengineered** - Fewer moving parts, less abstraction
2. **Server-side logic** - Core business logic runs on Convex
3. **Real-time by default** - Convex provides automatic state synchronization
4. **Type-safe throughout** - End-to-end TypeScript from database to UI

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | Convex | Database, real-time sync, server functions |
| **App Frontend** | React 19 | UI components (served at `/app/`) |
| **Public Site** | Astro 5 | Landing page, blog, legal pages (static HTML for SEO) |
| **Routing** | TanStack Router | Type-safe client-side routing (app) |
| **Drag-and-Drop** | @dnd-kit | Accessible DnD with keyboard support |
| **Styling** | Tailwind CSS v4 | Utility-first CSS (shared tokens across app and site) |
| **Components** | shadcn/ui | Copy-paste component library |
| **Blog** | Astro Content Collections + MDX | Static blog with RSS and sitemap |
| **Testing** | Vitest + Playwright | Unit + E2E |
| **Hosting** | Vercel | Static site + SPA, single project |
| **Package Manager** | pnpm | Fast, disk-efficient |

### What We're NOT Using

| Technology | Reason |
|------------|--------|
| Zustand | Convex handles server state reactively |
| React Query | Convex's `useQuery`/`useMutation` provide caching |
| Vercel AI SDK | Claude Code uses subprocess protocol, not HTTP |
| Redux | Overkill for our needs |

---

## Two-Framework Architecture (Astro + Vite)

### Why Two Frameworks?

ContextForge has two distinct audiences with different technical requirements:

| Audience | Content | Requirement |
|----------|---------|-------------|
| **Visitors** (landing, blog) | Marketing pages, blog posts | Static HTML for SEO — Google indexes real HTML, not JS-rendered SPAs |
| **Users** (app) | Interactive workspace | Client-side routing, real-time Convex subscriptions, drag-and-drop |

A single React SPA cannot serve both: SPAs render an empty `<div id="root"></div>` to crawlers, making them invisible to search engines. Astro generates static HTML at build time while supporting interactive React "islands" for components that need JavaScript (animations, drag demos).

### URL Structure

```
convexforgets.com/              → Astro static HTML (landing page)
convexforgets.com/blog/*        → Astro static HTML (MDX blog posts)
convexforgets.com/privacy/      → Astro static HTML
convexforgets.com/terms/        → Astro static HTML
convexforgets.com/rss.xml       → Astro RSS feed
convexforgets.com/app/*         → Vite SPA (React 19 + TanStack Router)
```

### Build Pipeline

The build is a two-stage process. Vite builds first, Astro second:

```
Step 1: pnpm build (Vite)
├── Compiles React SPA (src/) with base: "/app/"
├── Outputs to site/public/app/
│   ├── index.html          ← SPA entry point
│   └── assets/             ← JS/CSS bundles (hashed filenames)
│
Step 2: cd site && pnpm build (Astro)
├── Copies site/public/ (including app/) into site/dist/
├── Builds all .astro pages into site/dist/
│   ├── index.html          ← Landing page
│   ├── blog/*/index.html   ← Blog posts
│   ├── privacy/index.html
│   ├── terms/index.html
│   ├── 404.html
│   └── app/                ← SPA files (copied from public/)
│       ├── index.html
│       └── assets/
│
Final output: site/dist/       ← Everything Vercel deploys
```

### How Vercel Serves It

Vercel deploys `site/dist/` as a static site with one rewrite rule in `vercel.json`:

```json
{
  "rewrites": [{ "source": "/app/(.*)", "destination": "/app/index.html" }]
}
```

This means:
- `/` → `index.html` (Astro landing page, static HTML)
- `/blog/my-post/` → `blog/my-post/index.html` (Astro blog post, static HTML)
- `/app/` → `app/index.html` (SPA loads, TanStack Router takes over)
- `/app/settings` → `app/index.html` (rewrite rule, SPA handles client-side routing)
- `/app/login` → `app/index.html` (rewrite rule, SPA renders login page)

### Local Development

In development, the SPA and Astro site run as separate servers:

```bash
pnpm dev:all    # Runs all three concurrently:
                # ├── Vite SPA      → localhost:5173/app/
                # ├── Astro site    → localhost:4321/
                # └── Convex dev    → backend
```

This is different from production where everything is one domain. Links between the
site and app (e.g., "Get Started" → `/app/login`) work in production but cross ports
in development.

For production-like local testing with proper SPA rewrites:

```bash
pnpm preview    # Builds everything, serves at localhost:3000
                # Uses serve.json for /app/* → /app/index.html rewrite
```

### React Islands in Astro

Astro pages are static HTML by default. Interactive React components are loaded as
"islands" — only the JavaScript needed for that component is shipped to the browser:

```astro
<!-- site/src/pages/index.astro -->

<!-- Loads immediately (above fold, needs animation on page load) -->
<HeroAnimated client:load />

<!-- Loads when scrolled into view (below fold, saves initial bundle) -->
<FeatureCards client:visible />
<BeforeAfter client:visible />
<StepsSection client:visible />
<HeroZoneDemo client:visible />
```

These React islands are server-rendered during build (HTML is in the static output)
and then hydrated client-side when their load condition is met.

### Shared Styling

Both the SPA and Astro site use Tailwind CSS v4 with the same design tokens (oklch
color space). The CSS config is duplicated between:

- `src/index.css` — SPA styles (includes `tw-animate-css` for shadcn animations)
- `site/src/styles/global.css` — Astro site styles (includes `@tailwindcss/typography` for blog prose)

Both use `@theme inline` blocks with identical CSS custom properties (`:root` and `.dark`),
so colors, fonts, and spacing are consistent across the landing page and app.

### SEO Infrastructure

The Astro site includes:

- **Sitemap** — auto-generated by `@astrojs/sitemap`, excludes `/app/` routes
- **RSS feed** — `/rss.xml` with blog post entries
- **robots.txt** — allows crawling of public pages, blocks `/app/`
- **JSON-LD** — `WebApplication` schema on all pages, `BlogPosting` schema on blog posts
- **Open Graph / Twitter Cards** — meta tags for social sharing with OG image
- **Canonical URLs** — prevents duplicate content issues
- **Trailing slashes** — enforced via `trailingSlash: "always"` config

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  React Components                                                  │  │
│  │  ├── ZoneLayout (drag-and-drop zones)                             │  │
│  │  ├── BlockCard (content blocks)                                   │  │
│  │  ├── GeneratePanel (LLM generation)                               │  │
│  │  └── BlockEditor (edit content)                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Hooks                                                             │  │
│  │  ├── useGenerate (Ollama HTTP streaming)                          │  │
│  │  ├── useClaudeGenerate (Convex reactive streaming)                │  │
│  │  └── useFileDrop (file drag-and-drop)                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  State                                                             │  │
│  │  ├── useQuery(api.*) → Server data (blocks, sessions)             │  │
│  │  ├── useMutation(api.*) → Server mutations                        │  │
│  │  └── useState/useContext → UI-only state                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    WebSocket (real-time) + HTTP (streaming)
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                           Convex Backend                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  Queries        │  │  Mutations      │  │  Actions                │  │
│  │  (reads)        │  │  (writes)       │  │  (side effects)         │  │
│  │                 │  │                 │  │                         │  │
│  │  blocks.list    │  │  blocks.create  │  │  claudeNode.stream      │  │
│  │  sessions.get   │  │  blocks.move    │  │  (Node.js runtime)      │  │
│  │  generations.get│  │  generations.*  │  │                         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  HTTP Actions (httpAction)                                          ││
│  │  ├── POST /api/chat → Ollama streaming                              ││
│  │  ├── GET /api/health/ollama → Provider health check                 ││
│  │  └── POST /testing/* → E2E test utilities                           ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                           Convex Database                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐│
│  │  sessions   │ │  blocks     │ │  snapshots  │ │  generations        ││
│  │  (workspaces)│ │  (content)  │ │  (backups)  │ │  (LLM streaming)    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                          External Services                               │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │  Ollama (localhost:11434)   │  │  Claude Code CLI (subprocess)   │   │
│  │  HTTP API                   │  │  stdin/stdout protocol          │   │
│  └─────────────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```typescript
// convex/schema.ts

sessions: defineTable({
  name: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

blocks: defineTable({
  sessionId: v.id("sessions"),
  content: v.string(),
  type: v.string(),                    // "NOTE", "SYSTEM_MESSAGE", etc.
  zone: v.union(
    v.literal("PERMANENT"),
    v.literal("STABLE"),
    v.literal("WORKING")
  ),
  position: v.number(),                // Fractional for O(1) reordering
  createdAt: v.number(),
  updatedAt: v.number(),
  testData: v.optional(v.boolean()),   // For E2E test isolation
})
  .index("by_session", ["sessionId"])
  .index("by_session_zone", ["sessionId", "zone", "position"])

snapshots: defineTable({
  sessionId: v.id("sessions"),
  name: v.string(),
  createdAt: v.number(),
  blocks: v.array(v.object({...})),    // Serialized blocks
})
  .index("by_session", ["sessionId"])

generations: defineTable({
  sessionId: v.id("sessions"),
  provider: v.string(),                // "ollama" | "claude"
  status: v.union(
    v.literal("streaming"),
    v.literal("complete"),
    v.literal("error")
  ),
  text: v.string(),                    // Accumulated streamed text
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_session", ["sessionId", "createdAt"])
```

---

## LLM Integration

### Why Not Vercel AI SDK?

We evaluated Vercel AI SDK but chose not to use it:

| Aspect | Vercel AI SDK | Our Approach |
|--------|---------------|--------------|
| Ollama | ✅ Works via OpenAI adapter | Direct HTTP (simpler) |
| Claude Code | ❌ Not supported | Claude Agent SDK |
| Streaming | HTTP-based | Ollama: HTTP, Claude: Convex reactive |
| Dependencies | +3 packages | 0 new packages |

**Key reason:** Claude Code is NOT an HTTP API. It's the Claude Code CLI that communicates via subprocess stdin/stdout. Vercel AI SDK doesn't support this protocol.

### Two Providers, Two Patterns

#### Ollama: HTTP Streaming

```
┌──────────┐     HTTP POST      ┌──────────────┐     HTTP      ┌────────┐
│ Frontend │ ──────────────────►│ Convex HTTP  │ ─────────────►│ Ollama │
│          │                    │ Action       │               │        │
│          │◄─── SSE stream ────│              │◄── stream ────│        │
└──────────┘                    └──────────────┘               └────────┘
```

```typescript
// Frontend: useGenerate hook
const response = await fetch("/api/chat", {
  method: "POST",
  body: JSON.stringify({ sessionId, prompt }),
})
const reader = response.body.getReader()
// Read SSE chunks...
```

```typescript
// Backend: convex/http.ts
http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Stream from Ollama, pipe to response
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" }
    })
  }),
})
```

#### Claude Code: Convex Reactive Streaming

Claude Code requires a Node.js runtime (subprocess spawning), and Convex Node actions cannot return streaming HTTP responses. Solution: **database-backed streaming**.

```
┌──────────┐  1. mutation   ┌────────────┐
│ Frontend │ ──────────────►│ Convex     │
│          │                │ Mutation   │
│          │                │            │──► Creates generation record
│          │                │            │──► Schedules Node action
│          │                └────────────┘
│          │                      │
│          │                      ▼
│          │               ┌────────────┐      ┌─────────────┐
│          │               │ Node       │      │ Claude Code │
│          │               │ Action     │◄────►│ CLI         │
│          │               │            │      │ (subprocess)│
│          │               └────────────┘      └─────────────┘
│          │                      │
│          │                      │ writes chunks via mutation
│          │                      ▼
│          │               ┌────────────┐
│          │  2. subscribe │ generations│
│          │◄──────────────│ table      │
│          │  useQuery()   │            │
└──────────┘               └────────────┘
```

```typescript
// Frontend: useClaudeGenerate hook
const generation = useQuery(api.generations.get, { generationId })

useEffect(() => {
  if (generation?.text !== prevText) {
    const chunk = generation.text.slice(prevText.length)
    onChunk(chunk) // Real-time updates via Convex reactivity
  }
}, [generation])
```

```typescript
// Backend: convex/claudeNode.ts
export const streamGenerateWithContext = action({
  "use node",
  handler: async (ctx, args) => {
    for await (const message of claudeQuery({ prompt, options })) {
      if (message.type === "stream_event") {
        const event = message.event
        if (event.type === "content_block_delta") {
          buffer += event.delta.text
          await ctx.runMutation(internal.generations.appendChunk, {
            generationId: args.generationId,
            chunk: buffer,
          })
        }
      }
    }
  },
})
```

### Claude Agent SDK Details

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is different from the Anthropic API:

| Aspect | Anthropic API | Claude Agent SDK |
|--------|---------------|------------------|
| Protocol | HTTP REST | Subprocess stdin/stdout |
| Auth | API key | CLI session token |
| Package | `@anthropic-ai/sdk` | `@anthropic-ai/claude-agent-sdk` |
| Streaming | HTTP SSE | `SDKPartialAssistantMessage` |

**Key streaming detail:** The SDK's `query()` function with `includePartialMessages: true` yields messages with:
- `type: 'stream_event'`
- `event: BetaRawMessageStreamEvent` (contains `content_block_delta`)

```typescript
// Correct pattern for streaming
for await (const message of claudeQuery({ prompt, options: { includePartialMessages: true } })) {
  if (message.type === "stream_event") {
    const event = message.event
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      // This is the actual text chunk
      buffer += event.delta.text
    }
  }
}
```

---

## Context Assembly

Blocks are assembled into LLM messages with specific zone ordering for optimal cache utilization:

```typescript
// convex/lib/context.ts

export function assembleContext(
  blocks: Doc<"blocks">[],
  userPrompt: string,
  systemPrompt?: string
): ContextMessage[] {
  // 1. PERMANENT zone → system message (best cache hits)
  // 2. Optional system prompt override
  // 3. STABLE zone → user context
  // 4. WORKING zone → recent context
  // 5. User prompt (always last)
}
```

Zone order matters for LLM prefix caching:
- Content that appears first and doesn't change gets cached
- PERMANENT zone is ideal for system prompts, tool definitions
- STABLE zone for reference material that rarely changes
- WORKING zone for active content that changes frequently

---

## Drag-and-Drop

Using @dnd-kit for accessible drag-and-drop:

```
src/components/dnd/
├── DndProvider.tsx       # Context + sensors + handlers
├── SortableBlock.tsx     # useSortable wrapper for blocks
├── DroppableZone.tsx     # useDroppable + SortableContext
├── BlockDragOverlay.tsx  # Visual ghost during drag
└── types.ts              # DragData types
```

**Fractional positioning:** Instead of shifting all positions on reorder (O(n)), we use fractional positions (O(1)):

```typescript
// Insert between position 1.0 and 2.0 → new position 1.5
export function getPositionBetween(before: number | null, after: number | null): number
```

---

## State Management

| State Type | Solution | Example |
|------------|----------|---------|
| Server data | `useQuery(api.*)` | Blocks, sessions |
| Server mutations | `useMutation(api.*)` | Create, update, delete |
| UI-only | `useState` | Dialog open state |
| Shared UI | `useContext` | Current session |

No external state management libraries needed.

---

## Testing Strategy

### Unit Tests (Vitest)

```bash
pnpm test:run
```

Component tests in `src/test/`. Uses jsdom environment.

### E2E Tests (Playwright)

```bash
pnpm test:e2e
```

Tests in `e2e/`. Test data isolation via:
- `testData: true` flag on records
- HTTP endpoints for reset: `POST /testing/reset`
- Content prefix matching: `"E2E Test:"`

---

## File Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `BlockCard.tsx` |
| Hooks | camelCase, `use` prefix | `useGenerate.ts` |
| Convex functions | camelCase | `blocks.ts` |
| Routes | kebab-case or `$param` | `blocks/$blockId.tsx` |
| Tests | `.test.tsx` or `.spec.ts` | `app.spec.ts` |

Import alias: `@/` → `src/`

```typescript
import { Button } from "@/components/ui/button"
```

---

## Key Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Convex over FastAPI | Pure TypeScript, real-time built-in |
| 2 | No Zustand | Convex handles server state |
| 3 | TanStack Router | Type-safe, file-based routing |
| 4 | @dnd-kit | Accessibility, touch support |
| 5 | Fractional positions | O(1) reorder operations |
| 6 | No Vercel AI SDK | Claude Code uses subprocess protocol |
| 7 | Database-backed streaming | Convex Node actions can't stream HTTP |
| 8 | Two streaming patterns | HTTP for Ollama, reactive for Claude |

See [Progress](./PROGRESS.md) for detailed decision rationales.
