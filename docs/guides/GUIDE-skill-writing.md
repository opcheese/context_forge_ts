# Writing Claude Code Skills with ContextForge

Step-by-step guide for using ContextForge as your skill development environment.

---

## What You Get

ContextForge gives you a structured workspace for skill writing:

- **PERMANENT zone** — Skill writing rules always in LLM context during brainstorming
- **STABLE zone** — Reference material: quality checklist, persuasion patterns, examples
- **WORKING zone** — Your skill draft, pressure scenarios, test results
- **Brainstorm panel** — Generate and iterate on skill content with all context loaded
- **Export** — Package finished skill as a proper ZIP with SKILL.md + references

---

## Setup (One Time)

### 1. Import the Skill Writing Template

1. Open ContextForge
2. Create a new session (or use the current one)
3. Drag `docs/data/skill-writing-template.zip` onto any zone
4. The import creates 5 blocks across all three zones:

| Zone | Block | Purpose |
|---|---|---|
| PERMANENT | skill-writing-rules.md | Iron rules, frontmatter spec, quality gates |
| STABLE | Skill Writing Guide | Main guide (the SKILL.md itself) |
| STABLE | quality-checklist.md | RED/GREEN/REFACTOR checklists |
| STABLE | persuasion-patterns.md | Authority, commitment, rationalization tables |
| WORKING | draft-template.md | Starter template for your new skill |

### 2. Save as Template

1. Click the **Save** dropdown in the header
2. Choose **Save as Template**
3. Name it "Skill Writing"
4. Now every new skill starts from this template

---

## Workflow: Writing a New Skill

### Step 0: Start from Template

1. Click **New Session**
2. Choose **From Template** → "Skill Writing"
3. Rename the session to your skill name (e.g., "verification-before-completion")

Your zones are pre-loaded. The PERMANENT zone rules will be included in every brainstorm and generation from this point on.

---

### Step 1: RED Phase — Baseline Testing

**Goal:** Document what agents do wrong WITHOUT your skill.

#### Create Pressure Scenarios

1. In the WORKING zone, replace the draft-template block with your pressure scenarios
2. Use the brainstorm panel to help generate scenarios:

**Example brainstorm prompt:**
```
I'm writing a skill about [TOPIC]. I need 3 pressure scenarios
that test whether an agent follows this rule: [RULE].

Each scenario should:
- Combine 3+ pressures (time, sunk cost, authority, exhaustion)
- Have concrete A/B/C choices
- Use real file paths and real consequences
- End with "Make the decision."
```

3. Save good scenarios as blocks in WORKING zone (click **Save** on brainstorm messages)

#### Run Baseline Tests

1. Copy each scenario
2. Test it in a fresh Claude Code session (without your skill installed)
3. Paste the agent's response back into ContextForge as a new block in WORKING zone
4. Mark the block with what went wrong — the exact rationalization the agent used

**Tip:** Use block type `NOTE` for your observations and `REFERENCE` for agent responses.

#### Document Patterns

Once you have 3+ baseline results, brainstorm to find patterns:

```
Here are agent responses to pressure scenarios without my skill.
What rationalization patterns do you see? List each unique excuse
and how often it appeared.
```

Save the pattern analysis to WORKING zone.

---

### Step 2: GREEN Phase — Write Minimal Skill

**Goal:** Write the smallest SKILL.md that fixes the observed failures.

#### Draft the Skill

1. Open the draft-template block in WORKING zone (or create a new block)
2. Start with the YAML frontmatter — the rules are in your PERMANENT zone:
   - `name`: letters, numbers, hyphens only, max 64 chars
   - `description`: starts with "Use when...", third person, max 1024 chars

3. Use brainstorm to iterate on the content:

```
Based on the rationalization patterns I documented, write a minimal
SKILL.md that counters each observed failure. Use the discipline
skill patterns from the persuasion reference. Keep it under 500 lines.
```

4. The brainstorm has full context — your rules (PERMANENT), reference material (STABLE), and your test results (WORKING) are all loaded.

#### Validate Frontmatter

Check against the rules in PERMANENT zone:
- [ ] `name` uses only letters, numbers, hyphens
- [ ] `name` under 64 characters
- [ ] `description` starts with "Use when..."
- [ ] `description` is third person
- [ ] `description` under 1024 characters
- [ ] `description` does NOT summarize workflow

#### Test with Skill

1. Save your draft SKILL.md to a local file
2. Install it: copy to `~/.claude/skills/your-skill-name/SKILL.md`
3. Run the same pressure scenarios from RED phase WITH the skill
4. Document results in WORKING zone
5. Compare: did the agent comply this time?

**If agent still fails:** proceed to REFACTOR. Don't iterate endlessly in GREEN.

---

### Step 3: REFACTOR Phase — Bulletproof

**Goal:** Close every loophole the agent finds.

#### Identify New Rationalizations

If GREEN testing revealed new excuses, add them to your working context:

```
The agent read my skill but still failed in scenario 2. Here's what
it said: "[exact quote]". What rationalization is it using, and how
should I counter it in the skill?
```

#### Build Rationalization Table

Use brainstorm to generate a table:

```
Based on all the rationalizations I've documented, build a
rationalization table with two columns: "Excuse" and "Reality".
Format it as markdown.
```

Add this table to your skill draft.

#### Meta-Test

Create a new brainstorm with this prompt:

```
You just read my skill and still chose the wrong option in a
pressure scenario. How could the skill be written to make the
right answer crystal clear to you?
```

The response reveals one of three things:
1. "Skill WAS clear, I ignored it" → Add a foundational principle
2. "Skill should have said X" → Add their suggestion verbatim
3. "I didn't see section Y" → Move key points earlier/more prominent

#### Final Validation

Work through the quality checklist in STABLE zone. Every checkbox should be checked before export.

---

### Step 4: Export

#### Option A: Copy and Save Manually

1. Open the skill draft block
2. Copy the content
3. Save as `SKILL.md` in your skill directory
4. If you have reference files, copy those too

#### Option B: Export as ZIP

1. Click **Export** in the session menu
2. Download the ZIP
3. Extract and verify the structure:
   ```
   your-skill-name/
     SKILL.md
     references/
       *.md
   ```

---

## Zone Strategy

How to use each zone effectively during skill writing:

### PERMANENT Zone (Always in Context)

Keep only the core rules here. This content is included in every brainstorm and generation, so it must be concise and always relevant.

**What goes here:**
- Skill writing rules (pre-loaded from template)
- Your skill's core principle (once you've identified it)

**What does NOT go here:**
- Reference material (use STABLE)
- Draft content (use WORKING)
- Test results (use WORKING)

### STABLE Zone (Reference Material)

Material you need to consult but doesn't need to be in every prompt.

**What goes here:**
- Quality checklist
- Persuasion patterns
- Example skills for reference
- The skill writing guide itself

**Tip:** Import existing skills as reference. Drop a ZIP of a well-written skill into STABLE zone to study its patterns.

### WORKING Zone (Active Work)

Your current draft and everything related to the current phase.

**What goes here:**
- Pressure scenarios
- Baseline test results (agent responses)
- Pattern analysis
- Skill draft in progress
- GREEN/REFACTOR test results

**Tip:** Clean up between phases. After RED, compress or remove raw test responses and keep only the pattern analysis. After GREEN, remove failed drafts.

---

## Using Brainstorm Effectively

The brainstorm panel assembles context from all zones before sending to the LLM. This means your rules, references, and working material are all available.

### Good Prompts for Each Phase

**RED — Generating scenarios:**
```
Generate a pressure scenario for testing [RULE]. The scenario should
combine time pressure, sunk cost from 2 hours of work, and authority
pressure from a senior engineer. Use real file paths.
```

**GREEN — Drafting skill content:**
```
Write the "When to Use" section for my skill. It should describe
symptoms that indicate this skill is needed, based on the failures
I documented.
```

**REFACTOR — Countering rationalizations:**
```
The agent said "[quote]" when justifying its wrong choice. Write an
explicit counter for this rationalization, using the Authority
persuasion pattern.
```

**REFACTOR — Meta-testing:**
```
Pretend you're an agent who just read my skill draft and still chose
option B in scenario 1. Explain your reasoning, then explain how the
skill could be rewritten to prevent this.
```

### Compression

If your WORKING zone gets large (many test results, draft iterations), use **Compress** on older blocks to save tokens while keeping the information available.

---

## Checklist: Before You Ship

Run through this before considering your skill done:

- [ ] RED phase has 3+ documented baseline failures
- [ ] GREEN phase skill addresses only observed failures
- [ ] Agent complies with skill installed in all scenarios
- [ ] REFACTOR phase closed all loopholes
- [ ] Meta-test feedback incorporated
- [ ] Frontmatter validates (name, description format)
- [ ] Skill under 500 lines (or split into reference files)
- [ ] Token budget met for skill category
- [ ] Exported and verified directory structure
- [ ] Tested in a clean environment (fresh session, no other context)

---

## Quick Reference

| Phase | ContextForge Action | Zone |
|---|---|---|
| Setup | Import template ZIP, save as template | All |
| RED: Scenarios | Brainstorm scenarios, save to blocks | WORKING |
| RED: Baseline | Test without skill, paste results | WORKING |
| RED: Patterns | Brainstorm pattern analysis | WORKING |
| GREEN: Draft | Write SKILL.md in block | WORKING |
| GREEN: Test | Test with skill, document results | WORKING |
| REFACTOR: Counter | Brainstorm rationalization counters | WORKING |
| REFACTOR: Meta | Meta-test prompt in brainstorm | WORKING |
| REFACTOR: Table | Build rationalization table | WORKING |
| Export | Download ZIP or copy manually | — |
