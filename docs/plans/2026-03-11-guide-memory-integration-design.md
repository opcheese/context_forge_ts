# Guide Pipeline Memory Integration — Design

**Date:** 2026-03-11
**Goal:** Add memory feature to the tutorial guide pipeline (light touch, not restructuring)
**Scope:** 3 files — guide, lecture outline, student quickstart

---

## Design Decisions

1. **Light touch** — memory is introduced as an enhancement, not a pipeline restructure
2. **After GATE** — memory appears when the user commits (GO decision), not before
3. **Tag-based auto-selection is the "aha moment"** — set session tag `#aisha`, LLM sees her persona automatically
4. **Standalone section + step callouts** — one intro section after GATE, then brief callouts in L2-L4

---

## File 1: `docs/guides/GUIDE-project-kickstart.md`

### New section: "Building Project Memory" (between GATE and L2)

After GO decision:
1. Open memory drawer (bottom bar)
2. Pick PM schema template (learning, decision, stakeholder, tension)
3. Set session tags for current step
4. Brief explanation: memory entries are project knowledge scored by tag relevance, unlike WORKING zone's linear pile

### Callout box: tag demo

> "Try it: set your session tags to `#aisha`. Brainstorm about Aisha's scenarios. The LLM sees her persona card automatically."

### Substeps in L2, L3, L4

- **L2 Personas:** Save each persona as memory entry (type: stakeholder, tags: `#persona-name, #persona`)
- **L3 Scenarios:** Save key scenarios (type: learning or tension, tags: persona + context)
- **L4 Conceptual Model:** Save glossary terms (type: decision, tags: entity names)
- **L5 Stories:** No memory save — stories are the final output, stay as blocks

### Quick Reference table update

Add Memory column or row showing when entries are created.

---

## File 2: `internal/lecture-mobile-kickstart/00-lecture-outline.md`

### New Part 6.5: "Project Memory" (~5 min)

Inserted after Part 6 (IRD), before Part 7 (Personas).

**Talking points:**
- Outputs in WORKING are a linear pile — what if LLM auto-sees relevant parts?
- Memory = structured knowledge with types and tags
- Live demo: open drawer, pick PM template, save one brief item, show tags

**Key slide:**
- WORKING blocks vs Memory entries comparison table
- "Aha" demo: set `#aisha` tag, brainstorm, LLM references persona unprompted

**No student exercise** — they use it hands-on during assignment.

---

## File 3: `internal/lecture-mobile-kickstart/05-contextforge-quickstart.md`

### New Step 5.5: "Set Up Project Memory"

After GATE, before Personas:
1. Click memory bar at bottom
2. Expand → "Choose a starter template"
3. Select PM template
4. Now have types: learning, decision, stakeholder, tension

### Modified Step 6 (Personas)

After creating personas via brainstorm:
- Save each persona to memory (type: stakeholder, title, content, tags)
- Set session tags when brainstorming specific persona's scenarios

### New tip

> "Use session tags to focus the LLM. Tags like `#aisha, #discovery` make the LLM see only relevant memory entries."
