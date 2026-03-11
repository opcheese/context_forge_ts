# Project Kickstart with ContextForge

Build a structured PM workflow from idea to user stories using ContextForge's zone-based context management.

---

## What You Get

After following this guide, you will have:

- An 8-step PM pipeline as a ContextForge workflow (Brief → IRD → GATE → Personas → Scenarios → Mocks → Conceptual Model → Stories)
- CIRCLES framework for structured problem comprehension
- EARS syntax for writing testable requirements
- A GO/PIVOT/KILL decision gate to prevent wasted effort
- The entire workflow exportable as a Claude Code skill

---

## Prerequisites

- ContextForge running locally (`pnpm exec convex dev` + `pnpm dev`)
- The project-kickstart workflow package: `docs/data/project-kickstart-workflow.zip`
- An LLM provider configured (Ollama, Claude Code, or OpenRouter)

---

## Setup

### 1. Import the Workflow Package

1. Open ContextForge in your browser
2. Click **Import Skill** in the toolbar
3. Upload `project-kickstart-workflow.zip`
4. The import dialog shows "Import as Project" with 8 workflow steps
5. Name your project (e.g., "MyApp Kickstart")
6. Click Import

**What happened:** ContextForge created a project with 8 sessions, one per pipeline step. Each session has the right materials pre-loaded in the right zones.

### 2. Understand Your Zones

Every session in the workflow has three zones:

| Zone | Contains | Changes Between Steps? |
|------|----------|----------------------|
| **PERMANENT** | PM persona system prompt — enforces CIRCLES, EARS, user-oriented thinking | No — same across all steps |
| **STABLE** | Reference cards (CIRCLES/EARS) + step-specific template | Yes — each step loads its own template |
| **WORKING** | Your outputs — the documents you write | Yes — you create content here at each step |

The PM persona in PERMANENT shapes every LLM interaction. It will push back on feature creep, demand evidence, and enforce the pipeline order.

### 3. Optional: Import Community Skills

For richer context at specific steps, you can import quality-vetted community skills alongside the built-in templates:

| Step | Community Skill | Source | What It Adds |
|------|----------------|--------|-------------|
| L0 | rjs/shaping (appetite concept) | [github.com/rjs/shaping-skills](https://github.com/rjs/shaping-skills) | Structured scoping methodology |
| L1 | anthropic/feature-spec | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | PRD structure, MoSCoW, acceptance criteria |
| GATE | anthropic/competitive-analysis | anthropics/knowledge-work-plugins | Competitive landscape check |
| L2 | deanpeters/proto-persona | [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills) | Research-backed persona methodology |
| L3 | deanpeters/customer-journey-map | deanpeters/Product-Manager-Skills | NNGroup journey mapping framework |
| L3.5 | frontend-design | Built-in (already installed) | Production-grade UI design guidance |
| L5 | deanpeters/user-story-mapping | deanpeters/Product-Manager-Skills | Jeff Patton story mapping + epic breakdown |

These are optional — the built-in templates are self-sufficient. See [Community Skills Evaluation](./research/claude-code-pm-skills-evaluation.md) for detailed quality assessments.

---

## The Pipeline

### L0: Brief (CIRCLES)

**Goal:** Comprehend the problem space and set an appetite.

**Your zones:**

| Zone | Content |
|------|---------|
| PERMANENT | PM persona (auto-loaded) |
| STABLE | CIRCLES reference card + Brief template |
| WORKING | Empty — you write the brief here |

**What to do:**

1. Paste your raw materials into WORKING — meeting transcripts, client emails, product ideas, anything you have
2. Open the Brief template in STABLE — this is your structure
3. Use Brainstorm to work through each CIRCLES section with the LLM:
   - Start with **Comprehend**: "Walk me through CIRCLES for this project. Here's what we know: [paste raw notes]"
   - The PM persona will guide you through each letter
4. The LLM will push back if you jump to solutions too early — that's intentional
5. Set the **Appetite**: decide upfront how much time this is worth (e.g., "6 weeks")
6. Save the completed brief as a block in WORKING

**Quality check:**
- [ ] Problem is stated from the user's perspective, not as a feature request
- [ ] Appetite is a time budget (decision), not an estimate (guess)
- [ ] At least one customer segment is specific enough to find and interview
- [ ] "Open Questions" section has real unknowns, not blanks

---

### L1: IRD (EARS)

**Goal:** Translate the brief into testable requirements.

**Your zones:**

| Zone | Content |
|------|---------|
| PERMANENT | PM persona |
| STABLE | EARS reference card + IRD template |
| WORKING | Your brief from L0 (carried forward) |

**What to do:**

1. Review your brief in WORKING — this is your input
2. Open the IRD template in STABLE
3. Use Brainstorm: "Generate initial requirements from this brief using EARS syntax. Group by user goal."
4. The LLM will write each requirement using EARS patterns (WHEN/WHILE/IF/SHALL)
5. Review each requirement — can you write a test case from the sentence alone?
6. Mark priorities: Must / Should / Could / Won't (MoSCoW)
7. Write explicit "Out of Scope" — be specific
8. Save the IRD to WORKING

**Quality check:**
- [ ] Every functional requirement uses an EARS pattern explicitly
- [ ] Requirements are grouped by user goal, not system component
- [ ] Non-functional requirements have measurable thresholds
- [ ] "Out of Scope" is specific (not "limited admin features" but "no admin dashboard")
- [ ] Assumptions are marked with [ASSUMPTION]

---

### GATE: GO / PIVOT / KILL

**Goal:** Make a binary decision before investing further.

**Your zones:**

| Zone | Content |
|------|---------|
| PERMANENT | PM persona |
| STABLE | GATE decision template |
| WORKING | Brief + IRD (carried forward) |

**What to do:**

1. Open the GATE template in STABLE
2. Use Brainstorm: "Run the GATE decision for this project. Be honest — evaluate evidence for and against."
3. The LLM will assess evidence, risks, and decision criteria
4. Walk through the Decision Criteria checklist — check only what's actually true
5. Make the call:
   - **GO**: Proceed to L2. Document why.
   - **PIVOT**: Return to L0 with specific changes. Document what failed.
   - **KILL**: Stop. Archive everything. Document why — this is valuable data.
6. Save the decision to WORKING

**This is the hardest step.** The PM persona will push you to be honest. If evidence is weak, it will say so. Listen.

---

### Building Project Memory

After a GO decision, you're committing to this project. This is a good time to set up **Project Memory** — structured knowledge that the LLM can see automatically based on relevance.

**Zones vs Memory:**

| | WORKING Zone Blocks | Memory Entries |
|---|---|---|
| Structure | Linear — everything piles up | Typed and tagged — scored by relevance |
| Visibility | LLM sees all blocks in the zone | LLM sees entries matching your session tags |
| Scope | Per-session (carried forward via workflow) | Per-project (available in any session) |

**What to do:**

1. Click the memory bar at the bottom of the session
2. The drawer expands — click "Choose a starter template"
3. Select **PM** — this gives you types: learning, decision, stakeholder, tension
4. You now have project memory ready. You'll populate it starting with personas in the next step.

**How tags work:** Each memory entry has tags (e.g., `#aisha, #persona`). Each session has session tags. The LLM automatically sees entries whose tags overlap with your session tags — no manual pasting needed.

---

### L2: Personas

**Goal:** Define 2-3 user archetypes grounded in behavior, not demographics.

**Your zones:**

| Zone | Content |
|------|---------|
| PERMANENT | PM persona |
| STABLE | Persona template |
| WORKING | Brief + IRD + GATE decision (carried forward) |

**What to do:**

1. Open the Persona template in STABLE
2. Use Brainstorm: "Create proto-personas based on the customer segments from the brief and the user goals in the IRD."
3. For each persona, ensure:
   - Goals are behavioral ("needs to track weekly expenses") not demographic ("35-year-old accountant")
   - Frustrations describe current workarounds, not absent features
   - Everything is marked [ASSUMPTION] or [VALIDATED]
4. If you have more than 4 personas, you haven't prioritized — merge or cut
5. Save personas to WORKING
6. **Save to Memory:** For each persona, open the memory drawer and click **+**. Set type to `stakeholder`, title to the persona name, paste goals + frustrations as content, and add tags like `#aisha, #persona`.

> **Try it:** Set your session tags to `#aisha`. Now brainstorm about Aisha's scenarios. The LLM sees her persona card automatically — without you pasting it into the conversation.

**Quality check:**
- [ ] 2-3 personas (not more)
- [ ] Each persona has behavioral goals, not just demographics
- [ ] Frustrations describe what's broken today, with workarounds
- [ ] Validation status is explicit for every attribute
- [ ] Persona relationships section explains overlaps and conflicts

---

### L3: Scenarios

**Goal:** Map user journeys with specific steps, touchpoints, and emotional arcs.

**Your zones:**

| Zone | Content |
|------|---------|
| PERMANENT | PM persona |
| STABLE | Scenario template |
| WORKING | Prior outputs (carried forward) |

**What to do:**

1. Open the Scenario template in STABLE
2. Create at least one scenario per persona: "Map [Persona Name]'s primary journey for [goal from persona card]"
3. For each step in the journey, capture: action, touchpoint, what they're thinking, how they feel, pain level (1-5)
4. Identify opportunities — where can the product intervene? Which steps have pain scores of 4-5?
5. Write at least one edge case or failure scenario per persona
6. Save scenarios to WORKING
7. **Save to Memory:** Save key scenarios as memory entries (type: `tension` or `learning`, tags: persona name + context like `#aisha, #onboarding`)

**Quality check:**
- [ ] At least one scenario per persona
- [ ] Every step has a specific touchpoint (not "uses app" but "taps notification in mobile app")
- [ ] Pain scores identify clear intervention points
- [ ] At least one failure/edge case scenario exists
- [ ] Scenarios are specific enough to derive screen requirements

---

### L3.5: Mocks (Optional)

**Goal:** Sketch key screens at fat-marker level.

Skip this step if the project doesn't have a UI, or if you're handing off to a design team. If you do it, keep it rough.

**What to do:**

1. Open the Mocks template in STABLE
2. For each high-pain scenario step (pain 4-5), sketch the screen that addresses it
3. Focus on: what information is shown, what actions are available, how screens connect
4. 3-5 screens is typical. More than 10 means your scope is too large.
5. For detailed visual design later, use the `frontend-design` Claude Code skill

---

### L4: Conceptual Model

**Goal:** Define domain entities and relationships from the user's perspective.

**Your zones:**

| Zone | Content |
|------|---------|
| PERMANENT | PM persona |
| STABLE | Conceptual Model template |
| WORKING | Prior outputs (carried forward) |

**What to do:**

1. Open the Conceptual Model template in STABLE
2. Use Brainstorm: "Extract the conceptual model from our scenarios. What entities, relationships, and states emerge?"
3. Build the Glossary — every term must trace to a scenario or persona
4. Write relationships in plain English: "A Customer places many Orders"
5. Identify state transitions: what states do key entities pass through?
6. Define invariants: rules that must always be true
7. Mark boundary decisions: what's in-system vs external
8. **Save to Memory:** Save key glossary terms and domain decisions as memory entries (type: `decision`, tags: entity names like `#order, #customer`)

**This is NOT a database schema.** No IDs, no foreign keys, no data types. If a developer needs those, they derive them from your model. Your job is the user-facing concepts.

**Quality check:**
- [ ] Every entity traces back to a scenario
- [ ] Relationships are in plain English (no technical jargon)
- [ ] No orphan entities (terms that no scenario references)
- [ ] Synonyms are resolved (one term per concept)
- [ ] Boundary decisions have rationale

---

### L5: Stories

**Goal:** Decompose the shaped solution into prioritized, vertical user stories.

**Your zones:**

| Zone | Content |
|------|---------|
| PERMANENT | PM persona |
| STABLE | Stories template |
| WORKING | Prior outputs (carried forward) |

**What to do:**

1. Open the Stories template in STABLE
2. Use Brainstorm: "Create a story map from our scenarios. Start with the walking skeleton — the thinnest path a real user could use."
3. Organize horizontally: Activities -> Steps (from scenarios)
4. Organize vertically: Walking Skeleton (ship first) -> Release 1 -> Future
5. Every story: "As [named persona], I want [action] so that [goal from scenario]"
6. Write acceptance criteria in Given/When/Then format
7. Trace every story to a persona + scenario step

**Quality check:**
- [ ] Stories use specific persona names (never "As a user")
- [ ] Each story is a vertical slice (delivers value alone)
- [ ] Acceptance criteria are testable (Given/When/Then)
- [ ] Walking skeleton is identified — the minimum viable path
- [ ] No story is larger than one sprint
- [ ] Every story traces to a scenario step and persona
- [ ] Conceptual model terms are used consistently

---

## Advancing Between Steps

When you finish a step and move to the next:

1. **Promote key outputs**: Before advancing, ensure your important deliverables are saved as blocks in WORKING
2. **Advance the workflow**: Click Next in the workflow indicator
3. **What carries forward**: The PM persona (PERMANENT) always carries. Previous outputs in WORKING carry if configured.
4. **New materials appear**: The next step's template and reference cards load into STABLE

The carry-forward mechanism ensures you never lose context. Each step builds on everything before it.

---

## Export as Claude Code Skill

### Option A: Export from ContextForge

1. Complete all steps (or as many as needed)
2. Click **Export Skill** in the toolbar
3. Select "Export Project" to include all steps
4. Download the ZIP — it contains SKILL.md, context-map.yaml, and all reference files
5. The exported skill preserves the full workflow structure

### Option B: Install the Pre-Built Package

Copy the package directly to Claude Code:

```bash
cp -r docs/data/project-kickstart-workflow ~/.claude/skills/project-kickstart
```

### Using the Skill in Claude Code

Once installed, Claude Code recognizes the skill when you start a new project. The PM persona, CIRCLES/EARS references, and step templates are available as context. You won't have ContextForge's visual workflow, but the methodology guides the conversation.

---

## Presenting Results

After completing the pipeline, use the `stakeholder-comms` skill from [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) to prepare presentations:
- Executive summary (200 words max)
- Technical brief for engineering leads
- Sprint-ready story backlog for the development team

---

## Checklist: Before You Hand Off

Run through this after L5, before handing stories to the dev team:

- [ ] Brief has a clear problem statement with evidence
- [ ] IRD uses EARS syntax consistently — every requirement is testable
- [ ] GATE decision is documented with explicit rationale
- [ ] At least 2 personas with distinct behavioral goals
- [ ] Scenarios cover happy path + at least 1 edge case per persona
- [ ] Conceptual model glossary has no ambiguous terms
- [ ] Every story maps to a persona + scenario
- [ ] No story is larger than one sprint
- [ ] Walking skeleton is identified and could ship independently
- [ ] All [ASSUMPTION] tags have a plan for validation

---

## Quick Reference

| Step | Method | Primary Output | Save to Memory? |
|------|--------|----------------|-----------------|
| L0 | CIRCLES | Project Brief + Appetite | — |
| L1 | EARS | IRD with testable requirements | — |
| GATE | Decision framework | GO / PIVOT / KILL | Set up memory schema (PM template) |
| L2 | Proto-persona | 2-3 user archetypes | Personas as `stakeholder` entries |
| L3 | Journey mapping | User scenarios | Key scenarios as `tension`/`learning` |
| L3.5 | Fat-marker sketches | Key screen layouts | — |
| L4 | Use-case driven | Conceptual model | Glossary terms as `decision` entries |
| L5 | Story mapping | Prioritized user stories | — |

---

## Related Documentation

- [GUIDE-skill-writing.md](./GUIDE-skill-writing.md) — How to write Claude Code skills
- [research/claude-code-pm-skills-evaluation.md](./research/claude-code-pm-skills-evaluation.md) — Quality evaluation of community PM skills
- [VERIFICATION-context-map-import-export.md](./VERIFICATION-context-map-import-export.md) — Testing import/export round trips
- [ARCHITECTURE.md](./ARCHITECTURE.md) — ContextForge technical architecture
