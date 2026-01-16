# Development Progress

## Session 1: Project Initialization

### Context

This is a greenfield rewrite of ContextForge, originally a Python (FastAPI) backend + React frontend application for managing LLM context windows. The goal is to simplify the architecture using modern TypeScript tooling.

### Decisions Made

#### 1. Backend: Convex over FastAPI

**Decision:** Replace Python/FastAPI backend with Convex.

**Rationale:**
- Pure TypeScript stack (no Python ↔ TypeScript type gap)
- Real-time sync built-in (no manual cache invalidation)
- Server-side logic with guaranteed consistency
- Zero infrastructure management
- Simpler architecture (fewer moving parts)

**Trade-offs:**
- Vendor lock-in to Convex
- Less control over database queries
- Learning curve for team

#### 2. State Management: Convex Only (No Zustand)

**Decision:** Use Convex's `useQuery`/`useMutation` for all server state. Use React's `useState`/`useContext` for UI-only state.

**Rationale:**
- Convex handles reactivity automatically
- No need for Zustand's client-side store
- Simpler mental model
- Fewer dependencies

**What this means:**
- No Zustand
- No React Query wrapper around Convex
- Server is the source of truth

#### 3. Routing: TanStack Router (Client-Side SPA)

**Decision:** Use TanStack Router for client-side routing, not TanStack Start (SSR).

**Rationale:**
- Simpler than SSR setup
- Context management tool doesn't need SEO
- Type-safe routing is the main benefit we want
- Can add SSR later if needed

#### 4. Styling: Tailwind v4 + shadcn/ui

**Decision:** Use Tailwind CSS v4 with shadcn/ui components.

**Rationale:**
- Tailwind v4 is the latest with better performance
- shadcn/ui provides copy-paste components (not npm dependency)
- Good defaults, easy to customize

#### 5. Testing: Vitest + Playwright

**Decision:** Vitest for unit/integration tests, Playwright for E2E.

**Rationale:**
- Vitest is fast and Vite-native
- Playwright is modern and reliable
- Convex provides `convex-test` for backend function testing

#### 6. Package Manager: pnpm

**Decision:** Use pnpm over npm/yarn.

**Rationale:**
- Faster installs
- Disk-efficient (symlinked packages)
- Strict by default

---

### Accomplishments

#### Project Setup
- [x] Initialized Vite + React + TypeScript project
- [x] Configured Tailwind CSS v4 with Vite plugin
- [x] Initialized shadcn/ui with button component
- [x] Added path alias (`@/` → `src/`)
- [x] Set up dark mode toggle (basic implementation)

#### Convex Integration
- [x] Installed and configured Convex
- [x] Created database schema (`counters` table)
- [x] Implemented queries: `list`, `get`
- [x] Implemented mutations: `create`, `increment`, `decrement`, `reset`
- [x] Wired up ConvexProvider in React
- [x] Built counter demo UI showing real-time sync

#### Testing Setup
- [x] Configured Vitest with jsdom environment
- [x] Added @testing-library/react and jest-dom
- [x] Created sample component test
- [x] Configured Playwright for E2E tests
- [x] Created sample E2E test specs

#### Code Quality
- [x] Configured ESLint with TypeScript and React rules
- [x] Added Prettier with eslint-config-prettier
- [x] Set up .prettierrc and .prettierignore
- [x] Fixed ESLint conflicts with shadcn exports

#### Documentation
- [x] Created ARCHITECTURE.md with design decisions
- [x] Created REFERENCES.md with useful links
- [x] Created STRUCTURE.md with repo layout
- [x] Created PROGRESS.md (this file)
- [x] Updated README.md with project overview

#### Configuration
- [x] Created .env.example template
- [x] Updated .gitignore for Convex, Playwright, etc.
- [x] Added npm scripts for all common tasks

---

### Current State

The project is fully initialized and ready for feature development:

```bash
pnpm lint      # ✓ Passes
pnpm test:run  # ✓ 2 tests pass
pnpm build     # ✓ Builds successfully
```

**Working features:**
- Counter demo with real-time Convex sync
- Dark/light theme toggle
- shadcn/ui button variants
- Tailwind styling

**Not yet implemented:**
- TanStack Router (installed, not configured)
- Zone management (core feature)
- Block CRUD operations
- Token counting
- LLM integration

---

### Next Steps

1. **Configure TanStack Router** - Set up file-based routing
2. **Design block schema** - Define the blocks table in Convex
3. **Build zone layout** - Three-panel UI for zones
4. **Implement block CRUD** - Create, read, update, delete blocks
5. **Add drag-and-drop** - Move blocks between zones
6. **Token counting** - Server-side token calculation

---

### Open Questions

1. **Token counting library** - `gpt-tokenizer` vs `tiktoken` WASM?
2. **Auth requirements** - Multi-user or single-user for MVP?
3. **Compression** - Still needed with Convex storage?
4. **Theme implementation** - Current toggle is a hack; proper provider needed?

---

### Session Notes

- Convex local dev runs on `http://127.0.0.1:3210`
- Dashboard available at URL shown by `convex dev`
- Tailwind v4 uses `@import "tailwindcss"` syntax
- shadcn/ui v4 uses `@tailwindcss/vite` plugin

---

## Session 2: Roadmap Planning

### Decisions Made

#### 7. Development Approach: Vertical Slices

**Decision:** Build feature-by-feature (vertical), not layer-by-layer (horizontal).

**Rationale:**
- See working features fast
- Validate decisions early
- Natural fit for Convex's reactive model
- We have Python version as domain reference (not discovering requirements)

**Contrast with original:**
The Python version started with the core library (horizontal). For TypeScript/Convex, vertical makes more sense because:
- Convex tightly couples schema, functions, and UI
- Real-time sync means the UI is immediate feedback
- Less upfront planning, more iteration

#### 8. Token Counting: Deferred to LLM Integration

**Decision:** Don't implement token counting until Slice 5 (LLM integration).

**Rationale:**
- Start simpler (no external library dependencies yet)
- Token counting is most valuable when actually using LLMs
- Integration will be a test case for adapting non-Convex libraries

**Risk acknowledged:**
- Existing Python solution uses `tiktoken`/`litellm`
- These may not work in Convex runtime
- Will need to evaluate JS alternatives when we get there
- Documented as intentional integration test

### Accomplishments

- [x] Decided on vertical slice approach
- [x] Created detailed ROADMAP.md with 6 slices
- [x] Defined Slice 1: Basic Blocks (minimal scope)
- [x] Documented token counting deferral and challenges
- [x] Established dependency graph between slices

### Slice Plan

| Slice | Focus | Key Additions |
|-------|-------|---------------|
| 1 | Basic Blocks | Schema, CRUD, list UI |
| 2 | Zones | Zone field, three-column layout |
| 3 | Drag and Drop | @dnd-kit, move/reorder |
| 4 | Block Editor | TanStack Router, edit page |
| 5 | LLM + Tokens | Token counting, chat, streaming |
| 6 | Polish | Theme, search, import/export |

### Next: Slice 1

Starting with the simplest possible blocks implementation:
- No zones
- No tokens
- No routing
- Just: create, list, delete

See [ROADMAP.md](./ROADMAP.md) for full details.

---

## Session 3: Slice 1 - Basic Blocks

### Accomplishments

#### Blocks Implementation
- [x] Created blocks schema with `content`, `type`, `createdAt`, `updatedAt`
- [x] Implemented Convex functions: `list`, `get`, `create`, `remove`
- [x] Built BlocksDemo UI with AddBlockForm, BlockCard, BlockList
- [x] Real-time sync working (blocks appear/disappear instantly)

#### E2E Test Isolation
- [x] Added `testData` field to schema for marking test records
- [x] Updated `create` mutation to accept optional `testData` flag
- [x] Created `convex/testing.ts` with reset functions
- [x] Created `convex/http.ts` with HTTP endpoints:
  - `POST /testing/reset` - Deletes all test data
  - `POST /testing/blocks` - Creates blocks with `testData: true`
- [x] Updated E2E tests with proper isolation:
  - Global setup resets test data before all tests
  - Serial execution for Blocks tests (avoids parallel interference)
  - Cleanup after test suite completes
- [x] Reset logic deletes blocks where `testData === true` OR content starts with `"E2E Test:"`

### Decisions Made

#### 9. E2E Test Data Isolation Strategy

**Decision:** Use a combination of approaches for test isolation:
1. `testData` boolean field on records
2. Content pattern matching (`"E2E Test:"` prefix)
3. HTTP endpoints for reset operations
4. Serial test execution within the Blocks suite

**Rationale:**
- `testData` field allows API-created test data to be tracked
- Content pattern matching catches UI-created blocks in tests
- HTTP endpoints enable reset from Playwright (can't call internal mutations)
- Serial execution prevents parallel test interference with shared data

**Key URLs (local dev):**
- Convex WebSocket API: `http://127.0.0.1:3210`
- Convex HTTP Actions: `http://127.0.0.1:3211`

### Current State

```bash
pnpm lint           # ✓ Passes
pnpm test:run       # ✓ Passes
pnpm playwright test # ✓ 5 tests pass
pnpm build          # ✓ Builds successfully
```

**Working features:**
- Block CRUD (create, list, delete)
- Real-time sync via Convex
- E2E tests with proper isolation
- Dark/light theme toggle

---

## Session 4: Slice 2 - Zones

### Accomplishments

#### Schema Updates
- [x] Added `zone` field with union type (PERMANENT, STABLE, WORKING)
- [x] Added `position` field for ordering within zones
- [x] Added `by_zone` index for efficient zone queries

#### Convex Functions
- [x] `listByZone` - Query blocks by zone, ordered by position
- [x] `move` - Move block to different zone (auto-assigns position)
- [x] `reorder` - Change position within zone (shifts other blocks)
- [x] Updated `create` to accept zone (defaults to WORKING)

#### UI
- [x] Three-column zone layout (Permanent, Stable, Working)
- [x] Zone headers with descriptions
- [x] Move buttons on each block (→ Permanent, → Stable, → Working)
- [x] Block count per zone
- [x] Zone selector in Add Block form

#### Tests
- [x] Updated E2E tests for zone-based layout
- [x] Test for moving blocks between zones
- [x] Test for creating blocks in different zones
- [x] Updated HTTP endpoint to support zone parameter

### Current State

```bash
pnpm lint           # ✓ Passes
pnpm test:run       # ✓ Passes
pnpm playwright test # ✓ 6 tests pass
pnpm build          # ✓ Builds successfully
```

**Working features:**
- Block CRUD with zone assignment
- Three-column zone layout
- Move blocks between zones via buttons
- Real-time sync across all zones
- E2E tests with proper isolation

---

## Session 5: Slice 3 - Drag and Drop

### Accomplishments

#### @dnd-kit Integration
- [x] Installed @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- [x] Created DndProvider with PointerSensor (8px threshold) + KeyboardSensor
- [x] Created SortableBlock component (useSortable wrapper)
- [x] Created DroppableZone component (useDroppable + SortableContext)
- [x] Created BlockDragOverlay for ghost preview during drag
- [x] Implemented closestCenter collision detection

#### Fractional Positioning
- [x] Created positioning utilities in `src/lib/positioning.ts`
- [x] Simplified `reorder` mutation to just update position (O(1))
- [x] No shifting of other blocks required

#### File Drop Support
- [x] Created useFileDrop hook for native HTML5 file drops
- [x] Supports .txt and .md files
- [x] Visual overlay when dragging files over zones
- [x] Maps zone to default block type (PERMANENT→SYSTEM, others→NOTE)

#### Architecture
```
src/
├── components/dnd/
│   ├── DndProvider.tsx      # DndContext + sensors + handlers
│   ├── SortableBlock.tsx    # useSortable wrapper
│   ├── DroppableZone.tsx    # useDroppable + SortableContext
│   ├── BlockDragOverlay.tsx # Ghost preview
│   ├── types.ts             # DragData types
│   └── index.ts             # Exports
├── hooks/
│   └── useFileDrop.ts       # Native file drop
└── lib/
    └── positioning.ts       # Fractional ordering
```

### Decisions Made

#### 10. Drag and Drop Library Choice

**Decision:** Use @dnd-kit over native HTML5 drag and drop.

**Rationale:**
- Touch/mobile support built-in
- Accessibility (keyboard navigation, screen reader announcements)
- DragOverlay for smooth visual feedback
- Sensors system for activation constraints
- Existing ContextForge already uses it (familiarity)

#### 11. Fractional Positioning

**Decision:** Use fractional ordering instead of index-based positioning.

**Rationale:**
- O(1) position updates (no shifting other blocks)
- Simpler Convex mutations
- Natural for real-time (no race conditions)
- Example: Insert between 1.0 and 2.0 → position 1.5

**Trade-off:** Eventually may need normalization if positions get too fragmented, but this is rare in practice.

### Current State

```bash
pnpm lint           # ✓ Passes
pnpm test:run       # ✓ Passes
pnpm playwright test # ✓ 10 tests pass
pnpm build          # ✓ Builds successfully
```

**Working features:**
- Drag blocks to reorder within zones
- Drag blocks between zones
- Drop .txt/.md files to create blocks
- Visual feedback (ghost overlay, drop zone highlighting)
- Keyboard accessibility

---

## Session 6: Slice 4 - Block Editor

### Accomplishments

#### TanStack Router Setup
- [x] Configured file-based routing with TanStack Router
- [x] Created route tree (`src/routeTree.gen.ts`)
- [x] Set up routes: `/` (home), `/blocks/$blockId` (editor)
- [x] Replaced App.tsx with router-based layout

#### Block Editor Page
- [x] Created BlockEditor component at `/blocks/:id`
- [x] Edit content with auto-resizing textarea
- [x] Change block type via dropdown
- [x] Save/Cancel buttons
- [x] Navigate back to zones view

#### Convex Functions
- [x] `blocks.update` - Update content and type
- [x] Proper index usage for efficient queries

---

## Session 7: Slice 4.5 - Sessions

### Accomplishments

#### Session Management
- [x] Created sessions schema with name, createdAt, updatedAt
- [x] Updated blocks schema to require `sessionId`
- [x] Added indexes: `by_session`, `by_session_zone`
- [x] Created session CRUD functions

#### Convex Functions
- [x] `sessions.create` - Create new session
- [x] `sessions.list` - List all sessions
- [x] `sessions.get` - Get session by ID
- [x] `sessions.rename` - Rename session
- [x] `sessions.remove` - Delete session (cascades blocks/snapshots)
- [x] Updated all block functions to require sessionId

#### Snapshots
- [x] Created snapshots schema for state save/restore
- [x] `snapshots.create` - Serialize current blocks
- [x] `snapshots.list` - List session snapshots
- [x] `snapshots.restore` - Restore blocks from snapshot
- [x] `snapshots.remove` - Delete snapshot

#### UI
- [x] Session selector in header
- [x] Create new session button
- [x] Session context provider
- [x] All queries/mutations use current session

---

## Session 8: Slice 5 - LLM Integration

### Accomplishments

#### Ollama Integration
- [x] Created `convex/lib/ollama.ts` - Streaming client for local Ollama
- [x] HTTP streaming endpoint `/api/chat`
- [x] Real-time text streaming via Server-Sent Events
- [x] Auto-save generated content to WORKING zone

#### Claude Code Integration
- [x] Created `convex/claudeNode.ts` - Node.js action for Claude Agent SDK
- [x] Discovered SDK wraps events in `SDKPartialAssistantMessage`
- [x] Fixed streaming by checking `type: 'stream_event'` then `event.type`
- [x] `includePartialMessages: true` enables token-level streaming
- [x] Created `convex/generations.ts` for tracking generation state

#### Context Assembly
- [x] Created `convex/lib/context.ts`
- [x] Zone ordering: PERMANENT → STABLE → WORKING → prompt
- [x] System prompt handling
- [x] Message formatting for LLM APIs

#### Convex Streaming Pattern (Key Finding)
Convex actions cannot stream HTTP responses directly. Solution:
1. Mutation creates generation record, returns ID, schedules action
2. Action streams text to database via `ctx.runMutation(internal.appendChunk, ...)`
3. Client subscribes via `useQuery(api.generations.get, { generationId })`
4. React effect detects text changes and triggers `onChunk` callbacks

#### UI
- [x] GeneratePanel component with prompt input
- [x] Provider selector (Ollama/Claude Code)
- [x] Real-time streaming display
- [x] Stop button for cancellation
- [x] Provider health indicators

#### Hooks
- [x] `useGenerate.ts` - Ollama HTTP streaming
- [x] `useClaudeGenerate.ts` - Convex reactive queries

### Decisions Made

#### 12. Claude Code Streaming Architecture

**Decision:** Use Convex reactive queries instead of HTTP streaming for Claude Code.

**Rationale:**
- Claude Agent SDK is a Node.js library, requires `"use node"` action
- Convex actions cannot return streaming HTTP responses
- Convex's real-time subscription is naturally suited for this
- Database acts as streaming buffer, client subscribes to updates

**Trade-off:**
- More database writes (one per chunk batch)
- Slight latency vs. direct streaming (~50ms throttle)
- But: Works reliably, leverages Convex strengths

#### 13. Stream Event Handling

**Key Discovery:** The Claude Agent SDK's `query()` function with `includePartialMessages: true` yields `SDKPartialAssistantMessage` objects with:
- `type: 'stream_event'`
- `event: BetaRawMessageStreamEvent` (contains actual `content_block_delta`)

The Python SDK's `ClaudeSDKClient.receive_messages()` yields similar `StreamEvent` objects. The TypeScript equivalent is checking for `message.type === 'stream_event'` then accessing `message.event`.

### Current State

```bash
pnpm lint           # ✓ Passes
pnpm build          # ✓ Builds successfully
```

**Working features:**
- Ollama streaming generation (local LLM)
- Claude Code streaming generation (subscription)
- Context assembly from zones
- Auto-save to WORKING zone
- Real-time streaming display
- Provider health checks

### Next: Slice 5.5 - Token Counting & Zone Budgets

See [TOKEN_BUDGETS_PLAN.md](./TOKEN_BUDGETS_PLAN.md) for implementation plan.
