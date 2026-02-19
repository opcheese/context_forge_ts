> **Status: Exploratory — not yet implemented**

# Design: Block Type Usage in Context Assembly

## Current State

Block types exist (CHARACTER, SETTING, MECHANIC, PLOT, THEME, RULE, NOTE, OTHER) but are purely cosmetic - used only for UI badges. When assembling context for the LLM, all blocks are treated identically.

## Problem

The model receives a flat list of content without knowing what each piece represents. This loses valuable semantic information that could help the model:
- Understand the structure of the game/document
- Prioritize certain information
- Respond more appropriately based on content type

## Ideas for Block Type Usage

### 1. Type Prefixes in Context

When assembling context, prepend each block with its type:

```markdown
## CHARACTER
Elena is the protagonist, a former mechanic turned pilot...

## SETTING
The story takes place in Neo-Tokyo, 2157...

## MECHANIC
Combat uses a d20 + modifier system...
```

**Pros:** Simple, explicit, model understands structure
**Cons:** Uses extra tokens, might be repetitive

### 2. Grouped by Type

Organize context by type instead of zone:

```markdown
# Characters
- Elena: protagonist, former mechanic...
- Marcus: antagonist, corporate executive...

# Settings
- Neo-Tokyo: cyberpunk megacity...
- The Undercity: lawless zone beneath...

# Mechanics
- Combat: d20 + modifier
- Skills: point-buy system
```

**Pros:** Clear organization, model sees related info together
**Cons:** Loses zone priority (PERMANENT vs WORKING), more restructuring needed

### 3. Type-Aware System Prompts

Include type definitions in the system prompt:

```
You are helping design a game. The context includes:
- CHARACTER blocks: Define people, NPCs, or entities
- SETTING blocks: Describe locations, world, environment
- MECHANIC blocks: Game rules, systems, procedures
- PLOT blocks: Story events, narrative arcs
- THEME blocks: Core ideas, motifs, tone
- RULE blocks: Constraints, requirements, guidelines
- NOTE blocks: Miscellaneous information

Treat each type appropriately when generating content.
```

**Pros:** Model understands semantics without per-block overhead
**Cons:** Extra system prompt tokens, model might ignore

### 4. Selective Inclusion by Task

Different brainstorm tasks could prioritize different types:

| Task | Primary Types | Secondary | Exclude |
|------|--------------|-----------|---------|
| Character development | CHARACTER, THEME | SETTING, PLOT | MECHANIC, RULE |
| Combat design | MECHANIC, RULE | CHARACTER | PLOT, THEME |
| World-building | SETTING, THEME | CHARACTER | MECHANIC |
| Story planning | PLOT, CHARACTER | SETTING, THEME | MECHANIC, RULE |

**Pros:** More focused context, fewer tokens wasted
**Cons:** Complex to implement, might miss relevant cross-type info

### 5. Type-Based Formatting

Different types rendered differently:

```markdown
### Characters
| Name | Role | Description |
|------|------|-------------|
| Elena | Protagonist | Former mechanic turned pilot |
| Marcus | Antagonist | Corporate executive |

### Mechanics
1. **Combat**: Roll d20 + modifier vs target DC
2. **Skills**: Point-buy system, 30 points at creation

### Setting
> Neo-Tokyo, 2157: A sprawling cyberpunk megacity where
> corporations rule and the law is for sale...
```

**Pros:** Optimized presentation per type
**Cons:** Complex formatting logic, might break with certain content

### 6. Metadata Tags (Minimal Overhead)

Use inline tags that are compact:

```
[char] Elena is the protagonist...
[set] Neo-Tokyo, 2157...
[mech] Combat uses d20 + modifier...
```

**Pros:** Minimal token overhead, still provides type info
**Cons:** Less readable, model needs to understand shorthand

## Recommendation

Start with **Option 1 (Type Prefixes)** combined with **Option 3 (System Prompt)**:

1. Add type definitions to the system prompt (one-time cost)
2. Prefix each block with `## {TYPE}` header when assembling context
3. Keep zone-based ordering (PERMANENT first, then STABLE, then WORKING)

This gives the model clear structure without major changes to context assembly logic.

## Future Enhancements

- **Brainstorm modes** (Item 17 from bug report) could use Option 4 (selective inclusion)
- **Token optimization** could use Option 6 (minimal tags) for large contexts
- **User preference** could let users choose formatting style

## Related

- Bug Report Item 7: "Maybe should add explanation of what each note tag is for"
- Bug Report Item 17: Brainstorm modes (clarifying questions, document creation, etc.)

## Status

Design exploration - not yet planned for implementation
