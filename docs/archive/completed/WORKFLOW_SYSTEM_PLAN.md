# Workflow System Implementation Plan

> **✅ COMPLETED**
>
> This feature has been fully implemented. Phases 1-3 are complete.
> See [ROADMAP.md](../ROADMAP.md) for current status.

## Overview

Build a workflow system that enables structured document creation pipelines (IRD Documentation, Game Design, etc.) with reusable templates and project organization.

**Core Pattern:**
```
[Input Docs] + [Template/Guidelines] → Brainstorm → [Output Doc] → (input for next step)
```

---

## Data Model

### Templates
Snapshots of session state that can be reapplied.

```typescript
templates: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  systemPrompt: v.optional(v.string()),
  blocks: v.array(v.object({
    content: v.string(),
    type: v.string(),
    zone: v.union(v.literal("PERMANENT"), v.literal("STABLE"), v.literal("WORKING")),
    position: v.number(),
  })),
  workflowId: v.optional(v.id("workflows")),
  stepOrder: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

### Projects
Groups related sessions for one game/app/document set.

```typescript
projects: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  workflowId: v.optional(v.id("workflows")),
  currentStep: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

### Sessions (extend existing)
Add project linkage and template tracking.

```typescript
// Add to existing sessions table:
projectId: v.optional(v.id("projects")),
templateId: v.optional(v.id("templates")),
stepNumber: v.optional(v.number()),
systemPrompt: v.optional(v.string()),
```

### Workflows
Ordered sequence of templates for a complete process.

```typescript
workflows: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  steps: v.array(v.object({
    templateId: v.id("templates"),
    name: v.string(),
    description: v.optional(v.string()),
    carryForwardZones: v.optional(v.array(v.string())), // Which zones to pull from previous step
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

---

## Phase 1: Templates Foundation

### 1.1 Database Schema
- [ ] Add `templates` table to `convex/schema.ts`
- [ ] Add `systemPrompt` field to `sessions` table
- [ ] Create `convex/templates.ts` with CRUD operations
- [ ] Add indexes for efficient queries

### 1.2 Save Session as Template
- [ ] Backend: `templates.createFromSession` mutation
  - Takes sessionId, name, description
  - Snapshots all blocks with their zones
  - Captures system prompt from session
- [ ] Frontend: "Save as Template" button in session header
- [ ] Frontend: Save Template dialog (name, description input)

### 1.3 Apply Template
- [ ] Backend: `templates.applyToSession` mutation
  - Takes templateId, sessionId (or creates new session)
  - Clears existing blocks (or merges - configurable)
  - Copies template blocks into session
  - Sets system prompt
- [ ] Frontend: "Apply Template" button/menu
- [ ] Frontend: Template selection dialog

### 1.4 Template Library Page
- [ ] Create `/templates` route
- [ ] List all templates with name, description, block count
- [ ] Preview template contents (read-only)
- [ ] Delete template option
- [ ] Edit template metadata (name, description)

### 1.5 System Prompt Integration
- [ ] Add system prompt input to brainstorm dialog
- [ ] Store system prompt at session level
- [ ] Auto-populate from template when applied
- [ ] Display current system prompt in UI

---

## Phase 2: Projects

### 2.1 Database Schema
- [ ] Add `projects` table to `convex/schema.ts`
- [ ] Add `projectId` field to `sessions` table
- [ ] Create `convex/projects.ts` with CRUD operations
- [ ] Add indexes (by_project on sessions)

### 2.2 Project Management
- [ ] Backend: `projects.create`, `projects.list`, `projects.get`, `projects.update`, `projects.remove`
- [ ] Backend: `sessions.listByProject` query
- [ ] Frontend: Projects list page (`/projects`)
- [ ] Frontend: Create project dialog

### 2.3 Project Dashboard
- [ ] Create `/projects/:projectId` route
- [ ] Show project name, description, workflow (if any)
- [ ] List all sessions in project
- [ ] Show session status (active, completed)
- [ ] Quick actions: Open session, Create new session

### 2.4 Session-Project Linking
- [ ] Update session creation to optionally link to project
- [ ] Update session header to show project context
- [ ] Add "Move to Project" action for existing sessions
- [ ] Project selector in session creation dialog

---

## Phase 3: Workflows

### 3.1 Database Schema
- [ ] Add `workflows` table to `convex/schema.ts`
- [ ] Add `workflowId`, `stepOrder` fields to templates
- [ ] Add `workflowId`, `currentStep` fields to projects
- [ ] Create `convex/workflows.ts` with CRUD operations

### 3.2 Workflow Definition
- [ ] Backend: `workflows.create`, `workflows.list`, `workflows.get`, `workflows.update`
- [ ] Backend: `workflows.addStep`, `workflows.removeStep`, `workflows.reorderSteps`
- [ ] Frontend: Workflow editor page (`/workflows/:workflowId/edit`)
- [ ] Frontend: Add/remove/reorder steps UI
- [ ] Frontend: Link templates to workflow steps

### 3.3 Workflow Library
- [ ] Create `/workflows` route
- [ ] List all workflows with step count
- [ ] Preview workflow steps
- [ ] Create new workflow
- [ ] Clone existing workflow

### 3.4 Start Workflow
- [ ] Backend: `workflows.startProject` mutation
  - Creates new project linked to workflow
  - Creates first session from step 1 template
  - Sets project.currentStep = 1
- [ ] Frontend: "Start Workflow" button on workflow page
- [ ] Frontend: Project name input dialog

### 3.5 Workflow Progression
- [ ] Backend: `projects.advanceStep` mutation
  - Creates new session from next step's template
  - Optionally carries forward blocks from previous session
  - Updates project.currentStep
- [ ] Frontend: "Complete & Next Step" button in session
- [ ] Frontend: Workflow progress indicator in project dashboard
- [ ] Frontend: Step navigation (go back to previous steps)

### 3.6 Context Carry-Forward
- [ ] Configure which zones carry forward per step
- [ ] Backend: Copy blocks from previous session based on config
- [ ] Option to carry forward: all, by zone, by type, none
- [ ] UI to configure carry-forward in workflow editor

---

## Phase 4: Polish & UX

### 4.1 Navigation & Layout
- [ ] Update main navigation with Projects, Templates, Workflows
- [ ] Breadcrumb navigation (Workflow > Project > Session)
- [ ] Quick switcher (Cmd+K) for projects/sessions/templates

### 4.2 Workflow Progress UI
- [ ] Visual step indicator (1 → 2 → 3 → ...)
- [ ] Current step highlight
- [ ] Completed vs pending steps
- [ ] Click step to navigate to session

### 4.3 Template Management
- [ ] Template categories/tags
- [ ] Search/filter templates
- [ ] Template usage stats (how many projects use it)
- [ ] Duplicate template

### 4.4 Project Management
- [ ] Project status (in-progress, completed, archived)
- [ ] Project search/filter
- [ ] Export project (all sessions as markdown/JSON)
- [ ] Project duplication

### 4.5 Onboarding
- [ ] Pre-built workflows (IRD, Game Design)
- [ ] Sample templates for each workflow
- [ ] Getting started guide
- [ ] Interactive tutorial

---

## Seed Data (Built-in Workflows)

### IRD Documentation Workflow
1. **IRD Creation** - Input: project brief → Output: IRD document
2. **Personas** - Input: IRD → Output: Persona documents
3. **Scenarios** - Input: IRD + Personas → Output: Scenario documents
4. **User Stories** - Input: Scenarios → Output: User stories

### Game Design Workflow (customizable)
1. **Step 1** - Input: relevant chapters + supplements → Output: Step 1 doc
2. **Step 2** - Input: Step 1 + more chapters → Output: Step 2 doc
3. ... (user-defined steps)

---

## Implementation Order

```
Phase 1.1 → 1.2 → 1.3 → 1.4 → 1.5  (Templates - MVP)
    ↓
Phase 2.1 → 2.2 → 2.3 → 2.4  (Projects)
    ↓
Phase 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6  (Workflows)
    ↓
Phase 4.x  (Polish - can be done incrementally)
```

---

## Progress Tracking

### Phase 1: Templates Foundation ✅ COMPLETE
- [x] 1.1 Database Schema
- [x] 1.2 Save Session as Template
- [x] 1.3 Apply Template
- [x] 1.4 Template Library Page
- [x] 1.5 System Prompt Integration (now uses system_prompt blocks)

### Phase 2: Projects ✅ COMPLETE
- [x] 2.1 Database Schema (added in Phase 1)
- [x] 2.2 Project Management (CRUD operations)
- [x] 2.3 Project Dashboard (`/projects/$projectId`)
- [x] 2.4 Session-Project Linking

### Phase 3: Workflows ✅ COMPLETE
- [x] 3.1 Database Schema (added in Phase 1)
- [x] 3.2 Workflow Definition (add/edit/remove/reorder steps)
- [x] 3.3 Workflow Library (`/workflows`)
- [x] 3.4 Start Workflow (creates project with first session)
- [x] 3.5 Workflow Progression (advance step, copy blocks)
- [x] 3.6 Context Carry-Forward (zone-based block copying)

### Phase 4: Polish (Partially Complete)
- [x] 4.1 Navigation & Layout (nav links in header)
- [x] 4.2 Workflow Progress UI (step indicator in project dashboard)
- [ ] 4.3 Template Management (categories, search, stats)
- [ ] 4.4 Project Management (status, search, export)
- [ ] 4.5 Onboarding (pre-built workflows, tutorial)

### Bug Fixes Applied
- [x] Fixed TanStack Router nested routes (added `<Outlet />` to layout routes)
- [x] System prompt now uses blocks instead of session field

---

## Open Questions

1. **Template versioning**: Should we track template versions? What happens if template changes after project started?
2. **Concurrent editing**: What if same project is edited from multiple tabs?
3. **Permissions**: Future consideration - shared projects, read-only templates?
4. **Import/Export**: Should templates/workflows be exportable for sharing?
