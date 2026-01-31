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
| BUG-001 | Bug | Drag-drop reordering | Low | Medium | Speculative |
| BUG-002 | Bug | Brainstorm input blocked | High | Low | Documented |
| BUG-003 | Bug | Test connection before save | Low | Low | Documented |
| BUG-004 | Bug | Save dropdown positioning | Medium | Low | Documented |
| TASK-001 | Feature | Public templates & workflows | Low | High | Documented |
| TASK-002 | Feature | Delete confirmation dialogs | **Critical** | Low | Documented |
| TASK-003 | Feature | Session deletion | Medium | Low | Documented |
| TASK-004 | Feature | Block editor improvements | High | Medium | Documented |
| TASK-005 | Feature | Block title extraction | Medium | Low | Documented |
| TASK-006 | Feature | Zone move from editor | Medium | Low | Documented |
| TASK-007 | Feature | Keyboard shortcuts system | Low | High | Documented |
| TASK-008 | Feature | Brainstorm input sizing | Medium | Low | Documented |
| TASK-009 | Feature | Unsaved brainstorm warning | High | Medium | Documented |
| TASK-010 | Feature | Compression system | Medium | High | Documented |
| TASK-011 | Design | Interface design enhancement | Low | High | Documented |

### Design Documents (Not Implementation Tasks)

| ID | Name | Purpose |
|----|------|---------|
| DESIGN-brainstorm-questioning | Brainstorm questioning modes | Future feature design |
| DESIGN-compression-system | Compression architecture | Reference for TASK-010 |
| DESIGN-block-type-usage | Block type documentation | User guidance |

### Pending Bug Report Items (23-29)

| Item | Issue | Type | Priority |
|------|-------|------|----------|
| 23 | Export individual notes | Feature | Low |
| 24 | Individual note MD export | Feature | Low |
| 25 | AI asking questions | Feature | Low |
| 26 | Quote/highlight for feedback | Feature | Medium |
| 27 | Cascading document changes | Feature | Low |
| 28 | Add button not disabled | Bug | High |
| 29 | Generator missing OpenRouter | Bug | Medium |

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
| **1.3** | Item 28: Add button not disabled | Prevents duplicate block creation | Low |
| **1.4** | TASK-009: Unsaved brainstorm warning | Prevents conversation data loss | Medium |

**Sprint 1 Total Effort**: Low-Medium (~2-3 days)

---

### Sprint 2: Core Usability Fixes

Fix the most frustrating UX issues reported by users.

| Order | Task | Rationale | Effort |
|-------|------|-----------|--------|
| **2.1** | BUG-001: Drag-drop reordering | Core feature "doesn't work at all" | Medium |
| **2.2** | TASK-004: Block editor improvements | Multiple complaints about editor size/usability | Medium |
| **2.3** | BUG-004: Save dropdown positioning | Easy fix, improves save UX | Low |
| **2.4** | TASK-008: Brainstorm input sizing | Quick win, part of TASK-004 scope | Low |

**Sprint 2 Total Effort**: Medium (~3-4 days)

---

### Sprint 3: Feature Completeness

Fill gaps in existing features.

| Order | Task | Rationale | Effort |
|-------|------|-----------|--------|
| **3.1** | Item 29: Generator missing OpenRouter | Feature parity between Generate and Brainstorm | Low |
| **3.2** | TASK-005: Block title extraction | Improves block identification | Low |
| **3.3** | TASK-006: Zone move from editor | Workflow improvement | Low |
| **3.4** | TASK-003: Session deletion | Users need to manage sessions | Low |
| **3.5** | BUG-003: Test connection before save | Better settings UX | Low |

**Sprint 3 Total Effort**: Low-Medium (~2-3 days)

---

### Sprint 4: Major Features

Significant new functionality.

| Order | Task | Rationale | Effort |
|-------|------|-----------|--------|
| **4.1** | TASK-010: Compression system | Token management for large sessions | High |
| **4.2** | Item 26: Quote/highlight feedback | Improves brainstorm iteration | Medium |

**Sprint 4 Total Effort**: High (~5-7 days)

---

### Sprint 5: Polish & Design

Visual and interaction improvements.

| Order | Task | Rationale | Effort |
|-------|------|-----------|--------|
| **5.1** | TASK-011: Interface design enhancement | Phases 1-4 (tokens, surfaces, typography, spacing) | Medium |
| **5.2** | TASK-007: Keyboard shortcuts system | Power user productivity | High |

**Sprint 5 Total Effort**: High (~5-7 days)

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
```

---

## Quick Wins (< 1 hour each)

These can be done opportunistically:

1. **BUG-002**: Brainstorm input blocked — likely state initialization fix
2. **BUG-004**: Save dropdown — swap to Radix DropdownMenu
3. **Item 28**: Add button disabled — add loading state
4. **TASK-008**: Input sizing — CSS adjustment

---

## High-Risk Items

Tasks requiring careful implementation:

| Task | Risk | Mitigation |
|------|------|-----------|
| BUG-001: Drag-drop | Complex interaction, may have edge cases | Thorough testing |
| TASK-010: Compression | LLM integration, data transformation | Phase incrementally |
| TASK-011: Design | Many file changes, visual regression | Per-phase review |

---

## Summary

### Immediate Priorities (This Week)
1. TASK-002: Delete confirmation dialogs
2. BUG-002: Brainstorm input blocked
3. Item 28: Add button disabled
4. TASK-009: Unsaved brainstorm warning

### Next Priorities (Next Week)
5. BUG-001: Drag-drop reordering
6. TASK-004: Block editor improvements
7. Item 29: Generator OpenRouter

### Total Documented Work
- **4 Bugs** documented (BUG-001 to BUG-004)
- **11 Tasks** documented (TASK-001 to TASK-011)
- **2 Pending bugs** from report (Items 28, 29)
- **5 Pending features** from report (Items 23-27)

---

## Tracking

Update this section as work progresses:

| Task | Started | Completed | Notes |
|------|---------|-----------|-------|
| Items 11, 12 | - | ✅ | Fixed with vercel.json |
| | | | |
