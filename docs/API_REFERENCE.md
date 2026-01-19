# API Reference

Complete reference for all Convex functions in ContextForgeTS.

---

## Quick Reference

| Module | Queries | Mutations | Actions |
|--------|---------|-----------|---------|
| [blocks](#blocks) | 3 | 5 | - |
| [sessions](#sessions) | 2 | 3 | - |
| [generations](#generations) | 2 | 3 | - |
| [snapshots](#snapshots) | 2 | 4 | - |
| [claudeNode](#claudenode) | - | - | 4 |
| [HTTP endpoints](#http-endpoints) | - | - | 8 |

---

## blocks

Manage content blocks within sessions.

### Queries

#### `blocks.list`

List all blocks for a session.

```typescript
const blocks = useQuery(api.blocks.list, { sessionId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Session to list blocks from |

**Returns:** `Block[]` ordered by creation time (newest first)

---

#### `blocks.listByZone`

List blocks by session and zone, ordered by position.

```typescript
const blocks = useQuery(api.blocks.listByZone, { sessionId, zone: "WORKING" })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Session ID |
| `zone` | `"PERMANENT" \| "STABLE" \| "WORKING"` | Yes | Zone to filter |

**Returns:** `Block[]` ordered by position (ascending)

---

#### `blocks.get`

Get a single block by ID.

```typescript
const block = useQuery(api.blocks.get, { id: blockId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"blocks">` | Yes | Block ID |

**Returns:** `Block | null`

---

### Mutations

#### `blocks.create`

Create a new block.

```typescript
const blockId = await createBlock({
  sessionId,
  content: "Hello world",
  type: "NOTE",
  zone: "WORKING",  // optional, defaults to WORKING
})
```

| Arg | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | - | Parent session |
| `content` | `string` | Yes | - | Block content |
| `type` | `string` | Yes | - | Block type (SYSTEM, NOTE, ASSISTANT, etc.) |
| `zone` | `Zone` | No | `"WORKING"` | Target zone |
| `testData` | `boolean` | No | `false` | Mark for test cleanup |

**Returns:** `Id<"blocks">`

---

#### `blocks.move`

Move a block to a different zone.

```typescript
await moveBlock({ id: blockId, zone: "STABLE" })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"blocks">` | Yes | Block to move |
| `zone` | `Zone` | Yes | Target zone |

**Returns:** `Id<"blocks">`

**Note:** Block is appended to end of target zone.

---

#### `blocks.reorder`

Change a block's position within its zone.

```typescript
await reorderBlock({ id: blockId, newPosition: 1.5 })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"blocks">` | Yes | Block to reorder |
| `newPosition` | `number` | Yes | New position (fractional allowed) |

**Returns:** `Id<"blocks">`

---

#### `blocks.update`

Update a block's content or type.

```typescript
await updateBlock({ id: blockId, content: "New content" })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"blocks">` | Yes | Block to update |
| `content` | `string` | No | New content |
| `type` | `string` | No | New type |

**Returns:** `Id<"blocks">`

---

#### `blocks.remove`

Delete a block.

```typescript
await removeBlock({ id: blockId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"blocks">` | Yes | Block to delete |

**Returns:** `void`

---

## sessions

Manage isolated workspaces.

### Queries

#### `sessions.list`

List all sessions.

```typescript
const sessions = useQuery(api.sessions.list)
```

**Args:** None

**Returns:** `Session[]` ordered by creation time (newest first)

---

#### `sessions.get`

Get a single session by ID.

```typescript
const session = useQuery(api.sessions.get, { id: sessionId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"sessions">` | Yes | Session ID |

**Returns:** `Session | null`

---

### Mutations

#### `sessions.create`

Create a new session.

```typescript
const sessionId = await createSession({ name: "My Project" })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | `string` | No | Display name |

**Returns:** `Id<"sessions">`

---

#### `sessions.update`

Update a session (e.g., rename).

```typescript
await updateSession({ id: sessionId, name: "New Name" })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"sessions">` | Yes | Session to update |
| `name` | `string` | No | New name |

**Returns:** `Id<"sessions">`

---

#### `sessions.remove`

Delete a session and all its blocks and snapshots.

```typescript
await removeSession({ id: sessionId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"sessions">` | Yes | Session to delete |

**Returns:** `void`

**Warning:** This cascade deletes all blocks and snapshots in the session.

---

## generations

Track streaming LLM generations.

### Queries

#### `generations.get`

Get a generation by ID. Subscribe for real-time streaming updates.

```typescript
const generation = useQuery(api.generations.get, { generationId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `generationId` | `Id<"generations">` | Yes | Generation ID |

**Returns:** `Generation | null`

**Streaming pattern:**
```typescript
// Subscribe to generation
const generation = useQuery(
  api.generations.get,
  generationId ? { generationId } : "skip"
)

// generation.text updates as chunks arrive
// generation.status changes: "streaming" → "complete" | "error"
```

---

#### `generations.getLatest`

Get the most recent generation for a session.

```typescript
const generation = useQuery(api.generations.getLatest, { sessionId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Session ID |

**Returns:** `Generation | null`

---

### Mutations

#### `generations.create`

Create a new generation record (low-level, prefer `startClaudeGeneration`).

```typescript
const generationId = await createGeneration({
  sessionId,
  provider: "claude",
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Parent session |
| `provider` | `string` | Yes | `"ollama"` or `"claude"` |

**Returns:** `Id<"generations">`

---

#### `generations.startClaudeGeneration`

Start a Claude streaming generation. This is the main entry point for Claude.

```typescript
const { generationId } = await startClaudeGeneration({
  sessionId,
  prompt: "Write a poem",
  systemPrompt: "You are a poet",  // optional
})

// Then subscribe to updates
const generation = useQuery(api.generations.get, { generationId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Parent session |
| `prompt` | `string` | Yes | User's prompt |
| `systemPrompt` | `string` | No | Override system prompt |

**Returns:** `{ generationId: Id<"generations"> }`

**What it does:**
1. Creates generation record
2. Schedules `claudeNode.streamGenerateWithContext` action
3. Returns immediately so client can subscribe

---

#### `generations.saveToBlocks`

Save completed generation to blocks.

```typescript
const blockId = await saveToBlocks({ generationId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `generationId` | `Id<"generations">` | Yes | Generation to save |

**Returns:** `Id<"blocks">`

Creates an `ASSISTANT` type block in the `WORKING` zone.

---

## snapshots

Save and restore session state.

### Queries

#### `snapshots.list`

List all snapshots for a session.

```typescript
const snapshots = useQuery(api.snapshots.list, { sessionId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Session ID |

**Returns:** `Snapshot[]` ordered by creation time (newest first)

---

#### `snapshots.get`

Get a single snapshot by ID.

```typescript
const snapshot = useQuery(api.snapshots.get, { id: snapshotId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"snapshots">` | Yes | Snapshot ID |

**Returns:** `Snapshot | null`

---

### Mutations

#### `snapshots.create`

Create a snapshot from current session state.

```typescript
const snapshotId = await createSnapshot({
  sessionId,
  name: "before-experiment",
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Session to snapshot |
| `name` | `string` | Yes | Snapshot name |

**Returns:** `Id<"snapshots">`

---

#### `snapshots.restore`

Restore a snapshot (replaces current session blocks).

```typescript
await restoreSnapshot({ id: snapshotId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"snapshots">` | Yes | Snapshot to restore |

**Returns:** `Id<"sessions">`

**Warning:** This deletes all current blocks and recreates from snapshot.

---

#### `snapshots.remove`

Delete a snapshot.

```typescript
await removeSnapshot({ id: snapshotId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"snapshots">` | Yes | Snapshot to delete |

**Returns:** `void`

---

#### `snapshots.rename`

Rename a snapshot.

```typescript
await renameSnapshot({ id: snapshotId, name: "new-name" })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"snapshots">` | Yes | Snapshot to rename |
| `name` | `string` | Yes | New name |

**Returns:** `Id<"snapshots">`

---

## claudeNode

Claude Code SDK actions (run in Node.js runtime).

### Actions

#### `claudeNode.checkHealth`

Check if Claude Code CLI is available.

```typescript
const status = await checkHealth({})
// { ok: true, version: "claude-3-sonnet" }
// { ok: false, error: "Claude CLI not found" }
```

**Args:** None

**Returns:** `{ ok: boolean, error?: string, version?: string }`

---

#### `claudeNode.generate`

Generate text (non-streaming, waits for full response).

```typescript
const result = await generate({
  messages: [
    { role: "system", content: "You are helpful" },
    { role: "user", content: "Hello" },
  ],
})
// { text: "Hello! How can I help?", inputTokens: 10, outputTokens: 5 }
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `messages` | `ClaudeMessage[]` | Yes | Conversation history |
| `systemPrompt` | `string` | No | System prompt override |

**Returns:**
```typescript
{
  text: string
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  durationMs?: number
  error?: string
}
```

---

#### `claudeNode.streamGenerate`

Stream generate with database updates (low-level).

```typescript
await streamGenerate({
  generationId,
  messages: [...],
  throttleMs: 100,  // optional
})
```

| Arg | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `generationId` | `Id<"generations">` | Yes | - | Generation to update |
| `messages` | `ClaudeMessage[]` | Yes | - | Conversation history |
| `systemPrompt` | `string` | No | - | System prompt |
| `throttleMs` | `number` | No | `100` | DB write throttle |

**Returns:** `void` (updates generation via internal mutations)

---

#### `claudeNode.streamGenerateWithContext`

Stream generate with automatic context assembly from blocks.

```typescript
// Usually called by generations.startClaudeGeneration, not directly
await streamGenerateWithContext({
  generationId,
  sessionId,
  prompt: "Write a poem",
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `generationId` | `Id<"generations">` | Yes | Generation to update |
| `sessionId` | `Id<"sessions">` | Yes | Session for context |
| `prompt` | `string` | Yes | User's prompt |
| `systemPrompt` | `string` | No | Override system prompt |
| `throttleMs` | `number` | No | DB write throttle (default: 100) |

**Returns:** `void`

**What it does:**
1. Fetches blocks from session (PERMANENT → STABLE → WORKING)
2. Assembles context with zone ordering
3. Streams from Claude, writing chunks to generation record
4. Marks complete or error when done

---

## HTTP Endpoints

HTTP routes defined in `convex/http.ts`. Base URL: port 3211 (not 3210).

### Testing Endpoints

#### `POST /testing/reset`

Reset all test data.

```bash
curl -X POST http://localhost:3211/testing/reset
```

**Returns:** `{ deleted: number, deletedSessions: number, deletedSnapshots: number }`

---

#### `POST /testing/sessions`

Create a test session.

```bash
curl -X POST http://localhost:3211/testing/sessions \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Session"}'
```

**Body:** `{ name?: string }`

**Returns:** `{ id: string }`

---

#### `POST /testing/blocks`

Create a test block.

```bash
curl -X POST http://localhost:3211/testing/blocks \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "...", "content": "Test", "type": "NOTE"}'
```

**Body:** `{ sessionId: string, content: string, type: string, zone?: Zone }`

**Returns:** `{ id: string }`

---

### LLM Endpoints

#### `POST /api/chat`

Ollama streaming chat (Server-Sent Events).

```bash
curl -X POST http://localhost:3211/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "...", "prompt": "Hello"}'
```

**Body:** `{ sessionId: string, prompt: string, systemPrompt?: string }`

**Returns:** SSE stream with events:
- `data: {"type": "text-delta", "delta": "chunk"}`
- `data: {"type": "finish", "finishReason": "stop"}`
- `data: {"type": "error", "error": "message"}`
- `data: [DONE]`

---

### Health Endpoints

#### `GET /api/health`

Combined health check for all providers.

```bash
curl http://localhost:3211/api/health
```

**Returns:**
```json
{
  "ollama": { "ok": true, "url": "http://localhost:11434" },
  "claude": { "ok": true, "version": "claude-3-sonnet" }
}
```

---

#### `GET /api/health/ollama`

Ollama health check.

```bash
curl http://localhost:3211/api/health/ollama
```

**Returns:** `{ ok: boolean, url: string, error?: string }`

---

#### `GET /api/health/claude`

Claude Code CLI health check.

```bash
curl http://localhost:3211/api/health/claude
```

**Returns:** `{ ok: boolean, error?: string, version?: string }`

---

## Types

### Block

```typescript
interface Block {
  _id: Id<"blocks">
  _creationTime: number
  sessionId: Id<"sessions">
  content: string
  type: string
  zone: "PERMANENT" | "STABLE" | "WORKING"
  position: number
  createdAt: number
  updatedAt: number
  testData?: boolean
}
```

### Session

```typescript
interface Session {
  _id: Id<"sessions">
  _creationTime: number
  name?: string
  createdAt: number
  updatedAt: number
}
```

### Generation

```typescript
interface Generation {
  _id: Id<"generations">
  _creationTime: number
  sessionId: Id<"sessions">
  provider: string
  status: "streaming" | "complete" | "error"
  text: string
  error?: string
  createdAt: number
  updatedAt: number
}
```

### Snapshot

```typescript
interface Snapshot {
  _id: Id<"snapshots">
  _creationTime: number
  sessionId: Id<"sessions">
  name: string
  createdAt: number
  blocks: Array<{
    content: string
    type: string
    zone: "PERMANENT" | "STABLE" | "WORKING"
    position: number
  }>
}
```

### ClaudeMessage

```typescript
interface ClaudeMessage {
  role: "system" | "user" | "assistant"
  content: string
}
```

### Zone

```typescript
type Zone = "PERMANENT" | "STABLE" | "WORKING"
```

---

## Usage Examples

### Create a Session and Add Blocks

```typescript
import { useMutation, useQuery } from "convex/react"
import { api } from "../convex/_generated/api"

function MyComponent() {
  const createSession = useMutation(api.sessions.create)
  const createBlock = useMutation(api.blocks.create)

  const handleCreate = async () => {
    // Create session
    const sessionId = await createSession({ name: "My Project" })

    // Add system prompt
    await createBlock({
      sessionId,
      content: "You are a helpful assistant.",
      type: "SYSTEM",
      zone: "PERMANENT",
    })

    // Add reference material
    await createBlock({
      sessionId,
      content: "API documentation...",
      type: "NOTE",
      zone: "STABLE",
    })
  }
}
```

### Stream a Generation

```typescript
function GenerateComponent({ sessionId }) {
  const startGeneration = useMutation(api.generations.startClaudeGeneration)
  const saveToBlocks = useMutation(api.generations.saveToBlocks)
  const [generationId, setGenerationId] = useState(null)

  // Subscribe to generation updates
  const generation = useQuery(
    api.generations.get,
    generationId ? { generationId } : "skip"
  )

  const handleGenerate = async () => {
    const { generationId } = await startGeneration({
      sessionId,
      prompt: "Write a haiku about TypeScript",
    })
    setGenerationId(generationId)
  }

  // Save when complete
  useEffect(() => {
    if (generation?.status === "complete") {
      saveToBlocks({ generationId })
    }
  }, [generation?.status])

  return (
    <div>
      <button onClick={handleGenerate}>Generate</button>
      {generation && (
        <div>
          <p>Status: {generation.status}</p>
          <pre>{generation.text}</pre>
        </div>
      )}
    </div>
  )
}
```

### Save and Restore Snapshots

```typescript
function SnapshotManager({ sessionId }) {
  const snapshots = useQuery(api.snapshots.list, { sessionId })
  const createSnapshot = useMutation(api.snapshots.create)
  const restoreSnapshot = useMutation(api.snapshots.restore)

  return (
    <div>
      <button onClick={() => createSnapshot({ sessionId, name: `Backup ${Date.now()}` })}>
        Save Snapshot
      </button>

      <ul>
        {snapshots?.map(snapshot => (
          <li key={snapshot._id}>
            {snapshot.name}
            <button onClick={() => restoreSnapshot({ id: snapshot._id })}>
              Restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```
