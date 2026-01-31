# TASK-001: Public Templates and Workflows

## Overview

Enable users to share templates and workflows publicly, and allow other users to discover and fork them.

## Requirements

### Core Behavior
- Users can mark their templates/workflows as "public"
- Public content is visible to all users (including unauthenticated)
- When a user wants to use public content, they **fork** it (create a copy in their account)
- Original author can update and the public version reflects changes immediately
- No simultaneous editing concerns (everyone works on their own fork)

### Discovery
- Browse public templates/workflows
- Search by name
- Filter by tags
- Show original author attribution

### Out of Scope (for now)
- Content moderation
- Ratings/reviews
- Version history
- Sessions (only templates and workflows)

---

## Technical Implementation

### Phase 1: Schema Changes

#### 1.1 Update `templates` table in `convex/schema.ts`

Add fields:
```typescript
isPublic: v.optional(v.boolean()),  // default false
tags: v.optional(v.array(v.string())),
authorName: v.optional(v.string()),  // denormalized for display
```

Add index:
```typescript
.index("by_public", ["isPublic"])
```

#### 1.2 Update `workflows` table in `convex/schema.ts`

Add same fields:
```typescript
isPublic: v.optional(v.boolean()),
tags: v.optional(v.array(v.string())),
authorName: v.optional(v.string()),
```

Add index:
```typescript
.index("by_public", ["isPublic"])
```

---

### Phase 2: Access Control Changes

#### 2.1 Update `convex/lib/auth.ts`

Modify `canAccessTemplate`:
```typescript
export async function canAccessTemplate(
  ctx: QueryCtx | MutationCtx,
  templateId: Id<"templates">
): Promise<boolean> {
  const template = await ctx.db.get(templateId)
  if (!template) return false

  // Public templates are accessible to everyone
  if (template.isPublic) return true

  // Private templates require ownership
  const userId = await getOptionalUserId(ctx)
  if (!template.userId) return true  // legacy data
  return template.userId === userId
}
```

Add similar `canAccessWorkflow` update (or create if doesn't exist).

#### 2.2 Add `canModifyTemplate` helper

For mutations that should only work for owners (not just viewers):
```typescript
export async function canModifyTemplate(
  ctx: QueryCtx | MutationCtx,
  templateId: Id<"templates">
): Promise<boolean> {
  const userId = await getOptionalUserId(ctx)
  const template = await ctx.db.get(templateId)
  if (!template) return false
  if (!template.userId) return true  // legacy
  return template.userId === userId
}
```

---

### Phase 3: New Queries

#### 3.1 `convex/templates.ts` - Add public listing

```typescript
export const listPublic = query({
  args: {
    tags: v.optional(v.array(v.string())),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let templates = await ctx.db
      .query("templates")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .collect()

    // Filter by tags if provided
    if (args.tags && args.tags.length > 0) {
      templates = templates.filter(t =>
        args.tags!.some(tag => t.tags?.includes(tag))
      )
    }

    // Filter by search term if provided
    if (args.search) {
      const searchLower = args.search.toLowerCase()
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower)
      )
    }

    // Apply limit
    if (args.limit) {
      templates = templates.slice(0, args.limit)
    }

    return templates
  },
})
```

#### 3.2 `convex/templates.ts` - Get all tags

```typescript
export const listPublicTags = query({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db
      .query("templates")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .collect()

    const tagSet = new Set<string>()
    for (const t of templates) {
      for (const tag of t.tags ?? []) {
        tagSet.add(tag)
      }
    }

    return Array.from(tagSet).sort()
  },
})
```

#### 3.3 Add same queries for workflows

- `workflows.listPublic`
- `workflows.listPublicTags`

---

### Phase 4: New Mutations

#### 4.1 `convex/templates.ts` - Set public status

```typescript
export const setPublic = mutation({
  args: {
    id: v.id("templates"),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Must be owner to change visibility
    const canModify = await canModifyTemplate(ctx, args.id)
    if (!canModify) {
      throw new Error("Unauthorized: You can only modify your own templates")
    }

    const template = await ctx.db.get(args.id)
    if (!template) throw new Error("Template not found")

    // Get author name for attribution
    let authorName = template.authorName
    if (args.isPublic && !authorName) {
      const userId = await getOptionalUserId(ctx)
      if (userId) {
        const user = await ctx.db.get(userId)
        authorName = user?.name ?? user?.email ?? "Anonymous"
      }
    }

    await ctx.db.patch(args.id, {
      isPublic: args.isPublic,
      authorName,
      updatedAt: Date.now(),
    })

    return args.id
  },
})
```

#### 4.2 `convex/templates.ts` - Update tags

```typescript
export const setTags = mutation({
  args: {
    id: v.id("templates"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const canModify = await canModifyTemplate(ctx, args.id)
    if (!canModify) {
      throw new Error("Unauthorized")
    }

    // Normalize tags (lowercase, trim, unique)
    const normalizedTags = [...new Set(
      args.tags.map(t => t.toLowerCase().trim()).filter(t => t.length > 0)
    )]

    await ctx.db.patch(args.id, {
      tags: normalizedTags,
      updatedAt: Date.now(),
    })

    return args.id
  },
})
```

#### 4.3 `convex/templates.ts` - Fork template

```typescript
export const fork = mutation({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    // Source template must be accessible (public or owned)
    const canAccess = await canAccessTemplate(ctx, args.templateId)
    if (!canAccess) {
      throw new Error("Template not found or not accessible")
    }

    const source = await ctx.db.get(args.templateId)
    if (!source) throw new Error("Template not found")

    // User must be authenticated to fork
    const userId = await requireAuth(ctx)

    const now = Date.now()

    // Create copy with new ownership
    const newTemplateId = await ctx.db.insert("templates", {
      name: `${source.name} (Copy)`,
      description: source.description,
      blocks: source.blocks,
      userId,
      isPublic: false,  // Forks start private
      tags: source.tags,
      // Don't copy authorName - this is a new template
      createdAt: now,
      updatedAt: now,
    })

    return newTemplateId
  },
})
```

#### 4.4 Add same mutations for workflows

- `workflows.setPublic`
- `workflows.setTags`
- `workflows.fork`

---

### Phase 5: UI Changes

#### 5.1 Template Editor - Add Public Toggle

Location: Template edit/create form

- Add toggle/checkbox for "Make Public"
- Add tags input (comma-separated or tag chips)
- Show "Published by [authorName]" when viewing public template

#### 5.2 New Page: Browse Public Templates

Route: `/templates/public` or `/explore`

Components needed:
- Search input
- Tag filter (chips or dropdown)
- Template cards showing:
  - Name
  - Description (truncated)
  - Author
  - Tags
  - "Fork" button

#### 5.3 Template Card - Fork Button

- Show "Fork" button on public templates not owned by current user
- On click: call `templates.fork`, navigate to new template

#### 5.4 Same UI for Workflows

- Workflow editor: public toggle + tags
- Browse public workflows page
- Fork button on workflow cards

---

## File Checklist

### Backend (Convex)
- [ ] `convex/schema.ts` - Add isPublic, tags, authorName to templates
- [ ] `convex/schema.ts` - Add isPublic, tags, authorName to workflows
- [ ] `convex/schema.ts` - Add by_public indexes
- [ ] `convex/lib/auth.ts` - Update canAccessTemplate for public
- [ ] `convex/lib/auth.ts` - Add canModifyTemplate
- [ ] `convex/lib/auth.ts` - Update/add canAccessWorkflow for public
- [ ] `convex/lib/auth.ts` - Add canModifyWorkflow
- [ ] `convex/templates.ts` - Add listPublic query
- [ ] `convex/templates.ts` - Add listPublicTags query
- [ ] `convex/templates.ts` - Add setPublic mutation
- [ ] `convex/templates.ts` - Add setTags mutation
- [ ] `convex/templates.ts` - Add fork mutation
- [ ] `convex/workflows.ts` - Add listPublic query
- [ ] `convex/workflows.ts` - Add listPublicTags query
- [ ] `convex/workflows.ts` - Add setPublic mutation
- [ ] `convex/workflows.ts` - Add setTags mutation
- [ ] `convex/workflows.ts` - Add fork mutation

### Frontend
- [ ] Template editor - public toggle
- [ ] Template editor - tags input
- [ ] Public templates browse page
- [ ] Template card - fork button
- [ ] Workflow editor - public toggle
- [ ] Workflow editor - tags input
- [ ] Public workflows browse page
- [ ] Workflow card - fork button
- [ ] Navigation - link to browse public content

---

## Testing Checklist

- [ ] Can mark template as public
- [ ] Public template visible to other users
- [ ] Public template visible to unauthenticated users
- [ ] Can search public templates by name
- [ ] Can filter public templates by tags
- [ ] Can fork public template
- [ ] Forked template is private and owned by forking user
- [ ] Cannot modify someone else's public template
- [ ] Same tests for workflows

---

## Notes

- Start with templates, add workflows after templates work
- Tags should be lowercase and trimmed
- Consider rate limiting fork operations later
- Consider adding fork count display later
