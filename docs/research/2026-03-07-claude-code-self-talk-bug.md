# Claude Code Self-Talk Bug: Research Report

**Date:** 2026-03-07
**Issue:** Claude Code continues generating after `</assistant>`, produces `<user>` tags and talks to itself

## Executive Summary

This is a **known model-level behavior**, not a client-side bug. Claude Code does NOT set stop sequences for the main conversation loop, relying entirely on the API's `stop_reason: "end_turn"` signal. The model occasionally generates past its natural turn boundary, especially in long conversations (~120K+ tokens). The Claude Messages API doesn't use `<user>`/`</assistant>` text tokens for role boundaries — roles are structural JSON — so there's nothing to "stop on." The self-talk happens when the model hallucinates role markers in its output text.

## How Claude Code Makes API Calls

### Main Conversation Loop (decompiled from v2.1.71 binary)

The main query builder constructs API params like this (reconstructed from minified source):

```js
return {
  model: rB(f.model),
  messages: Zjq(T, xH, f.querySource, X$, fH, vH, f.skipCacheWrite),
  system: m,
  tools: [...Z, ...f.extraToolSchemas ?? []],
  tool_choice: f.toolChoice,
  ...(b ? { betas: EH } : {}),
  metadata: PHH(),
  max_tokens: bH,
  thinking: aH,
  ...(E$ !== void 0 && { temperature: E$ }),
  ...(kH && b && EH.includes(CM$) ? { context_management: kH } : {}),
  ...uH,
  ...(Object.keys(NH).length > 0 && { output_config: NH }),
  ...(sH !== void 0 && { speed: sH })
}
```

Key observations:
- **No `stop_sequences` parameter** in the main query path
- **Temperature** defaults to `f.temperatureOverride ?? 1` (so 1.0 unless overridden)
- Temperature is set to `undefined` when thinking/extended thinking is enabled (`!dH ? ... : void 0`)
- Uses `beta.messages.create({...E$, stream: true})` with streaming
- Uses betas: `claude-code-20250219`, `interleaved-thinking-2025-05-14`, `context-1m-2025-08-07`, `context-management-2025-06-27`, and others

### Side Queries (vh function)

The `vh` function (used for compaction, classification, etc.) DOES accept stop_sequences:

```js
async function vh(H) {
  let { model, system, messages, tools, tool_choice, output_format,
        max_tokens = 1024, maxRetries = 2, signal, skipSystemPromptPrefix,
        temperature, thinking, stop_sequences } = H;
  // ...
  return await O.beta.messages.create({
    model, max_tokens, system, messages,
    ...(tools && { tools }),
    ...(temperature !== undefined && { temperature }),
    ...(stop_sequences && { stop_sequences }),  // <-- passed through
    ...(thinking && { thinking }),
    // ...
  });
}
```

Example usage with stop sequences: classifier uses `stop_sequences: ["</block>"]`

### Stop Reason Handling

Claude Code processes streaming events and checks `stop_reason`:
- `"end_turn"` — normal completion
- `"max_tokens"` — logs `tengu_max_tokens_reached`
- `"tool_use"` — processes tool calls
- `null` — **known issue** causing hangs (Issue #20660)

The `stop_reason` comes from `message_delta` streaming events:
```js
case "message_delta":
  A.stop_reason = $.delta.stop_reason;
  A.stop_sequence = $.delta.stop_sequence;
```

### Prompt Caching

Claude Code uses `cache_control: { type: "ephemeral" }` on certain message content blocks. The function `Zjq` builds messages with cache breakpoints. A beta header `prompt-caching-scope-2026-01-05` is used. Cache editing is enabled for "cached microcompact" scenarios.

## Why Self-Talk Happens

### Root Cause

The Claude Messages API uses **structured JSON** for role boundaries, not text tokens:

```json
{
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

The model never sees literal `<user>` or `</assistant>` tokens during training in this format. However, the model was also trained on data containing `###Human:` and similar markers (from Claude's original training format). When the model generates these markers in its output text, it's a **hallucination** — the API treats them as regular text, not role boundaries.

Since Claude Code doesn't set stop sequences, and the API's `end_turn` signal depends on the model itself deciding to stop, there is no external mechanism to catch this.

### Contributing Factors

1. **Long context**: Reports consistently mention 120K+ tokens when this occurs
2. **Temperature 1.0**: Claude Code uses temperature=1.0 for main queries (maximum creativity/randomness)
3. **No stop sequences**: The main conversation loop doesn't set any stop sequences
4. **Extended thinking**: When thinking is enabled, temperature is set to `undefined` (API default, which is 1.0)
5. **Agentic loop**: Claude Code runs in a tool-use loop, continuing until `stop_reason === "end_turn"`, which means hallucinated content gets processed

### The Danger

As the reporter of Issue #10628 noted:
> "If you hallucinated that I started giving you new instructions, you could re-instruct yourself. And if that chain of thought went on long enough, it could be a self-feeding machine."

In that case, Claude generated `###Human:` followed by fabricated user feedback, then **treated the hallucinated input as real** when asked about it later.

## Known GitHub Issues

| Issue | Description | Status |
|-------|-------------|--------|
| [#10628](https://github.com/anthropics/claude-code/issues/10628) | Claude hallucinated `###Human:` and fake user input mid-response, then treated hallucination as real | Closed (inactivity) |
| [#20660](https://github.com/anthropics/claude-code/issues/20660) | `stop_reason: null` causing hangs after workflow completion | Closed (dup of #19195) |
| [#14229](https://github.com/anthropics/claude-code/issues/14229) | Claude confirms stop but silently continues spending tokens | Open |
| [#2700](https://github.com/anthropics/claude-code/issues/2700) | Agents ignore explicit STOP directives in CLAUDE.md | Open |
| [CrewAI #3836](https://github.com/crewAIInc/crewAI/issues/3836) | Stop sequences not sent to API causing 138K+ token responses | Fixed |

## What Could Be Done (if we were building our own)

### 1. Add Stop Sequences
```js
stop_sequences: ["###Human:", "Human:", "\n\nHuman:", "<user>", "</assistant>"]
```
This would catch the most common hallucinated role markers. Cost: zero (it's just a parameter).

### 2. Lower Temperature
Temperature 1.0 maximizes diversity but also maximizes the probability of rare events like role confusion. For agentic coding tasks, 0.7-0.8 would be more appropriate. The Agent SDK doesn't currently expose temperature configuration.

### 3. Post-Processing Output Scanning
Scan streaming text deltas for role-marker patterns. If detected:
- Truncate the response at the marker
- Force `end_turn`
- Log the incident

### 4. Context Window Management
The issue correlates with long contexts. More aggressive compaction before hitting 120K+ tokens could help.

### 5. Handle `stop_reason: null`
Currently causes infinite hangs. Should be treated as `end_turn` with a warning.

## Agent SDK Limitations

The Claude Agent SDK (both Python and TypeScript) currently does **NOT** support:
- `temperature` parameter (GitHub issue anthropics/claude-agent-sdk-python#273)
- `stop_sequences` parameter
- `top_p` parameter

These are open feature requests. The SDK focuses on tool management and agentic workflows, not model parameter tuning. To control these parameters, you must use the lower-level Anthropic Client SDK directly.

## For Our ContextForge Use Case

If we build any agentic features that call the Claude API directly:
1. Always set `stop_sequences` to catch common role markers
2. Use temperature 0.7-0.8 for deterministic tasks
3. Implement streaming output scanning for role-marker hallucinations
4. Set reasonable `max_tokens` limits per turn
5. Handle `stop_reason: null` gracefully with timeout + force-stop
6. Monitor context length and compact proactively

## Sources

- [Claude Code Issue #10628 — Hallucinated fake user input](https://github.com/anthropics/claude-code/issues/10628)
- [Claude Code Issue #20660 — stop_reason: null hangs](https://github.com/anthropics/claude-code/issues/20660)
- [CrewAI Issue #3836 — Stop sequences not sent to API](https://github.com/crewAIInc/crewAI/issues/3836)
- [Claude Agent SDK Issue #273 — Temperature not configurable](https://github.com/anthropics/claude-agent-sdk-python/issues/273)
- [Anthropic Messages API — Handling stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)
- [Anthropic Messages API — Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming)
- Claude Code v2.1.71 binary analysis (strings extraction from compiled Bun executable)
