# Data Model Reference

This document explains the ContextForgeTS database schema, relationships, and design decisions.

---

## Overview

ContextForgeTS uses Convex as its database. The schema is defined in `convex/schema.ts`.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Data Model                                       │
│                                                                               │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                   │
│  │  workflows  │──1:N─│  templates  │      │ generations │                   │
│  │             │      │             │      │             │                   │
│  │  (pipeline) │      │  (config)   │      │ (streaming) │                   │
│  └──────┬──────┘      └─────────────┘      └─────────────┘                   │
│         │                   │                     │                           │
│         │                   │ apply               │                           │
│         ▼                   ▼                     │                           │
│  ┌─────────────┐      ┌─────────────┐            │                           │
│  │  projects   │──1:N─│  sessions   │◄───────────┘                           │
│  │             │      │             │                                         │
│  │  (grouping) │      │  (workspace)│──1:N─┬─────────────┐                   │
│  └─────────────┘      └─────────────┘      │             │                   │
│                              │             │             │                    │
│                              │             ▼             ▼                    │
│                              │      ┌─────────────┐ ┌─────────────┐          │
│                              └──1:N─│   blocks    │ │  snapshots  │          │
│                                     │      ↺      │ │             │          │
│                                     │  (content)  │ │  (backup)   │          │
│                                     └─────────────┘ └─────────────┘          │
│                                        ↺ = linked ref (refBlockId)           │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Tables

### sessions

**Purpose:** Isolated workspaces for context management. Each session contains its own set of blocks.

```typescript
{
  _id: Id<"sessions">        // Auto-generated Convex ID
  userId?: Id<"users">       // Owner (optional for migration)
  name?: string              // Display name (e.g., "Project Alpha Docs")
  createdAt: number          // Unix timestamp (ms)
  updatedAt: number          // Unix timestamp (ms)
  // Token budget configuration
  budgets?: {
    permanent: number        // Default: 50000
    stable: number           // Default: 100000
    working: number          // Default: 100000
    total: number            // Default: 500000
  }
  // System prompt for LLM interactions
  systemPrompt?: string
  // Project/workflow linkage
  projectId?: Id<"projects">
  templateId?: Id<"templates">
  stepNumber?: number
}
```

**Why sessions exist:**
- Users may work on multiple projects simultaneously
- Testing requires isolated environments
- Context can be saved/restored per session via snapshots
- Sessions can be organized into projects for workflow pipelines

**Indexes:**
- `by_project` - Query sessions by project ID
- `by_user` - Query sessions by user ID

---

### blocks

**Purpose:** Content blocks that form the context window. Organized into three zones.

```typescript
{
  _id: Id<"blocks">          // Auto-generated Convex ID
  sessionId: Id<"sessions">  // Parent session (required)
  content: string            // The actual text content
  type: string               // Block type (see below)
  zone: Zone                 // PERMANENT | STABLE | WORKING
  position: number           // Order within zone (fractional)
  createdAt: number          // Unix timestamp (ms)
  updatedAt: number          // Unix timestamp (ms)
  testData?: boolean         // Flag for test cleanup
  isDraft?: boolean          // Draft blocks visible but excluded from LLM context
  // Token tracking
  tokens?: number            // Current token count
  originalTokens?: number    // Original token count (before compression)
  tokenModel?: string        // Model used for counting (e.g., "cl100k_base")
  // Compression state
  isCompressed?: boolean     // Whether this block has been compressed
  compressionStrategy?: string  // "semantic" | "structural" | "statistical"
  compressionRatio?: number  // e.g., 2.5 means 2.5x smaller
  compressedAt?: number      // Timestamp when compressed
  mergedFromCount?: number   // Number of blocks merged into this one
  // Skill metadata
  metadata?: {
    skillName: string
    skillDescription?: string
    sourceType: "local" | "upload" | "url"
    sourceRef?: string
    parentSkillName?: string   // Links reference blocks to parent skill
  }
  // Linked blocks
  refBlockId?: Id<"blocks">  // Points to canonical block in another session
  contentHash?: string       // DJB2 hex hash for duplicate detection
}
```

**Indexes:**
- `by_session` - Query all blocks for a session
- `by_session_zone` - Query blocks by session + zone (most common)
- `by_content_hash` - Find blocks by content hash (duplicate detection)
- `by_zone` - Legacy, may be removed

#### Block Types

| Type | Category | Purpose | Default Zone |
|------|----------|---------|-------------|
| `system_prompt` | Core | LLM behavior instructions | PERMANENT |
| `note` | Core | General-purpose notes | WORKING |
| `code` | Core | Source code, scripts, config | WORKING |
| `guideline` | Document | Instructions for creating outputs | PERMANENT |
| `template` | Document | Reusable document templates | STABLE |
| `reference` | Document | External references and sources | STABLE |
| `document` | Document | Standalone documents | WORKING |
| `user_message` | Conversation | User input in dialog | WORKING |
| `assistant_message` | Conversation | LLM-generated responses | WORKING |
| `instruction` | Behavioral | Task-specific instructions | PERMANENT |
| `persona` | Behavioral | Character/persona definitions | PERMANENT |
| `framework` | Behavioral | Reasoning frameworks | STABLE |
| `skill` | Behavioral | Imported skill definitions | PERMANENT |

#### Zones

| Zone | Purpose | Behavior |
|------|---------|----------|
| `PERMANENT` | Core context that never changes | Always first in context, cannot be moved out |
| `STABLE` | Reference material for the session | Cached well, rarely evicted |
| `WORKING` | Recent work, generated content | First to evict when over budget |

**Context Assembly Order:**
```
PERMANENT blocks (by position)
    ↓
STABLE blocks (by position)
    ↓
WORKING blocks (by position)
    ↓
User's current prompt
```

#### Fractional Positioning

Blocks use fractional positions to avoid reindexing on reorder:

```
Initial state:    After insert between 1 and 2:
┌─────────────┐   ┌─────────────┐
│ pos: 1      │   │ pos: 1      │
├─────────────┤   ├─────────────┤
│ pos: 2      │   │ pos: 1.5    │  ← New block
├─────────────┤   ├─────────────┤
│ pos: 3      │   │ pos: 2      │
└─────────────┘   ├─────────────┤
                  │ pos: 3      │
                  └─────────────┘
```

Benefits:
- O(1) insert (just calculate midpoint)
- No cascading position updates
- Works well with drag-and-drop

#### Linked Blocks

Blocks can reference a canonical block in another session via `refBlockId`:

```
Session A (canonical)          Session B (reference)
┌──────────────────┐          ┌──────────────────┐
│ Block #123       │          │ Block #456       │
│ content: "..."   │◄─────── │ refBlockId: #123 │
│ zone: PERMANENT  │          │ content: ""      │
│ tokens: 500      │          │ zone: STABLE     │
└──────────────────┘          └──────────────────┘
```

**Resolution:** All queries resolve linked blocks server-side — clients always see the canonical content. Each session controls its own zone, position, and draft status independently.

**Lifecycle rules:**
- **Edit:** Updates to a reference block redirect to the canonical. Token counts sync across all references.
- **Delete canonical:** All referencing blocks are promoted — content copied, `refBlockId` cleared.
- **Session delete/clear:** References in other sessions are promoted before blocks are deleted.
- **Unlink:** Copies canonical content into the reference block and clears `refBlockId`.
- **Compress guard:** Linked blocks cannot be compressed — must unlink first.
- **Templates/snapshots:** Content is resolved before saving — no references in serialized data.
- **Workflow carry-forward:** PERMANENT/STABLE blocks create linked references. WORKING blocks create independent copies.

**Duplicate detection:** `contentHash` (DJB2 hex) is computed on create and edit. The `by_content_hash` index enables fast lookup for suggesting links to identical content in other sessions.

---

### generations

**Purpose:** Track streaming LLM generations with real-time text updates.

```typescript
{
  _id: Id<"generations">     // Auto-generated Convex ID
  sessionId: Id<"sessions">  // Parent session
  provider: string           // "ollama" | "claude" | "openrouter"
  status: Status             // streaming | complete | error
  text: string               // Accumulated text (grows during streaming)
  error?: string             // Error message if status is "error"
  createdAt: number          // Unix timestamp (ms)
  updatedAt: number          // Unix timestamp (ms)
  // Usage tracking
  inputTokens?: number       // Prompt tokens used
  outputTokens?: number      // Completion tokens generated
  totalTokens?: number       // Total tokens (input + output)
  costUsd?: number           // Estimated cost in USD
  durationMs?: number        // Generation duration in milliseconds
}
```

**Indexes:**
- `by_session` - Query generations for a session by creation time

**Lifecycle:**
```
1. Client calls startClaudeGeneration mutation
   └─► Creates generation with status="streaming", text=""

2. Node.js action streams from LLM
   └─► Calls appendChunk internal mutation repeatedly
       └─► text grows: "" → "Hello" → "Hello, how" → "Hello, how are you?"

3. Client subscribes via useQuery(api.generations.get)
   └─► Sees text update in real-time

4. Streaming completes
   └─► status changes to "complete" or "error"

5. Client calls saveToBlocks mutation
   └─► Creates ASSISTANT block in WORKING zone
```

**Why this pattern:**
- Convex doesn't support HTTP streaming responses
- Database writes + reactive queries = real-time updates
- Client automatically reconnects if connection drops

---

### snapshots

**Purpose:** Save and restore session state for testing, experimentation, or undo.

```typescript
{
  _id: Id<"snapshots">       // Auto-generated Convex ID
  sessionId: Id<"sessions">  // Parent session
  name: string               // Display name (e.g., "before-refactor")
  createdAt: number          // Unix timestamp (ms)
  blocks: Array<{            // Denormalized block data
    content: string
    type: string
    zone: Zone
    position: number
    tokens?: number
    originalTokens?: number
    tokenModel?: string
    metadata?: SkillMetadata  // Skill block metadata
    isDraft?: boolean         // Draft status preserved
  }>
}
```

**Indexes:**
- `by_session` - Query snapshots for a session

**Why denormalized blocks:**
- Snapshots are immutable once created
- Fast restore without joins
- Works even if original blocks are deleted

**Use cases:**
- Save state before LLM experiment
- A/B test different context configurations
- Undo destructive changes

---

### templates

**Purpose:** Reusable session configurations that can be applied to create consistent starting points.

```typescript
{
  _id: Id<"templates">       // Auto-generated Convex ID
  name: string               // Template name
  description?: string       // Optional description
  blocks: Array<{            // Block configurations
    content: string
    type: string
    zone: Zone
    position: number
    metadata?: SkillMetadata  // Skill block metadata
  }>
  // Workflow linkage
  workflowId?: Id<"workflows">
  stepOrder?: number
  createdAt: number          // Unix timestamp (ms)
  updatedAt: number          // Unix timestamp (ms)
}
```

**Indexes:**
- `by_workflow` - Query templates for a workflow

**Use cases:**
- Create reusable project setups
- Define workflow step templates
- Share configurations between sessions

---

### projects

**Purpose:** Group related sessions together for organized work.

```typescript
{
  _id: Id<"projects">        // Auto-generated Convex ID
  name: string               // Project name
  description?: string       // Optional description
  workflowId?: Id<"workflows">  // Link to workflow for step-by-step process
  currentStep?: number       // Current workflow step (0-indexed)
  createdAt: number          // Unix timestamp (ms)
  updatedAt: number          // Unix timestamp (ms)
}
```

**Indexes:** None (small table)

**Use cases:**
- Group sessions for a game design project
- Track progress through a workflow
- Organize related documents

---

### workflows

**Purpose:** Multi-step document creation pipelines with templates and context carry-forward.

```typescript
{
  _id: Id<"workflows">       // Auto-generated Convex ID
  name: string               // Workflow name
  description?: string       // Optional description
  steps: Array<{             // Ordered steps
    templateId?: Id<"templates">  // Template to apply for this step
    name: string                  // Step name
    description?: string          // Step description
    carryForwardZones?: Zone[]    // Which zones to copy from previous step
  }>
  createdAt: number          // Unix timestamp (ms)
  updatedAt: number          // Unix timestamp (ms)
}
```

**Indexes:** None (small table)

**Step Carry-Forward:**
When advancing to the next step, blocks from specified zones are carried forward:
```
Step 1 Session                    Step 2 Session
┌──────────────────┐             ┌──────────────────┐
│ PERMANENT blocks │ ─link─────► │ PERMANENT refs   │ (linked — edits propagate)
│ STABLE blocks    │ ─link─────► │ STABLE refs      │ (linked — edits propagate)
│ WORKING blocks   │ ─copy─────► │ WORKING copies   │ (independent copies)
└──────────────────┘             │ + Template blocks│
                                 └──────────────────┘
```

**Use cases:**
- IRD documentation workflow: Brief → Personas → Scenarios → Stories
- Game design workflow: Concept → Mechanics → Content → Polish
- Any multi-step document creation process

---

### counters (Deprecated)

**Purpose:** Demo table for testing Convex setup. Can be safely removed.

```typescript
{
  _id: Id<"counters">
  name: string
  value: number
}
```

---

## Relationships

### Session → Blocks (1:N)

```typescript
// Query
const blocks = await ctx.db
  .query("blocks")
  .withIndex("by_session", q => q.eq("sessionId", sessionId))
  .collect()

// Cascade delete (in sessions.remove mutation)
for (const block of blocks) {
  await ctx.db.delete(block._id)
}
```

### Session → Generations (1:N)

```typescript
// Get latest
const generation = await ctx.db
  .query("generations")
  .withIndex("by_session", q => q.eq("sessionId", sessionId))
  .order("desc")
  .first()
```

### Session → Snapshots (1:N)

```typescript
// List snapshots
const snapshots = await ctx.db
  .query("snapshots")
  .withIndex("by_session", q => q.eq("sessionId", sessionId))
  .order("desc")
  .collect()
```

### Project → Sessions (1:N)

```typescript
// Get sessions for a project
const sessions = await ctx.db
  .query("sessions")
  .withIndex("by_project", q => q.eq("projectId", projectId))
  .collect()
```

### Workflow → Templates (1:N)

```typescript
// Get templates linked to a workflow
const templates = await ctx.db
  .query("templates")
  .withIndex("by_workflow", q => q.eq("workflowId", workflowId))
  .collect()
```

### Project → Workflow (N:1)

```typescript
// Get workflow for a project
if (project.workflowId) {
  const workflow = await ctx.db.get(project.workflowId)
}
```

### Template → Session (apply relationship)

When a template is applied to a session, blocks are copied and the session is linked:
```typescript
await ctx.db.patch(sessionId, {
  templateId: args.templateId,
  updatedAt: Date.now(),
})
```

### Block → Block (Linked Reference)

```typescript
// Resolve a linked block
if (block.refBlockId) {
  const canonical = await ctx.db.get(block.refBlockId)
  return { ...block, content: canonical?.content ?? "" }
}

// Find all blocks referencing a canonical block
const refs = await ctx.db
  .query("blocks")
  .filter((q) => q.eq(q.field("refBlockId"), canonicalBlockId))
  .collect()

// Promote references before deleting canonical
for (const ref of refs) {
  await ctx.db.patch(ref._id, {
    content: canonical.content,
    refBlockId: undefined,
  })
}
```

---

## Validators

Defined in `convex/lib/validators.ts`:

```typescript
// Zone validator
export const zoneValidator = v.union(
  v.literal("PERMANENT"),
  v.literal("STABLE"),
  v.literal("WORKING")
)

// TypeScript type
export type Zone = "PERMANENT" | "STABLE" | "WORKING"
```

---

## Common Patterns

### Getting Blocks for Context Assembly

```typescript
// Get all blocks ordered by zone priority, then position
const permanentBlocks = await ctx.db
  .query("blocks")
  .withIndex("by_session_zone", q =>
    q.eq("sessionId", sessionId).eq("zone", "PERMANENT")
  )
  .collect()

const stableBlocks = await ctx.db
  .query("blocks")
  .withIndex("by_session_zone", q =>
    q.eq("sessionId", sessionId).eq("zone", "STABLE")
  )
  .collect()

const workingBlocks = await ctx.db
  .query("blocks")
  .withIndex("by_session_zone", q =>
    q.eq("sessionId", sessionId).eq("zone", "WORKING")
  )
  .collect()

// Assemble in order
const allBlocks = [...permanentBlocks, ...stableBlocks, ...workingBlocks]
```

### Calculating Next Position

```typescript
// Append to end of zone
const lastBlock = await ctx.db
  .query("blocks")
  .withIndex("by_session_zone", q =>
    q.eq("sessionId", sessionId).eq("zone", zone)
  )
  .order("desc")
  .first()

const nextPosition = lastBlock ? lastBlock.position + 1 : 1
```

### Insert Between Blocks

```typescript
function getPositionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1
  if (before === null) return after! / 2
  if (after === null) return before + 1
  return (before + after) / 2
}
```

---

## Test Data

Blocks and sessions can be marked as test data for cleanup:

```typescript
// Creating test block
await ctx.db.insert("blocks", {
  ...blockData,
  testData: true,  // ← Mark for cleanup
})

// Creating test session (by name convention)
await ctx.db.insert("sessions", {
  name: "Test Session",  // ← Cleaned up by testing.resetAll
  ...
})

// Cleanup (called by E2E tests)
const testBlocks = await ctx.db
  .query("blocks")
  .filter(q => q.eq(q.field("testData"), true))
  .collect()

for (const block of testBlocks) {
  await ctx.db.delete(block._id)
}
```

---

## Schema Evolution Notes

If you need to add fields:

1. **Optional fields** - Add with `v.optional()`, existing docs unaffected
2. **Required fields** - Add with default in migration, or use `v.optional()` initially
3. **Removing fields** - Remove from schema, old data ignored (Convex is schemaless underneath)

Example adding a field:
```typescript
// convex/schema.ts
blocks: defineTable({
  // ... existing fields
  tokens: v.optional(v.number()),  // New field, optional for backwards compat
})
```
