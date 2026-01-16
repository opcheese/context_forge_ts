# Context Optimization and Provider Caching

## Overview

ContextForge deals with large contexts (100K+ tokens). This document covers:
1. Why the zone system matters for caching
2. Provider-specific caching mechanisms
3. How to structure prompts for cache hits
4. Optimization considerations for large contexts

---

## The Zone System and Caching

The three-zone architecture is designed specifically to leverage provider caching:

```
┌─────────────────────────────────────────────────────────────┐
│  PERMANENT ZONE                                             │
│  - Core instructions, personas, rules                       │
│  - Changes rarely (days/weeks)                              │
│  - SHOULD BE CACHED                                         │
├─────────────────────────────────────────────────────────────┤
│  STABLE ZONE                                                │
│  - Reference material, documentation, examples              │
│  - Changes occasionally (per session)                       │
│  - SHOULD BE CACHED                                         │
├─────────────────────────────────────────────────────────────┤
│  WORKING ZONE                                               │
│  - Current task, recent generations, scratch notes          │
│  - Changes frequently (per message)                         │
│  - NOT CACHED (dynamic)                                     │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** Place static content FIRST in the prompt. Caching only works for prefixes.

---

## Provider Caching Mechanisms

### Anthropic Claude

**How it works:** Explicit cache breakpoints with `cache_control`.

| Setting | Details |
|---------|---------|
| Minimum tokens | 1,024 (Claude Sonnet/Opus), 2,048 (Claude Haiku) |
| Max breakpoints | 4 per prompt |
| TTL | 5 minutes (default), 1 hour (optional, costs more) |
| Cache write cost | 1.25x base price (5min), 2x (1hr) |
| Cache read cost | 0.1x base price (90% discount!) |

**Prompt structure:**
```
[Tools] → [System with cache_control] → [Messages with cache_control] → [Current message]
         ▲                              ▲
         └── Cache breakpoint 1         └── Cache breakpoint 2
```

**AI SDK syntax:**
```typescript
const messages = [
  {
    role: 'system',
    content: permanentContext,  // 50K tokens
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } }
    }
  },
  {
    role: 'user',
    content: stableContext,  // 30K tokens
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } }
    }
  },
  // Working zone + current prompt (not cached)
  { role: 'user', content: workingContext + currentPrompt }
];
```

**For Claude Code:** The Claude Code CLI/SDK handles caching automatically. We can defer explicit cache_control implementation and let Claude Code manage it. Just ensure context is ordered correctly (static first, dynamic last).

### OpenAI

**How it works:** Automatic prefix caching. No code changes needed.

| Setting | Details |
|---------|---------|
| Minimum tokens | 1,024 |
| Cache increment | 128 tokens |
| TTL | 5-10 minutes (up to 1hr off-peak), 24hr for GPT-4.1/GPT-5.1 |
| Cache cost | 50% discount on cached tokens |
| Activation | Automatic for all API requests |

**Key rule:** Static content must be at the START of the prompt. OpenAI caches the longest matching prefix.

**Prompt structure:**
```
[Static prefix - instructions, examples, docs] → [Dynamic content - user query]
▲                                                 ▲
└── Cached automatically                          └── Not cached
```

**Optimization tips:**
- Keep instructions/system prompts identical across requests
- Use `prompt_cache_key` parameter for routing control
- Place user-specific content at the END

### Ollama (Local)

**How it works:** KV cache stores attention computations in memory.

| Setting | Details |
|---------|---------|
| Default | Enabled, stores KV pairs in VRAM |
| Quantization | Optional (q8_0 = 50% memory, q4_0 = 25% memory) |
| Persistence | Only while model is loaded |
| Configuration | `OLLAMA_KV_CACHE_TYPE` environment variable |

**Important:** Ollama's KV cache is for **memory optimization**, not prompt prefix caching like cloud providers. Each new request recomputes from scratch.

**For large contexts:**
```bash
# Enable KV cache quantization to fit larger contexts
export OLLAMA_KV_CACHE_TYPE=q8_0
export OLLAMA_FLASH_ATTENTION=1
```

**Implication for development:** Ollama won't give us the caching benefits of cloud providers. It's good for testing but won't validate caching behavior. Test caching with OpenAI or Anthropic periodically.

---

## Context Assembly for Caching

### Correct Order (Cache-Friendly)

```typescript
function assembleContext(
  permanentBlocks: Block[],
  stableBlocks: Block[],
  workingBlocks: Block[],
  userPrompt: string
): Message[] {
  const messages: Message[] = [];

  // 1. PERMANENT zone first (most stable, cached)
  if (permanentBlocks.length > 0) {
    messages.push({
      role: 'system',
      content: permanentBlocks.map(b => b.content).join('\n\n'),
      // Add cache_control for Anthropic if using directly
    });
  }

  // 2. STABLE zone second (semi-stable, cached)
  if (stableBlocks.length > 0) {
    messages.push({
      role: 'user',
      content: `Reference Material:\n${stableBlocks.map(b => b.content).join('\n\n')}`,
      // Add cache_control for Anthropic if using directly
    });
  }

  // 3. WORKING zone last (dynamic, NOT cached)
  if (workingBlocks.length > 0) {
    messages.push({
      role: 'user',
      content: `Current Context:\n${workingBlocks.map(b => b.content).join('\n\n')}`,
    });
  }

  // 4. Current user prompt (always last)
  messages.push({
    role: 'user',
    content: userPrompt,
  });

  return messages;
}
```

### Wrong Order (Cache-Breaking)

```typescript
// DON'T DO THIS - dynamic content first breaks cache
const messages = [
  { role: 'user', content: userPrompt },        // Dynamic first = no cache
  { role: 'system', content: permanentContext }, // This won't be cached!
  { role: 'user', content: stableContext },
];
```

---

## Large Context Optimization

### Do We Need to Optimize?

For 100K+ token contexts:

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Network transfer | ~400KB per request | Acceptable for local dev |
| Memory usage | Moderate | Convex handles well |
| Latency | First token slower | Streaming helps perception |
| Cost | High without caching | Caching = 90% reduction |

**Verdict:** The main optimization IS caching. Get zone ordering right and caching handles the rest.

### Memory Considerations

```typescript
// Convex HTTP actions have memory limits
// For very large contexts, consider:

// 1. Stream the context assembly
async function* streamContext(sessionId: Id<"sessions">) {
  const blocks = await ctx.runQuery(api.blocks.list, { sessionId });
  for (const block of blocks) {
    yield block.content;
  }
}

// 2. Paginate if needed (unlikely for 100K tokens)
const blocks = await ctx.db
  .query("blocks")
  .withIndex("by_session_zone", q => q.eq("sessionId", sessionId))
  .take(100); // Process in batches if memory is tight
```

### Token Counting for Budgets

```typescript
// Track tokens per zone to enforce budgets
interface ZoneBudgets {
  permanent: number;  // Default: 50,000
  stable: number;     // Default: 100,000
  working: number;    // Default: 100,000
  total: number;      // Default: 500,000
}

function checkBudgets(blocks: Block[], budgets: ZoneBudgets): BudgetStatus {
  const byZone = {
    PERMANENT: blocks.filter(b => b.zone === 'PERMANENT').reduce((sum, b) => sum + (b.tokens || 0), 0),
    STABLE: blocks.filter(b => b.zone === 'STABLE').reduce((sum, b) => sum + (b.tokens || 0), 0),
    WORKING: blocks.filter(b => b.zone === 'WORKING').reduce((sum, b) => sum + (b.tokens || 0), 0),
  };

  return {
    permanent: { used: byZone.PERMANENT, limit: budgets.permanent, ok: byZone.PERMANENT <= budgets.permanent },
    stable: { used: byZone.STABLE, limit: budgets.stable, ok: byZone.STABLE <= budgets.stable },
    working: { used: byZone.WORKING, limit: budgets.working, ok: byZone.WORKING <= budgets.working },
    total: { used: Object.values(byZone).reduce((a, b) => a + b, 0), limit: budgets.total },
  };
}
```

---

## Implementation Strategy

### Phase 1: Correct Ordering (MVP)

- Assemble context with zones in correct order: PERMANENT → STABLE → WORKING → prompt
- Don't add explicit cache_control yet
- OpenAI will cache automatically
- Claude Code will handle Anthropic caching

### Phase 2: Token Budgets (Later)

- Add `tokens` field to blocks
- Display per-zone totals
- Warn when approaching limits

### Phase 3: Explicit Caching (If Needed)

- Add `cache_control` for direct Anthropic API use
- Add `prompt_cache_key` for OpenAI routing optimization
- Only needed for production BYOK scenario

---

## Provider Comparison Summary

| Feature | Anthropic | OpenAI | Ollama |
|---------|-----------|--------|--------|
| Caching type | Explicit (cache_control) | Automatic (prefix) | None (KV for memory) |
| Min tokens | 1,024 | 1,024 | N/A |
| Cache discount | 90% | 50% | N/A |
| TTL | 5min / 1hr | 5-10min / 24hr | N/A |
| Code changes | Required (or use Claude Code) | None | N/A |
| Zone ordering | Critical | Critical | Doesn't matter |

---

## Key Takeaways

1. **Zone ordering is the optimization** - PERMANENT → STABLE → WORKING → prompt
2. **OpenAI caches automatically** - Just order correctly
3. **Anthropic needs cache_control** - But Claude Code handles it
4. **Ollama doesn't cache prompts** - Good for testing, not for validating cache behavior
5. **100K tokens is fine** - Caching makes large contexts cost-effective
6. **Defer explicit caching** - Get ordering right first, add cache_control later if needed

---

## Sources

- [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [OpenAI Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching)
- [OpenAI Prompt Caching Announcement](https://openai.com/index/api-prompt-caching/)
- [Ollama KV Cache Quantization](https://smcleod.net/2024/12/bringing-k/v-context-quantisation-to-ollama/)
- [AI SDK Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)
- [Vercel AI SDK Caching Discussion](https://github.com/vercel/ai/issues/2689)
- [LiteLLM Prompt Caching](https://docs.litellm.ai/docs/completion/prompt_caching)
