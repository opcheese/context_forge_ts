# Claude Code Caching Rewrite — Design Document

Date: 2026-03-10
Status: Ready for implementation
Research: [2026-03-10-claude-code-structured-api-caching.md](../research/2026-03-10-claude-code-structured-api-caching.md)

---

## Problem Statement

ContextForge's Claude Code integration spawns a fresh CLI subprocess per brainstorm turn (`persistSession: false`, `maxTurns: 1`). All non-system context (STABLE blocks, WORKING blocks, conversation history) is flattened into a single `prompt` string via `formatPromptForSDK()`. This defeats Anthropic's prefix caching — only the system prompt is cacheable, while the bulk of tokens (reference material, conversation history) are reprocessed from scratch every turn.

### Measured impact

- System prompt (cacheable): ~500-2K tokens
- STABLE + WORKING + conversation (NOT cacheable): 5K-100K+ tokens
- Every turn re-sends everything at full price (no 90% cache discount)

---

## Chosen Approach: SDK Sessions with `continue`/`resume`

Use the Claude Agent SDK's session management to maintain a persistent conversation across brainstorm turns. The SDK manages the subprocess lifecycle, accumulates structured conversation history with proper cache breakpoints, and Anthropic's server-side cache handles the 90% cost reduction on all prior turns.

### Why this approach

| Criteria | SDK Sessions | Raw subprocess | V2 SDK |
|----------|-------------|----------------|--------|
| Caching | Automatic | Manual | Automatic |
| Stability | Stable (V1) | Stable (CLI) | Unstable preview |
| Complexity | Low | High | Low but missing `systemPrompt` |
| `systemPrompt` | Supported | Via CLI flag | NOT in `SDKSessionOptions` |
| Subscription auth | Native | Native | Native |

### What NOT to do

- Do NOT extract OAuth tokens for direct API access (fragile, unsupported)
- Do NOT add CLIProxyAPI dependency (external Go service)
- Do NOT use V2 SDK (`unstable_v2_*`) — missing `systemPrompt`, API may break

---

## Current Flow (to be replaced)

```
claudeNode.ts:streamBrainstormMessage()
  1. Query blocks from DB
  2. assembleSystemPromptWithContext(blocks) → systemPrompt string
  3. assembleContextWithConversation(blocks, history, newMessage) → messages[]
  4. Filter out system messages, formatPromptForSDK(nonSystemMessages) → prompt string
  5. claudeQuery({ prompt, options: { systemPrompt, persistSession: false, maxTurns: 1, ... } })
  6. Stream response, flush chunks to DB
  7. Process exits
```

Every turn: full context re-sent, subprocess spawned and killed.

## New Flow

```
claudeNode.ts:streamBrainstormMessage()
  Turn 1:
    1. Query blocks from DB
    2. assembleSystemPromptWithContext(blocks) → systemPrompt string
    3. assembleContextWithConversation(blocks, [], newMessage) → messages[]
    4. formatPromptForSDK(nonSystemMessages) → prompt string (context + first message)
    5. claudeQuery({ prompt, options: { systemPrompt, maxTurns: 1, ... } })
       ↑ persistSession: true (default), no change needed
    6. Capture sessionId from result message
    7. Store sessionId on the session record in DB
    8. Stream response, flush chunks to DB

  Turn 2+:
    1. Read sessionId from session record
    2. claudeQuery({ prompt: newMessage, options: { resume: sessionId, systemPrompt, maxTurns: 1, ... } })
       ↑ Only new message sent. SDK has full prior context cached.
    3. Stream response, flush chunks to DB
```

### Key differences

1. **No more `persistSession: false`** — sessions persist to disk by default
2. **No more flattening conversation history** — SDK manages it via session
3. **`resume: sessionId`** on turns 2+ — only new message sent as prompt
4. **Session ID stored in DB** — on the `sessions` table, new field `claudeSessionId`
5. **Context assembled only on turn 1** — subsequent turns send just the user message

---

## Data Model Changes

### `sessions` table

```ts
// New field
claudeSessionId: v.optional(v.string()), // Claude Agent SDK session ID for resume
```

### No changes to

- `blocks` table
- `generations` table
- `metrics` module

---

## Context Staleness Policy

With sessions, context (STABLE/WORKING blocks) is injected on turn 1 only. If blocks change mid-conversation:

**Decision: Accept staleness, start new session on context change.**

- If user edits a block in PERMANENT or STABLE zone → clear `claudeSessionId` → next turn starts fresh session
- WORKING zone edits don't reset (expected to change frequently, and working context is less critical for caching)
- User can manually "reset context" via UI action that clears `claudeSessionId`

This is the simplest approach and correct for brainstorming — you don't usually edit reference blocks mid-conversation.

---

## Token Budget

Total budget: **150K tokens** (down from 200K).

| Zone | Budget | Rationale |
|------|--------|-----------|
| PERMANENT | 30K | System prompt, personas, rules |
| STABLE | 50K | Reference material, documentation |
| WORKING | 40K | Current work, recent generations |
| **Total** | **150K** | 200K window − 33-45K compaction buffer − response space |

Already implemented in `convex/metrics.ts` and `convex/schema.ts`.

---

## Session Lifecycle

```
User opens session → no claudeSessionId
  ↓
First brainstorm message
  → assembles full context as prompt
  → claudeQuery() creates new CLI session
  → captures sessionId from result
  → stores sessionId on session record
  ↓
Subsequent messages
  → reads sessionId from session record
  → claudeQuery({ resume: sessionId, prompt: newMessage })
  → SDK serves prior context from cache (90% cost reduction)
  ↓
User edits PERMANENT or STABLE block
  → clears claudeSessionId on session record
  → next message starts fresh session
  ↓
Session ends / user closes
  → no cleanup needed (session files are ephemeral)
```

---

## Convex Constraints

Convex actions have execution time limits. The current approach (spawn subprocess per action invocation) works with sessions because:

- `claudeQuery()` with `resume` spawns a subprocess that loads the session from disk
- The subprocess handles one turn (`maxTurns: 1`) and exits
- Session state is on disk (`~/.claude/projects/...`), not in process memory
- No long-running persistent process needed — each action invocation is still independent

This is NOT Approach C (persistent subprocess). The SDK handles the session file I/O.

---

## Implementation Scope

### In scope

1. Add `claudeSessionId` field to sessions schema
2. Modify `streamBrainstormMessage` to use `resume` on turn 2+
3. Add mutation to clear `claudeSessionId` when PERMANENT/STABLE blocks change
4. Remove `persistSession: false` from claudeQuery options
5. Update context assembly to skip conversation history on resumed turns
6. Update token budget defaults to 150K

### Out of scope (YAGNI)

- V2 SDK migration
- Raw subprocess protocol (Approach C)
- Cache hit monitoring/metrics
- Pre-flight token counting before API call
- Conversation compression/summarization
- Session fork for block edits (overkill — just start new session)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Session files accumulate on disk | Claude Code already manages cleanup; no action needed |
| Session resume fails (file missing, corrupted) | Fallback: clear `claudeSessionId`, start fresh |
| Convex action runs from different `cwd` than session was created | Set explicit `cwd` in claudeQuery options or use absolute session paths |
| SDK version changes session format | Pin SDK version; test on upgrades |
| System prompt changes between turns invalidate cache | Acceptable — only changes if PERMANENT blocks change, which already resets session |

---

## Verification

1. **Turn 1** — full context sent, session created, response received
2. **Turn 2** — only new message sent, response references prior context correctly
3. **Cost check** — `cache_read_input_tokens` should be >0 on turn 2+ (visible in result message usage)
4. **Block edit** — editing STABLE block clears session, next turn creates fresh session
5. **Error recovery** — deleting session file doesn't crash, falls back to new session
6. **Budget** — UI shows 150K total budget, warns at 80%
