> **Status: Exploratory — not yet implemented (see ROADMAP.md item 25)**

# Design: Effective Brainstorm Questioning

## Problem

When brainstorming, AI models tend to ask multiple questions at once, overwhelming users:

```
AI: Great! To help you design this game mechanic, I have a few questions:
1. What's the target audience?
2. Is this for single-player or multiplayer?
3. What's the core loop?
4. How long should a session last?
5. What platforms are you targeting?
6. What's the monetization model?
```

This creates cognitive overload and users often:
- Skip questions
- Give incomplete answers
- Lose track of what was asked
- Feel interrogated rather than guided

## Best Practice: One Question at a Time

Reference: [Superpowers Brainstorming Skill](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md)

Key principles:
1. **One question per message** - break complex topics into sequential questions
2. **Multiple choice when possible** - easier to answer than open-ended
3. **Sequential exploration** - build understanding progressively
4. **Validate incrementally** - "Does this look right so far?"

## Solution Approaches

### Approach A: System Prompt Guidance

Add instructions to the brainstorm system prompt:

```markdown
## Questioning Style

When gathering information:
- Ask ONE question at a time
- Wait for the user's response before asking the next question
- Prefer multiple choice questions when the options are knowable
- For complex topics, break into a sequence of focused questions
- After receiving answers, summarize understanding before moving on

Example - Instead of:
"What's the genre, target audience, and platform?"

Do this:
"What genre is your game? (e.g., RPG, puzzle, action, simulation)"
[wait for response]
"Who's your target audience?
A) Casual mobile gamers
B) Hardcore PC gamers
C) Families/all ages
D) Other (please describe)"
[wait for response]
```

### Approach B: Brainstorm Mode Templates

Pre-built system prompts for different phases (relates to Item 17):

**Discovery Mode:**
```
You are helping discover requirements through focused questions.
- Ask ONE question at a time
- Use multiple choice when possible
- Summarize after every 3-4 answers
- Don't propose solutions yet
```

**Design Mode:**
```
Based on gathered requirements, propose solutions.
- Present 2-3 approaches with trade-offs
- Break designs into 200-300 word sections
- Ask "Does this direction feel right?" after each section
```

### Approach C: User Education

Document best practices for users to customize their own system prompts:

1. Add to session/block as SYSTEM type
2. Include questioning guidelines
3. Reference example prompts in documentation

---

## Recommended System Prompt Addition

For ContextForge's default brainstorm behavior:

```markdown
## Interaction Guidelines

1. **One Question Rule**: Ask only ONE question per message. If you need multiple pieces of information, ask them sequentially across multiple exchanges.

2. **Multiple Choice Preferred**: When options are finite and knowable, offer multiple choice:
   - A) Option one
   - B) Option two
   - C) Option three
   - D) Other (please specify)

3. **Progressive Understanding**: Build context step by step:
   - Start with the most fundamental question
   - Each question should build on previous answers
   - Summarize understanding every 3-4 exchanges

4. **Incremental Validation**: When presenting ideas or designs:
   - Break into digestible sections (200-300 words)
   - After each section, ask: "Does this align with your vision?"
   - Adjust based on feedback before continuing

5. **Never Assume**: If something is unclear, ask for clarification rather than assuming.
```

---

## Implementation Options

### Option 1: Default System Prompt (Simplest)

Add these guidelines to the default brainstorm system prompt that's always included.

**Pros:** Works immediately, no UI changes
**Cons:** Users can't easily customize, might not fit all use cases

### Option 2: System Prompt Templates

Provide selectable templates in brainstorm settings:
- "Focused Discovery" (one question at a time)
- "Quick Brainstorm" (more free-form)
- "Custom" (user-defined)

**Pros:** Flexibility, user choice
**Cons:** More UI work, decision paralysis

### Option 3: Documentation Only

Document best practices, let users add to their session context.

**Pros:** No code changes
**Cons:** Users must discover and implement themselves

---

## Recommendation

**Start with Option 1** (default system prompt), evolve to **Option 2** (templates) later.

1. Add questioning guidelines to default brainstorm system prompt
2. Document the guidelines so users understand the behavior
3. Later: Add brainstorm mode selector (ties into Item 17)

---

## Example Interaction

**Without one-question-at-a-time:**
```
User: I want to design a crafting system

AI: Great! Here are my questions:
1. What game genre?
2. How many items?
3. Recipe complexity?
4. Resource gathering?
5. Player progression?
6. Multiplayer trading?

User: Uh... RPG, maybe 100 items, medium complexity, yes gathering,
      leveling up unlocks recipes, no multiplayer

AI: [Proceeds with assumptions based on terse answers]
```

**With one-question-at-a-time:**
```
User: I want to design a crafting system

AI: What genre is your game?
A) RPG/Adventure
B) Survival
C) Simulation/Building
D) Other

User: A - RPG

AI: In RPG crafting, items often tie to character progression.
How should crafting relate to your character's growth?
A) Crafting skill levels up separately (like Skyrim)
B) Recipes unlock with character level
C) Crafting is class-specific
D) Other approach

User: B - unlock with level

AI: Got it - level-gated recipes. Roughly how many craftable items
are you imagining?
A) Small set (20-30 iconic items)
B) Medium (50-100 items)
C) Large (200+ items)
D) Not sure yet

User: B

AI: Let me summarize what I understand so far:
- RPG genre
- Recipes unlock as character levels up
- Medium item pool (~50-100 items)

Does this capture your vision? Anything to adjust before we
dive into recipe structure?
```

---

## Related

- Bug Report Item 19: "Maybe AI should ask one question at a time"
- Bug Report Item 17: Brainstorm modes (different phases)
- DESIGN-block-type-usage.md (context assembly)

## Status

Design exploration - ready for implementation decision

## References

- [Superpowers Brainstorming Skill](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md)
