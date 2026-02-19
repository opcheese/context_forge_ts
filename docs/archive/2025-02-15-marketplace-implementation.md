# Marketplace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a community marketplace where users publish templates/workflows as snapshots and others browse, search, and import them.

**Architecture:** Two new Convex tables (`marketplace`, `marketplaceCategories`) with full-text search. New `convex/marketplace.ts` for all mutations/queries. New `/app/marketplace` route. Publishing UI integrated into existing template/workflow cards.

**Tech Stack:** Convex (DB, search, mutations/queries), React + TanStack Router, shadcn/ui components.

**Design doc:** `docs/plans/2025-02-15-marketplace-design.md`

---

### Task 1: Schema — Add marketplace tables and linkage fields

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/lib/validators.ts`

**Step 1: Add marketplace type validator to validators.ts**

After the existing `zoneValidator` export, add:

```typescript
export const marketplaceTypeValidator = v.union(
  v.literal("template"),
  v.literal("workflow")
)
export type MarketplaceType = "template" | "workflow"
```

**Step 2: Add marketplace and marketplaceCategories tables to schema.ts**

Import `marketplaceTypeValidator` from validators. Add after the `snapshots` table definition:

```typescript
// Marketplace - community template/workflow library
marketplace: defineTable({
  authorId: v.id("users"),
  authorName: v.string(),
  type: marketplaceTypeValidator,
  name: v.string(),
  description: v.string(),
  category: v.string(),

  // Content snapshot (copied on publish, self-contained)
  templateBlocks: v.optional(v.array(v.object({
    content: v.string(),
    type: v.string(),
    zone: zoneValidator,
    position: v.number(),
    metadata: v.optional(skillMetadataValidator),
  }))),
  workflowSteps: v.optional(v.array(v.object({
    name: v.string(),
    description: v.optional(v.string()),
    carryForwardZones: v.optional(v.array(v.union(
      v.literal("PERMANENT"), v.literal("STABLE"), v.literal("WORKING")
    ))),
  }))),
  workflowTemplates: v.optional(v.array(v.object({
    stepIndex: v.number(),
    blocks: v.array(v.object({
      content: v.string(),
      type: v.string(),
      zone: zoneValidator,
      position: v.number(),
      metadata: v.optional(skillMetadataValidator),
    })),
  }))),

  importCount: v.number(),
  searchText: v.string(),
  publishedAt: v.number(),
  updatedAt: v.number(),
})
  .searchIndex("search_marketplace", {
    searchField: "searchText",
    filterFields: ["type", "category"],
  })
  .index("by_author", ["authorId"])
  .index("by_category", ["category", "importCount"]),

// Marketplace categories - admin-managed
marketplaceCategories: defineTable({
  slug: v.string(),
  label: v.string(),
  position: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_position", ["position"]),
```

**Step 3: Add linkage fields to existing tables**

Add to `templates` table (after `updatedAt`):
```typescript
publishedMarketplaceId: v.optional(v.id("marketplace")),
sourceMarketplaceId: v.optional(v.id("marketplace")),
```

Add to `workflows` table (after `updatedAt`):
```typescript
publishedMarketplaceId: v.optional(v.id("marketplace")),
sourceMarketplaceId: v.optional(v.id("marketplace")),
```

**Step 4: Verify**

Run: `cd /home/newub/w/ContextLibrary/ContextForgeTS && npx convex dev --once`
Expected: Schema push succeeds with new tables.

**Step 5: Commit**

```bash
git add convex/schema.ts convex/lib/validators.ts
git commit -m "feat(marketplace): add marketplace schema and linkage fields"
```

---

### Task 2: Seed categories mutation

**Files:**
- Create: `convex/marketplace.ts`

**Step 1: Create convex/marketplace.ts with seed mutation and categories query**

```typescript
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { requireAuth, getOptionalUserId, canAccessTemplate, canAccessWorkflow } from "./lib/auth"
import { zoneValidator, marketplaceTypeValidator } from "./lib/validators"

const SEED_CATEGORIES = [
  { slug: "game-design", label: "Game Design", position: 0 },
  { slug: "project-management", label: "Project Management", position: 1 },
  { slug: "writing", label: "Writing", position: 2 },
  { slug: "coding", label: "Coding", position: 3 },
  { slug: "research", label: "Research", position: 4 },
  { slug: "business", label: "Business", position: 5 },
  { slug: "education", label: "Education", position: 6 },
  { slug: "other", label: "Other", position: 7 },
]

// Seed categories (idempotent — skips if already seeded)
export const seedCategories = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("marketplaceCategories")
      .first()
    if (existing) return { seeded: false, message: "Categories already exist" }

    for (const cat of SEED_CATEGORIES) {
      await ctx.db.insert("marketplaceCategories", cat)
    }
    return { seeded: true, message: `Seeded ${SEED_CATEGORIES.length} categories` }
  },
})

// List categories ordered by position
export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("marketplaceCategories")
      .withIndex("by_position")
      .collect()
  },
})
```

**Step 2: Verify**

Run: `cd /home/newub/w/ContextLibrary/ContextForgeTS && npx convex dev --once`
Expected: No errors.

**Step 3: Commit**

```bash
git add convex/marketplace.ts
git commit -m "feat(marketplace): add seed categories mutation and list query"
```

---

### Task 3: Publish template mutation

**Files:**
- Modify: `convex/marketplace.ts`

**Step 1: Add the publish mutation**

Append to `convex/marketplace.ts`:

```typescript
// Shared block snapshot validator (reused across mutations)
const blockSnapshotValidator = v.object({
  content: v.string(),
  type: v.string(),
  zone: zoneValidator,
  position: v.number(),
  metadata: v.optional(v.object({
    skillName: v.string(),
    skillDescription: v.optional(v.string()),
    sourceType: v.union(v.literal("local"), v.literal("upload"), v.literal("url")),
    sourceRef: v.optional(v.string()),
    parentSkillName: v.optional(v.string()),
  })),
})

// Publish a template to the marketplace
export const publishTemplate = mutation({
  args: {
    templateId: v.id("templates"),
    name: v.string(),
    description: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const hasAccess = await canAccessTemplate(ctx, args.templateId)
    if (!hasAccess) throw new Error("Template not found or access denied")

    const template = await ctx.db.get(args.templateId)
    if (!template) throw new Error("Template not found")

    // Verify category exists
    const category = await ctx.db
      .query("marketplaceCategories")
      .withIndex("by_slug", (q) => q.eq("slug", args.category))
      .unique()
    if (!category) throw new Error("Invalid category")

    // Get author name from user record
    const user = await ctx.db.get(userId)
    const authorName = user?.email?.split("@")[0] ?? "Anonymous"

    // Snapshot blocks (filter out draft blocks)
    const templateBlocks = template.blocks
      .filter((b: { type: string }) => b.type !== "system_prompt" || true) // keep all
      .map((b) => ({
        content: b.content,
        type: b.type,
        zone: b.zone,
        position: b.position,
        metadata: b.metadata,
      }))

    const now = Date.now()
    const searchText = `${args.name} ${args.description} ${category.label}`

    const marketplaceId = await ctx.db.insert("marketplace", {
      authorId: userId,
      authorName,
      type: "template",
      name: args.name,
      description: args.description,
      category: args.category,
      templateBlocks,
      importCount: 0,
      searchText,
      publishedAt: now,
      updatedAt: now,
    })

    // Link source template to marketplace record
    await ctx.db.patch(args.templateId, {
      publishedMarketplaceId: marketplaceId,
      updatedAt: now,
    })

    return marketplaceId
  },
})
```

**Step 2: Verify**

Run: `cd /home/newub/w/ContextLibrary/ContextForgeTS && npx convex dev --once`
Expected: No errors.

**Step 3: Commit**

```bash
git add convex/marketplace.ts
git commit -m "feat(marketplace): add publishTemplate mutation"
```

---

### Task 4: Publish workflow mutation

**Files:**
- Modify: `convex/marketplace.ts`

**Step 1: Add publishWorkflow mutation**

Append to `convex/marketplace.ts`:

```typescript
// Publish a workflow to the marketplace
export const publishWorkflow = mutation({
  args: {
    workflowId: v.id("workflows"),
    name: v.string(),
    description: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const hasAccess = await canAccessWorkflow(ctx, args.workflowId)
    if (!hasAccess) throw new Error("Workflow not found or access denied")

    const workflow = await ctx.db.get(args.workflowId)
    if (!workflow) throw new Error("Workflow not found")

    // Verify category
    const category = await ctx.db
      .query("marketplaceCategories")
      .withIndex("by_slug", (q) => q.eq("slug", args.category))
      .unique()
    if (!category) throw new Error("Invalid category")

    const user = await ctx.db.get(userId)
    const authorName = user?.email?.split("@")[0] ?? "Anonymous"

    // Snapshot steps (without templateId references — self-contained)
    const workflowSteps = workflow.steps.map((s) => ({
      name: s.name,
      description: s.description,
      carryForwardZones: s.carryForwardZones,
    }))

    // Snapshot all linked templates' blocks
    const workflowTemplates: Array<{
      stepIndex: number
      blocks: Array<{
        content: string
        type: string
        zone: "PERMANENT" | "STABLE" | "WORKING"
        position: number
        metadata?: {
          skillName: string
          skillDescription?: string
          sourceType: "local" | "upload" | "url"
          sourceRef?: string
          parentSkillName?: string
        }
      }>
    }> = []

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i]
      if (step.templateId) {
        const template = await ctx.db.get(step.templateId)
        if (template) {
          workflowTemplates.push({
            stepIndex: i,
            blocks: template.blocks.map((b) => ({
              content: b.content,
              type: b.type,
              zone: b.zone,
              position: b.position,
              metadata: b.metadata,
            })),
          })
        }
      }
    }

    const now = Date.now()
    const searchText = `${args.name} ${args.description} ${category.label}`

    const marketplaceId = await ctx.db.insert("marketplace", {
      authorId: userId,
      authorName,
      type: "workflow",
      name: args.name,
      description: args.description,
      category: args.category,
      workflowSteps,
      workflowTemplates,
      importCount: 0,
      searchText,
      publishedAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(args.workflowId, {
      publishedMarketplaceId: marketplaceId,
      updatedAt: now,
    })

    return marketplaceId
  },
})
```

**Step 2: Verify**

Run: `cd /home/newub/w/ContextLibrary/ContextForgeTS && npx convex dev --once`

**Step 3: Commit**

```bash
git add convex/marketplace.ts
git commit -m "feat(marketplace): add publishWorkflow mutation"
```

---

### Task 5: Update, unpublish, and browse queries

**Files:**
- Modify: `convex/marketplace.ts`

**Step 1: Add update mutation**

```typescript
// Update an existing marketplace publication
export const update = mutation({
  args: {
    id: v.id("marketplace"),
    name: v.string(),
    description: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const record = await ctx.db.get(args.id)
    if (!record) throw new Error("Marketplace item not found")
    if (record.authorId !== userId) throw new Error("Not the author")

    const category = await ctx.db
      .query("marketplaceCategories")
      .withIndex("by_slug", (q) => q.eq("slug", args.category))
      .unique()
    if (!category) throw new Error("Invalid category")

    // Re-snapshot content from the source template/workflow
    const updates: Record<string, unknown> = {
      name: args.name,
      description: args.description,
      category: args.category,
      searchText: `${args.name} ${args.description} ${category.label}`,
      updatedAt: Date.now(),
    }

    if (record.type === "template") {
      // Find source template by publishedMarketplaceId
      const templates = await ctx.db.query("templates").withIndex("by_user").collect()
      const source = templates.find((t) => t.publishedMarketplaceId === args.id)
      if (source) {
        updates.templateBlocks = source.blocks.map((b) => ({
          content: b.content,
          type: b.type,
          zone: b.zone,
          position: b.position,
          metadata: b.metadata,
        }))
      }
    } else {
      const workflows = await ctx.db.query("workflows").withIndex("by_user").collect()
      const source = workflows.find((w) => w.publishedMarketplaceId === args.id)
      if (source) {
        updates.workflowSteps = source.steps.map((s) => ({
          name: s.name,
          description: s.description,
          carryForwardZones: s.carryForwardZones,
        }))

        const workflowTemplates = []
        for (let i = 0; i < source.steps.length; i++) {
          const step = source.steps[i]
          if (step.templateId) {
            const template = await ctx.db.get(step.templateId)
            if (template) {
              workflowTemplates.push({
                stepIndex: i,
                blocks: template.blocks.map((b) => ({
                  content: b.content,
                  type: b.type,
                  zone: b.zone,
                  position: b.position,
                  metadata: b.metadata,
                })),
              })
            }
          }
        }
        updates.workflowTemplates = workflowTemplates
      }
    }

    await ctx.db.patch(args.id, updates)
    return args.id
  },
})
```

**Step 2: Add unpublish mutation**

```typescript
// Unpublish (remove from marketplace)
export const unpublish = mutation({
  args: { id: v.id("marketplace") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const record = await ctx.db.get(args.id)
    if (!record) throw new Error("Marketplace item not found")
    if (record.authorId !== userId) throw new Error("Not the author")

    // Clear publishedMarketplaceId on source
    if (record.type === "template") {
      const templates = await ctx.db.query("templates").withIndex("by_user").collect()
      const source = templates.find((t) => t.publishedMarketplaceId === args.id)
      if (source) {
        await ctx.db.patch(source._id, {
          publishedMarketplaceId: undefined,
          updatedAt: Date.now(),
        })
      }
    } else {
      const workflows = await ctx.db.query("workflows").withIndex("by_user").collect()
      const source = workflows.find((w) => w.publishedMarketplaceId === args.id)
      if (source) {
        await ctx.db.patch(source._id, {
          publishedMarketplaceId: undefined,
          updatedAt: Date.now(),
        })
      }
    }

    await ctx.db.delete(args.id)
  },
})
```

**Step 3: Add browse/search query**

```typescript
// Search marketplace items
export const search = query({
  args: {
    searchTerm: v.optional(v.string()),
    category: v.optional(v.string()),
    type: v.optional(marketplaceTypeValidator),
  },
  handler: async (ctx, args) => {
    // When searching with a term, use search index
    if (args.searchTerm && args.searchTerm.trim()) {
      let searchQuery = ctx.db
        .query("marketplace")
        .withSearchIndex("search_marketplace", (q) => {
          let sq = q.search("searchText", args.searchTerm!)
          if (args.category) sq = sq.eq("category", args.category)
          if (args.type) sq = sq.eq("type", args.type)
          return sq
        })

      return await searchQuery.take(20)
    }

    // When browsing (no search term), use regular index sorted by import count
    if (args.category) {
      const results = await ctx.db
        .query("marketplace")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .order("desc")
        .take(50)

      // Post-filter by type if needed
      if (args.type) {
        return results.filter((r) => r.type === args.type)
      }
      return results
    }

    // Browse all — get recent/popular
    const results = await ctx.db
      .query("marketplace")
      .order("desc")
      .take(50)

    if (args.type) {
      return results.filter((r) => r.type === args.type)
    }
    return results
  },
})

// Get a single marketplace item
export const get = query({
  args: { id: v.id("marketplace") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// List user's own publications
export const listByAuthor = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx)
    if (!userId) return []

    return await ctx.db
      .query("marketplace")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .order("desc")
      .collect()
  },
})
```

**Step 4: Verify**

Run: `cd /home/newub/w/ContextLibrary/ContextForgeTS && npx convex dev --once`

**Step 5: Commit**

```bash
git add convex/marketplace.ts
git commit -m "feat(marketplace): add update, unpublish, search, and browse queries"
```

---

### Task 6: Import mutations (template + workflow)

**Files:**
- Modify: `convex/marketplace.ts`

**Step 1: Add importTemplate mutation**

```typescript
// Import a template from the marketplace into user's account
export const importTemplate = mutation({
  args: { id: v.id("marketplace") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const record = await ctx.db.get(args.id)
    if (!record) throw new Error("Marketplace item not found")
    if (record.type !== "template") throw new Error("Not a template")
    if (!record.templateBlocks) throw new Error("No template content")

    const now = Date.now()

    // Create new template in user's account
    const templateId = await ctx.db.insert("templates", {
      userId,
      name: record.name,
      description: record.description,
      blocks: record.templateBlocks,
      sourceMarketplaceId: args.id,
      createdAt: now,
      updatedAt: now,
    })

    // Increment import count
    await ctx.db.patch(args.id, {
      importCount: record.importCount + 1,
    })

    return { templateId }
  },
})
```

**Step 2: Add importWorkflow mutation**

```typescript
// Import a workflow from the marketplace into user's account
export const importWorkflow = mutation({
  args: { id: v.id("marketplace") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const record = await ctx.db.get(args.id)
    if (!record) throw new Error("Marketplace item not found")
    if (record.type !== "workflow") throw new Error("Not a workflow")
    if (!record.workflowSteps) throw new Error("No workflow content")

    const now = Date.now()

    // Create templates for each step that has blocks
    const stepTemplateMap = new Map<number, typeof import("./schema").default["tables"]["templates"]["document"]["_id"]>()

    if (record.workflowTemplates) {
      for (const wt of record.workflowTemplates) {
        const stepName = record.workflowSteps[wt.stepIndex]?.name ?? `Step ${wt.stepIndex + 1}`
        const templateId = await ctx.db.insert("templates", {
          userId,
          name: `${record.name} - ${stepName}`,
          blocks: wt.blocks,
          createdAt: now,
          updatedAt: now,
        })
        stepTemplateMap.set(wt.stepIndex, templateId)
      }
    }

    // Create workflow with step references
    const workflowId = await ctx.db.insert("workflows", {
      userId,
      name: record.name,
      description: record.description,
      steps: record.workflowSteps.map((step, i) => ({
        name: step.name,
        description: step.description,
        carryForwardZones: step.carryForwardZones,
        templateId: stepTemplateMap.get(i),
      })),
      sourceMarketplaceId: args.id,
      createdAt: now,
      updatedAt: now,
    })

    // Link templates to workflow
    for (const [, templateId] of stepTemplateMap) {
      await ctx.db.patch(templateId, {
        workflowId,
      })
    }

    // Increment import count
    await ctx.db.patch(args.id, {
      importCount: record.importCount + 1,
    })

    return { workflowId }
  },
})
```

**Step 3: Verify**

Run: `cd /home/newub/w/ContextLibrary/ContextForgeTS && npx convex dev --once`

**Step 4: Commit**

```bash
git add convex/marketplace.ts
git commit -m "feat(marketplace): add import mutations for templates and workflows"
```

---

### Task 7: Marketplace browse page — route + search + category chips

**Files:**
- Create: `src/routes/app/marketplace.tsx`
- Modify: `src/routes/app.tsx` (add nav link)

**Step 1: Create marketplace route**

Create `src/routes/app/marketplace.tsx` with:
- Search bar (controlled input, debounced 300ms)
- Category chips from `api.marketplace.listCategories` (plus "All" chip)
- Type filter: All / Templates / Workflows (3 chips)
- Results grid from `api.marketplace.search`
- MarketplaceCard component inline
- Import button with loading state
- Uses existing shadcn components: Button, Input, Badge

Key structure:

```tsx
import { useState, useMemo } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Doc } from "../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Download, Package, Workflow as WorkflowIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

function MarketplacePage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [selectedType, setSelectedType] = useState<"template" | "workflow" | undefined>()

  const categories = useQuery(api.marketplace.listCategories)
  const results = useQuery(api.marketplace.search, {
    searchTerm: debouncedSearch || undefined,
    category: selectedCategory,
    type: selectedType,
  })

  // debounce search input
  // ... (standard useEffect debounce)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse and import community templates and workflows
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input ... />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        <button "All" chip ... />
        {categories?.map((cat) => <button key={cat._id} ... />)}
      </div>

      {/* Type filter */}
      <div className="flex gap-2">
        <button "All" / "Templates" / "Workflows" ... />
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results?.map((item) => <MarketplaceCard key={item._id} item={item} />)}
      </div>
    </div>
  )
}

function MarketplaceCard({ item }: { item: Doc<"marketplace"> }) {
  const importTemplate = useMutation(api.marketplace.importTemplate)
  const importWorkflow = useMutation(api.marketplace.importWorkflow)
  const navigate = useNavigate()
  const [importing, setImporting] = useState(false)

  const handleImport = async () => {
    setImporting(true)
    try {
      if (item.type === "template") {
        await importTemplate({ id: item._id })
        navigate({ to: "/app/templates" })
      } else {
        await importWorkflow({ id: item._id })
        navigate({ to: "/app/workflows" })
      }
      // toast: "Imported '{name}'"
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-3 hover:shadow-sm transition-all">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
          {item.type === "template" ? "Template" : "Workflow"}
        </span>
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50">
          {/* category label */}
        </span>
      </div>
      <div>
        <h3 className="font-semibold">{item.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>by {item.authorName} · {item.importCount} imports</span>
        <Button size="sm" onClick={handleImport} disabled={importing}>
          {importing ? "Importing..." : "Import"}
        </Button>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/app/marketplace")({
  component: MarketplacePage,
})
```

**Step 2: Add Marketplace to nav in app.tsx**

In the `<nav>` section of the `Header` component in `src/routes/app.tsx`, add after the Workflows NavLink:

```tsx
<NavLink to="/app/marketplace">Marketplace</NavLink>
```

**Step 3: Verify**

Run: `cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm tsc --noEmit`
Expected: No type errors.

**Step 4: Commit**

```bash
git add src/routes/app/marketplace.tsx src/routes/app.tsx
git commit -m "feat(marketplace): add marketplace browse page with search and filters"
```

---

### Task 8: Publish dialog on template/workflow cards

**Files:**
- Create: `src/components/marketplace/PublishDialog.tsx`
- Modify: `src/routes/app/templates.tsx`
- Modify: `src/routes/app/workflows.index.tsx`

**Step 1: Create PublishDialog component**

A dialog with:
- Name input (pre-filled from template/workflow name)
- Description textarea (pre-filled)
- Category dropdown (from `listCategories`)
- If item has `publishedMarketplaceId`: show "Update existing or publish as new?" radio
- Submit calls `publishTemplate`/`publishWorkflow` or `marketplace.update`

```tsx
import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface PublishDialogProps {
  isOpen: boolean
  onClose: () => void
  type: "template" | "workflow"
  sourceId: Id<"templates"> | Id<"workflows">
  sourceName: string
  sourceDescription?: string
  publishedMarketplaceId?: Id<"marketplace">
  onSuccess?: () => void
}

export function PublishDialog({ ... }: PublishDialogProps) {
  // name, description, category state
  // publishMode: "update" | "new" (only shown if publishedMarketplaceId exists)
  // calls appropriate mutation
  // shows category dropdown from listCategories query
}
```

**Step 2: Add Publish action to template cards**

In `src/routes/app/templates.tsx`, on each template card's actions area:
- If template has `publishedMarketplaceId`: show "Published" badge + "Update Publication" / "Unpublish" buttons
- If not published: show "Publish" button
- Wire up PublishDialog

**Step 3: Add Publish action to workflow cards**

Same pattern in `src/routes/app/workflows.index.tsx`.

**Step 4: Verify**

Run: `cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm tsc --noEmit`

**Step 5: Commit**

```bash
git add src/components/marketplace/PublishDialog.tsx src/routes/app/templates.tsx src/routes/app/workflows.index.tsx
git commit -m "feat(marketplace): add publish dialog and publishing UI to template/workflow cards"
```

---

### Task 9: Seed categories in dev environment

**Step 1: Run seed mutation**

After `convex dev` is running, execute the seed via Convex dashboard or CLI:

Run: `cd /home/newub/w/ContextLibrary/ContextForgeTS && npx convex run marketplace:seedCategories`

Expected: `{ seeded: true, message: "Seeded 8 categories" }`

**Step 2: Verify categories load on marketplace page**

Open `/app/marketplace` in browser. Category chips should appear.

---

### Task 10: End-to-end verification

**Step 1: Verify type checking**

Run: `cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm tsc --noEmit`
Expected: No errors.

**Step 2: Run existing tests**

Run: `cd /home/newub/w/ContextLibrary/ContextForgeTS && pnpm vitest run`
Expected: All existing tests pass (new code is additive, no changes to tested functions).

**Step 3: Manual test checklist**

1. Navigate to `/app/marketplace` — page loads, shows search bar and category chips
2. Create a template with some blocks → Publish it → appears in marketplace
3. Search for it by name → found
4. Filter by category → works
5. Import it (from another account or same) → template appears in Templates page
6. Create a workflow with 2 steps → Publish → appears in marketplace as Workflow type
7. Import the workflow → workflow + templates created
8. Update publication → content refreshes
9. Unpublish → removed from marketplace, source template still exists

**Step 4: Commit final state**

```bash
git add -A
git commit -m "feat(marketplace): complete marketplace implementation (phases 1-3)"
```
