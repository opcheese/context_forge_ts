# Development Roadmap

**Last updated:** 2026-02-19

## Now / Next / Later

### Now — Active Work

The anchor feature for this cycle is **Linked Blocks** — the ability to place a block in multiple sessions, with edits syncing everywhere. See [linked-blocks-shaping.md](./plans/2026-02-19-linked-blocks-shaping.md) for the full design.

| Item | Type | Description | Effort |
|------|------|-------------|--------|
| `[feature]` Linked blocks V1 | Anchor | Schema + manual link flow + visual treatment + edit resolution + unlink | 2-3 days |
| `[feature]` Linked blocks V2 | Anchor | Content hash + auto-suggest linking on create/edit | 1-2 days |
| `[feature]` Linked blocks V3 | Anchor | Session delete safety + workflow carry-forward integration | 1 day |
| `[feature]` Linked blocks V4 | Anchor | Template/snapshot resolution (self-contained saves) | Half day |
| `[polish]` Theme toggle animation | Quick win | Rotate+scale transition on Sun/Moon icon swap | 1 hour |
| `[polish]` Auth loading state | Quick win | Replace "Loading..." with branded Anvil pulse animation | 1 hour |
| `[polish]` Empty state illustrations | Quick win | Anvil-themed illustrations for "No session", "No projects", etc. | 2-3 hours |
| `[bug]` BUG-003: Test LLM connection before save | Quick win | Validate provider config before saving to prevent silent failures | 1-2 hours |

### Next — Planned

Scoped and prioritized, not yet started. Will pick from these after linked blocks ships.

| Item | Type | Description | Effort |
|------|------|-------------|--------|
| `[feature]` Ephemeral skills for brainstorming | Feature | Inject skill context into brainstorm dialog. [Design approved](./plans/2026-02-16-ephemeral-skills-design.md) | 3-4 days |
| `[feature]` Token budgets: make useful | Feature | Configurable per-session budgets, budget warnings that guide action, smart defaults based on model | 2-3 days |
| `[feature]` Templates save only PERMANENT+STABLE | Feature | PM-requested — avoid saving WORKING zone junk into templates | 1 day |
| `[feature]` TASK-006: Zone move from editor | Feature | Change block zone without navigating back to home | 1 hour |
| `[feature]` TASK-005: Block title extraction | Feature | Auto-extract title from first line of block content | 1-2 hours |
| `[polish]` Replace raw select dropdowns | Polish | Use shadcn Select instead of native `<select>` elements | 2-3 hours |
| `[polish]` Focus-visible rings | Polish | Branded keyboard focus indicators for accessibility | 1-2 hours |
| `[polish]` Block card hover elevation | Polish | Subtle `translateY(-1px)` lift on hover | 30 min |
| `[polish]` Drop-zone empty state icon | Polish | Subtle icon in empty drop zones to invite action | 1 hour |
| `[polish]` Toast icon differentiation | Polish | Colored icons for success/error toasts | 1 hour |
| `[bug]` Item 29: Generator missing OpenRouter | Bug | Add OpenRouter to Generate panel (already in Brainstorm) | 1-2 hours |

### Later — Directional

Strategic bets. Scope and timing are flexible.

| Item | Type | Description |
|------|------|-------------|
| `[feature]` Keyboard shortcuts system (TASK-007) | Feature | Global shortcuts for power users — needs design |
| `[feature]` Block editor split-pane (TASK-004) | Feature | Side-by-side markdown preview + edit |
| `[feature]` Brainstorm questioning modes | Feature | AI asks clarifying questions before generating. [Design doc](./design/DESIGN-brainstorm-questioning.md) |
| `[feature]` Community marketplace (TASK-001) | Feature | Publish/discover templates and workflows. [Full design exists](./plans/2025-02-15-marketplace-design.md) |
| `[feature]` Access files in dialog mode | Feature | Browse blocks while brainstorm dialog is open |
| `[feature]` Shared files across workflow levels | Feature | Common reference files inherited by all workflow steps |
| `[polish]` Staggered page transitions | Polish | Content slide-up animation on route change |
| `[polish]` Login page atmosphere | Polish | Gradient mesh or noise texture for premium feel |
| `[design]` Interface design enhancement (TASK-011) | Design | Design system overhaul — cherry-pick phases as needed |

### Won't Do

Explicitly out of scope. Removed or indefinitely deferred.

| Item | Reason |
|------|--------|
| Full 8-phase design system overhaul (TASK-011 as monolith) | Too large for 2-person team. Cherry-pick individual improvements instead. |
| Claude Code exit-1 debugging | Intermittent, unclear root cause. Investigate when it reproduces. |

---

## Contributing

**Want to help?** Items in the **Now** and **Next** sections are the best places to start.

- **Quick wins** in the Now section are self-contained and well-scoped — good first contributions.
- **Next** items have clear descriptions but may need a design discussion first — open an issue to discuss before starting.
- **Later** items need design work — great for people who want to shape features, not just implement.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for setup instructions and code style guidelines.

---

## Completed

All core feature slices (1-5.9) are shipped. Slice 6 (Polish) is ongoing.

### Slice Summary

| Slice | Status | Shipped |
|-------|--------|---------|
| 1. Basic Blocks | Done | CRUD + E2E test isolation |
| 2. Zones | Done | Three-column layout + zone moves |
| 3. Drag and Drop | Done | @dnd-kit + file drop + stabilization (8 root causes fixed) |
| 4. Block Editor | Done | TanStack Router + edit page + markdown preview |
| 5. LLM Integration | Done | Ollama + Claude Code streaming |
| 5.5. Brainstorming | Done | Multi-turn, OpenRouter, LangFuse observability |
| 5.6. Workflows | Done | Templates, projects, workflows, context carry-forward |
| 5.7. Token Budgets | Done | js-tiktoken, zone budgets, UI components |
| 5.8. Skill Import | Done | SKILL.md parser + ZIP + file upload + URL import |
| 5.9. Context-Map | Done | Bidirectional import/export, multi-context projects |
| 6. Polish | In Progress | See below |

### Slice 6: Polish (In Progress)

Completed:
- [x] Markdown preview in editor and BrainstormDialog
- [x] Compression system (multi-provider)
- [x] DnD stabilization (8 root causes)
- [x] Save dropdown positioning (Radix DropdownMenu)
- [x] Auto-expanding brainstorm input
- [x] Stop generation button + cleanup on close (TASK-012)
- [x] Draft blocks — exclude from context without deleting (TASK-013)
- [x] Delete confirmation dialogs + unsaved brainstorm warnings
- [x] Skeleton loading states for budget panel and zone columns
- [x] Animated sliding nav indicator (framer-motion layoutId)
- [x] Micro delights animation system (dialogs, toasts, buttons, AnimatedNumber)
- [x] Session deletion from UI (TASK-003)
- [x] Clipboard copy/paste fix for HTTP

Remaining: see Now/Next sections above.

### Dependency Graph

```
Slice 1: Basic Blocks
        │
        ▼
Slice 2: Zones
        │
        ├────────────────┐
        ▼                ▼
Slice 3: DnD      Slice 4: Editor
        │                │
        └───────┬────────┘
                ▼
     Slice 4.5: Sessions
                │
                ▼
    Slice 5: LLM Integration
                │
        ┌───────┴───────┐
        ▼               ▼
 Slice 5.5:       Slice 5.6:
 Brainstorming    Workflows
        │               │
        └───────┬───────┘
                ▼
   Slice 5.7: Token Budgets
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
 Slice 5.8: Slice 5.9: Slice 6:
 Skill      CtxMap      Polish
    All ✅       ▼
          Linked Blocks ← YOU ARE HERE
```

---

## Technical Notes

### LLM Streaming Architecture
- Convex actions cannot stream directly to clients
- Pattern: mutation creates generation → action streams to DB → client subscribes via reactive query
- Claude Code uses subprocess protocol, not HTTP (Vercel AI SDK evaluated but not used)

### Token Counting
- `js-tiktoken` — pure JS, no WASM, matches Python tiktoken accuracy
- ~100KB bundle, cached encoding instances
- See [completed/TOKEN_BUDGETS_PLAN.md](./completed/TOKEN_BUDGETS_PLAN.md)
