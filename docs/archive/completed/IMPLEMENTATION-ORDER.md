# Implementation Order & Triage

## Overview

Prioritized implementation order for ContextForgeTS tasks and bugs based on:
- **Impact**: User-facing severity, data loss potential
- **Dependencies**: Tasks that unblock others
- **Effort**: Estimated complexity
- **User Value**: Direct improvement to user experience

---

## Task Inventory

### Documented Items

| ID | Type | Name | Priority | Effort | Status |
|----|------|------|----------|--------|--------|
| BUG-001 | Bug | Drag-drop reordering | Low | Medium | ✅ **Completed** |
| BUG-002 | Bug | Brainstorm input blocked | High | Low | ✅ **Completed** |
| BUG-003 | Bug | Test connection before save | Low | Low | Documented |
| BUG-004 | Bug | Save dropdown positioning | Medium | Low | ✅ **Completed** (Radix DropdownMenu) |
| TASK-001 | Feature | Public templates & workflows | Low | High | Documented |
| TASK-002 | Feature | Delete confirmation dialogs | **Critical** | Low | ✅ **Completed** |
| TASK-003 | Feature | Session deletion | Medium | Low | ✅ **Completed** |
| TASK-004 | Feature | Block editor improvements | High | Medium | ⚡ **Partial** (PR #1) |
| TASK-005 | Feature | Block title extraction | Medium | Low | Documented |
| TASK-006 | Feature | Zone move from editor | Medium | Low | Documented |
| TASK-007 | Feature | Keyboard shortcuts system | Low | High | Documented |
| TASK-008 | Feature | Brainstorm input sizing | Medium | Low | ✅ **Completed** (auto-expand) |
| TASK-009 | Feature | Unsaved brainstorm warning | High | Medium | ✅ **Completed** |
| TASK-010 | Feature | Compression system | Medium | High | ✅ **Completed** |
| TASK-011 | Design | Interface design enhancement | Low | High | Documented |
| TASK-012 | Feature | Stop generation button | **High** | Medium | ✅ **Completed** |
| TASK-013 | Feature | Draft blocks | Medium | Low | ✅ **Completed** |

### Design Documents (Not Implementation Tasks)

| ID | Name | Purpose |
|----|------|---------|
| DESIGN-brainstorm-questioning | Brainstorm questioning modes | Future feature design |
| DESIGN-compression-system | Compression architecture | Reference for TASK-010 |
| DESIGN-block-type-usage | Block type documentation | User guidance |
| DESIGN-skill-import | SKILL.md import system | Design for TASK-012 (✅ implemented) |

### Pending Bug Report Items (23-29)

| Item | Issue | Type | Priority | Status |
|------|-------|------|----------|--------|
| 23 | Export individual notes | Feature | Low | Pending |
| 24 | Individual note MD export | Feature | Low | Pending |
| 25 | AI asking questions | Feature | Low | Pending |
| 26 | Quote/highlight for feedback | Feature | Medium | Pending |
| 27 | Cascading document changes | Feature | Low | Pending |
| 28 | Add button not disabled | Bug | High | ✅ **Completed** |
| 29 | Generator missing OpenRouter | Bug | Medium | Pending |

---

## Priority Definitions

| Level | Criteria |
|-------|----------|
| **Critical** | Data loss, blocking user workflows, production broken |
| **High** | Significantly impacts usability, common user friction |
| **Medium** | Improves experience, requested by users |
| **Low** | Nice to have, future enhancements |

---

## Recommended Implementation Order

### Sprint 1: Critical Fixes (Data Loss & Blocking Issues)

These must be fixed first — they cause data loss or block core functionality.

| Order | Task | Rationale | Effort |
|-------|------|-----------|--------|
| **1.1** | TASK-002: Delete confirmation dialogs | Prevents accidental data deletion | Low |
| **1.2** | BUG-002: Brainstorm input blocked | Users can't use brainstorm without workaround | Low |
| **1.3** | Item 28: Add button not disabled (debounce) | Prevents duplicate block creation | Low |
| **1.4** | TASK-009: Unsaved brainstorm warning | Prevents conversation data loss | Medium |

**Sprint 1 Total Effort**: Low-Medium (~2-3 days)

---

### Sprint 2: Core Usability Fixes ✅

Fix the most frustrating UX issues reported by users.

| Order | Task | Rationale | Status |
|-------|------|-----------|--------|
| **2.1** | BUG-001: Drag-drop reordering | Core feature stabilized (8 fixes) | ✅ 2026-02-12 |
| **2.2** | TASK-004: Block editor improvements | ⚡ Partially done (PR #1: markdown view, edit toggle, larger textarea). Remaining: split-pane, keyboard shortcuts | ⚡ Partial |
| **2.3** | BUG-004: Save dropdown positioning | Radix DropdownMenu with collision detection | ✅ 2026-02-11 |
| **2.4** | TASK-008: Brainstorm input sizing | Auto-expanding textarea | ✅ 2026-02-11 |

**Sprint 2 Status**: ✅ Complete (TASK-004 remaining items deferred to Sprint 6)

---

### Sprint 3: SKILL.md Import System ✅

SKILL.md compatibility for the growing Agent Skills ecosystem. Design: [completed/2026-02-11-skill-import-design.md](./completed/2026-02-11-skill-import-design.md)

| Order | Task | Rationale | Status |
|-------|------|-----------|--------|
| **3.1** | TASK-012a: Schema + parser | `skill` block type, metadata, SKILL.md parser (zero deps) | ✅ 2026-02-11 |
| **3.2** | TASK-012b: Convex mutation + Node action | `skills.importSkill`, local folder scan (feature-flagged) | ✅ 2026-02-11 |
| **3.3** | TASK-012c: Client-side handlers | File upload (.md/.zip), URL import, drag-and-drop | ✅ 2026-02-12 |
| **3.4** | TASK-012d: UI — import modal + skill block card | Import modal, skill rendering with name/icon/provenance | ✅ 2026-02-11 |
| **3.5** | Context-map import/export | Multi-context ZIP import, project export with context-map.yaml | ✅ 2026-02-12 |

**Sprint 3 Status**: ✅ Complete

---

### Sprint 4: Feature Completeness

Fill gaps in existing features.

| Order | Task | Rationale | Effort |
|-------|------|-----------|--------|
| **4.1** | Item 29: Generator missing OpenRouter | Feature parity between Generate and Brainstorm | Low |
| **4.2** | TASK-005: Block title extraction | Improves block identification | Low |
| **4.3** | TASK-006: Zone move from editor | Workflow improvement | Low |
| **4.4** | TASK-003: Session deletion | Users need to manage sessions | Low |
| **4.5** | BUG-003: Test connection before save | Better settings UX | Low |

**Sprint 4 Total Effort**: Low-Medium (~2-3 days)

---

### Sprint 5: Major Features

Significant new functionality.

| Order | Task | Rationale | Status |
|-------|------|-----------|--------|
| **5.1** | TASK-010: Compression system | Token management for large sessions | ✅ Completed |
| **5.2** | Item 26: Quote/highlight feedback | Improves brainstorm iteration | Pending |

**Sprint 5 Status**: ⚡ Partial (TASK-010 done, Item 26 pending)

---

### Sprint 6: Polish & Design

Visual and interaction improvements.

| Order | Task | Rationale | Effort |
|-------|------|-----------|--------|
| **6.1** | TASK-011: Interface design enhancement | Phases 1-4 (tokens, surfaces, typography, spacing) | Medium |
| **6.2** | TASK-007: Keyboard shortcuts system | Power user productivity | High |

**Sprint 6 Total Effort**: High (~5-7 days)

---

### Backlog (Low Priority / Future)

Not scheduled — implement when time permits or user demand increases.

| Task | Rationale for Deferral |
|------|----------------------|
| TASK-001: Public templates | Nice to have, not blocking |
| Item 23/24: Export individual notes | Low demand, workaround exists |
| Item 25: AI asking questions | Vague requirement |
| Item 27: Cascading changes | Major feature, needs design |
| DESIGN-brainstorm-questioning | Future feature, not critical |

---

## Dependencies

```
TASK-002 (Confirm dialogs)
    ↓
TASK-003 (Session deletion) — needs confirm dialog

TASK-004 (Editor improvements)
    ↓
TASK-008 (Input sizing) — subset of TASK-004

BUG-002 (Input blocked) — standalone, no deps

TASK-010 (Compression)
    ↓
TASK-011 (Design) Phase 5 — block card badges for compression

TASK-012 (Skill import) — standalone, no deps on open bugs
    ↓
TASK-012a (Schema + parser) → TASK-012b (Convex) → TASK-012c (Client) → TASK-012d (UI)
    Internal ordering: sequential (schema first, UI last)
```

---

## Quick Wins (< 1 hour each)

~~All quick wins completed:~~

1. ~~**BUG-002**: Brainstorm input blocked~~ ✅
2. ~~**BUG-004**: Save dropdown~~ ✅
3. ~~**Item 28**: Add button disabled~~ ✅
4. ~~**TASK-008**: Input sizing~~ ✅

---

## High-Risk Items

Tasks requiring careful implementation:

| Task | Risk | Mitigation | Status |
|------|------|-----------|--------|
| ~~BUG-001: Drag-drop~~ | Complex interaction, may have edge cases | 8 root causes identified and fixed | ✅ |
| ~~TASK-010: Compression~~ | LLM integration, data transformation | Phased incrementally | ✅ |
| TASK-011: Design | Many file changes, visual regression | Per-phase review | Pending |
| ~~TASK-012: Skill import~~ | Schema change, Convex runtime constraints | Zero-dep parser, dependency-free mutations | ✅ |

---

## Summary

### Completed
1. ~~TASK-002: Delete confirmation dialogs~~ ✅
2. ~~BUG-002: Brainstorm input blocked~~ ✅
3. ~~Item 28: Add button disabled~~ ✅
4. ~~TASK-009: Unsaved brainstorm warning~~ ✅
5. ~~BUG-001: Drag-drop reordering~~ ✅ (8 root causes fixed)
6. ~~BUG-004: Save dropdown positioning~~ ✅
7. ~~TASK-008: Brainstorm input sizing~~ ✅
8. ~~TASK-010: Compression system~~ ✅
9. ~~TASK-012: Stop generation button~~ ✅
10. ~~Context-map import/export~~ ✅
11. ~~TASK-013: Draft blocks~~ ✅
12. ~~TASK-003: Session deletion~~ ✅
13. ~~Clipboard copy/paste fix~~ ✅
14. ~~Skeleton loading states~~ ✅
15. ~~Animated nav indicator~~ ✅
16. ~~Micro delights animation system~~ ✅

### Current: Linked Blocks (Anchor Feature)
See [plans/2026-02-19-linked-blocks-shaping.md](./plans/2026-02-19-linked-blocks-shaping.md) for full design.
- V1: Schema + manual link + visual + edit resolution (2-3 days)
- V2: Content hash + auto-suggest linking (1-2 days)
- V3: Session delete safety + workflow integration (1 day)
- V4: Template/snapshot resolution (half day)

### Next Up: Quick Wins + Feature Completeness
11. BUG-003: Test connection before save
12. Item 29: Generator missing OpenRouter
13. TASK-005: Block title extraction
14. TASK-006: Zone move from editor
15. Polish: theme toggle animation, empty states, auth loading

### Then: Next Planned
16. Ephemeral skills for brainstorming
17. Token budgets: make configurable and useful
18. Templates save only PERMANENT+STABLE
19. TASK-007: Keyboard shortcuts system
20. TASK-004: Remaining editor improvements (split-pane)

### Total Documented Work
- **4 Bugs** documented (BUG-001 to BUG-004) — 3 completed, 1 remaining
- **13 Tasks** documented (TASK-001 to TASK-013) — 8 completed, 1 partial (TASK-004), 4 remaining
- **2 Pending bugs** from report (Items 28 ✅, 29)
- **5 Pending features** from report (Items 23-27)

---

## Tracking

Update this section as work progresses:

| Task | Started | Completed | Notes |
|------|---------|-----------|-------|
| Items 11, 12 | - | ✅ | Fixed with vercel.json |
| **Sprint 1** | 2026-02-01 | ✅ 2026-02-01 | **All tasks completed** |
| TASK-002 | 2026-02-01 | ✅ | Delete confirmations with ConfirmDialog + useConfirmDelete |
| BUG-002 | 2026-02-01 | ✅ | Brainstorm input - optimistic health checks |
| Item 28 | 2026-02-01 | ✅ | Button debouncing (300-500ms) on all critical actions |
| TASK-009 | 2026-02-01 | ✅ | Unsaved brainstorm warnings (close/navigate/refresh) |
| TASK-010 | 2026-01-30 | ✅ | Compression system with multi-provider support |
| **Sprint 2** | 2026-02-11 | ✅ 2026-02-12 | **All tasks completed** |
| TASK-004 | 2026-02-11 | ⚡ Partial | PR #1: markdown rendering, view/edit toggle, larger textarea. Remaining: split-pane, keyboard shortcuts |
| BUG-004 | 2026-02-11 | ✅ | Radix DropdownMenu with collision detection |
| TASK-008 | 2026-02-11 | ✅ | Auto-expanding textarea |
| BUG-001 | 2026-02-12 | ✅ | 8 root causes: ref-stabilize, closestCorners, drag handle, optimistic ordering, file guards, no drop animation, blur on end |
| **Sprint 3** | 2026-02-11 | ✅ 2026-02-12 | **All tasks completed** |
| TASK-012 | 2026-02-11 | ✅ | SKILL.md + ZIP import, parser, UI modal, drag-and-drop |
| Context-map | 2026-02-12 | ✅ | Bidirectional import/export, multi-context projects, YAML spec |
| | | | |
