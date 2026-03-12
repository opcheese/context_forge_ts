# Validation & Save-to-Memory — Design Document

Date: 2026-03-11
Status: Approved design, ready for implementation planning
Supersedes: `2026-03-10-validation-design.md` (preliminary)
Related: `2026-03-10-memory-validation-scenarios.md` (reference scenarios)

---

## Problem Statement

Two gaps in the current ContextForge workflow:

1. **No validation loop.** LLM outputs are accepted uncritically. Users should define criteria before generating, then check results against them. The create-validate-update cycle is fundamental to responsible LLM usage.

2. **No save-to-memory from brainstorm.** During brainstorm conversations, users discover insights, decisions, and tensions that belong in project memory. Currently they must switch to the memory drawer and manually recreate them.

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Validation uses the same brainstorm panel | 95% context overlap — no separate UI |
| Block context modes replace `isDraft` | Extensible, clean schema, supports validation blocks |
| Save-to-memory is a brainstorm feature first | Validation reuses it, not the other way around |
| LLM-assisted memory drafting on text selection | Users save their own insight, not raw LLM text — LLM distills it |
| Nudge, not force | Validation is always advisory, never blocks |

---

## Part 1: Block Context Modes

### Schema Change

Replace `isDraft: v.optional(v.boolean())` with:

```ts
contextMode: v.optional(
  v.union(v.literal("default"), v.literal("draft"), v.literal("validation"))
)
// undefined = "default" (backwards compatible)
```

### Context Inclusion Matrix

| Mode | Brainstorm context | Validation context | UI appearance |
|------|-------------------|-------------------|---------------|
| `default` / undefined | Included | Included | Normal block |
| `draft` | Excluded | Excluded | Dimmed with draft badge |
| `validation` | Excluded | Included | Criteria badge |

### Migration

- `isDraft: true` → `contextMode: "draft"`
- `isDraft: false` / undefined → remove field (defaults to `"default"`)
- Remove `isDraft` from schema after migration
- Update all mutations referencing `isDraft` to use `contextMode`

### Session Invalidation

Changing a block's `contextMode` on PERMANENT/STABLE blocks clears `claudeSessionId` (same pattern as other block mutations that affect context).

### Block UI

The current draft toggle becomes a 3-way selector in the block header:
- **Default** — normal, included in all contexts
- **Draft** — excluded from all LLM contexts, work in progress
- **Validation** — excluded from brainstorm, included in validation

---

## Part 2: Validation

### Concept

Validation = brainstorm with `validation` mode blocks included + a system suffix that instructs the LLM to evaluate artifacts against criteria.

### User Flow

1. User creates criteria blocks in any zone, sets `contextMode: "validation"`
2. User writes/generates artifacts via brainstorm (criteria blocks are excluded)
3. User clicks **Validate** button in brainstorm panel
4. Context assembly includes `validation` blocks + appends validation system suffix
5. LLM evaluates artifacts against criteria, produces free-form verdict
6. User reads verdict, fixes artifacts or saves findings to memory

### Validate Button

- Located next to Send in the brainstorm panel
- Same conversation stream — validation responses appear alongside brainstorm responses
- Visual distinction: secondary variant with a checkmark icon
- Sends the user's message (if any) + the validation suffix

### Validation System Suffix

Default (hardcoded):

```
VALIDATION MODE: You are evaluating artifacts against criteria.
Blocks marked as validation criteria define what "good" looks like.
For each criterion, state whether the artifacts meet it. Be specific —
quote the artifact where it meets or fails the criterion.
Summarize with a clear PASS / PARTIAL / FAIL verdict.
```

**Overridable:** If a PERMANENT zone block with type `validation_prompt` exists, its content replaces the default suffix.

### Context Assembly Changes

`assembleContextWithConversation()` and related functions gain a `mode: "brainstorm" | "validation"` parameter:

- **Brainstorm mode** (default): exclude blocks where `contextMode === "draft"` or `contextMode === "validation"`
- **Validation mode**: exclude blocks where `contextMode === "draft"` only

This is the only difference between the two modes at the context level.

### Workflow Integration

Workflow step templates can include `validation` mode blocks with step-specific criteria. When `advanceStep()` creates a session from a template, the criteria blocks carry forward with their `contextMode: "validation"`.

Example for project-kickstart L1 (IRD):
- STABLE (default): EARS reference card, IRD template
- STABLE (validation): "All requirements use EARS syntax", "Grouped by user goal, not system component", "Includes mobile-specific requirements", "Out of Scope is specific"

The quality checklists already in the guide become machine-enforceable `validation` blocks in templates.

---

## Part 3: Save-to-Memory

### Concept

During brainstorm or validation, users can save selected text to project memory with LLM-assisted drafting. The LLM distills the selection into a structured memory entry, reusing existing tags and avoiding duplicates.

### User Flow

1. User reads LLM response in brainstorm or validation
2. Selects text they want to save
3. Two buttons visible: **Save as block** (existing behavior) and **Save to memory** (new, memory icon)
4. Clicking "Save to memory" triggers an LLM draft call
5. Pre-filled create entry form appears (type, title, distilled content, tags)
6. User reviews, adjusts if needed, saves

### Button Behavior

| State | Save as block | Save to memory |
|-------|--------------|----------------|
| No text selected | Saves full response (current behavior) | Disabled |
| Text selected | Saves selection as block | Triggers LLM draft → form |

### LLM Draft Call

**Input sent to the model:**
- Selected text from the conversation
- Project's memory schema types (names, icons, colors)
- All existing memory entries for the project (full content — titles, content, tags)

**Expected output:**
- Suggested `type` (from available schema types)
- Suggested `title` (concise, descriptive)
- Distilled `content` (cleaned up from raw selection — concise, actionable)
- Suggested `tags` (reusing existing tags where appropriate, consistent naming)
- Optional duplicate warning: "Consider updating existing entry '[title]' instead of creating new"

**Model:** Configurable in project or global settings. Defaults to a fast/cheap model (e.g., Haiku). This is a structured extraction task — doesn't need the brainstorm model.

**System prompt for draft call:**

```
You are a memory entry drafting assistant. Given selected text from a conversation,
create a structured memory entry for the project's knowledge base.

Available memory types: [list from schema]

Existing entries: [list with title, content, tags]

Rules:
- Pick the most appropriate type from the available types
- Write a concise, specific title (not the first line of the selection)
- Distill the content — extract the insight, don't just copy the text
- Reuse existing tags where they fit. Use lowercase, #-prefixed tags
- If a similar entry already exists, note it so the user can update instead of duplicate

Respond with JSON: { type, title, content, tags, duplicateWarning? }
```

### From Memory Drawer

The **+** button in the memory drawer opens an empty create form — no LLM call, fully manual entry. This path is for intentional, user-initiated entries where the user knows exactly what they want to write.

### No Changes to Save-as-Block

The existing "Save as block" behavior is unchanged. It saves the full response (or selection) as a WORKING zone block.

---

## Part 4: Reference Scenario Walkthroughs

### Marina (PM) — IRD Validation + Save-to-Memory

**Setup:** L1 session has STABLE blocks:
- (default) EARS reference card, IRD template
- (validation) IRD acceptance criteria: "All requirements use EARS", "Grouped by user goal", "Mobile-specific requirements included"

**Brainstorm:** Marina generates IRD requirements. The validation criteria blocks are excluded — the LLM writes freely without gaming its own criteria.

**Validate:** Marina clicks Validate. Criteria blocks join the context. LLM evaluates:
> "PARTIAL — 8/10 requirements use EARS syntax. FR-003 and FR-007 use informal language. Requirements are grouped by system component (Authentication, Database) instead of user goal. No mobile-specific requirements found. Missing: offline access, notification awareness, permission handling."

**Save to memory:** Marina selects the paragraph about CTO vs retail ops wallet conflict from an earlier brainstorm turn. Clicks "Save to memory". LLM drafts:
```
Type: tension
Title: Point transfer UX — on-chain vs custodial
Content: CTO wants on-chain P2P transfers (blockchain ethos).
         Retail ops needs phone-number-based transfers (customer simplicity).
         Possible compromise: custodial wallets with phone-number lookup.
Tags: #transfer, #ux, #cto, #retail-ops
Duplicate warning: None
```
Marina adjusts tags, saves.

### Sasha (Fiction) — Chapter Validation + Continuity Tension

**Setup:** Chapter 19 session has STABLE blocks:
- (default) Chapter outline, previous chapter summary
- (validation) Continuity criteria: "Character locations consistent with previous chapter", "Voice matches POV character's voice notes", "No lore rule violations"

**Brainstorm:** LLM drafts Renn's mutiny speech. Validation blocks excluded.

**Validate:** Sasha clicks Validate. LLM evaluates:
> "PARTIAL — Voice matches Renn's engineering-metaphor pattern. However: Okafor appears in cargo bay but ch18 ended with her in med bay — no transition shown. Lore rules respected (0.3g acceleration referenced correctly)."

**Save to memory:** Sasha selects the Okafor finding. LLM drafts:
```
Type: tension
Title: Okafor location ch18→ch19
Content: Ch 18 ends with Okafor in med bay treating burns.
         Ch 19 draft has her in cargo bay for Renn's speech.
         Need transition scene or time skip.
Tags: #okafor, #continuity, #ch18, #ch19
Duplicate warning: None
```

### Dmitri (Architecture) — Service Design Validation + Constraint Discovery

**Setup:** Refund service session has STABLE blocks:
- (default) Event catalog, service dependency map
- (validation) Service design checklist: "No cross-service DB access", "All events follow schema v3", "DLQ pattern for every consumer", "PCI-DSS tokenization for card data", "SLA: refund completion < 30s"

**Brainstorm:** LLM drafts refund flow. Validation blocks excluded — it proposes a direct DB read.

**Validate:** LLM evaluates against checklist:
> "FAIL — Direct DB read from payment-gateway violates 'No cross-service DB access'. Refund-service must maintain its own read model from PaymentCompleted events. DLQ pattern not specified for RefundRequested consumer. PCI tokenization correctly uses reference IDs."

**Save to memory:** Dmitri selects his correction about cross-service DB access from the brainstorm conversation. LLM drafts:
```
Type: constraint
Title: No cross-service DB access
Content: Services NEVER read another service's database directly.
         Each service maintains its own read model from events.
         Non-negotiable architectural boundary.
Tags: #data-ownership, #microservices, #foundational
Duplicate warning: Similar to existing constraint "PCI-DSS tokenization"
                   in scope but different topic. No duplicate.
```

### Yuki (Game Design) — Pipeline Level Validation

**Setup:** L4 session has STABLE blocks:
- (default) L0-L3 summaries, pipeline rules
- (validation) L4 entry checklist: "L3 Systems Design complete", "Core mechanics finalized", "Conflict resolutions C01-C03 incorporated", "All L3 mechanics have narrative hooks"

**Validate before starting:** Yuki clicks Validate immediately:
> "PARTIAL — L3 complete, core mechanics finalized, C01-C03 incorporated. However: 'All L3 mechanics have narrative hooks identified' is not met — evidence system and room topology have no narrative hooks documented."

This surfaces a gap before Yuki wastes time on L4. She goes back to add narrative hooks to L3.

---

## Part 5: Implementation Scope

### What's New

1. **Schema:** `contextMode` field replacing `isDraft`
2. **Migration:** `isDraft` → `contextMode` for all existing blocks
3. **Context assembly:** mode parameter controlling block filtering
4. **Brainstorm panel:** Validate button alongside Send
5. **Brainstorm panel:** Save-to-memory button (active on text selection)
6. **LLM draft action:** separate action for memory entry drafting
7. **Block UI:** 3-way context mode selector replacing draft toggle
8. **Validation system suffix:** default text + override mechanism
9. **Settings:** configurable model for memory draft calls

### What's NOT Included (YAGNI)

- No pass/fail persistence — verdict is in the conversation
- No auto-validation on step advance
- No validation history or scoring
- No blocking — always advisory
- No separate validation conversation
- No structured validation output format — free-form text
- No auto-save to memory — always user-initiated

---

## Part 6: Guide Pipeline Updates

After implementation, update:

1. **GUIDE-project-kickstart.md** — each step's quality checklist becomes a note: "These criteria can be added as validation blocks in STABLE zone"
2. **Lecture outline** — add validation demo to the relevant part
3. **Student quickstart** — add "validate your IRD" step
4. **Workflow templates** — ship with `validation` mode blocks containing the quality checklists from the guide

---

## Appendix: Affected Files (Preliminary)

| Area | Files |
|------|-------|
| Schema | `convex/schema.ts` |
| Migration | New migration script |
| Block CRUD | `convex/blocks.ts` (replace isDraft references) |
| Context assembly | `convex/lib/context.ts`, `convex/lib/context.test.ts` |
| Brainstorm action | `convex/claudeNode.ts` |
| Memory draft action | New action (e.g., `convex/memoryDraft.ts`) |
| Block components | `src/components/blocks/` (context mode selector) |
| Brainstorm panel | `src/components/brainstorm/BrainstormPanel.tsx` |
| Settings | Settings page + new config field |
| Workflow templates | `docs/data/project-kickstart-workflow/` |
