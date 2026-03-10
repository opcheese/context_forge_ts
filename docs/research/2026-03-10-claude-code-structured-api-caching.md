# Research: Using Claude Code Subscription with Structured Message Passing for Prompt Caching

**Date:** 2026-03-10
**Sources:** 12 sources (see bottom)

---

## Executive Summary

ContextForge's current integration uses `claudeQuery()` with `persistSession: false` and `maxTurns: 1`, spawning a fresh Claude Code subprocess per brainstorm turn. All non-system context (STABLE blocks, WORKING blocks, conversation history) is flattened into a single `prompt` string, defeating prefix caching for everything except the system prompt. Three viable approaches exist: (1) switch to persistent sessions via the SDK's `continue`/`resume` mechanism, (2) use CLIProxyAPI to get OpenAI-compatible endpoints backed by the Claude Code subscription, or (3) extract the OAuth token and call the Anthropic Messages API directly with `cache_control` breakpoints. Approach 1 is the cleanest and stays within Anthropic's supported SDK surface.

---

## Key Findings

### 1. The Current Problem: One-Shot Subprocesses Kill Caching

Each brainstorm turn in ContextForge calls `claudeQuery()` with `persistSession: false`. This spawns a fresh Claude Code CLI process, sends the entire context as two strings (`systemPrompt` + `prompt`), gets a response, and the process exits. The SDK can only place cache breakpoints on the `systemPrompt` (which becomes the API's system message) and the `prompt` (which becomes a single user message). Since the `prompt` string changes every turn (conversation history grows), only the system prompt is cacheable — typically a few hundred to a few thousand tokens [1][6].

The "50K tokens per subprocess" problem documented by Jae Hoon Jung [5] is an extreme version of the same issue: every subprocess re-injects system prompt, tool definitions, CLAUDE.md, and MCP tool descriptions. ContextForge avoids the worst of this by using `allowedTools: []` (no tools) and a custom `systemPrompt` (no CLAUDE.md auto-load), but the core caching problem remains.

### 2. SDK Session Management: `continue` and `resume`

The Claude Agent SDK supports persistent multi-turn sessions where the subprocess stays alive and accumulates conversation history with proper cache breakpoints [2][3]. Three mechanisms exist:

- **`continue: true`** — resumes the most recent session in the current directory. No ID tracking needed.
- **`resume: sessionId`** — resumes a specific session by ID. Required for multi-user or concurrent sessions.
- **`persistSession: true`** (default) — writes session history to `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`.

When using sessions, the SDK maintains structured conversation history internally. Each turn extends the cached prefix — system prompt, tool definitions, and all prior turns are served from Anthropic's server-side cache (90% cost reduction). Only the new user message is a cache write [1][8].

**Critical insight:** The session approach means ContextForge would NOT flatten messages into a single `prompt` string. Instead, each brainstorm turn would be a separate `query()` call with `continue: true` or `resume: sessionId`, and the SDK manages the growing conversation natively.

### 3. V2 TypeScript SDK (Preview): `createSession()` / `send()` / `stream()`

The V2 preview provides a cleaner interface for exactly this use case [4]:

```ts
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk"

await using session = unstable_v2_createSession({ model: "claude-opus-4-6" })

// Turn 1: system prompt + context injected here
await session.send("Your brainstorm prompt with context...")
for await (const msg of session.stream()) { /* handle response */ }

// Turn 2: only new message sent, everything else cached
await session.send("Follow-up message...")
for await (const msg of session.stream()) { /* handle response */ }
```

The session maintains its own subprocess. `send()` dispatches a message; `stream()` returns the response. The SDK handles cache breakpoint placement internally. Session IDs are available for resume across process restarts.

**Status:** Marked `unstable` — APIs may change. V1 `query()` with `continue`/`resume` is the stable equivalent.

### 4. System Prompt Options

The SDK's `systemPrompt` option accepts three forms [7]:

| Form | Effect |
|------|--------|
| `string` | Replaces default entirely (current ContextForge approach) |
| `{ preset: "claude_code" }` | Uses full Claude Code system prompt |
| `{ preset: "claude_code", append: "..." }` | Claude Code defaults + your additions |

For ContextForge, the current custom string approach is correct — we don't want Claude Code's full system prompt (tool instructions, coding guidelines) since we're running a brainstorming assistant, not a coding agent. The custom string should remain.

### 5. `--input-format stream-json`: Persistent Subprocess Without SDK

For maximum control, the CLI can be spawned directly with `--input-format stream-json --output-format stream-json`. The process stays alive, accepts JSON-lines on stdin, and emits JSON-lines on stdout [5][9]. This avoids the SDK abstraction entirely but requires manual JSON protocol handling.

The protocol uses two message categories:
- **Regular messages:** `{"type": "user", "message": {"role": "user", "content": "..."}}`
- **Control messages:** Permission requests/responses with `request_id` for multiplexing

This is the lowest-level approach. The SDK does this internally.

### 6. CLIProxyAPI: OpenAI-Compatible Proxy (15K+ stars)

CLIProxyAPI [10] is a Go-based proxy that exposes OpenAI-compatible `/v1/chat/completions` endpoints backed by Claude Code's OAuth authentication. It supports structured messages (system/user/assistant), streaming, and function calling. 15.2K GitHub stars, 119 contributors, actively maintained (v6.8.51, 527 releases).

**How it helps:** ContextForge could use the OpenAI chat format with structured multi-message arrays, and CLIProxyAPI would handle authentication via the user's Claude Code subscription. However, it's unclear whether CLIProxyAPI passes `cache_control` breakpoints through to the Anthropic API, and adding a Go proxy as a dependency is significant.

### 7. OAuth Token Extraction: Direct API Access

The user's Claude Code subscription authenticates via OAuth. The token can be extracted (via mitmproxy or from `~/.claude/` config files) and used directly with the Anthropic Messages API [11]. This would give full control over `cache_control` breakpoints on every content block.

**Trade-offs:** Tokens expire and need refreshing. Anthropic doesn't officially support this for programmatic use. It works but is fragile and may break on auth changes.

### 8. claude-code-openai-wrapper (Python, 439 stars)

A Python FastAPI server that wraps Claude Code with OpenAI-compatible endpoints [12]. Supports structured messages, session management, system prompts via SDK options. Less mature than CLIProxyAPI but more transparent about the mapping.

---

## Approach Comparison

| Approach | Caching | Subscription Auth | Structured Messages | Stability | Complexity |
|----------|---------|-------------------|-------------------|-----------|------------|
| **A: SDK sessions (`continue`/`resume`)** | Automatic (SDK manages) | Yes (native) | Via session (SDK flattens internally, but caches) | Stable (V1) | Low — minimal code change |
| **B: V2 SDK (`createSession`)** | Automatic | Yes | `send()`/`stream()` | Unstable preview | Low |
| **C: Raw subprocess (`stream-json`)** | Manual | Yes | JSON protocol | Stable (CLI) | High — manual protocol |
| **D: CLIProxyAPI proxy** | Unknown | Yes (OAuth) | OpenAI format | Active (15K stars) | Medium — external dep |
| **E: OAuth token + Messages API** | Full control (`cache_control`) | Fragile (token refresh) | Native Anthropic format | Fragile | Medium — token management |
| **F: OpenAI wrapper (Python)** | Unknown | Yes | OpenAI format | Moderate (439 stars) | Medium — Python dep |

---

## Recommended Approach for ContextForge

**Approach A: SDK sessions with `continue`/`resume`** is the clear winner.

The key change: instead of spawning a fresh subprocess per turn with `persistSession: false`, keep a session alive across the brainstorm conversation. Each turn calls `query()` with `resume: sessionId`. The SDK manages the subprocess, accumulates conversation history with proper cache breakpoints, and Anthropic's server-side cache handles the 90% cost reduction on all prior turns.

### What Changes in ContextForge

**Current flow:**
```
Turn 1: spawn CLI → send systemPrompt + prompt(all context flattened) → get response → kill CLI
Turn 2: spawn CLI → send systemPrompt + prompt(all context + turn1 flattened) → get response → kill CLI
Turn 3: spawn CLI → send systemPrompt + prompt(all context + turn1+2 flattened) → get response → kill CLI
```

**New flow:**
```
Turn 1: spawn CLI → send systemPrompt + context as prompt → get response + sessionId → CLI stays alive
Turn 2: resume sessionId → send only new message → get response → SDK caches everything before
Turn 3: resume sessionId → send only new message → get response → 90%+ tokens cached
```

### Open Design Question

The session approach means ContextForge can't re-assemble context from blocks on every turn (the current model). If a user edits a STABLE block mid-conversation, the session won't reflect it. Options:

1. **Accept staleness** — context is set at session start, block edits create a new session
2. **Inject delta** — on block change, send a "context update" message: "Note: the following reference material has been updated: ..."
3. **Fork session** — on block change, fork the session with updated context

Option 1 is simplest and likely correct for brainstorming (you don't usually edit reference blocks mid-conversation).

---

## Sources

[1] Anthropic. "Prompt caching." https://platform.claude.com/docs/en/build-with-claude/prompt-caching
[2] Anthropic. "Work with sessions." https://platform.claude.com/docs/en/agent-sdk/sessions
[3] Anthropic. "How Claude Code works." https://code.claude.com/docs/en/how-claude-code-works
[4] Anthropic. "TypeScript SDK V2 interface (preview)." https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview
[5] Jung, J.H. "Building a 24/7 Claude Code Wrapper? Here's Why Each Subprocess Burns 50K Tokens." https://dev.to/jungjaehoon/why-claude-code-subagents-waste-50k-tokens-per-turn-and-how-to-fix-it-41ma
[6] Anthropic. "Run Claude Code programmatically." https://code.claude.com/docs/en/headless
[7] Anthropic. "Modifying system prompts." https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts
[8] AWS. "Supercharge your development with Claude Code and Amazon Bedrock prompt caching." https://aws.amazon.com/blogs/machine-learning/supercharge-your-development-with-claude-code-and-amazon-bedrock-prompt-caching/
[9] "Inside the Claude Agent SDK: From stdin/stdout Communication to Production on AWS AgentCore." https://buildwithaws.substack.com/p/inside-the-claude-agent-sdk-from
[10] router-for-me. "CLIProxyAPI." https://github.com/router-for-me/CLIProxyAPI
[11] Alif. "Unlock Claude API from Claude Pro/Max (Flat Subscription)." https://www.alif.web.id/posts/claude-oauth-api-key
[12] RichardAtCT. "claude-code-openai-wrapper." https://github.com/RichardAtCT/claude-code-openai-wrapper
