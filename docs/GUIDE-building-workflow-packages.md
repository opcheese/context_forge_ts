# Building Workflow Packages in ContextForge

How to build a multi-step workflow from scratch using ContextForge, then export it as a reusable skill package. Uses the Project Kickstart PM pipeline as the worked example.

---

## What You Get

After following this guide, you will know how to:

- Build templates for each step of a multi-step workflow
- Wire templates into a ContextForge workflow with carry-forward zones
- Test the workflow by running it on a real project
- Export the entire workflow as a distributable ZIP (installable as a Claude Code skill)

---

## Prerequisites

- ContextForge running locally (`pnpm exec convex dev` + `pnpm dev`)
- Reference materials for your workflow (we provide a starter pack below)

---

## Overview: What Makes a Workflow Package

A ContextForge workflow package is a ZIP with this structure:

```
my-workflow/
  SKILL.md              # Skill definition (name, description, methodology)
  context-map.yaml      # Step definitions with dependencies
  references/
    permanent/          # Blocks for PERMANENT zone (always active)
    stable/             # Blocks for STABLE zone (per-step materials)
    working/            # Blocks for WORKING zone (rarely pre-filled)
```

You build this by: **(1)** setting up sessions with the right zone content, **(2)** saving each as a template, **(3)** wiring templates into a workflow, **(4)** exporting.

---

## Step 1: Import Your Reference Materials

Before building templates, gather the materials that will live in your zones. For our PM pipeline, we distribute a starter pack of reference materials. Import them into a fresh session.

### 1.1 Create a Workspace Session

1. Open ContextForge
2. The home page shows a default session with three empty zones
3. This is your workspace — you'll build templates from here

### 1.2 Import the Reference Materials

We provide pre-built reference files so you don't need to hunt for them. These are the building blocks you'll arrange into templates.

**To import a file:**
1. Click **Import Skill** (puzzle icon in toolbar)
2. Upload the `.md` file
3. The file appears as a block in the appropriate zone

**Or drag-and-drop:** Drag any `.md` file directly onto a zone column.

**Reference materials for the PM pipeline:**

| File | What It Is | Goes In |
|------|-----------|---------|
| `pm-persona.md` | System prompt — enforces CIRCLES, EARS, user-oriented thinking | PERMANENT |
| `circles-reference.md` | CIRCLES framework quick reference card | STABLE |
| `ears-reference.md` | EARS requirement syntax patterns | STABLE |
| `brief-template.md` | Fill-in template for L0: Brief | STABLE |
| `ird-template.md` | Fill-in template for L1: IRD | STABLE |
| `gate-template.md` | GO/PIVOT/KILL decision framework | STABLE |
| `persona-template.md` | Proto-persona template for L2 | STABLE |
| `scenario-template.md` | User journey template for L3 | STABLE |
| `mocks-template.md` | Screen sketch template for L3.5 | STABLE |
| `conceptual-model-template.md` | Domain glossary template for L4 | STABLE |
| `stories-template.md` | Story mapping template for L5 | STABLE |

Import all of them. Your session now has the full material library.

---

## Step 2: Build Your First Template (L0: Brief)

A template is a snapshot of a session's zone contents. To build one, arrange the right blocks in the right zones, then save.

### 2.1 Arrange Zones for L0

The Brief step needs:
- **PERMANENT**: PM persona (the system prompt that shapes all LLM interactions)
- **STABLE**: CIRCLES reference card + Brief template
- **WORKING**: Empty (the PM fills this during the session)

You imported everything into one session. Now clean it up for L0:

1. **Keep in PERMANENT**: `pm-persona.md` — if it landed elsewhere, drag it to PERMANENT or click the zone-move button (→ PERMANENT) on hover
2. **Keep in STABLE**: `circles-reference.md` and `brief-template.md`
3. **Move everything else out**: Delete or move the remaining blocks (IRD template, EARS card, etc.) — you'll use them in other templates

**Tip:** Don't worry about losing blocks. You already have the source files. You can re-import any block you delete.

### 2.2 Save as Template

1. Open **Tools** in the toolbar
2. Click **Save Template**
3. Name: `L0: Brief (CIRCLES)`
4. Description: `Problem comprehension using CIRCLES framework. Includes PM persona and brief template.`
5. Click **Save Template**

Done. The L0 template is saved. It captures exactly what's in your three zones right now.

---

## Step 3: Build the Remaining Templates

Repeat the process for each pipeline step. For each template:
1. Clear the session or start fresh
2. Import/arrange the right blocks per zone
3. Save as template

### Template configurations:

**L1: IRD (EARS)**
| Zone | Blocks |
|------|--------|
| PERMANENT | `pm-persona.md` |
| STABLE | `ears-reference.md` + `ird-template.md` |
| WORKING | Empty |

Save as: `L1: IRD (EARS)`

---

**GATE: GO/PIVOT/KILL**
| Zone | Blocks |
|------|--------|
| PERMANENT | `pm-persona.md` |
| STABLE | `gate-template.md` |
| WORKING | Empty |

Save as: `GATE: GO/PIVOT/KILL`

---

**L2: Personas**
| Zone | Blocks |
|------|--------|
| PERMANENT | `pm-persona.md` |
| STABLE | `persona-template.md` |
| WORKING | Empty |

Save as: `L2: Personas`

---

**L3: Scenarios**
| Zone | Blocks |
|------|--------|
| PERMANENT | `pm-persona.md` |
| STABLE | `scenario-template.md` |
| WORKING | Empty |

Save as: `L3: Scenarios`

---

**L3.5: Mocks (optional)**
| Zone | Blocks |
|------|--------|
| PERMANENT | `pm-persona.md` |
| STABLE | `mocks-template.md` |
| WORKING | Empty |

Save as: `L3.5: Mocks`

---

**L4: Conceptual Model**
| Zone | Blocks |
|------|--------|
| PERMANENT | `pm-persona.md` |
| STABLE | `conceptual-model-template.md` |
| WORKING | Empty |

Save as: `L4: Conceptual Model`

---

**L5: Stories**
| Zone | Blocks |
|------|--------|
| PERMANENT | `pm-persona.md` |
| STABLE | `stories-template.md` |
| WORKING | Empty |

Save as: `L5: Stories`

You now have 8 templates. Each captures a step's zone configuration.

---

## Step 4: Create the Workflow

Workflows chain templates into a pipeline with carry-forward between steps.

### 4.1 Create a New Workflow

1. Navigate to **Workflows** page
2. Click **+ New Workflow**
3. Name: `Project Kickstart`
4. Description: `8-step PM pipeline from Brief to Stories. CIRCLES + EARS methodology with GO/PIVOT/KILL gate.`
5. Click **Create Workflow**

### 4.2 Add Steps

You're now in the workflow editor. Click **+ Add Step** for each pipeline step:

**Step 1:**
- Name: `L0: Brief (CIRCLES)`
- Template: Select `L0: Brief (CIRCLES)` from dropdown
- Carry Forward: None (this is the first step)
- Click **Add Step**

**Step 2:**
- Name: `L1: IRD (EARS)`
- Template: Select `L1: IRD (EARS)`
- Carry Forward: Toggle **PERMANENT** and **WORKING** on
- Click **Add Step**

**Step 3:**
- Name: `GATE: GO/PIVOT/KILL`
- Template: Select `GATE: GO/PIVOT/KILL`
- Carry Forward: **PERMANENT** and **WORKING**
- Click **Add Step**

**Step 4:**
- Name: `L2: Personas`
- Template: Select `L2: Personas`
- Carry Forward: **PERMANENT** and **WORKING**
- Click **Add Step**

**Step 5:**
- Name: `L3: Scenarios`
- Template: Select `L3: Scenarios`
- Carry Forward: **PERMANENT** and **WORKING**
- Click **Add Step**

**Step 6:**
- Name: `L3.5: Mocks (optional)`
- Template: Select `L3.5: Mocks`
- Carry Forward: **PERMANENT** and **WORKING**
- Click **Add Step**

**Step 7:**
- Name: `L4: Conceptual Model`
- Template: Select `L4: Conceptual Model`
- Carry Forward: **PERMANENT** and **WORKING**
- Click **Add Step**

**Step 8:**
- Name: `L5: Stories`
- Template: Select `L5: Stories`
- Carry Forward: **PERMANENT** and **WORKING**
- Click **Add Step**

### 4.3 Understanding Carry-Forward

When you advance from one step to the next, ContextForge copies blocks from the selected carry-forward zones into the new session. Then it loads the next template's blocks after them.

For this pipeline:
- **PERMANENT carries**: The PM persona stays active across all steps
- **WORKING carries**: Your outputs (brief, IRD, personas, etc.) accumulate as you progress
- **STABLE does NOT carry**: Each step loads its own fresh template and reference cards

This means at L5 (Stories), your WORKING zone contains the brief, IRD, gate decision, personas, scenarios, conceptual model — the full context for writing stories.

---

## Step 5: Test the Workflow

### 5.1 Start the Workflow

1. Go back to **Workflows** page
2. Find your `Project Kickstart` workflow
3. Click **Start Workflow**
4. Name: `Test Run — [your project name]`
5. Click **Start Project**

You're now in L0: Brief. Check your zones:
- **PERMANENT** should have the PM persona
- **STABLE** should have the CIRCLES card and brief template
- **WORKING** should be empty

### 5.2 Walk Through a Step

1. Open **Brainstorm** (click the Brainstorm button)
2. Select your LLM provider
3. Try: `Walk me through CIRCLES for a task management app for small teams.`
4. The PM persona guides the conversation — it will push back on solution-first thinking
5. When you have useful output, click **Save** on a message to add it as a WORKING block

### 5.3 Advance to Next Step

1. In the workflow indicator, click **Next** (or advance to the next step)
2. Verify L1 loads: EARS card + IRD template in STABLE, your L0 output carried in WORKING
3. Continue through a few steps to confirm carry-forward works

---

## Step 6: Export as Skill Package

Once your workflow is tested, export it as a distributable ZIP.

### 6.1 Export from ContextForge

1. Navigate to the project you created from the workflow
2. Click **Export Skill** (download icon in toolbar)
3. The dialog shows "Export Project" with step count and block count
4. Click **Download ZIP**

The exported ZIP contains:
- `SKILL.md` — generated from the first skill-type block found (or the session name)
- `context-map.yaml` — auto-generated workflow definition with `depends_on` chains
- `references/permanent/` — blocks from PERMANENT zones
- `references/stable/` — blocks from STABLE zones
- `references/working/` — blocks from WORKING zones (your generated content)

### 6.2 Customize the SKILL.md

The auto-generated SKILL.md may need editing. Open the ZIP and update:

```yaml
---
name: project-kickstart
description: Use when starting a new product or feature from scratch and need structured progression from idea to user stories.
---
```

The body should describe the methodology, pipeline steps, and when to use it. See the [Project Kickstart SKILL.md](./data/project-kickstart-workflow/SKILL.md) as an example.

### 6.3 Install as Claude Code Skill

```bash
# Unzip to Claude Code skills directory
unzip my-workflow.zip -d ~/.claude/skills/project-kickstart
```

Claude Code now recognizes the skill and uses it when relevant.

---

## Step 7: Distribute

Your workflow package can be shared in multiple ways:

| Method | How | Recipient Does |
|--------|-----|---------------|
| **ZIP file** | Send the `.zip` directly | Import via ContextForge Import Skill dialog |
| **Claude Code skill** | Copy to `~/.claude/skills/` | Claude Code auto-detects it |
| **Git repository** | Commit the skill directory | Clone and import or install |

When someone imports your ZIP into ContextForge, the `context-map.yaml` triggers a project import — they get the full multi-step workflow with all templates pre-configured.

---

## Design Decisions: Building Good Workflows

### What goes in PERMANENT?

Content that every step needs. Typically:
- System prompts / personas
- Core methodology rules
- Project-wide constraints

Keep it small. PERMANENT content is included in every LLM call. Bloated PERMANENT zones waste tokens.

### What goes in STABLE?

Step-specific reference materials. Typically:
- Framework reference cards
- Fill-in templates
- Examples and patterns

STABLE swaps with each step. The brief step gets CIRCLES; the IRD step gets EARS.

### What goes in WORKING?

User-generated content. Typically empty in templates. This is where the PM (or developer, or writer) creates their deliverables during the workflow.

### When to carry forward WORKING?

Almost always. Each step's output is input for the next. Without WORKING carry-forward, you'd lose all prior context when advancing.

Exception: If a step's output is very large and would blow token budgets, consider compressing it before advancing.

### When to carry forward STABLE?

Rarely. Each step has its own STABLE content via templates. Carrying STABLE forward would mix reference materials from different steps. Usually you want a clean swap.

Exception: If multiple steps share the same reference material, carry STABLE to avoid duplication.

### How many steps?

5-10 is the sweet spot. Fewer than 5 and you probably don't need a workflow — just use a single session. More than 10 and the pipeline gets unwieldy. Split into sub-workflows if needed.

---

## Checklist: Before You Ship a Workflow Package

- [ ] Every template has been saved and tested
- [ ] Workflow steps are in the right order
- [ ] Carry-forward zones are configured (PERMANENT + WORKING at minimum)
- [ ] First step has no carry-forward (nothing to carry from)
- [ ] Tested with a real example (not just verified zones)
- [ ] SKILL.md has proper frontmatter (`name` and `description`)
- [ ] Description starts with "Use when..." (CSO optimization for Claude Code)
- [ ] Exported ZIP imports cleanly into a fresh ContextForge instance
- [ ] Optional: installed as Claude Code skill and tested

---

## Quick Reference

| Phase | What You Do | ContextForge Feature |
|-------|------------|---------------------|
| Gather materials | Import reference files | Import Skill (upload/drag-drop) |
| Build templates | Arrange zones, save | Save Template |
| Wire workflow | Add steps, set carry-forward | Workflow Editor |
| Test | Start workflow, walk through steps | Start Workflow + Brainstorm |
| Export | Download ZIP | Export Skill |
| Distribute | Share ZIP or install as skill | Import Skill / `~/.claude/skills/` |

---

## Related Documentation

- [GUIDE-project-kickstart.md](./GUIDE-project-kickstart.md) — Using the pre-built PM pipeline
- [GUIDE-skill-writing.md](./GUIDE-skill-writing.md) — Writing Claude Code skills with TDD
- [VERIFICATION-context-map-import-export.md](./VERIFICATION-context-map-import-export.md) — Testing import/export round trips
- [ARCHITECTURE.md](./ARCHITECTURE.md) — ContextForge technical architecture
