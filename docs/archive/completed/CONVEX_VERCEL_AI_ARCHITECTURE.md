# Convex + Vercel AI SDK: Technical Architecture

> **⚠️ HISTORICAL DOCUMENT - RESEARCH NOTES**
>
> This document was written during the research phase exploring Convex + Vercel AI SDK integration patterns. **We decided NOT to use Vercel AI SDK.**
>
> **For current implementation, see:**
> - [ARCHITECTURE.md](../ARCHITECTURE.md#llm-integration) - What we actually built
>
> **Why we didn't use Vercel AI SDK:**
> - Claude Code uses subprocess protocol, not HTTP (incompatible with Vercel AI SDK)
> - We wanted to preserve Convex's reactive model for Claude streaming
> - Direct HTTP to Ollama is simpler than adding Vercel AI SDK abstraction
>
> This document is preserved for historical context and may be useful if we add Anthropic API support in the future.

---

## Overview

This document explains how Convex and Vercel AI SDK work together, the data flow, protocols used, and potential integration patterns for ContextForge.

---

## The Two Systems

### Convex

**What it is:** A reactive backend-as-a-service with real-time subscriptions.

**Core primitives:**
- **Queries** - Read data, automatically re-run when data changes
- **Mutations** - Write data transactionally
- **Actions** - Run arbitrary code (can call external APIs)
- **HTTP Actions** - Handle raw HTTP requests/responses

**Real-time mechanism:** WebSocket-based subscriptions. When data changes, connected clients automatically receive updates.

**Local development:** Runs at `http://127.0.0.1:3210` with SQLite storage.

### Vercel AI SDK

**What it is:** A TypeScript toolkit for building AI applications with streaming support.

**Core primitives:**
- **`generateText()`** - Generate complete text (blocking)
- **`streamText()`** - Generate text with streaming (non-blocking)
- **`useChat()`** - React hook for chat interfaces
- **`useCompletion()`** - React hook for single completions

**Streaming mechanism:** HTTP streaming via Server-Sent Events (SSE) or plain text streams.

---

## How They Work Together

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐              ┌──────────────────────────┐    │
│   │   useQuery   │◄─WebSocket──►│     Convex Client        │    │
│   │  useMutation │              │   (real-time sync)       │    │
│   └──────────────┘              └──────────────────────────┘    │
│                                              │                   │
│   ┌──────────────┐                          │                   │
│   │   useChat    │                          │                   │
│   │    (AI SDK)  │                          │                   │
│   └──────┬───────┘                          │                   │
│          │                                  │                   │
└──────────┼──────────────────────────────────┼───────────────────┘
           │ HTTP POST                        │ WebSocket
           │ (streaming)                      │
           ▼                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                     CONVEX BACKEND                                │
│                   (127.0.0.1:3210 local)                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────────┐         ┌─────────────────────────────┐    │
│   │  HTTP Actions   │         │   Queries / Mutations       │    │
│   │  (/api/chat)    │         │   (blocks, sessions, etc)   │    │
│   └────────┬────────┘         └─────────────────────────────┘    │
│            │                                                      │
│            │ fetch()                                              │
│            ▼                                                      │
│   ┌─────────────────┐                                            │
│   │  LLM Provider   │                                            │
│   │  (Ollama, etc)  │                                            │
│   └─────────────────┘                                            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     LLM PROVIDER                                  │
│                  (localhost:11434 for Ollama)                    │
└──────────────────────────────────────────────────────────────────┘
```

### Two Parallel Communication Channels

1. **Convex WebSocket** - For database operations and real-time sync
2. **HTTP Streaming** - For LLM responses (managed by AI SDK or custom)

These are **independent channels** that can work together.

---

## Streaming Protocols

### Option A: Vercel AI SDK Data Stream Protocol

The AI SDK uses SSE (Server-Sent Events) with a custom message format:

```
data: {"type":"text-start","id":"text-1"}
data: {"type":"text-delta","id":"text-1","delta":"Hello"}
data: {"type":"text-delta","id":"text-1","delta":" world"}
data: {"type":"text-end","id":"text-1"}
data: {"type":"finish","finishReason":"stop"}
data: [DONE]
```

**Message types:**
| Type | Purpose |
|------|---------|
| `text-start` | Begin text block |
| `text-delta` | Chunk of text |
| `text-end` | End text block |
| `finish` | Generation complete |
| `error` | Error occurred |

**Backend helper:**
```typescript
const result = streamText({ model, messages });
return result.toUIMessageStreamResponse(); // Returns SSE response
```

**Frontend consumption:**
```typescript
const { messages, sendMessage, status } = useChat({
  api: '/api/chat',  // Points to Convex HTTP action
});
```

### Option B: Plain Text Stream Protocol

Simpler alternative - just stream raw text chunks:

```typescript
// Backend
const result = streamText({ model, messages });
return result.toTextStreamResponse(); // Returns plain text stream

// Frontend
const { completion } = useCompletion({
  api: '/api/generate',
  streamProtocol: 'text',
});
```

### Option C: Custom Streaming (No AI SDK)

Direct HTTP streaming without AI SDK:

```typescript
// Convex HTTP Action
export const chat = httpAction(async (ctx, request) => {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Async streaming logic
  (async () => {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      body: JSON.stringify({ model: 'gpt-oss:latest', messages, stream: true }),
    });

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value); // Forward chunks
    }
    await writer.close();
  })();

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
});
```

---

## Data Flow Patterns

### Pattern 1: Stream-Only (Simplest)

```
User Input → HTTP Action → LLM → Stream to Client
                                      ↓
                              Client displays text
```

- No persistence during streaming
- Save to Convex after generation completes
- Simplest to implement

### Pattern 2: Stream + Periodic Persistence

```
User Input → HTTP Action → LLM → Stream to Client
                  ↓                    ↓
           Save chunks          Display immediately
           every ~200ms
                  ↓
        Other clients see updates via useQuery
```

- Balance between responsiveness and durability
- Other connected clients see progress
- More complex but resilient

### Pattern 3: Optimistic UI + Final Persistence

```
User Input → HTTP Action → LLM → Stream to Client (optimistic)
                                      ↓
                              Generation complete
                                      ↓
                              Save final result
                                      ↓
                              Switch to persisted data
```

- Best UX for single-user scenarios
- Client maintains optimistic state during stream
- Switches to Convex data once complete

---

## Integration Points

### Where Convex Handles

| Responsibility | Convex Primitive |
|----------------|------------------|
| Store blocks/sessions | Mutations |
| Read blocks/sessions | Queries (real-time) |
| Handle LLM requests | HTTP Actions |
| Context assembly | Queries + Actions |
| User authentication (future) | Auth |

### Where AI SDK Handles

| Responsibility | AI SDK Primitive |
|----------------|------------------|
| LLM API calls | `streamText()` / `generateText()` |
| Streaming format | `toUIMessageStreamResponse()` |
| React state | `useChat()` / `useCompletion()` |
| Provider abstraction | `@ai-sdk/openai`, `@ai-sdk/anthropic` |
| Token usage | `result.usage` |

### Overlap / Choice Points

| Feature | Convex Option | AI SDK Option | Recommendation |
|---------|---------------|---------------|----------------|
| HTTP streaming | TransformStream | toTextStreamResponse() | AI SDK (simpler) |
| React state | Custom useState | useChat() | AI SDK (built-in) |
| Persistence | Mutations | None | Convex (required) |
| Real-time sync | useQuery | None | Convex (required) |
| Provider switching | Custom logic | Provider packages | AI SDK (cleaner) |

---

## Potential Issues

### 1. Two Sources of Truth

**Problem:** `useChat` maintains its own message state. Convex also stores messages. They can diverge.

**Solution:** Use Convex as source of truth. After streaming completes, save to Convex and optionally clear `useChat` state.

```typescript
const { messages: streamMessages, sendMessage } = useChat({
  onFinish: async (message) => {
    // Save to Convex when done
    await createBlock({
      sessionId,
      content: message.content,
      type: 'generation',
      zone: 'WORKING',
    });
  },
});

// Use Convex for persistent display
const savedBlocks = useQuery(api.blocks.list, { sessionId });
```

### 2. Streaming Endpoint Path

**Problem:** `useChat` defaults to `/api/chat`. Convex HTTP actions are at `CONVEX_SITE_URL/path`.

**Solution:** Configure the `api` option:

```typescript
const { messages, sendMessage } = useChat({
  api: `${import.meta.env.VITE_CONVEX_URL.replace(':3210', ':3211')}/api/chat`,
  // Local: http://127.0.0.1:3211/api/chat
});
```

Note: Convex HTTP actions run on port 3211, not 3210.

### 3. CORS

**Problem:** Browser may block cross-origin requests to Convex HTTP actions.

**Solution:** Add CORS headers in HTTP action:

```typescript
export const chat = httpAction(async (ctx, request) => {
  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // ... streaming logic ...

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
```

### 4. Local vs Production URLs

**Problem:** Ollama is at `localhost:11434` locally but doesn't exist in cloud.

**Solution:** Environment-based configuration:

```typescript
// convex/llm.ts
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';

// In HTTP action
if (USE_OLLAMA) {
  // Call Ollama
} else {
  // Use AI SDK with cloud provider
}
```

---

## Recommended Architecture for ContextForge

### Local Development

```
┌─────────────────────────────────────────────────────────────┐
│                         BROWSER                              │
│  ┌─────────────┐    ┌──────────────────────────────────┐    │
│  │  useChat()  │    │  useQuery(api.blocks.list)       │    │
│  │  (streaming)│    │  (persistent blocks)             │    │
│  └──────┬──────┘    └──────────────────────────────────┘    │
└─────────┼───────────────────────────────────────────────────┘
          │ POST /api/chat
          ▼
┌─────────────────────────────────────────────────────────────┐
│              CONVEX (127.0.0.1:3210/3211)                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  HTTP Action: /api/chat                             │    │
│  │  - Assemble context from blocks                     │    │
│  │  - Call Ollama (localhost:11434)                    │    │
│  │  - Stream response back                             │    │
│  │  - Save result to blocks table                      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              OLLAMA (localhost:11434)                        │
│              Model: gpt-oss:latest                           │
└─────────────────────────────────────────────────────────────┘
```

### Production (Future)

```
┌─────────────────────────────────────────────────────────────┐
│                         BROWSER                              │
│  ┌─────────────┐    ┌──────────────────────────────────┐    │
│  │  useChat()  │    │  useQuery(api.blocks.list)       │    │
│  └──────┬──────┘    └──────────────────────────────────┘    │
└─────────┼───────────────────────────────────────────────────┘
          │ POST /api/chat (with user's API key)
          ▼
┌─────────────────────────────────────────────────────────────┐
│              CONVEX CLOUD                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  HTTP Action: /api/chat                             │    │
│  │  - Validate user's API key                          │    │
│  │  - Call provider (OpenAI/Anthropic)                 │    │
│  │  - Stream response back                             │    │
│  │  - Save result to blocks table                      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│         PROVIDER API (api.openai.com / api.anthropic.com)   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Ollama Streaming (Local Dev)

- [ ] Create HTTP action `/api/chat`
- [ ] Implement TransformStream for streaming
- [ ] Call Ollama at `localhost:11434`
- [ ] Add CORS headers
- [ ] Create basic generation UI with `useChat` or custom fetch

### Phase 2: Context Assembly

- [ ] Read blocks from session in HTTP action
- [ ] Assemble system/user messages
- [ ] Include zone-based ordering

### Phase 3: Persistence

- [ ] Save generated content to WORKING zone
- [ ] Track token usage (from Ollama response)
- [ ] Update UI via Convex real-time sync

### Phase 4: AI SDK Integration (Optional)

- [ ] Add `ai` and `@ai-sdk/openai` packages
- [ ] Replace custom fetch with `streamText()`
- [ ] Use `useChat()` for state management

---

## Summary

| Aspect | Technology | Notes |
|--------|------------|-------|
| Database | Convex | Real-time sync via WebSocket |
| HTTP Streaming | Convex HTTP Actions | TransformStream |
| LLM Calls | Ollama (local) / AI SDK (production) | Direct fetch or streamText() |
| React State | useChat() or custom | AI SDK provides nice abstraction |
| Protocol | SSE or plain text | SSE for AI SDK compatibility |

**Key insight:** Convex and AI SDK are complementary, not overlapping. Convex handles persistence and real-time sync. AI SDK handles LLM abstraction and streaming protocol. They connect via HTTP actions.
