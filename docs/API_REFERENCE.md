# API Reference

Complete reference for all Convex functions in ContextForgeTS.

---

## Quick Reference

| Module | Queries | Mutations | Actions |
|--------|---------|-----------|---------|
| [blocks](#blocks) | 3 | 5 | - |
| [sessions](#sessions) | 2 | 6 | - |
| [generations](#generations) | 2 | 3 | - |
| [snapshots](#snapshots) | 2 | 4 | - |
| [metrics](#metrics) | 4 | - | - |
| [templates](#templates) | 3 | 5 | - |
| [projects](#projects) | 2 | 6 | - |
| [workflows](#workflows) | 2 | 8 | - |
| [claudeNode](#claudenode) | - | - | 4 |
| [HTTP endpoints](#http-endpoints) | - | - | 12 |

---

## blocks

Manage content blocks within sessions.

### Queries

#### `blocks.list`

List all blocks for a session.

```typescript
const blocks = useQuery(api.blocks.list, { sessionId })
```

```bash
npx convex run blocks:list '{"sessionId": "SESSION_ID"}'
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

```bash
npx convex run blocks:listByZone '{"sessionId": "SESSION_ID", "zone": "WORKING"}'
npx convex run blocks:listByZone '{"sessionId": "SESSION_ID", "zone": "STABLE"}'
npx convex run blocks:listByZone '{"sessionId": "SESSION_ID", "zone": "PERMANENT"}'
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

```bash
npx convex run blocks:get '{"id": "BLOCK_ID"}'
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

```bash
npx convex run blocks:create '{"sessionId": "SESSION_ID", "content": "Hello world", "type": "NOTE"}'
npx convex run blocks:create '{"sessionId": "SESSION_ID", "content": "System prompt", "type": "SYSTEM", "zone": "PERMANENT"}'
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

```bash
npx convex run blocks:move '{"id": "BLOCK_ID", "zone": "STABLE"}'
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

```bash
npx convex run blocks:reorder '{"id": "BLOCK_ID", "newPosition": 1.5}'
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

```bash
npx convex run blocks:update '{"id": "BLOCK_ID", "content": "New content"}'
npx convex run blocks:update '{"id": "BLOCK_ID", "type": "SYSTEM"}'
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

```bash
npx convex run blocks:remove '{"id": "BLOCK_ID"}'
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

```bash
npx convex run sessions:list
```

**Args:** None

**Returns:** `Session[]` ordered by creation time (newest first)

---

#### `sessions.get`

Get a single session by ID.

```typescript
const session = useQuery(api.sessions.get, { id: sessionId })
```

```bash
npx convex run sessions:get '{"id": "SESSION_ID"}'
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

```bash
npx convex run sessions:create '{"name": "My Project"}'
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

```bash
npx convex run sessions:update '{"id": "SESSION_ID", "name": "New Name"}'
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"sessions">` | Yes | Session to update |
| `name` | `string` | No | New name |

**Returns:** `Id<"sessions">`

---

#### `sessions.remove`

Delete a session and all its blocks, snapshots, and generations.

```typescript
await removeSession({ id: sessionId })
```

```bash
npx convex run sessions:remove '{"id": "SESSION_ID"}'
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"sessions">` | Yes | Session to delete |

**Returns:** `void`

**Warning:** This cascade deletes all blocks, snapshots, and generations in the session.

---

#### `sessions.removeAll`

Delete ALL sessions and their data.

```typescript
const result = await removeAllSessions({})
// { deletedSessions: 5, deletedBlocks: 42, deletedSnapshots: 3, deletedGenerations: 10 }
```

```bash
npx convex run sessions:removeAll
```

**Args:** None

**Returns:** `{ deletedSessions: number, deletedBlocks: number, deletedSnapshots: number, deletedGenerations: number }`

**Warning:** This is a nuclear option - deletes everything.

---

#### `sessions.removeByName`

Delete all sessions matching an exact name.

```typescript
const result = await removeByName({ name: "Test Session" })
// { deletedSessions: 3, deletedBlocks: 15, ... }
```

```bash
npx convex run sessions:removeByName '{"name": "Test Session"}'
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | `string` | Yes | Exact session name to match |

**Returns:** `{ deletedSessions: number, deletedBlocks: number, deletedSnapshots: number, deletedGenerations: number }`

---

#### `sessions.clear`

Delete all blocks from a session but keep the session itself.

```typescript
const result = await clearSession({ id: sessionId })
// { deletedBlocks: 12 }
```

```bash
npx convex run sessions:clear '{"id": "SESSION_ID"}'
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"sessions">` | Yes | Session to clear |

**Returns:** `{ deletedBlocks: number }`

---

## generations

Track streaming LLM generations.

### Queries

#### `generations.get`

Get a generation by ID. Subscribe for real-time streaming updates.

```typescript
const generation = useQuery(api.generations.get, { generationId })
```

```bash
npx convex run generations:get '{"generationId": "GENERATION_ID"}'
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

```bash
npx convex run generations:getLatest '{"sessionId": "SESSION_ID"}'
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

```bash
npx convex run generations:create '{"sessionId": "SESSION_ID", "provider": "claude"}'
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

```bash
npx convex run generations:startClaudeGeneration '{"sessionId": "SESSION_ID", "prompt": "Write a poem"}'
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

```bash
npx convex run generations:saveToBlocks '{"generationId": "GENERATION_ID"}'
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

```bash
npx convex run snapshots:list '{"sessionId": "SESSION_ID"}'
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

```bash
npx convex run snapshots:get '{"id": "SNAPSHOT_ID"}'
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

```bash
npx convex run snapshots:create '{"sessionId": "SESSION_ID", "name": "before-experiment"}'
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

```bash
npx convex run snapshots:restore '{"id": "SNAPSHOT_ID"}'
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

```bash
npx convex run snapshots:remove '{"id": "SNAPSHOT_ID"}'
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

```bash
npx convex run snapshots:rename '{"id": "SNAPSHOT_ID", "name": "new-name"}'
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"snapshots">` | Yes | Snapshot to rename |
| `name` | `string` | Yes | New name |

**Returns:** `Id<"snapshots">`

---

## metrics

Token counting and budget tracking.

### Queries

#### `metrics.getZoneMetrics`

Get token metrics for all zones in a session.

```typescript
const metrics = useQuery(api.metrics.getZoneMetrics, { sessionId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Session ID |

**Returns:**
```typescript
{
  zones: {
    PERMANENT: { blocks: number, tokens: number, budget: number, percentUsed: number },
    STABLE: { blocks: number, tokens: number, budget: number, percentUsed: number },
    WORKING: { blocks: number, tokens: number, budget: number, percentUsed: number },
  },
  total: { blocks: number, tokens: number, budget: number, percentUsed: number },
  budgets: { permanent: number, stable: number, working: number, total: number },
}
```

---

#### `metrics.checkBudget`

Check if adding content would exceed zone budget.

```typescript
const check = useQuery(api.metrics.checkBudget, {
  sessionId,
  zone: "WORKING",
  additionalTokens: 1000,
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Session ID |
| `zone` | `string` | Yes | Zone to check |
| `additionalTokens` | `number` | Yes | Tokens to add |

**Returns:**
```typescript
{
  currentTokens: number,
  additionalTokens: number,
  newTotal: number,
  budget: number,
  wouldExceed: boolean,
  percentUsed: number,
  warning: boolean,    // true if 80-95% used
  danger: boolean,     // true if >95% used
}
```

---

#### `metrics.estimateTokens`

Estimate token count for content.

```typescript
const { tokens } = useQuery(api.metrics.estimateTokens, { content: "Hello world" })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `content` | `string` | Yes | Text to count |

**Returns:** `{ tokens: number }`

---

#### `metrics.getBudgetStatus`

Get simple ok/warning/danger status for each zone.

```typescript
const status = useQuery(api.metrics.getBudgetStatus, { sessionId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Session ID |

**Returns:**
```typescript
{
  permanent: { tokens: number, budget: number, status: "ok" | "warning" | "danger" },
  stable: { tokens: number, budget: number, status: "ok" | "warning" | "danger" },
  working: { tokens: number, budget: number, status: "ok" | "warning" | "danger" },
  total: { tokens: number, budget: number, status: "ok" | "warning" | "danger" },
}
```

---

## templates

Reusable session configurations.

### Queries

#### `templates.list`

List all templates.

```typescript
const templates = useQuery(api.templates.list)
```

**Returns:** `Template[]` ordered by creation time (newest first)

---

#### `templates.get`

Get a template by ID.

```typescript
const template = useQuery(api.templates.get, { id: templateId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"templates">` | Yes | Template ID |

**Returns:** `Template | null`

---

#### `templates.listByWorkflow`

List templates linked to a workflow.

```typescript
const templates = useQuery(api.templates.listByWorkflow, { workflowId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `workflowId` | `Id<"workflows">` | Yes | Workflow ID |

**Returns:** `Template[]`

---

### Mutations

#### `templates.create`

Create a template from scratch.

```typescript
const templateId = await createTemplate({
  name: "My Template",
  description: "A useful template",
  blocks: [{ content: "Hello", type: "NOTE", zone: "WORKING", position: 0 }],
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | `string` | Yes | Template name |
| `description` | `string` | No | Description |
| `blocks` | `BlockData[]` | Yes | Block configurations |

**Returns:** `Id<"templates">`

---

#### `templates.createFromSession`

Create a template from an existing session.

```typescript
const templateId = await createFromSession({
  sessionId,
  name: "My Template",
  description: "Captured from session",
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Source session |
| `name` | `string` | Yes | Template name |
| `description` | `string` | No | Description |

**Returns:** `Id<"templates">`

---

#### `templates.applyToSession`

Apply a template to a session.

```typescript
await applyToSession({
  templateId,
  sessionId,
  clearExisting: true,  // optional, default true
})
```

| Arg | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `templateId` | `Id<"templates">` | Yes | - | Template to apply |
| `sessionId` | `Id<"sessions">` | Yes | - | Target session |
| `clearExisting` | `boolean` | No | `true` | Clear existing blocks first |

**Returns:** `{ success: boolean, blocksCreated: number }`

---

#### `templates.update`

Update template metadata.

```typescript
await updateTemplate({ id: templateId, name: "New Name" })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"templates">` | Yes | Template ID |
| `name` | `string` | No | New name |
| `description` | `string` | No | New description |

**Returns:** `Id<"templates">`

---

#### `templates.remove`

Delete a template.

```typescript
await removeTemplate({ id: templateId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"templates">` | Yes | Template to delete |

**Returns:** `void`

---

## projects

Group related sessions together.

### Queries

#### `projects.list`

List all projects with session counts.

```typescript
const projects = useQuery(api.projects.list)
```

**Returns:** `Array<Project & { sessionCount: number }>` ordered by creation time

---

#### `projects.get`

Get a project with its sessions and workflow.

```typescript
const project = useQuery(api.projects.get, { id: projectId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"projects">` | Yes | Project ID |

**Returns:**
```typescript
{
  ...Project,
  sessions: Session[],      // Sorted by step number
  workflow: Workflow | null,
}
```

---

### Mutations

#### `projects.create`

Create a new project.

```typescript
const projectId = await createProject({
  name: "My Project",
  description: "A game design project",
  workflowId,  // optional
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | `string` | Yes | Project name |
| `description` | `string` | No | Description |
| `workflowId` | `Id<"workflows">` | No | Link to workflow |

**Returns:** `Id<"projects">`

---

#### `projects.update`

Update project metadata.

```typescript
await updateProject({ id: projectId, name: "New Name" })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"projects">` | Yes | Project ID |
| `name` | `string` | No | New name |
| `description` | `string` | No | New description |
| `workflowId` | `Id<"workflows">` | No | Workflow link |
| `currentStep` | `number` | No | Current workflow step |

**Returns:** `Id<"projects">`

---

#### `projects.remove`

Delete a project (sessions become orphaned).

```typescript
await removeProject({ id: projectId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"projects">` | Yes | Project to delete |

**Returns:** `void`

---

#### `projects.createSession`

Create a new session within a project.

```typescript
const sessionId = await createSession({
  projectId,
  name: "Step 1",
  templateId,     // optional
  stepNumber: 0,  // optional
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `projectId` | `Id<"projects">` | Yes | Parent project |
| `name` | `string` | No | Session name |
| `templateId` | `Id<"templates">` | No | Apply template |
| `stepNumber` | `number` | No | Workflow step number |

**Returns:** `Id<"sessions">`

---

#### `projects.addSession`

Add an existing session to a project.

```typescript
await addSession({ projectId, sessionId, stepNumber: 1 })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `projectId` | `Id<"projects">` | Yes | Target project |
| `sessionId` | `Id<"sessions">` | Yes | Session to add |
| `stepNumber` | `number` | No | Workflow step number |

**Returns:** `Id<"sessions">`

---

#### `projects.removeSession`

Remove a session from a project (doesn't delete it).

```typescript
await removeSession({ sessionId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `sessionId` | `Id<"sessions">` | Yes | Session to remove |

**Returns:** `Id<"sessions">`

---

## workflows

Multi-step document creation pipelines.

### Queries

#### `workflows.list`

List all workflows.

```typescript
const workflows = useQuery(api.workflows.list)
```

**Returns:** `Workflow[]` ordered by creation time (newest first)

---

#### `workflows.get`

Get a workflow with enriched step data.

```typescript
const workflow = useQuery(api.workflows.get, { id: workflowId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"workflows">` | Yes | Workflow ID |

**Returns:**
```typescript
{
  ...Workflow,
  steps: Array<Step & { template: Template | null }>,
}
```

---

### Mutations

#### `workflows.create`

Create a new workflow.

```typescript
const workflowId = await createWorkflow({
  name: "Game Design",
  description: "Step-by-step game design process",
  steps: [{ name: "Step 1", templateId }],
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | `string` | Yes | Workflow name |
| `description` | `string` | No | Description |
| `steps` | `Step[]` | No | Initial steps |

**Returns:** `Id<"workflows">`

---

#### `workflows.update`

Update workflow metadata.

```typescript
await updateWorkflow({ id: workflowId, name: "New Name" })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"workflows">` | Yes | Workflow ID |
| `name` | `string` | No | New name |
| `description` | `string` | No | New description |

**Returns:** `Id<"workflows">`

---

#### `workflows.remove`

Delete a workflow.

```typescript
await removeWorkflow({ id: workflowId })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | `Id<"workflows">` | Yes | Workflow to delete |

**Returns:** `void`

---

#### `workflows.addStep`

Add a step to a workflow.

```typescript
await addStep({
  workflowId,
  name: "New Step",
  templateId,
  carryForwardZones: ["PERMANENT", "STABLE"],
  position: 1,  // optional, default end
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `workflowId` | `Id<"workflows">` | Yes | Parent workflow |
| `name` | `string` | Yes | Step name |
| `description` | `string` | No | Step description |
| `templateId` | `Id<"templates">` | No | Template to apply |
| `carryForwardZones` | `Zone[]` | No | Zones to carry forward |
| `position` | `number` | No | Insert position |

**Returns:** `number` (inserted position)

---

#### `workflows.updateStep`

Update a workflow step.

```typescript
await updateStep({
  workflowId,
  stepIndex: 0,
  name: "Updated Step",
  carryForwardZones: ["PERMANENT"],
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `workflowId` | `Id<"workflows">` | Yes | Parent workflow |
| `stepIndex` | `number` | Yes | Step index |
| `name` | `string` | No | New name |
| `description` | `string` | No | New description |
| `templateId` | `Id<"templates">` | No | Template to apply |
| `carryForwardZones` | `Zone[]` | No | Zones to carry forward |

**Returns:** `number` (step index)

---

#### `workflows.removeStep`

Remove a step from a workflow.

```typescript
await removeStep({ workflowId, stepIndex: 1 })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `workflowId` | `Id<"workflows">` | Yes | Parent workflow |
| `stepIndex` | `number` | Yes | Step to remove |

**Returns:** `void`

---

#### `workflows.reorderSteps`

Reorder steps in a workflow.

```typescript
await reorderSteps({ workflowId, fromIndex: 2, toIndex: 0 })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `workflowId` | `Id<"workflows">` | Yes | Parent workflow |
| `fromIndex` | `number` | Yes | Current position |
| `toIndex` | `number` | Yes | New position |

**Returns:** `void`

---

#### `workflows.startProject`

Start a new project from a workflow.

```typescript
const { projectId, sessionId } = await startProject({
  workflowId,
  projectName: "My Game",
  projectDescription: "A new game project",
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `workflowId` | `Id<"workflows">` | Yes | Workflow to use |
| `projectName` | `string` | Yes | Project name |
| `projectDescription` | `string` | No | Project description |

**Returns:** `{ projectId: Id<"projects">, sessionId: Id<"sessions"> }`

---

#### `workflows.advanceStep`

Advance to the next workflow step.

```typescript
const { sessionId, stepIndex } = await advanceStep({
  projectId,
  previousSessionId,
})
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `projectId` | `Id<"projects">` | Yes | Project ID |
| `previousSessionId` | `Id<"sessions">` | Yes | Current session |

**Returns:** `{ sessionId: Id<"sessions">, stepIndex: number }`

Creates a new session with:
- Blocks carried forward from specified zones
- Template blocks applied (if step has template)

---

#### `workflows.clone`

Clone an existing workflow.

```typescript
const newWorkflowId = await cloneWorkflow({ workflowId, name: "Copy" })
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `workflowId` | `Id<"workflows">` | Yes | Workflow to clone |
| `name` | `string` | Yes | New workflow name |

**Returns:** `Id<"workflows">`

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

```bash
npx convex run claudeNode:checkHealth
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
  "claude": { "ok": true, "version": "claude-3-sonnet" },
  "openrouter": { "ok": true, "model": "anthropic/claude-3-sonnet" }
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

#### `GET /api/health/openrouter`

OpenRouter API health check.

```bash
curl http://localhost:3211/api/health/openrouter
```

**Returns:** `{ ok: boolean, error?: string, model?: string }`

---

### OpenRouter Endpoints

#### `POST /api/openrouter/chat`

OpenRouter streaming chat (Server-Sent Events).

```bash
curl -X POST http://localhost:3211/api/openrouter/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "...", "prompt": "Hello"}'
```

**Body:** `{ sessionId: string, prompt: string, systemPrompt?: string }`

**Returns:** SSE stream (same format as `/api/chat`)

---

#### `POST /api/openrouter/brainstorm`

OpenRouter multi-turn brainstorm (Server-Sent Events).

```bash
curl -X POST http://localhost:3211/api/openrouter/brainstorm \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "...", "messages": [{"role": "user", "content": "Hello"}]}'
```

**Body:** `{ sessionId: string, messages: Message[], systemPrompt?: string }`

**Returns:** SSE stream with conversation response

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
  // Token tracking
  tokens?: number           // Current token count
  originalTokens?: number   // Original token count (before compression)
  tokenModel?: string       // Model used for counting (e.g., "cl100k_base")
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
  // Token budget configuration
  budgets?: {
    permanent: number   // Default: 50000
    stable: number      // Default: 100000
    working: number     // Default: 100000
    total: number       // Default: 500000
  }
  // System prompt for LLM interactions
  systemPrompt?: string
  // Project/workflow linkage
  projectId?: Id<"projects">
  templateId?: Id<"templates">
  stepNumber?: number
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
  // Usage tracking
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  costUsd?: number
  durationMs?: number
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
    // Token tracking (optional for backwards compatibility)
    tokens?: number
    originalTokens?: number
    tokenModel?: string
  }>
}
```

### Template

```typescript
interface Template {
  _id: Id<"templates">
  _creationTime: number
  name: string
  description?: string
  systemPrompt?: string
  blocks: Array<{
    content: string
    type: string
    zone: "PERMANENT" | "STABLE" | "WORKING"
    position: number
  }>
  // Workflow linkage
  workflowId?: Id<"workflows">
  stepOrder?: number
  createdAt: number
  updatedAt: number
}
```

### Project

```typescript
interface Project {
  _id: Id<"projects">
  _creationTime: number
  name: string
  description?: string
  workflowId?: Id<"workflows">
  currentStep?: number
  createdAt: number
  updatedAt: number
}
```

### Workflow

```typescript
interface Workflow {
  _id: Id<"workflows">
  _creationTime: number
  name: string
  description?: string
  steps: Array<{
    templateId?: Id<"templates">
    name: string
    description?: string
    carryForwardZones?: Zone[]  // Which zones to copy from previous step
  }>
  createdAt: number
  updatedAt: number
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
