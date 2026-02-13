---
name: project-kickstart
description: Use when starting a new product or feature from scratch and need structured progression from idea to user stories. Guides through CIRCLES brief, EARS requirements, GO/PIVOT/KILL gate, personas, scenarios, conceptual model, and story mapping.
---

# Project Kickstart Pipeline

Take a raw idea through 8 structured steps to produce actionable user stories. Core principle: user-oriented thinking over feature lists, evidence over assumptions. Each step has explicit inputs, outputs, and a method — skip nothing.

## When to Use

**Use for:**
- New product from scratch
- New major feature (multi-sprint scope)
- Pivot or significant direction change
- Redesign of existing product area

**Do NOT use for:**
- Bug fixes or patches
- Incremental feature improvements
- Technical debt or refactoring
- Work where personas and requirements already exist

## Pipeline

| Step | Name | Method | Input | Output |
|------|------|--------|-------|--------|
| L0 | Brief | CIRCLES | Raw idea, transcript, notes | Problem statement + appetite |
| L1 | IRD | EARS syntax | Brief | Testable requirements |
| GATE | GO/PIVOT/KILL | Decision framework | Brief + IRD | Binary decision + rationale |
| L2 | Personas | Proto-persona | IRD + Brief | 2-3 user archetypes |
| L3 | Scenarios | Journey mapping | Personas + IRD | User journeys with touchpoints |
| L3.5 | Mocks (opt) | Visual sketching | Scenarios + Personas | Key screen layouts |
| L4 | Conceptual Model | Use-case driven | Scenarios + Personas + IRD | Domain glossary + relationships |
| L5 | Stories | Story mapping | Model + Scenarios + Personas | Prioritized user stories |

Execute steps in order. Do not start a step until the previous step's output exists. The GATE is mandatory — it exists to prevent wasted effort on doomed projects.

## Zone Strategy

This skill uses ContextForge's three-zone system:

- **PERMANENT**: PM persona system prompt. Always active, shapes every LLM interaction throughout the pipeline. Enforces user-oriented thinking, CIRCLES/EARS methods, and anti-pattern detection.
- **STABLE**: Reference cards for CIRCLES and EARS methods, plus the step template for the current pipeline step. Swap the step template as you progress through L0-L5.
- **WORKING**: Your deliverables. The brief, IRD, gate decision, persona cards, scenarios, conceptual model, and story map. These are the documents you produce at each step.

## Step Progression

1. Start at L0. Load the L0 step template into STABLE.
2. Complete L0 outputs and save to WORKING.
3. Swap STABLE step template to L1. Use L0 outputs as input.
4. Complete L1. Save to WORKING.
5. Run GATE. This is a hard checkpoint — do not proceed without an explicit GO decision.
6. If GO: continue L2 through L5, swapping step templates as you progress.
7. If PIVOT: return to L0 with revised direction.
8. If KILL: stop. Archive outputs. Document why.

## Common Mistakes

**Skipping the GATE.** Investing in personas, scenarios, and stories for a project that should be killed. The GATE exists to save effort — use it honestly.

**Gold-plating the Brief.** The Brief is a working document, not a pitch deck. Get the problem statement and appetite down, then move on. You will refine understanding through later steps.

**Writing stories before personas.** Stories without user context are feature lists. Personas ground every story in a real user's goals and constraints.

**Treating IRD as final.** Requirements evolve as personas and scenarios reveal gaps. Return to the IRD and update it when new information surfaces — this is expected, not a failure.

**Solution-first thinking.** Starting with "we need a dashboard" before understanding what problem the dashboard solves. CIRCLES forces problem comprehension before solutions.
