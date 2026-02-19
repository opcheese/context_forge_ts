# Marketplace — Community Template & Workflow Library

## Problem

New users arrive at ContextForge with an empty account. There's no way to discover what other users have built or share your own configurations. Users need a library of prebuilt templates and workflows to get started, and a way to publish their own for the community.

## Solution

A community marketplace where users publish templates and workflows as snapshots. Other users browse, search, and import them into their own accounts. Categories are admin-managed for quality control.

---

## Data Model

### `marketplace` table

```typescript
marketplace: defineTable({
  authorId: v.id("users"),
  authorName: v.string(),             // denormalized for display
  type: v.union(v.literal("template"), v.literal("workflow")),
  name: v.string(),
  description: v.string(),
  category: v.string(),               // references marketplaceCategories.slug

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

  // Stats
  importCount: v.number(),

  // Search
  searchText: v.string(),             // name + " " + description + " " + category

  // Timestamps
  publishedAt: v.number(),
  updatedAt: v.number(),
})
  .searchIndex("search_marketplace", {
    searchField: "searchText",
    filterFields: ["type", "category"],
  })
  .index("by_author", ["authorId"])
  .index("by_category", ["category", "importCount"])
```

### `marketplaceCategories` table

```typescript
marketplaceCategories: defineTable({
  slug: v.string(),                   // "game-design"
  label: v.string(),                  // "Game Design"
  position: v.number(),               // display order
})
  .index("by_slug", ["slug"])
  .index("by_position", ["position"])
```

Seed categories: writing, coding, research, business, education, game-design, project-management, other.

### Linkage on existing tables

Add to `templates` and `workflows`:

```typescript
publishedMarketplaceId: v.optional(v.id("marketplace"))
```

Add to imported templates and workflows:

```typescript
sourceMarketplaceId: v.optional(v.id("marketplace"))
```

---

## Publishing Flow

### User perspective

1. User has a template or workflow they want to share
2. On the template/workflow card, they click **"Publish"**
3. A dialog opens with:
   - Name (pre-filled, editable)
   - Description (pre-filled, editable)
   - Category (dropdown from `marketplaceCategories`)
4. User clicks "Publish"
5. If they have previously published this item (checked via `publishedMarketplaceId`), dialog asks: **"Update existing publication or publish as new?"**

### Backend

**Publish mutation:**
1. Verify user owns the template/workflow
2. Snapshot all content:
   - For templates: copy blocks array
   - For workflows: copy steps array + snapshot all linked template blocks into `workflowTemplates`
3. Build `searchText` = `name + " " + description + " " + categoryLabel`
4. Insert into `marketplace` table with `importCount: 0`
5. Set `publishedMarketplaceId` on the source template/workflow

**Update mutation:**
1. Verify user is the author of the marketplace record
2. Replace content snapshot, name, description, category
3. Rebuild `searchText`
4. Bump `updatedAt`

**Unpublish mutation:**
1. Verify user is the author
2. Delete marketplace record
3. Clear `publishedMarketplaceId` on source template/workflow
4. Users who already imported keep their copies (no cascading delete)

---

## Consuming Flow

### Browsing

**Route:** `/app/marketplace` (in main nav)

**Layout:**
- Search bar at top (full-text search via Convex search index)
- Category chips below search (loaded from `marketplaceCategories`, ordered by position)
- Optional type filter: All / Templates / Workflows
- Results grid: cards sorted by relevance (when searching) or import count (when browsing)

### Marketplace card

```
┌──────────────────────────────────────────┐
│ [Template] badge    [Game Design] chip   │
│                                          │
│ IRD Documentation Starter                │
│ A complete setup for writing initial     │
│ requirements documents with structured...│
│                                          │
│ by AuthorName  ·  12 imports  ·  3 steps │
│                                      [Import] │
└──────────────────────────────────────────┘
```

### Import flow

1. User clicks "Import" on a card
2. **For templates:**
   - Create new template in user's account
   - Copy name, description, blocks from marketplace snapshot
   - Set `sourceMarketplaceId` on the new template
3. **For workflows:**
   - Create new workflow with steps
   - Create templates for each step with blocks from `workflowTemplates`
   - Link templates to workflow steps
   - Set `sourceMarketplaceId` on the new workflow
4. Increment `importCount` on marketplace record
5. Navigate to Templates or Workflows page
6. Show toast: "Imported '{name}'"

---

## Author Experience

No separate "My Publications" section. Instead, existing template/workflow cards show publishing state inline:

- **Unpublished**: normal card with "Publish" action in hover menu
- **Published**: card shows a small "Published" badge. Hover menu shows "Update Publication" and "Unpublish" actions
- Editing the local template/workflow does NOT auto-update the publication. User must explicitly click "Update Publication" to push a new snapshot.

---

## Search Implementation

Convex search index on `searchText` field with `type` and `category` as filter fields.

```typescript
// Browse by category
const results = await ctx.db
  .query("marketplace")
  .withSearchIndex("search_marketplace", (q) =>
    q.search("searchText", searchTerm).eq("category", category)
  )
  .take(20)

// Browse all (empty search returns by relevance/recency)
// For "browse all", query by index by_category for import count ordering
```

**Language support:** SimpleTokenizer splits on whitespace and punctuation. Works for English and Russian (Cyrillic uses spaces). No stemming, but prefix matching on last term helps. CJK not supported but not in target audience.

Research notes: `docs/research/convex-full-text-search.md`

---

## UI Components

All standard components following existing design system. No /frontend-design needed.

- `MarketplacePage` — route component with search, filters, grid
- `MarketplaceCard` — display card for marketplace items
- `PublishDialog` — publish/update dialog (name, description, category)
- `MarketplaceCategoryChips` — filter chips loaded from DB
- Updated template/workflow cards — "Published" badge, publish/unpublish actions

---

## Implementation Phases

### Phase 1: Schema & Backend
- `marketplace` and `marketplaceCategories` tables in schema
- `publishedMarketplaceId` and `sourceMarketplaceId` fields on templates/workflows
- Publish, update, unpublish mutations
- Import mutation (template + workflow)
- Search/list/browse queries
- Seed categories

### Phase 2: Marketplace UI
- `/app/marketplace` route
- Search bar + category chips
- Marketplace cards with import button
- Import flow with navigation + toast
- Nav link in header

### Phase 3: Publishing UI
- Publish dialog on template/workflow cards
- "Update or new" dialog on re-publish
- "Published" badge on source cards
- "Update Publication" and "Unpublish" hover actions

### Phase 4: Seed Content
- Publish 10-20 starter templates/workflows
- Categories: game-design, project-management, writing, coding, research

---

## What's NOT included (future)

- Ratings / reviews
- Version history
- Detail page with full content preview
- Automatic update notifications for imported items
- User profiles / author pages
- Reporting / moderation
- Private sharing (share with specific users)
