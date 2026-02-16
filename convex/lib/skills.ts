/**
 * Server-side ephemeral skills registry.
 * Mirrors src/lib/llm/skills/ for the Claude backend path.
 */

const BRAINSTORMING_SKILL = {
  id: "brainstorming",
  label: "Brainstorming Methodology",
  content: `# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs through natural collaborative dialogue.

The user's context blocks are already loaded into this conversation. Use them to understand the project, domain, and constraints. Ask questions one at a time to refine the idea. Once you understand what's being designed, present the design and get user approval.

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every idea goes through this process. "Simple" ideas are where unexamined assumptions cause the most wasted work. The design can be short (a few sentences for truly simple ideas), but you MUST present it and get approval.

## Process Flow

1. **Review the context blocks** — understand the project/domain from what's already loaded
2. **Ask clarifying questions** — one at a time, understand purpose/constraints/success criteria
3. **Propose 2-3 approaches** — with trade-offs and your recommendation
4. **Present design** — in sections scaled to their complexity, get user approval after each section

## The Process

**Understanding the idea:**
- Review the context blocks to understand the project and domain
- Ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: purpose, constraints, success criteria

**Exploring approaches:**
- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**
- Once you believe you understand what's being designed, present it
- Scale each section to its complexity: a few sentences if straightforward, up to 200-300 words if nuanced
- Ask after each section whether it looks right so far
- Cover whatever aspects are relevant to the domain (structure, flow, trade-offs, edge cases)
- Be ready to go back and clarify if something doesn't make sense

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary complexity from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, get approval before moving on
- **Be flexible** - Go back and clarify when something doesn't make sense`,
}

const SKILLS: Record<string, typeof BRAINSTORMING_SKILL> = {
  [BRAINSTORMING_SKILL.id]: BRAINSTORMING_SKILL,
}

/**
 * Get formatted content for active skills by their IDs.
 */
export function getActiveSkillsContent(skillIds: string[]): string {
  const parts: string[] = []
  for (const id of skillIds) {
    const skill = SKILLS[id]
    if (skill) {
      parts.push(`[Active Skill: ${skill.label}]\n${skill.content}`)
    }
  }
  return parts.join("\n\n")
}
