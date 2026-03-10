# ContextForge Validation Pipeline — Design Document

Date: 2026-03-10
Status: Preliminary — return after memory implementation
Scenarios: [2026-03-10-memory-validation-scenarios.md](2026-03-10-memory-validation-scenarios.md)

---

## Problem Statement

The create-validate-update-validate loop is not represented in ContextForge. Any LLM-enabled workflow should nudge users to validate their results. Users should learn the habit of always validating.

---

## Core Design Decisions

| Decision | Rationale |
|----------|-----------|
| Validation = checklists on workflow steps | Simple, universal, no workflow engine needed |
| Orthogonal to memory | Validation reads memory but doesn't write to it |
| Nudge, not force | Strongly suggest validation but never block the user |
| Emergent validation is OK | Nudge for structure but don't require it |

---

## What Validation Means

Four types of validation observed across scenarios:

1. **Acceptance criteria** — "this document must cover X, Y, Z" (Marina's IRD)
2. **Required artifacts** — "these deliverables should be created during this session" (Yuki's pipeline levels)
3. **Must-answer questions** — "these questions must be answered before proceeding" (Yuki's entry questions)
4. **Tensions/problems** — borderline: "if any conflicts surfaced, they must be captured" (Dmitri's cross-service tensions)

---

## Where Checklists Come From

- **Session templates** can define a checklist (e.g., "Service Design Checklist" from Dmitri's scenario)
- **Users can add/edit checklist items** during a session
- Checklists are stored on the session, not on blocks or memory

---

## Checklist Item Schema

```ts
// On the session record
checklists: v.optional(v.array(v.object({
  label: v.string(),
  checked: v.boolean(),
}))),
```

---

## Behavior

- Checklist is visible in a sidebar or as a collapsible section
- Unchecked items are highlighted when user tries to "finish" a session
- No blocking — nudge only ("2 items unchecked. Continue anyway?")
- Checklist items can reference memory entries by tag (e.g., "Verify all #constraint entries respected") but this is UI sugar, not a data dependency

---

## NOT Included (YAGNI)

- Auto-validation (LLM checks items automatically)
- Checklist inheritance across sessions
- Checklist templates separate from session templates
- Validation scoring or metrics

---

## Open Questions (deferred)

- Exact UI placement — sidebar section? Top bar? Inside the drawer?
- Checklist item types (checkbox vs. text response vs. artifact link)
- How to surface "you should validate" nudge timing
- Relationship between pipeline-style entry/exit questions and generic checklists
