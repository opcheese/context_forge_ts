# Development Roadmap

## Approach: Vertical Slices

We're building feature-by-feature, not layer-by-layer. Each slice delivers working functionality: schema → Convex functions → UI → tests.

**Why vertical:**
- See working features fast
- Validate decisions early
- Natural fit for Convex's reactive model
- We have the Python version as reference for domain knowledge

---

## Slice 1: Basic Blocks

**Goal:** Create, list, and delete blocks. Minimal viable block management.

### Schema
```typescript
blocks: defineTable({
  content: v.string(),
  type: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

### Convex Functions
- [x] `blocks.list` - Get all blocks
- [x] `blocks.get` - Get single block by ID
- [x] `blocks.create` - Create new block
- [x] `blocks.remove` - Delete block

### UI
- [x] Block list component
- [x] Add block form (content + type)
- [x] Delete button on blocks
- [x] Replace counter demo with blocks demo

### Tests
- [x] E2E tests with test data isolation
- [x] HTTP endpoints for test reset/create

**No zones yet. No tokens yet. Just blocks.**

---

## Slice 2: Zones

**Goal:** Organize blocks into three zones.

### Schema Changes
```typescript
blocks: defineTable({
  // ... existing fields
  zone: v.union(
    v.literal("PERMANENT"),
    v.literal("STABLE"),
    v.literal("WORKING")
  ),
  position: v.number(),  // Order within zone
})
```

### Convex Functions
- [x] `blocks.listByZone` - Get blocks for a zone
- [x] `blocks.move` - Move block to different zone
- [x] `blocks.reorder` - Change position within zone
- [x] Update `create` to accept zone

### UI
- [x] Three-column zone layout
- [x] Zone headers (name only, no token count yet)
- [x] Blocks grouped by zone
- [x] Move block dropdown/buttons

### Tests
- [x] Zone filtering tests
- [x] Move/reorder tests

---

## Slice 3: Drag and Drop

**Goal:** Drag blocks between zones and reorder within zones.

### Dependencies
- Install `@dnd-kit/core` and `@dnd-kit/sortable`
- Reference: [Trellaux example](https://tanstack.com/start/latest/docs/framework/react/examples/start-convex-trellaux)

### UI
- [x] Make blocks draggable
- [x] Make zones drop targets
- [x] Visual drag feedback (DragOverlay)
- [x] Call `move` mutation on cross-zone drop
- [x] Call `reorder` mutation on same-zone drop
- [x] File drop support (.txt, .md)

### Tests
- [x] E2E drag-drop tests

---

## Slice 4: Block Editor

**Goal:** Edit block content and metadata.

### Router
- [x] Configure TanStack Router (file-based routing)
- [x] Route: `/` (zone view)
- [x] Route: `/blocks/:id` (editor)

### UI
- [x] Block editor page
- [x] Edit content textarea
- [x] Change block type
- [x] Save/cancel buttons
- [x] Navigate back to zones

### Convex Functions
- [x] `blocks.update` - Update content/type

---

## Slice 4.5: Sessions

**Goal:** Isolated workspaces for context management and LLM testing.

### Schema
```typescript
sessions: defineTable({
  name: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

// Update blocks to require session
blocks: defineTable({
  sessionId: v.id("sessions"),  // Required
  // ... existing fields
}).index("by_session", ["sessionId"])
  .index("by_session_zone", ["sessionId", "zone", "position"])

// Snapshots for save/restore
snapshots: defineTable({
  sessionId: v.id("sessions"),
  name: v.string(),
  createdAt: v.number(),
  blocks: v.array(v.object({...})),  // Serialized blocks
}).index("by_session", ["sessionId"])
```

### Convex Functions
- [x] `sessions.create` - Create new session
- [x] `sessions.list` - List all sessions
- [x] `sessions.get` - Get session by ID
- [x] `sessions.update` - Rename session
- [x] `sessions.remove` - Delete session (cascade blocks/snapshots)
- [x] `snapshots.create` - Save current state
- [x] `snapshots.list` - List session snapshots
- [x] `snapshots.restore` - Restore from snapshot
- [x] `snapshots.remove` - Delete snapshot
- [x] Update all block functions to require sessionId

### UI
- [x] Session selector in header
- [x] Create new session button
- [x] Session context provider
- [x] All block queries/mutations use current session

### Tests
- [x] E2E tests updated for sessions
- [x] Session switching tests
- [x] HTTP endpoints for test session creation

---

## Slice 5: LLM Integration (Basic Generation)

**Goal:** Connect to LLM providers with streaming generation.

**Status:** ✅ Complete

### LLM Providers
- [x] Ollama (local) - HTTP streaming via `/api/chat`
- [x] Claude Code (subscription) - Convex reactive queries with `stream_event` handling

### Architecture
- [x] Context assembly function (`convex/lib/context.ts`)
- [x] Zone ordering: PERMANENT → STABLE → WORKING → prompt
- [x] HTTP action for Ollama streaming
- [x] Node.js action for Claude Code streaming
- [x] Convex reactive queries for real-time UI updates

### UI
- [x] Generate panel with prompt input
- [x] Provider selection (Ollama/Claude Code)
- [x] Real-time streaming display
- [x] Auto-save to WORKING zone
- [x] Provider health indicators

### Files
- `convex/lib/ollama.ts` - Ollama streaming client
- `convex/lib/context.ts` - Context assembly
- `convex/claudeNode.ts` - Claude Code SDK integration
- `convex/generations.ts` - Generation tracking
- `convex/http.ts` - HTTP endpoints
- `src/hooks/useGenerate.ts` - Ollama streaming hook
- `src/hooks/useClaudeGenerate.ts` - Claude reactive hook
- `src/components/GeneratePanel.tsx` - Generation UI

---

## Slice 5.5: Brainstorming & Advanced Generation

**Goal:** Multi-turn conversations with context, multiple providers, observability.

**Status:** ✅ Complete

### Features
- [x] Multi-turn brainstorming with conversation history
- [x] OpenRouter provider (100+ models via API)
- [x] LangFuse integration for LLM observability
- [x] System prompt blocks (extracted from PERMANENT zone)
- [x] Save brainstorm messages to blocks

### LLM Providers
- Ollama (local) - `/api/brainstorm` endpoint
- Claude Code (subscription) - Convex reactive streaming
- OpenRouter (API) - `/api/openrouter/brainstorm` endpoint

### Files
- `convex/lib/openrouter.ts` - OpenRouter API client
- `convex/lib/langfuse.ts` - LangFuse tracing integration
- `src/hooks/useBrainstorm.ts` - Unified brainstorm hook
- `src/components/BrainstormPanel.tsx` - Brainstorm UI
- `src/components/BrainstormDialog.tsx` - Conversation dialog

---

## Slice 5.6: Workflows, Templates & Projects

**Goal:** Reusable session configurations and multi-step document pipelines.

**Status:** ✅ Complete

**Details:** See [completed/WORKFLOW_SYSTEM_PLAN.md](./completed/WORKFLOW_SYSTEM_PLAN.md)

### Features
- [x] Templates - Save/apply session configurations
- [x] Projects - Organize related sessions
- [x] Workflows - Multi-step document creation pipelines
- [x] Context carry-forward between workflow steps
- [x] Block type rationalization (12 semantic types)

### Files
- `convex/templates.ts` - Template CRUD
- `convex/projects.ts` - Project management
- `convex/workflows.ts` - Workflow management
- `src/routes/templates.tsx` - Template library
- `src/routes/projects.*.tsx` - Project pages
- `src/routes/workflows.*.tsx` - Workflow pages
- `src/lib/blockTypes.ts` - Block type definitions

---

## Slice 5.7: Token Counting & Zone Budgets

**Goal:** Add accurate token counting, zone budgets, and usage tracking.

**Status:** ✅ Complete

**Details:** See [completed/TOKEN_BUDGETS_PLAN.md](./completed/TOKEN_BUDGETS_PLAN.md)

### Features
- [x] Per-block token counting with `js-tiktoken`
- [x] Zone budgets (PERMANENT: 50K, STABLE: 100K, WORKING: 100K, Total: 500K)
- [x] Generation usage tracking (input/output tokens, cost)
- [x] Budget validation queries (`checkBudget`, `getBudgetStatus`)
- [x] UI components (ZoneHeader, BlockTokenBadge, SessionMetrics)
- [x] Warning/danger status at 80%/95% thresholds

### Files
- `convex/lib/tokenizer.ts` - Token counting with js-tiktoken
- `convex/metrics.ts` - Budget queries (getZoneMetrics, checkBudget, getBudgetStatus)
- `src/components/metrics/ZoneHeader.tsx` - Zone header with token display
- `src/components/metrics/BlockTokenBadge.tsx` - Per-block token badge
- `src/components/metrics/SessionMetrics.tsx` - Session metrics panel
- `src/hooks/useBudgetCheck.ts` - Budget checking hook

---

## Slice 6: Polish & Advanced

**Goal:** Refinements based on usage.

- [ ] Theme system (proper provider)
- [ ] Markdown preview in editor
- [ ] Search/filter blocks
- [ ] Block type icons
- [ ] Import/export
- [ ] Compression (if needed)

---

## Current Status

| Slice | Status | Notes |
|-------|--------|-------|
| 0. Project Setup | ✅ Done | Counter demo working |
| 1. Basic Blocks | ✅ Done | CRUD + E2E test isolation |
| 2. Zones | ✅ Done | Three-column layout + move |
| 3. Drag and Drop | ✅ Done | @dnd-kit + file drop |
| 4. Block Editor | ✅ Done | TanStack Router + edit page |
| 4.5. Sessions | ✅ Done | Session isolation + snapshots |
| 5. LLM Integration | ✅ Done | Ollama + Claude Code streaming |
| 5.5. Brainstorming | ✅ Done | Multi-turn, OpenRouter, LangFuse |
| 5.6. Workflows | ✅ Done | Templates, projects, workflows |
| 5.7. Token Budgets | ✅ Done | js-tiktoken, zone budgets, UI |
| 6. Polish | 🔜 Next | Theme system, search, import/export |

---

## Dependency Graph

```
Slice 1: Basic Blocks
        │
        ▼
Slice 2: Zones
        │
        ├────────────────┐
        ▼                ▼
Slice 3: DnD    Slice 4: Editor
        │                │
        └───────┬────────┘
                ▼
     Slice 4.5: Sessions ✅
                │
                ▼
    Slice 5: LLM Integration ✅
                │
        ┌───────┴───────┐
        ▼               ▼
 Slice 5.5:       Slice 5.6:
 Brainstorming ✅  Workflows ✅
        │               │
        └───────┬───────┘
                ▼
   Slice 5.7: Token Budgets ✅
                │
                ▼
       Slice 6: Polish 🔜
```

---

## Notes

### Starting Small
- Slice 1 has no zones, no tokens, no routing
- Just blocks: create, list, delete
- Proves the Convex model works for our domain

### LLM Integration Findings

**Claude Code Streaming:**
- The Claude Agent SDK wraps Anthropic's raw events in `SDKPartialAssistantMessage`
- Events have `type: 'stream_event'` with actual event in `message.event`
- Need to check `event.type === 'content_block_delta'` and `event.delta.type === 'text_delta'`
- `includePartialMessages: true` must be set in options
- Convex actions cannot stream directly - use reactive queries with database writes

**Convex Streaming Pattern:**
1. Mutation creates generation record, returns ID, schedules action
2. Action streams to database via `ctx.runMutation(internal.appendChunk, ...)`
3. Client subscribes via `useQuery(api.generations.get, { generationId })`
4. React effect detects text changes and calls `onChunk` callbacks

### Token Counting Implementation
Token counting is implemented with `js-tiktoken`:
- Pure JS implementation (no WASM required)
- Compatible with Convex actions and mutations
- Matches Python's `tiktoken` accuracy
- ~100KB bundle size
- Cached encoding instances for performance

See [completed/TOKEN_BUDGETS_PLAN.md](./completed/TOKEN_BUDGETS_PLAN.md) for implementation details.
