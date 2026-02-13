# User Stories

Stories are organized as a story map: activities across the top (horizontal), priority tiers down (vertical). Every story must trace back to a persona and scenario.

---

## Story Map

### Activity: [User Activity Name — from scenarios]

**Steps** (horizontal, in order the user performs them):

#### Step: [Step Name]

**Walking Skeleton** (minimum viable — ship first):
- **[STORY-001]** As [Persona], I want [action] so that [outcome]
  - Given [precondition]
  - When [action]
  - Then [expected result]
  - Priority: MUST
  - Traces to: [Scenario name, step number]

**Release 1** (next tier of value):
- **[STORY-002]** As [Persona], I want [action] so that [outcome]
  - Given / When / Then
  - Priority: SHOULD
  - Traces to: [Scenario, step]

**Future** (nice to have, validated need but can wait):
- **[STORY-003]** ...
  - Priority: COULD

---

[Repeat for each Activity > Step combination]

## Story Quality Checklist

For each story, verify:
- [ ] Uses a specific persona name (not "As a user")
- [ ] The "so that" explains user value (not system behavior)
- [ ] Acceptance criteria are testable (Given/When/Then)
- [ ] Story is a vertical slice (delivers value alone, not a horizontal layer)
- [ ] Story fits within one sprint
- [ ] Traces back to a specific scenario step
- [ ] Conceptual model entities are used consistently

## Dependencies
[Which stories depend on other stories? Draw the critical path for the Walking Skeleton.]
