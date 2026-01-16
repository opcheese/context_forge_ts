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
- [ ] Make blocks draggable
- [ ] Make zones drop targets
- [ ] Visual drag feedback
- [ ] Call `move` mutation on cross-zone drop
- [ ] Call `reorder` mutation on same-zone drop

### Tests
- [ ] E2E drag-drop test

---

## Slice 4: Block Editor

**Goal:** Edit block content and metadata.

### Router
- [ ] Configure TanStack Router
- [ ] Route: `/` (zone view)
- [ ] Route: `/blocks/:id` (editor)

### UI
- [ ] Block editor page
- [ ] Edit content textarea
- [ ] Change block type
- [ ] Save/cancel buttons
- [ ] Navigate back to zones

### Convex Functions
- [ ] `blocks.update` - Update content/type

---

## Slice 5: LLM Integration + Token Counting

**Goal:** Connect to LLM providers. Add token counting.

### Token Counting (Deferred to Here)

> **IMPORTANT:** Token counting is intentionally deferred to this slice.
>
> **Why:** The existing Python implementation uses `tiktoken` and `litellm` which weren't designed for Convex. Integrating token counting will be a test of how well we can adapt existing solutions to the Convex model.
>
> **Challenges to solve:**
> - Token libraries may not work in Convex runtime (Node.js subset)
> - May need WASM-based tokenizer or pure JS implementation
> - Server-side counting in mutations vs. client-side estimation
> - Caching token counts vs. recomputing
>
> **Options to evaluate:**
> - `gpt-tokenizer` (pure JS, ~50KB)
> - `js-tiktoken` (lighter tiktoken port)
> - `tiktoken` (official, WASM, larger)
> - API-based counting (latency concerns)
>
> **Decision will be made when we reach this slice.**

### Schema Changes
```typescript
blocks: defineTable({
  // ... existing fields
  tokens: v.number(),  // Add token count
})
```

### Convex Functions
- [ ] Token counting utility
- [ ] Update `create` to compute tokens
- [ ] Update `update` to recompute tokens
- [ ] `context.assemble` - Build context string from blocks

### LLM Integration
- [ ] Provider configuration (env vars)
- [ ] HTTP action for chat/streaming
- [ ] Vercel AI SDK integration

### UI
- [ ] Token count per block
- [ ] Token count per zone
- [ ] Total token count
- [ ] Chat/generation panel

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
| 3. Drag and Drop | 🔜 Next | - |
| 4. Block Editor | Planned | - |
| 5. LLM + Tokens | Planned | Token counting integration test |
| 6. Polish | Planned | - |

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
    Slice 5: LLM + Tokens
                │
                ▼
       Slice 6: Polish
```

---

## Notes

### Starting Small
- Slice 1 has no zones, no tokens, no routing
- Just blocks: create, list, delete
- Proves the Convex model works for our domain

### Token Counting Integration
This will be the first real test of integrating external JS libraries into Convex. The Python version relies on `tiktoken` which has no direct JS equivalent that's guaranteed to work in Convex's runtime.

Document findings when we get there - this could inform future integrations.
