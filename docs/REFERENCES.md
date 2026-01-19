# Reference Materials

Links and resources for ContextForge TypeScript development.

## Core Technologies

### Convex

| Resource | URL | Notes |
|----------|-----|-------|
| Convex Docs | https://docs.convex.dev/ | Main documentation |
| Schema Definition | https://docs.convex.dev/database/schemas | Database schema syntax |
| Queries & Mutations | https://docs.convex.dev/functions | Server functions |
| Actions | https://docs.convex.dev/functions/actions | Side effects, external APIs |
| HTTP Actions | https://docs.convex.dev/functions/http-actions | For streaming endpoints |
| Node.js Actions | https://docs.convex.dev/functions/actions#nodejs-runtime | `"use node"` for npm packages |
| Scheduling | https://docs.convex.dev/scheduling | `ctx.scheduler.runAfter()` |
| Testing | https://docs.convex.dev/testing/convex-test | Unit testing Convex functions |

### TanStack Router

| Resource | URL | Notes |
|----------|-----|-------|
| TanStack Router Docs | https://tanstack.com/router/latest/docs/framework/react/overview | Router documentation |
| File-Based Routing | https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing | Route conventions |
| TanStack Start | https://tanstack.com/start/latest | Full-stack framework (SSR) |

### UI

| Resource | URL | Notes |
|----------|-----|-------|
| shadcn/ui | https://ui.shadcn.com/ | Component library |
| Tailwind CSS | https://tailwindcss.com/docs | Utility classes |
| @dnd-kit | https://dndkit.com/ | Drag-and-drop library |

## LLM Integration

### Ollama

| Resource | URL | Notes |
|----------|-----|-------|
| Ollama | https://ollama.ai/ | Local LLM runtime |
| Ollama API | https://github.com/ollama/ollama/blob/main/docs/api.md | REST API docs |
| Ollama Models | https://ollama.ai/library | Available models |

### Claude Code / Agent SDK

| Resource | URL | Notes |
|----------|-----|-------|
| Claude Code | https://claude.ai/code | CLI tool (requires subscription) |
| Claude Agent SDK | https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk | NPM package |
| SDK TypeScript Types | https://platform.claude.com/docs/en/agent-sdk/typescript | Type definitions reference |

**Key SDK Types:**
- `SDKPartialAssistantMessage` - Streaming events wrapper
- `BetaRawMessageStreamEvent` - Anthropic's raw event types
- `includePartialMessages: true` - Option to enable streaming

### Token Counting

| Resource | URL | Notes |
|----------|-----|-------|
| js-tiktoken | https://www.npmjs.com/package/js-tiktoken | **Recommended** - Pure JS tiktoken |
| gpt-tokenizer | https://www.npmjs.com/package/gpt-tokenizer | Alternative tokenizer |
| tiktoken (WASM) | https://www.npmjs.com/package/tiktoken | Official OpenAI (larger) |

## Example Projects

| Resource | URL | Notes |
|----------|-----|-------|
| Trellaux | https://github.com/TanStack/router/tree/main/examples/react/start-convex-trellaux | TanStack + Convex + DnD |
| Convex AI Chat | https://www.convex.dev/templates | Chat patterns (search templates) |
| Netlify TanStack | https://github.com/netlify-templates/tanstack-template | TanStack + Convex patterns |

## Historical Research (Superseded)

These were useful during research but our implementation differs:

| Resource | URL | Notes |
|----------|-----|-------|
| Vercel AI SDK | https://ai-sdk.dev/ | Not used - Claude Code incompatible |
| Convex + Vercel AI Streaming | https://www.arhamhumayun.com/blog/streamed-ai-response | Patterns we didn't follow |

---

## Quick Reference

### Convex Local URLs

| Service | URL |
|---------|-----|
| WebSocket API | `http://127.0.0.1:3210` |
| HTTP Actions | `http://127.0.0.1:3211` |
| Dashboard | Shown when running `convex dev` |

### Ollama Default

| Service | URL |
|---------|-----|
| Ollama API | `http://localhost:11434` |
| Health Check | `GET http://localhost:11434/api/tags` |
| Chat Endpoint | `POST http://localhost:11434/api/chat` |

### Claude Agent SDK

```typescript
import { query as claudeQuery } from "@anthropic-ai/claude-agent-sdk"

// Enable streaming
const options = {
  includePartialMessages: true,
  allowedTools: [],
  maxTurns: 1,
}

// Handle streaming events
for await (const message of claudeQuery({ prompt, options })) {
  if (message.type === "stream_event") {
    if (message.event.type === "content_block_delta") {
      // Text chunk: message.event.delta.text
    }
  }
}
```
