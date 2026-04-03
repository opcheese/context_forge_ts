# Research Pipeline Design

**Status**: Design (v1.0)  
**Date**: 2026-04-03  
**Scope**: Add web-search research step to ContextForge pipeline (research → brainstorm → formalize → verify)

---

## Problem

The current ContextForge pipeline starts at brainstorm. There is no way to ground ideas in current information before brainstorming. Users must research externally and manually paste findings into blocks. This breaks flow and adds friction before the creative work begins.

## Goal

Add a Research mode that:
- Lets Claude search the web (WebSearch + WebFetch) to answer a research question
- Streams the synthesized answer into the session
- Lets the user save useful research output as a WORKING zone block
- Feeds naturally into the existing brainstorm → formalize → verify stages

## Constraints

- Tool support exists only in the Claude Code provider (Ollama/OpenRouter have no WebSearch/WebFetch)
- Research must NOT pollute the brainstorm conversation history
- Web tools only — no filesystem, bash, or other tools
- Multi-turn is required: Claude calls tools → processes results → may call more tools
- YAGNI: no new block types, no schema migrations

---

## Architecture

### Backend: `isResearch` flag on existing action

Add `isResearch: v.optional(v.boolean())` to `streamBrainstormMessage` (in `claudeNode.ts`) and `startBrainstormGeneration` (in `generations.ts`).

When `isResearch = true`, the action configures the SDK call differently:

```
allowedTools: ["WebSearch", "WebFetch"]   // was []
maxTurns: 10                               // was 1
NO_TOOLS_SUFFIX: skipped                   // tools ARE available
NO_SELF_TALK_SUFFIX: skipped               // tool responses are not role-play
Session resume: skipped                    // always fresh context
RESEARCH_SUFFIX: appended                  // grounds the research task
```

Context assembly uses the existing "brainstorm" mode — includes PERMANENT and STABLE blocks, excludes validation/draft blocks. Research benefits from knowing the user's persona and goals (PERMANENT zone).

### `RESEARCH_SUFFIX` constant in `context.ts`

```typescript
export const RESEARCH_SUFFIX = `
RESEARCH MODE: You have access to WebSearch and WebFetch tools. Use them to research the user's question thoroughly before responding. Synthesize findings into a clear, structured summary. Cite your sources inline. Do not fabricate information — if you cannot find something, say so.`
```

### No schema changes

Research output is saved as a regular WORKING zone block (same as brainstorm output). The existing "Save to blocks" flow handles this. No new contextMode on blocks needed.

---

## Data Flow

```
User types research question
  → ResearchPanel calls startBrainstormGeneration({ isResearch: true })
  → Convex mutation creates generation record, schedules streamBrainstormMessage
  → Action assembles context (brainstorm mode), adds RESEARCH_SUFFIX
  → SDK call: allowedTools=["WebSearch","WebFetch"], maxTurns=10
  → Claude calls WebSearch/WebFetch internally (SDK manages loop)
  → Text output streams through existing buffer/flush pipeline
  → ResearchPanel renders streamed text
  → User clicks "Save" → saved as WORKING block
  → Brainstorm panel picks up saved block in next turn context
```

---

## Components

### `convex/generations.ts`
- Add `isResearch: v.optional(v.boolean())` to `startBrainstormGeneration` args
- Pass through to scheduled action

### `convex/claudeNode.ts` — `streamBrainstormMessage`
- Add `isResearch: v.optional(v.boolean())` arg
- Compute `contextMode` as: `isResearch ? "brainstorm" : isValidation ? "validation" : "brainstorm"`
- Skip session resume when `isResearch`
- SDK options: `allowedTools: isResearch ? ["WebSearch", "WebFetch"] : []`, `maxTurns: isResearch ? 10 : 1`
- System prompt building: skip NO_TOOLS_SUFFIX and NO_SELF_TALK_SUFFIX when `isResearch`, append RESEARCH_SUFFIX instead
- Skip self-talk detector when `isResearch`

### `convex/lib/context.ts`
- Add `RESEARCH_SUFFIX` constant (exported)
- No changes to `isBlockExcluded` (research uses same brainstorm filtering)

### `src/components/ResearchPanel.tsx`
- Mirror of `BrainstormPanel.tsx` but for research mode
- Maintains its own conversation state (separate from brainstorm history)
- Sends `isResearch: true` via `startBrainstormGeneration`
- Renders streamed answer
- "Save to blocks" button → saves to WORKING zone with title "Research: [first line of answer]"
- Shows a note when Claude Code provider is unavailable (research requires Claude Code)

### `src/hooks/useResearch.ts`
- Thin wrapper around existing Convex query/mutation hooks
- Maintains `researchHistory: Message[]` (separate from brainstorm)
- Exposes `sendResearchMessage`, `isStreaming`, `currentGeneration`, `saveToBlock`
- Reuses the existing `useStreamingGeneration` pattern for streaming output

### Session view integration
- Add "Research" tab/button to session header alongside existing brainstorm controls
- Toggle between Research panel and Brainstorm panel (mount/unmount, separate state)
- Research panel only shown when Claude Code provider is available

---

## Error Handling

- **Claude Code unavailable**: Research panel shows provider status badge + disabled input (same pattern as BrainstormPanel)
- **Tool errors**: SDK returns error_during_execution; surfaced as generation failure with error message (existing error path)
- **maxTurns exceeded**: SDK stops after 10 turns; streams whatever text was generated (generation completes normally)
- **Network failure during web fetch**: Claude reports in output text; user sees it inline

---

## Testing

### Unit
- `streamBrainstormMessage` with `isResearch: true` sets `allowedTools: ["WebSearch", "WebFetch"]` and `maxTurns: 10`
- NO_TOOLS_SUFFIX is NOT appended when `isResearch: true`
- RESEARCH_SUFFIX IS appended when `isResearch: true`
- Session resume is skipped when `isResearch: true`

### Integration
- Research generation creates a generation record and streams output (same as brainstorm)
- Research output can be saved as a WORKING block
- Saved block appears in brainstorm context on next turn

### Manual
- Claude performs web search and returns cited answer
- Research history is separate from brainstorm history
- Research panel disabled when Claude Code provider is unavailable

---

## Out of Scope

- Research history persistence across sessions (research history is in-memory only)
- Streaming tool call events to the UI (WebSearch queries/results not shown, only final synthesis)
- Research mode for Ollama/OpenRouter providers
- Auto-saving research output (manual save only)
- New block types for research content
