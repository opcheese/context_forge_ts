# Claude Agent SDK — Experience Report from ContextForge

> Comprehensive reference for reusing patterns in future projects.
> Based on `@anthropic-ai/claude-agent-sdk@^0.2.9` used in ContextForge (Convex + React).

---

## 1. What the SDK Actually Is

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is a Node.js wrapper around the **Claude Code CLI**. It doesn't call the Anthropic API directly — it spawns the Claude Code process and communicates with it. This has major implications:

- **Claude Code CLI must be installed** on the server (not just the npm package)
- Uses the user's **Claude subscription** (Pro/Max), not API keys
- The CLI handles prompt caching, tool use, and model routing internally
- You get **subscription-tier pricing** (unlimited with Pro/Max) instead of per-token API billing

### Import

```typescript
import { query as claudeQuery } from "@anthropic-ai/claude-agent-sdk"
```

The main export is `query` — a single async generator function.

---

## 2. Core API — `claudeQuery()`

```typescript
for await (const message of claudeQuery({
  prompt,                              // The user message (string)
  options: {
    systemPrompt,                      // System prompt (string)
    model: "claude-sonnet-4-5-20250929", // Model override (optional)
    allowedTools: [],                  // Empty = text-only mode
    maxTurns: 1,                       // Number of agent turns
    maxBudgetUsd: 0.50,               // Hard per-request budget
    includePartialMessages: true,      // Enable streaming deltas
    pathToClaudeCodeExecutable: "/path/to/claude", // CLI location
    resume: sessionId,                 // Resume previous session (string)
    abortController,                   // Standard AbortController
    stderr: (data: string) => { ... }, // Capture stderr from Claude process
  },
})) {
  // message handling...
}
```

### Message Types

The async generator yields three types of messages:

#### 1. `stream_event` — Streaming deltas (when `includePartialMessages: true`)

```typescript
if (msg.type === "stream_event") {
  if (msg.event.type === "content_block_delta" && msg.event.delta?.type === "text_delta") {
    const chunk = msg.event.delta.text
    // Append to output buffer
  }
}
```

#### 2. `assistant` — Final complete response

```typescript
if (msg.type === "assistant") {
  const fullText = msg.message.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("")
  const resolvedModel = msg.message.model // Actual model used
}
```

#### 3. `result` — Session metadata and token usage

```typescript
if (msg.type === "result") {
  const sessionId = msg.session_id        // Save for resume!
  const inputTokens = msg.usage.input_tokens
  const outputTokens = msg.usage.output_tokens
  if (msg.is_error) {
    // SDK-level error (not an exception)
  }
}
```

---

## 3. Session Resume — The Killer Feature

Session resume enables **prompt caching** with ~90% cost reduction on subsequent turns. The SDK maintains conversation history internally.

### How It Works

**Turn 1 (fresh):**
```typescript
// Send full context: system prompt + all history + new message
const fullPrompt = formatFullContext(blocks, history, newMessage)

for await (const msg of claudeQuery({
  prompt: fullPrompt,
  options: { systemPrompt, /* NO resume */ }
})) {
  if (msg.type === "result") {
    savedSessionId = msg.session_id  // Capture this!
  }
}
```

**Turn 2+ (resume):**
```typescript
// Send ONLY the new message — SDK has prior context cached
for await (const msg of claudeQuery({
  prompt: newMessage,  // Just the new message!
  options: {
    systemPrompt,      // Must match Turn 1's system prompt
    resume: savedSessionId,
  }
})) { ... }
```

### Critical Rules

1. **System prompt must match** — If the system prompt changes between turns, the resumed session may behave unpredictably or error. When system prompt inputs change, clear the session ID.

2. **Don't resend conversation history on resume** — The SDK already has it. Sending it again causes duplication.

3. **Store session ID persistently** — It's needed across requests. We store it in the database alongside the session.

4. **Invalidate on context changes** — Any change to content that was part of the cached prompt requires clearing the session ID.

### Invalidation Pattern

```typescript
// When any PERMANENT or STABLE block changes:
async function invalidateClaudeSession(ctx, sessionId, zone) {
  if (zone === "PERMANENT" || zone === "STABLE") {
    const session = await ctx.db.get(sessionId)
    if (session?.claudeSessionId) {
      await ctx.db.patch(sessionId, { claudeSessionId: undefined })
    }
  }
}
```

In ContextForge, **11 block mutations** trigger invalidation: create, update (content), remove, move, reorder, compress, toggleDraft, etc. We also invalidate when **memory entries** change (since memory is rendered into the system prompt).

**Lesson learned:** Audit EVERY mutation that affects cached content. Missing even one causes stale context bugs that are extremely hard to debug — the model responds based on old context while the UI shows new content.

### Resume Failure Handling

```typescript
try {
  for await (const msg of claudeQuery({ ... })) { ... }
} catch (error) {
  // If resume fails, clear session for fresh start next time
  try {
    await clearClaudeSessionId(ctx, sessionId)
  } catch {}
  throw error
}
```

---

## 4. CLI Discovery

The SDK needs the `claude` CLI binary. It won't find it automatically in all environments (especially SSH, Docker, pm2).

```typescript
function getClaudeCodePath(): string {
  // 1. Environment variable override (best for deployment)
  if (process.env.CLAUDE_CODE_PATH) return process.env.CLAUDE_CODE_PATH

  // 2. Try `which claude`
  try {
    return execSync("which claude", { encoding: "utf-8" }).trim()
  } catch {}

  // 3. Common install locations
  const locations = [
    path.join(os.homedir(), ".local/bin/claude"),
    "/usr/local/bin/claude",
    "/usr/bin/claude",
  ]
  for (const loc of locations) {
    if (existsSync(loc)) return loc
  }

  throw new Error("Claude Code executable not found")
}
```

**Deployment gotcha:** When running under pm2 or in SSH sessions, PATH may not include the Claude CLI location. Always use `CLAUDE_CODE_PATH` env var in production.

---

## 5. Streaming Architecture

### Buffered Flush Pattern

Don't write every single delta to the database — it's too many writes. Buffer and flush on a timer:

```typescript
let buffer = ""
let lastFlush = Date.now()
const THROTTLE_MS = 100

for await (const msg of claudeQuery({ ... })) {
  if (msg.type === "stream_event" && msg.event.delta?.type === "text_delta") {
    buffer += msg.event.delta.text

    if (Date.now() - lastFlush >= THROTTLE_MS) {
      await flushToDb(generationId, fullText + buffer)
      fullText += buffer
      buffer = ""
      lastFlush = Date.now()
    }
  }
}
// Final flush
if (buffer) {
  fullText += buffer
  await flushToDb(generationId, fullText)
}
```

### Cancellation

Check for user cancellation during streaming:

```typescript
const abortController = new AbortController()

// Periodic check during streaming
if (chunkCount % 10 === 0) {
  const gen = await ctx.runQuery(internal.generations.getStatus, { id: generationId })
  if (gen?.status === "cancelled") {
    abortController.abort()
    break
  }
}
```

### AbortError Is Not An Error

```typescript
try {
  for await (const msg of claudeQuery({ options: { abortController } })) { ... }
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    // User cancelled — flush buffer and complete gracefully
    return
  }
  throw error // Real error
}
```

---

## 6. Self-Talk Detection

When using the SDK for brainstorming (not agentic tool use), the model sometimes "hallucinates" additional conversation turns — generating fake `USER:` messages and responding to them.

### Prevention (Prompt Engineering)

```typescript
const NO_SELF_TALK_SUFFIX = `
IMPORTANT: Generate ONLY your single assistant response. Do NOT simulate, generate,
or continue with any user messages. Do NOT write "USER:" or pretend to be the user.
Your response ends when your answer is complete — do not continue the conversation pattern.`
```

### Detection (Streaming)

```typescript
class SelfTalkDetector {
  private tail = ""
  private readonly MAX_MARKER_LENGTH = 12

  feed(chunk: string): SelfTalkDetection | null {
    this.tail = (this.tail + chunk).slice(-this.MAX_MARKER_LENGTH)

    const markers = [
      "</assistant>", "<user>", "###Human:", "\n\nHuman:",
      "\n\nUSER:\n", "<assistant>", "</user>", "<system>", "</system>"
    ]

    for (const marker of markers) {
      if (this.tail.includes(marker)) {
        return {
          detected: true,
          marker,
          cleanTextBefore: this.tail.split(marker)[0]
        }
      }
    }
    return null
  }
}
```

When detected, abort the stream and keep only the clean text before the marker.

### Anti-Agent Suffix

When using the SDK for text generation (not agent mode), disable tool-use behavior:

```typescript
const NO_TOOLS_SUFFIX = `
IMPORTANT: In this conversation you do NOT have access to tools, files, or code execution.
Do NOT say "let me read that file" or "I'll search for that" — work only with information
provided in this conversation.`
```

---

## 7. Prompt Formatting for SDK

The SDK works best with a specific prompt format. Don't use XML tags (the model already uses those internally):

```typescript
function formatPromptForSDK(
  stableBlocks: Block[],
  workingBlocks: Block[],
  history: Message[],
  newMessage: string
): string {
  const parts: string[] = []

  // Reference material (stable zone)
  if (stableBlocks.length > 0) {
    parts.push("=== Context Instructions ===")
    parts.push(stableBlocks.map(b => b.content).join("\n\n"))
    parts.push("=== End Context Instructions ===")
  }

  // Working context
  if (workingBlocks.length > 0) {
    parts.push("=== Working Context ===")
    parts.push(workingBlocks.map(b => b.content).join("\n\n"))
    parts.push("=== End Working Context ===")
  }

  // Conversation history with role labels
  if (history.length > 0) {
    parts.push("=== Conversation History ===")
    for (const msg of history) {
      parts.push(`${msg.role.toUpperCase()}:\n${msg.content}`)
    }
    parts.push("=== End Conversation History ===")
  }

  // New message
  parts.push(`USER:\n${newMessage}`)

  return parts.join("\n\n")
}
```

**Key pattern:** PERMANENT zone content goes in `systemPrompt` option (not in the prompt string). Everything else goes in the `prompt` string.

---

## 8. Subscription Usage Tracking

The SDK uses OAuth tokens from `~/.claude/.credentials.json` for subscription-based access:

```typescript
async function getSubscriptionUsage() {
  const credPath = path.join(os.homedir(), ".claude", ".credentials.json")
  const creds = JSON.parse(readFileSync(credPath, "utf-8"))
  const token = creds.claudeAiOauth?.accessToken

  const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json()

  return {
    fiveHour: {
      used: data.five_hour.percentage_used,
      resetsAt: data.five_hour.resets_at,
    },
    daily: {
      used: data.seven_day.percentage_used,
      resetsAt: data.seven_day.resets_at,
    },
  }
}
```

---

## 9. Token Budget Strategy

### Budget Allocation

| Zone | Budget | Purpose |
|------|--------|---------|
| PERMANENT | 30K tokens | System prompt, personas, rules |
| STABLE | 50K tokens | Reference docs, examples |
| WORKING | 40K tokens | Current task, scratch notes |
| **Total** | **150K tokens** | Out of 200K context window |

The 50K buffer (200K - 150K) provides:
- Room for conversation history growth
- Response generation space
- Safety margin before compaction

### Per-Request Budget

```typescript
maxBudgetUsd: 0.50  // Hard limit per SDK call
```

This prevents runaway costs if the model enters an unexpected loop.

---

## 10. Health Check Pattern

Always implement a health check before enabling SDK features:

```typescript
async function checkClaudeHealth() {
  if (!process.env.CLAUDE_CODE_ENABLED) {
    return { ok: false, disabled: true }
  }

  try {
    const path = getClaudeCodePath()
    const version = execSync(`${path} --version`, {
      encoding: "utf-8",
      timeout: 10000,
    }).trim()
    return { ok: true, version }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}
```

---

## 11. Deployment Considerations

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `CLAUDE_CODE_ENABLED` | Feature flag | `true` |
| `CLAUDE_CODE_PATH` | CLI location | `/home/ubuntu/.local/bin/claude` |

### Self-Hosted / VPN

When deploying to a self-hosted server:

1. Install Claude Code CLI on the server
2. Authenticate: `claude login` (interactive, one-time)
3. Set `CLAUDE_CODE_PATH` in environment
4. The credential file at `~/.claude/.credentials.json` must exist and be valid
5. **pm2/systemd won't have your shell PATH** — always use absolute paths

### Docker

Not tested in ContextForge, but expected challenges:
- CLI needs to be installed inside the container
- Credentials need to be mounted or injected
- The Claude process spawns child processes — ensure PID namespace is shared

---

## 12. Lessons Learned

### Things That Went Well

1. **Session resume is transformative** — 90% cost reduction on turn 2+ is real and measurable
2. **Subscription pricing** — Using Pro/Max subscription instead of API keys is much cheaper for development and small deployments
3. **Streaming works reliably** — `includePartialMessages: true` gives good UX
4. **Model override** — Can switch models per-request without reconfiguring

### Gotchas and Pain Points

1. **CLI dependency** — The SDK is a wrapper, not a standalone library. Your server needs the CLI installed and authenticated. This complicates deployment.

2. **Session invalidation is error-prone** — You must track every mutation that affects cached content. We missed memory entries initially and had stale context bugs.

3. **No structured output** — The SDK returns text. No JSON mode, no function calling in the response. You parse text output.

4. **Self-talk is a real problem** — Without the anti-self-talk suffix AND streaming detection, the model regularly generates fake conversation turns. Both defenses are needed.

5. **stderr is important** — When things fail, the error message is often in stderr, not in the exception. Always capture it:
   ```typescript
   stderr: (data: string) => { stderrChunks.push(data) }
   ```

6. **AbortController quirks** — Aborting doesn't always throw AbortError immediately. Sometimes the generator just stops yielding. Handle both cases.

7. **`maxTurns: 1` for text generation** — Without this, the agent may try to use tools or take multiple turns even with `allowedTools: []`.

8. **System prompt must be provided on resume** — Even though the SDK has it cached. If you omit it, behavior is undefined.

9. **The `result` message may not always appear** — On abort or error, you might not get token usage. Don't depend on it for critical paths.

10. **pnpm and the executable** — If using pnpm, the Claude CLI may not be in `node_modules/.bin`. Always use `pathToClaudeCodeExecutable` explicitly.

### Architecture Recommendations

1. **Separate the SDK call from business logic** — Our action does too much (context assembly + SDK call + DB writes + observability). In the next project, separate into: context assembler, SDK wrapper, result handler.

2. **Make invalidation declarative** — Instead of manually calling `invalidateSession` in every mutation, use a middleware or hook pattern that automatically detects context-affecting changes.

3. **Test the prompt format** — Write unit tests for your prompt formatting. We caught context ordering bugs early because of tests.

4. **Feature-flag the SDK** — Always have a way to disable it. The CLI may not be available in all environments.

5. **Budget per session, not just per request** — `maxBudgetUsd` is per-call. Consider tracking cumulative spend per session.

---

## 13. Code References (ContextForge)

| File | What It Does |
|------|-------------|
| `convex/claudeNode.ts` | Main SDK streaming action, health check, subscription usage |
| `convex/generations.ts` | Session ID storage/retrieval, generation lifecycle |
| `convex/blocks.ts` | Session invalidation on block changes |
| `convex/sessions.ts` | Session invalidation on pin/tag changes |
| `convex/memoryEntries.ts` | Session invalidation on memory changes |
| `convex/lib/context.ts` | Context assembly and prompt formatting |
| `convex/lib/selfTalkDetector.ts` | Streaming self-talk detection |
| `convex/lib/featureFlags.ts` | Feature flag for SDK enable/disable |
| `convex/lib/context.test.ts` | Tests for context assembly and prompt formatting |
| `convex/lib/selfTalkDetector.test.ts` | Tests for self-talk detection |
| `docs/CONTEXT_OPTIMIZATION_AND_CACHING.md` | Caching strategy documentation |
