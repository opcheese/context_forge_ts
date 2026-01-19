# Convex Development Guide

This guide explains how Convex is used in ContextForgeTS and how to extend it.

---

## Table of Contents

1. [Overview](#overview)
2. [Coming from Traditional Backends](#coming-from-traditional-backends)
3. [Function Types](#function-types)
4. [Project Structure](#project-structure)
5. [Schema & Data Model](#schema--data-model)
6. [Common Patterns](#common-patterns)
7. [Adding New Features](#adding-new-features)
8. [LLM Integration](#llm-integration)
9. [Testing](#testing)
10. [Best Practices](#best-practices)

---

## Overview

Convex is our backend-as-a-service providing:
- **Real-time database** with automatic subscriptions
- **Server functions** (queries, mutations, actions)
- **HTTP endpoints** for streaming and external APIs
- **Scheduler** for background tasks

### Key URLs (Local Development)

| Service | URL |
|---------|-----|
| WebSocket API | `http://127.0.0.1:3210` |
| HTTP Actions | `http://127.0.0.1:3211` |
| Dashboard | Shown when running `convex dev` |

---

## Coming from Traditional Backends

If you're familiar with Express, FastAPI, Django, or similar frameworks, here's how Convex concepts map:

### Quick Reference

| Traditional Concept | Convex Equivalent | Location |
|---------------------|-------------------|----------|
| Database (PostgreSQL, MongoDB) | Convex DB (built-in) | Automatic, no setup |
| ORM / Models | `schema.ts` + typed queries | `convex/schema.ts` |
| REST Controllers / Routes | Queries & Mutations | `convex/*.ts` (exported functions) |
| HTTP Endpoints (streaming, webhooks) | HTTP Actions | `convex/http.ts` |
| Middleware | Wrapper functions or auth checks in handlers | Manual in each function |
| Background Jobs / Workers | Scheduler + Actions | `ctx.scheduler.runAfter()` |
| WebSocket handlers | Built-in (queries auto-subscribe) | Automatic |
| Environment variables | Convex dashboard or `.env.local` | `process.env.*` in actions |

### Where is the Database?

Convex includes a built-in database. No PostgreSQL, MongoDB, or connection strings.

```typescript
// Schema defines tables (like migrations)
// convex/schema.ts
export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
  }).index("by_email", ["email"]),
})

// Queries read data (like SELECT)
// convex/users.ts
export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)  // Direct access, no ORM
  },
})
```

**Key differences from SQL:**
- No JOINs - denormalize or query multiple times
- No raw SQL - use `ctx.db.query()` API
- Indexes are required for filtered queries
- Automatic TypeScript types from schema

### Where is Backend Routing?

**Important:** Convex queries and mutations are **NOT REST**. They use a WebSocket-based RPC protocol.

```
┌─────────────────────────────────────────────────────────────────┐
│  Traditional REST                                                │
│                                                                  │
│  Browser ──HTTP GET /api/users/123──► Express ──► Database      │
│         ◄──JSON response────────────                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Convex (Default)                                                │
│                                                                  │
│  Browser ══WebSocket══► Convex ══► Built-in DB                  │
│         ◄══Real-time subscriptions══                             │
│                                                                  │
│  No HTTP, no REST, no URLs - just function calls                │
└─────────────────────────────────────────────────────────────────┘
```

**Queries and mutations are function calls, not HTTP endpoints:**

```typescript
// convex/users.ts
export const get = query({ ... })     // NOT accessible via HTTP!
export const create = mutation({ ... }) // NOT accessible via HTTP!

// Frontend calls these via WebSocket RPC:
const user = useQuery(api.users.get, { id })  // Subscribes via WebSocket
await createUser({ name: "Alice" })            // Sends via WebSocket
```

**So when DO you need http.ts?**

`http.ts` is for when you actually need HTTP endpoints:

| Scenario | Why HTTP? |
|----------|-----------|
| **External webhooks** | Stripe/GitHub POST to a URL - they can't use Convex WebSocket |
| **SSE streaming** | Browser EventSource needs HTTP, not WebSocket |
| **OAuth callbacks** | Auth providers redirect to HTTP URLs |
| **Legacy API clients** | External systems expect REST endpoints |
| **File downloads** | Need HTTP Content-Disposition headers |

**Example: Webhook that external service calls**

```typescript
// convex/http.ts - This IS an HTTP endpoint
http.route({
  path: "/webhooks/stripe",  // Stripe POSTs to https://your-app.convex.site/webhooks/stripe
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await request.json()
    await ctx.runMutation(api.payments.handleWebhook, { event })
    return new Response("OK", { status: 200 })
  }),
})
```

**In this project:**
- `blocks.ts`, `sessions.ts`, etc. → WebSocket RPC (frontend uses `useQuery`/`useMutation`)
- `http.ts` → Actual HTTP endpoints for Ollama SSE streaming and health checks

### Where are Middlewares?

Convex doesn't have middleware chains. Common patterns:

**Authentication check (manual in each function):**
```typescript
export const getPrivateData = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)  // Helper function
    if (!user) throw new Error("Unauthorized")
    return await ctx.db.query("secrets").collect()
  },
})
```

**Reusable validation:**
```typescript
// convex/lib/auth.ts
export async function requireAuth(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Unauthorized")
  const user = await ctx.db.query("users")
    .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique()
  if (!user) throw new Error("User not found")
  return user
}

// Usage in any query/mutation
export const myProtectedQuery = query({
  handler: async (ctx) => {
    const user = await requireAuth(ctx)
    // ... rest of logic
  },
})
```

### Our `http.ts` Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/chat` | Ollama SSE streaming (browser uses EventSource) |
| `GET /api/health/*` | Health checks for monitoring |
| `POST /testing/*` | E2E test utilities |

These exist because:
- Ollama streaming uses SSE, which requires HTTP (not WebSocket)
- Health checks are called by external monitoring tools via HTTP
- E2E tests use HTTP to reset test data

### Where is Claude Streaming?

Claude uses **Convex reactive streaming**, not HTTP:

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend                                                        │
│  1. Call mutation: startClaudeGeneration({ prompt })            │
│  2. Get back generationId                                        │
│  3. Subscribe: useQuery(api.generations.get, { generationId })  │
│  4. UI updates automatically as text field changes              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Convex Backend                                                  │
│  1. Mutation creates generation record, schedules action        │
│  2. Action streams from Claude SDK, writes chunks to DB         │
│  3. Reactive query pushes updates to subscribed clients         │
└─────────────────────────────────────────────────────────────────┘
```

**Files involved:**
- `convex/generations.ts` - `startClaudeGeneration` mutation, `get` query
- `convex/claudeNode.ts` - `streamGenerateWithContext` action (Node.js runtime)
- `src/hooks/useClaudeGenerate.ts` - Frontend hook

### How Do I Add OpenRouter Support?

OpenRouter is an HTTP API, so it's similar to Ollama:

**1. Create client library:**
```typescript
// convex/lib/openrouter.ts
export async function* streamChat(
  messages: Message[],
  model: string,
  apiKey: string
): AsyncGenerator<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, stream: true }),
  })

  // Parse SSE stream, yield chunks
  const reader = response.body!.getReader()
  // ... similar to ollama.ts
}
```

**2. Add to http.ts (for SSE streaming):**
```typescript
// In /api/chat handler, add provider check
if (provider === "openrouter") {
  const apiKey = process.env.OPENROUTER_API_KEY
  for await (const chunk of streamOpenRouter(messages, model, apiKey)) {
    // ... write to SSE
  }
}
```

**3. Or use Convex reactive (like Claude):**
```typescript
// convex/openrouterNode.ts
"use node"
export const streamGenerate = action({
  handler: async (ctx, args) => {
    for await (const chunk of streamOpenRouter(...)) {
      await ctx.runMutation(internal.generations.appendChunk, {
        generationId: args.generationId,
        chunk,
      })
    }
  },
})
```

### How Do I Add Authentication?

Convex supports multiple auth providers. Recommended: **Clerk** or **Auth0**.

**1. Install and configure:**
```bash
npm install @clerk/clerk-react
```

**2. Wrap app with provider:**
```typescript
// src/main.tsx
import { ClerkProvider } from "@clerk/clerk-react"
import { ConvexProviderWithClerk } from "convex/react-clerk"

<ClerkProvider publishableKey={...}>
  <ConvexProviderWithClerk client={convex}>
    <App />
  </ConvexProviderWithClerk>
</ClerkProvider>
```

**3. Access identity in functions:**
```typescript
export const myQuery = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null // or throw
    }
    // identity.tokenIdentifier, identity.email, etc.
  },
})
```

**4. Create users table and sync:**
```typescript
// convex/users.ts
export const ensureUser = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const existing = await ctx.db.query("users")
      .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique()

    if (existing) return existing._id

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email,
      name: identity.name,
    })
  },
})
```

See: https://docs.convex.dev/auth

### Where Do Environment Variables Go?

| Variable Type | Location | Access |
|---------------|----------|--------|
| Convex functions | Convex Dashboard → Settings → Environment Variables | `process.env.MY_VAR` |
| Frontend (Vite) | `.env.local` with `VITE_` prefix | `import.meta.env.VITE_MY_VAR` |
| Local dev override | `.env.local` | Both |

**Example `.env.local`:**
```bash
# Frontend
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# Backend (also set in Convex dashboard for production)
OPENROUTER_API_KEY=sk-or-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Function Types

Convex has four function types. Understanding when to use each is critical.

### Queries (Read-Only, Reactive)

```typescript
import { query } from "./_generated/server"
import { v } from "convex/values"

export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()
  },
})
```

**Use for:** Reading data. Clients subscribe automatically and re-render on changes.

**Frontend usage:**
```typescript
const blocks = useQuery(api.blocks.list, { sessionId })
// `blocks` is undefined while loading, then updates reactively
```

### Mutations (Write, Transactional)

```typescript
import { mutation } from "./_generated/server"
import { v } from "convex/values"

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
    type: v.string(),
    zone: v.optional(zoneValidator),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("blocks", {
      sessionId: args.sessionId,
      content: args.content,
      type: args.type,
      zone: args.zone ?? "WORKING",
      position: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})
```

**Use for:** Creating, updating, or deleting data. Runs in a transaction.

**Frontend usage:**
```typescript
const createBlock = useMutation(api.blocks.create)
await createBlock({ sessionId, content: "Hello", type: "text" })
```

### Actions (Side Effects, External APIs)

```typescript
import { action } from "./_generated/server"
import { api } from "./_generated/api"
import { v } from "convex/values"

export const generate = action({
  args: {
    sessionId: v.id("sessions"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    // Read from database via query
    const blocks = await ctx.runQuery(api.blocks.list, {
      sessionId: args.sessionId,
    })

    // Call external API
    const response = await fetch("https://api.example.com/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: args.prompt }),
    })

    // Write to database via mutation
    await ctx.runMutation(api.blocks.create, {
      sessionId: args.sessionId,
      content: await response.text(),
      type: "generation",
    })
  },
})
```

**Use for:** External API calls, file operations, anything with side effects.

**Key points:**
- Cannot access `ctx.db` directly - use `ctx.runQuery` and `ctx.runMutation`
- Can call other actions with `ctx.runAction`
- Can schedule future work with `ctx.scheduler`

### Node.js Actions

For npm packages requiring Node.js APIs (like Claude Agent SDK):

```typescript
"use node"  // <-- Must be first line of file

import { action } from "./_generated/server"
import { query as claudeQuery } from "@anthropic-ai/claude-agent-sdk"

export const generate = action({
  args: { prompt: v.string() },
  handler: async (_, args) => {
    for await (const message of claudeQuery({ prompt: args.prompt })) {
      // Process message
    }
  },
})
```

**Use for:** Packages that need Node.js runtime (fs, child_process, etc.).

### Internal Functions

Functions only callable from other Convex functions (not from client):

```typescript
import { internalMutation, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"

export const appendChunk = internalMutation({
  args: {
    generationId: v.id("generations"),
    chunk: v.string(),
  },
  handler: async (ctx, args) => {
    // Called from action: ctx.runMutation(internal.generations.appendChunk, {...})
  },
})
```

**Use for:** Internal operations that shouldn't be exposed to clients.

### HTTP Actions

For raw HTTP endpoints:

```typescript
import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"

const http = httpRouter()

http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()

    // Access database
    const data = await ctx.runQuery(api.blocks.list, { sessionId })

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    })
  }),
})

export default http
```

**Use for:** Streaming responses, webhooks, external API compatibility.

---

## Project Structure

```
convex/
├── _generated/          # Auto-generated types (don't edit)
├── lib/
│   ├── context.ts       # Context assembly utilities
│   └── ollama.ts        # Ollama API client
├── schema.ts            # Database schema
├── blocks.ts            # Block CRUD operations
├── sessions.ts          # Session management
├── generations.ts       # Streaming generation tracking
├── snapshots.ts         # State save/restore
├── claudeNode.ts        # Claude Code SDK ("use node")
├── http.ts              # HTTP endpoints router
├── testing.ts           # Test utilities (internal)
└── counters.ts          # Demo file (can remove)
```

### File Naming Conventions

| Pattern | Purpose |
|---------|---------|
| `{domain}.ts` | Domain module (sessions, blocks, etc.) |
| `lib/*.ts` | Utility libraries (no Convex functions) |
| `*Node.ts` | Node.js runtime files (use "use node") |
| `http.ts` | HTTP router (must be named this) |

---

## Schema & Data Model

### Defining Tables

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  sessions: defineTable({
    name: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  blocks: defineTable({
    sessionId: v.id("sessions"),   // Foreign key reference
    content: v.string(),
    type: v.string(),
    zone: zoneValidator,           // Reusable validator
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_zone", ["sessionId", "zone", "position"]),
})
```

### Common Validators

```typescript
import { v } from "convex/values"

// Literals and unions
const zoneValidator = v.union(
  v.literal("PERMANENT"),
  v.literal("STABLE"),
  v.literal("WORKING")
)

// IDs
v.id("sessions")        // Reference to sessions table
v.optional(v.id("sessions"))  // Optional reference

// Primitives
v.string()
v.number()
v.boolean()
v.null()
v.optional(v.string())  // string | undefined

// Complex types
v.array(v.string())
v.object({
  key: v.string(),
  nested: v.object({ ... }),
})
```

### Indexes

```typescript
defineTable({ ... })
  // Single field index
  .index("by_session", ["sessionId"])

  // Compound index (queries can use prefix)
  .index("by_session_zone", ["sessionId", "zone", "position"])
```

**Using indexes in queries:**
```typescript
// Matches index exactly or as prefix
await ctx.db
  .query("blocks")
  .withIndex("by_session_zone", (q) =>
    q.eq("sessionId", sessionId).eq("zone", "WORKING")
  )
  .collect()
```

---

## Common Patterns

### Pattern 1: CRUD Module

Standard pattern for domain entities:

```typescript
// convex/{entity}.ts
import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// List all
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sessions").order("desc").collect()
  },
})

// Get by ID
export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Create
export const create = mutation({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("sessions", {
      name: args.name,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// Update
export const update = mutation({
  args: {
    id: v.id("sessions"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error("Not found")

    await ctx.db.patch(args.id, {
      name: args.name,
      updatedAt: Date.now(),
    })
    return args.id
  },
})

// Delete
export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
```

### Pattern 2: Parent-Child Relationships

When deleting parent, delete children:

```typescript
// convex/sessions.ts
export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    // Delete child blocks
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect()
    for (const block of blocks) {
      await ctx.db.delete(block._id)
    }

    // Delete session
    await ctx.db.delete(args.id)
  },
})
```

### Pattern 3: Scheduler for Async Work

Return immediately, process in background:

```typescript
// convex/generations.ts
export const startClaudeGeneration = mutation({
  args: {
    sessionId: v.id("sessions"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    // Create record for tracking
    const generationId = await ctx.db.insert("generations", {
      sessionId: args.sessionId,
      status: "streaming",
      text: "",
      createdAt: Date.now(),
    })

    // Schedule action to run immediately (non-blocking)
    await ctx.scheduler.runAfter(0, api.claudeNode.streamGenerate, {
      generationId,
      prompt: args.prompt,
    })

    // Return immediately - client subscribes to generation
    return { generationId }
  },
})
```

### Pattern 4: Database-Backed Streaming

For real-time streaming without HTTP:

```typescript
// Action writes chunks to database
export const streamGenerate = action({
  handler: async (ctx, args) => {
    let buffer = ""
    let lastFlush = Date.now()
    const throttleMs = 100

    for await (const chunk of llmStream) {
      buffer += chunk

      // Throttle writes to database
      if (Date.now() - lastFlush >= throttleMs) {
        await ctx.runMutation(internal.generations.appendChunk, {
          generationId: args.generationId,
          chunk: buffer,
        })
        buffer = ""
        lastFlush = Date.now()
      }
    }

    // Final flush
    await ctx.runMutation(internal.generations.complete, {
      generationId: args.generationId,
    })
  },
})
```

```typescript
// Client subscribes to reactive query
const generation = useQuery(api.generations.get, { generationId })
// `generation.text` updates as chunks arrive
```

### Pattern 5: Fractional Positioning

For O(1) reordering without shifting all items:

```typescript
// Items have floating-point positions
// To insert between items at 1.0 and 2.0:
const newPosition = (1.0 + 2.0) / 2  // 1.5

export const reorder = mutation({
  args: {
    id: v.id("blocks"),
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      position: args.newPosition,
      updatedAt: Date.now(),
    })
  },
})
```

---

## Adding New Features

### Step 1: Define Schema (if new table)

```typescript
// convex/schema.ts
export default defineSchema({
  // ... existing tables

  newEntity: defineTable({
    name: v.string(),
    sessionId: v.id("sessions"),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),
})
```

### Step 2: Create Module

```typescript
// convex/newEntity.ts
import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newEntity")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()
  },
})

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("newEntity", {
      sessionId: args.sessionId,
      name: args.name,
      createdAt: Date.now(),
    })
  },
})
```

### Step 3: Use in Frontend

```typescript
import { useQuery, useMutation } from "convex/react"
import { api } from "../convex/_generated/api"

function MyComponent({ sessionId }) {
  const entities = useQuery(api.newEntity.list, { sessionId })
  const create = useMutation(api.newEntity.create)

  if (entities === undefined) return <Loading />

  return (
    <div>
      {entities.map((e) => <div key={e._id}>{e.name}</div>)}
      <button onClick={() => create({ sessionId, name: "New" })}>
        Add
      </button>
    </div>
  )
}
```

### Step 4: Add HTTP Endpoint (if needed)

```typescript
// convex/http.ts
http.route({
  path: "/api/newEntity",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()
    const id = await ctx.runMutation(api.newEntity.create, body)
    return new Response(JSON.stringify({ id }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }),
})
```

---

## LLM Integration

### Two Streaming Patterns

**1. Ollama (HTTP SSE):**
```
HTTP Action → Ollama API → TransformStream → SSE Response
```

**2. Claude Code (Database-backed):**
```
Mutation → Scheduler → Action → Database → Reactive Query
```

### Adding a New LLM Provider

1. Create client library in `convex/lib/`:
   ```typescript
   // convex/lib/newProvider.ts
   export async function* streamChat(messages): AsyncGenerator<string> {
     // Implementation
   }

   export async function checkHealth(): Promise<{ ok: boolean }> {
     // Implementation
   }
   ```

2. Add to HTTP chat endpoint:
   ```typescript
   // convex/http.ts
   if (provider === "newProvider") {
     for await (const chunk of streamNewProvider(messages)) {
       // Forward chunks
     }
   }
   ```

3. Add health check endpoint:
   ```typescript
   http.route({
     path: "/api/health/newProvider",
     method: "GET",
     handler: httpAction(async () => {
       const status = await checkNewProviderHealth()
       return new Response(JSON.stringify(status))
     }),
   })
   ```

---

## Testing

### Internal Test Functions

```typescript
// convex/testing.ts
export const resetAll = internalMutation({
  handler: async (ctx) => {
    // Delete test data
  },
})
```

### HTTP Test Endpoints

```typescript
// convex/http.ts
http.route({
  path: "/testing/reset",
  method: "POST",
  handler: httpAction(async (ctx) => {
    const result = await ctx.runMutation(internal.testing.resetAll)
    return new Response(JSON.stringify(result))
  }),
})
```

### Test Data Marking

```typescript
// Mark blocks as test data for easy cleanup
export const create = mutation({
  args: {
    // ... other args
    testData: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("blocks", {
      // ... other fields
      testData: args.testData,
    })
  },
})
```

---

## Best Practices

### 1. Always Use Indexes

```typescript
// Bad - full table scan
await ctx.db.query("blocks").filter((q) => q.eq(q.field("sessionId"), id))

// Good - uses index
await ctx.db.query("blocks").withIndex("by_session", (q) => q.eq("sessionId", id))
```

### 2. Update Parent Timestamps

```typescript
// When modifying child, update parent's updatedAt
export const update = mutation({
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id)
    await ctx.db.patch(args.id, { ... })

    // Update parent session
    await ctx.db.patch(block.sessionId, { updatedAt: Date.now() })
  },
})
```

### 3. Validate Before Acting

```typescript
export const update = mutation({
  handler: async (ctx, args) => {
    const entity = await ctx.db.get(args.id)
    if (!entity) throw new Error("Not found")  // Early validation

    await ctx.db.patch(args.id, { ... })
  },
})
```

### 4. Use Internal Functions for Cross-Module Calls

```typescript
// Exposed to clients
export const doThing = mutation({ ... })

// Only for server-side use
export const doThingInternal = internalMutation({ ... })
```

### 5. Throttle Frequent Writes

```typescript
// For streaming, don't write every chunk
let buffer = ""
let lastWrite = Date.now()
const throttleMs = 100

for await (const chunk of stream) {
  buffer += chunk
  if (Date.now() - lastWrite >= throttleMs) {
    await ctx.runMutation(internal.appendChunk, { chunk: buffer })
    buffer = ""
    lastWrite = Date.now()
  }
}
```

### 6. Handle CORS for HTTP Actions

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

// Handle preflight
http.route({
  path: "/api/endpoint",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders })
  }),
})
```

### 7. Centralize Validators

```typescript
// convex/lib/validators.ts
import { v } from "convex/values"

export const zoneValidator = v.union(
  v.literal("PERMANENT"),
  v.literal("STABLE"),
  v.literal("WORKING")
)

// Use in modules
import { zoneValidator } from "./lib/validators"
```

### 8. Use Context Types for Helper Functions

When extracting logic into helper functions, use the proper context types:

```typescript
import type { MutationCtx, QueryCtx } from "./_generated/server"

// Helper for mutations
async function getNextPosition(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  zone: string
): Promise<number> {
  const blocks = await ctx.db
    .query("blocks")
    .withIndex("by_session_zone", (q) => q.eq("sessionId", sessionId).eq("zone", zone))
    .collect()
  return blocks.length === 0 ? 0 : Math.max(...blocks.map((b) => b.position)) + 1
}

// Helper for queries (read-only)
async function countBlocks(ctx: QueryCtx, sessionId: Id<"sessions">): Promise<number> {
  const blocks = await ctx.db
    .query("blocks")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect()
  return blocks.length
}
```

**Available context types:**
| Type | Use For |
|------|---------|
| `QueryCtx` | Read-only database access |
| `MutationCtx` | Read/write database access |
| `ActionCtx` | External calls, `runQuery`, `runMutation`, `scheduler` |

---

## Resources

| Resource | URL |
|----------|-----|
| Convex Docs | https://docs.convex.dev/ |
| Schema Definition | https://docs.convex.dev/database/schemas |
| Queries & Mutations | https://docs.convex.dev/functions |
| Actions | https://docs.convex.dev/functions/actions |
| HTTP Actions | https://docs.convex.dev/functions/http-actions |
| Scheduling | https://docs.convex.dev/scheduling |
| Testing | https://docs.convex.dev/testing/convex-test |
