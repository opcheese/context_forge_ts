# LLM Integration Research & Implementation Plan

## Overview

This document analyzes the requirements for LLM integration in ContextForge TypeScript, based on:
1. The Python ContextForge implementation
2. Vercel AI SDK capabilities
3. Convex runtime constraints

---

## Features from Python Implementation

### Core LLM Features

| Feature | Python Implementation | Required for TS? |
|---------|----------------------|------------------|
| Multi-provider support | OpenRouter, Ollama, Claude Code | Yes (start with 1-2) |
| Provider switching | Runtime switching with health checks | Later phase |
| Streaming responses | SSE with Vercel AI SDK v5 format | Yes |
| Token counting | LiteLLM + tiktoken | Yes |
| Context assembly | Zone-aware message building | Yes |
| Auto-save generation | Single-shot saves to WORKING | Yes |
| Brainstorming mode | Multi-turn with manual save | Nice-to-have |

### Generation Modes (Python)

**1. Single-Shot Generation (`/api/chat`)**
- Context-aware, single-turn generation
- Auto-saves generated content to WORKING zone
- Vercel AI SDK v5 protocol for streaming

**2. Multi-Turn Brainstorming (`/api/chat/conversation`)**
- Interactive sessions without auto-save
- User manually selects what to save
- In-memory conversation history

### Context Assembly (Python)

The Python implementation renders context as messages:
```python
context_messages = await context_manager.render(format="messages")
# Separates system messages from user/assistant history
# Final structure:
# [system from context] + [user system prompt] + [history] + [current query]
```

### Token Counting (Python)

Uses `litellm.token_counter()` with `tiktoken` under the hood:
- Model-aware counting (different tokenizers per model)
- SHA256 hash-based caching
- Per-zone budget tracking:
  - `permanent_budget`: 50,000 tokens
  - `stable_budget`: 100,000 tokens
  - `working_budget`: 100,000 tokens
  - `max_context_tokens`: 500,000 total

---

## Vercel AI SDK Analysis

### Architecture

The Vercel AI SDK provides:
- **AI SDK Core**: Unified API for calling any LLM
- **AI SDK UI**: React hooks (`useChat`, `useCompletion`, `useObject`)
- **Provider packages**: `@ai-sdk/openai`, `@ai-sdk/anthropic`, etc.

### Key Features for Our Use Case

**1. Streaming**
```typescript
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages,
});

// Returns textStream for real-time UI updates
```

**2. Token Usage (Post-Request)**
```typescript
const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Hello',
});

console.log(result.usage);
// { promptTokens, completionTokens, totalTokens, ... }
```

**3. React Hooks**
```typescript
import { useChat } from 'ai/react';

function Chat() {
  const { messages, input, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  });
  // ...
}
```

### Limitations

1. **No pre-request token estimation** - Only post-request usage
2. **Streaming formats vary by provider** - SDK normalizes this
3. **Requires server-side endpoint** - Cannot call LLMs from browser

---

## Convex Integration Patterns

### Option A: HTTP Actions with Streaming

```typescript
// convex/http.ts
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export const chat = httpAction(async (ctx, request) => {
  const { messages, sessionId } = await request.json();

  // Get context blocks from database
  const blocks = await ctx.runQuery(api.blocks.listBySession, { sessionId });
  const contextMessages = assembleContext(blocks);

  // Stream response
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    messages: [...contextMessages, ...messages],
  });

  return result.toTextStreamResponse();
});
```

### Option B: Actions with Buffered Persistence

Better for reliability - decouple streaming from persistence:

```typescript
// convex/llm.ts
import { action } from "./_generated/server";
import { streamText } from 'ai';

export const generate = action({
  args: {
    sessionId: v.id("sessions"),
    prompt: v.string(),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Get context
    const blocks = await ctx.runQuery(api.blocks.list, {
      sessionId: args.sessionId
    });

    // 2. Assemble messages
    const contextMessages = assembleContext(blocks);

    // 3. Generate
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: [
        ...contextMessages,
        { role: 'user', content: args.prompt }
      ],
      system: args.systemPrompt,
    });

    // 4. Auto-save to WORKING zone
    await ctx.runMutation(api.blocks.create, {
      sessionId: args.sessionId,
      content: result.text,
      type: 'generation',
      zone: 'WORKING',
    });

    return {
      text: result.text,
      usage: result.usage,
    };
  },
});
```

### Option C: Streaming with SSE (Full Python Parity)

For streaming to client:

```typescript
// convex/http.ts
export default httpRouter((http) => {
  http.route({
    path: "/api/chat",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const { sessionId, prompt, systemPrompt } = await request.json();

      // Get context blocks
      const blocks = await ctx.runQuery(api.blocks.list, { sessionId });
      const contextMessages = assembleContext(blocks);

      // Stream with AI SDK
      const result = streamText({
        model: anthropic('claude-sonnet-4-20250514'),
        messages: [
          ...contextMessages,
          { role: 'user', content: prompt }
        ],
        system: systemPrompt,
        onFinish: async ({ text, usage }) => {
          // Save after stream completes
          await ctx.runMutation(api.blocks.create, {
            sessionId,
            content: text,
            type: 'generation',
            zone: 'WORKING',
            tokens: usage.completionTokens,
          });
        },
      });

      return result.toTextStreamResponse();
    }),
  });
});
```

---

## Token Counting Strategy

### The Challenge

From the roadmap:
> Token counting is intentionally deferred. The existing Python implementation uses `tiktoken` and `litellm` which weren't designed for Convex.

### Options Evaluated

| Library | Size | Convex Compatible | Notes |
|---------|------|-------------------|-------|
| `gpt-tokenizer` | ~50KB | ✅ Yes | Pure JS, basic |
| `js-tiktoken` | ~100KB | ✅ Yes | Lighter tiktoken port |
| `tiktoken` (official) | ~2MB | ⚠️ WASM | May work in Convex actions |
| API-based | N/A | ✅ Yes | Latency concerns |
| Vercel AI SDK | Built-in | ✅ Yes | Post-request only |

### Recommended Approach

**Hybrid Strategy:**

1. **Pre-save estimation**: Use `js-tiktoken` or `gpt-tokenizer` for client-side estimation
2. **Accurate counting**: Use Vercel AI SDK's `usage` from generation responses
3. **Stored counts**: Save `tokens` field on blocks after creation

```typescript
// For estimation (client or server)
import { encode } from 'gpt-tokenizer';

function estimateTokens(text: string): number {
  return encode(text).length;
}

// For accurate counts (after generation)
const result = await generateText({ ... });
const actualTokens = result.usage.completionTokens;
```

### Token Budget Implementation

```typescript
// convex/schema.ts
blocks: defineTable({
  // ... existing fields
  tokens: v.optional(v.number()),  // Estimated or actual
  tokenModel: v.optional(v.string()), // Model used for counting
})

// Zone budgets (configurable per session)
sessions: defineTable({
  // ... existing fields
  budgets: v.optional(v.object({
    permanent: v.number(),  // Default: 50000
    stable: v.number(),     // Default: 100000
    working: v.number(),    // Default: 100000
    total: v.number(),      // Default: 500000
  })),
})
```

---

## Recommended Implementation Plan

### Phase 1: Basic Generation (MVP)

**Goal:** Single-shot generation with auto-save

**Scope:**
- Single provider (Anthropic Claude)
- Non-streaming initially (simpler)
- Token counting via response `usage`
- Auto-save to WORKING zone

**Implementation:**
```typescript
// convex/llm.ts
export const generate = action({
  args: {
    sessionId: v.id("sessions"),
    prompt: v.string(),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const blocks = await ctx.runQuery(api.blocks.list, {
      sessionId: args.sessionId
    });

    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: assembleContext(blocks, args.prompt),
      system: args.systemPrompt,
    });

    // Auto-save
    const blockId = await ctx.runMutation(api.blocks.create, {
      sessionId: args.sessionId,
      content: result.text,
      type: 'generation',
      zone: 'WORKING',
      tokens: result.usage.completionTokens,
    });

    return { text: result.text, blockId, usage: result.usage };
  },
});
```

**UI:**
```typescript
// Simple generation panel
function GeneratePanel({ sessionId }: { sessionId: Id<"sessions"> }) {
  const generate = useAction(api.llm.generate);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async () => {
    setIsGenerating(true);
    try {
      await generate({ sessionId, prompt });
      setPrompt('');
    } finally {
      setIsGenerating(false);
    }
  };

  return (/* ... */);
}
```

### Phase 2: Streaming

**Goal:** Real-time streaming responses

**Implementation:**
- HTTP action with `streamText`
- `useChat` hook on frontend
- SSE response format

### Phase 3: Token UI

**Goal:** Display token counts

**Implementation:**
- Token count per block
- Zone totals
- Budget warnings
- Pre-save estimation

### Phase 4: Multi-Provider (Optional)

**Goal:** Provider switching like Python

**Implementation:**
- Provider configuration
- Model selection UI
- Health checks

---

## Context Assembly

### Message Format

```typescript
interface ContextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function assembleContext(
  blocks: Block[],
  userPrompt: string,
  systemPrompt?: string
): ContextMessage[] {
  const messages: ContextMessage[] = [];

  // System blocks become system messages
  const systemBlocks = blocks.filter(b => b.type === 'system');
  if (systemBlocks.length > 0) {
    messages.push({
      role: 'system',
      content: systemBlocks.map(b => b.content).join('\n\n'),
    });
  }

  // User system prompt
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  // Context blocks as user context
  const contextBlocks = blocks.filter(b => b.type !== 'system');
  if (contextBlocks.length > 0) {
    messages.push({
      role: 'user',
      content: `Context:\n${contextBlocks.map(b => b.content).join('\n\n')}`,
    });
  }

  // Current prompt
  messages.push({ role: 'user', content: userPrompt });

  return messages;
}
```

### Zone Priority

Context assembly should respect zone semantics:
1. **PERMANENT**: Always included first (core instructions)
2. **STABLE**: Included second (reference material)
3. **WORKING**: Included last (current work)

---

## Environment Configuration

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...

# Optional: for token estimation
CONVEX_SITE_URL=http://localhost:3000
```

---

## Dependencies

```json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "gpt-tokenizer": "^2.0.0"
  }
}
```

---

## Summary

### Recommended Approach

1. **Start simple**: Non-streaming action-based generation
2. **Use Vercel AI SDK**: Proven, well-documented, provider-agnostic
3. **Anthropic first**: Best for context-heavy tasks, good caching
4. **Token counting**: Post-request from SDK, estimation with `gpt-tokenizer`
5. **Auto-save**: Single-shot generates and saves to WORKING
6. **Streaming later**: Add after basic flow works

### Key Differences from Python

| Aspect | Python | TypeScript/Convex |
|--------|--------|-------------------|
| Runtime | FastAPI async | Convex actions/HTTP |
| Streaming | SSE endpoints | HTTP actions or useChat |
| Token counting | LiteLLM + tiktoken | Vercel AI SDK + gpt-tokenizer |
| Provider mgmt | Global singleton | Convex env vars |
| Context render | ContextManager class | Pure functions |

### Next Steps

1. Install dependencies: `ai`, `@ai-sdk/anthropic`, `gpt-tokenizer`
2. Add schema changes (tokens field on blocks)
3. Implement `convex/llm.ts` with basic generation
4. Create generation UI panel
5. Add token display to blocks and zones
