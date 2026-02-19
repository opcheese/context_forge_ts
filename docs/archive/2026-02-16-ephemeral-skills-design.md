# Ephemeral Skills for Brainstorm

**Date:** 2026-02-16
**Status:** Approved
**Skill source:** https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md

## Problem

The brainstorm button benefits from injecting a methodology prompt (like the superpowers brainstorming SKILL.md) into the LLM call. But ContextForge's core principle is iron-hand control over context — every piece of text sent to the LLM should be visible and controllable by the user. Silently injecting content violates this. Adding it as a persistent block doesn't fit either, since brainstorm conversations are ephemeral.

## Solution: Visible Ephemeral Skills

Skills are **visible but ephemeral** context injections. They appear in the brainstorm dialog UI, can be read and toggled, but are never persisted as blocks. They exist only for the duration of the brainstorm session.

### User Experience

- When the brainstorm dialog opens, an "Active Skills" area appears at the top (alongside the existing "System Prompt Active" badge)
- Shows a chip labeled "Brainstorming Methodology" with a toggle (on by default)
- Clicking the chip text expands/collapses an inline preview of the full skill content
- Toggle off = excluded from subsequent LLM calls
- State resets when dialog closes (always starts on)

### Context Assembly Order

Skills are placed after WORKING zone blocks to preserve prompt caching:

1. System prompt (`system_prompt` block)
2. PERMANENT zone blocks
3. STABLE zone blocks
4. WORKING zone blocks
5. **Active skills** (injected here)
6. Conversation history
7. User message

This ensures toggling a skill only invalidates the conversation suffix, which changes every turn anyway. The entire block context stays cached.

### Skill Content Format

Skills are prefixed with a framing line:

```
[Active Skill: Brainstorming Methodology]
<skill content>
```

### Implementation

**New file: `src/lib/llm/skills/brainstorming.ts`**
- Exports the brainstorming methodology as a string constant
- Hardcoded for now; future: loadable/customizable

**Modified: `src/hooks/useBrainstorm.ts`**
- New state: `activeSkills: Record<string, boolean>` defaulting to `{ brainstorming: true }`
- Toggle function to flip individual skills on/off
- State is ephemeral — resets on dialog close
- Pass active skill names to context assembly

**Modified: `src/components/BrainstormDialog.tsx`**
- Render skill chips in the header area
- Click chip label → expand/collapse preview
- Toggle switch per skill
- Existing "System Prompt Active" badge remains unchanged

**Modified: `src/lib/llm/context.ts` (`assembleContextWithConversation`)**
- Accept optional `activeSkills` parameter (list of skill IDs)
- Look up skill content from the skills module
- Inject as system message after WORKING blocks, before conversation history

**Modified: `convex/claudeNode.ts` (Claude backend path)**
- Accept `activeSkillIds: string[]` parameter
- Read skill content from same hardcoded source (duplicated server-side)
- Inject in the same position during server-side context assembly

**Ollama/OpenRouter (client-side path)**
- Injected directly in `assembleContextWithConversation()` — no additional changes

### What This Does NOT Include

- No backend storage / schema changes
- No skill picker UI
- No user-uploaded skills
- No skill marketplace integration
- No multiple built-in skills

### Future Extensibility

The architecture supports future expansion without redesign:
- Localized skill variants (same skill, different language)
- User-customizable skill sets per session type
- Skills loaded from backend instead of hardcoded
- Skill marketplace (browse/import ephemeral skills)

All of these would work by extending the `activeSkills` map and the skill content registry — the injection mechanism and UI pattern stay the same.
