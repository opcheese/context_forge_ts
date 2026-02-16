# Migrate Workflow Between Deployments

Copy a workflow (with all its templates) from one ContextForge deployment to another.

## Prerequisites

- Node 20+ with `pnpm` installed
- Admin keys for both source and target deployments
- Both deployments must have `convex/migrations.ts` deployed (commit `240c063` or later)

## Deployment Reference

| Deployment | Convex URL | Frontend |
|---|---|---|
| **Production (cloud)** | `https://next-chickadee-334.convex.cloud` | Vercel |
| **Local VPN** | `http://192.168.87.58:3210` | `http://192.168.87.58:8080` |

## Finding Your Admin Keys

**Local VPN deployment:**
```bash
ssh ubuntu@192.168.87.58 "cat ~/contextforge/.credentials"
# Look for ADMIN_KEY=contextforge|...
```

**Production (cloud) deployment:**
```bash
# From your development machine, in the project root:
npx convex dashboard
# Go to Settings → Deploy Key in the Convex dashboard
```

## Finding Workflow IDs

Open the Convex Dashboard for the source deployment and look up workflows:

- **Local VPN dashboard:** http://192.168.87.58:6791
- **Production dashboard:** https://dashboard.convex.dev

Navigate to **Data → workflows** table. Copy the `_id` value of the workflow you want to migrate.

## Usage

### Basic: Cloud → Local VPN

```bash
node scripts/migrate-workflow.mjs <WORKFLOW_ID> \
  --from-url https://next-chickadee-334.convex.cloud \
  --from-key "prod|<YOUR_PROD_ADMIN_KEY>" \
  --to-url http://192.168.87.58:3210 \
  --to-key "contextforge|01eb1f25f94fd7b2bbb849737a182a5454e9605538280c7f079bfbf8686aad6ecc3f0b55e9"
```

### Basic: Local VPN → Cloud

```bash
node scripts/migrate-workflow.mjs <WORKFLOW_ID> \
  --from-url http://192.168.87.58:3210 \
  --from-key "contextforge|01eb1f25f94fd7b2bbb849737a182a5454e9605538280c7f079bfbf8686aad6ecc3f0b55e9" \
  --to-url https://next-chickadee-334.convex.cloud \
  --to-key "prod|<YOUR_PROD_ADMIN_KEY>"
```

### Dry Run (preview without writing)

Add `--dry-run` to see what would be migrated without making any changes:

```bash
node scripts/migrate-workflow.mjs <WORKFLOW_ID> \
  --from-url https://next-chickadee-334.convex.cloud \
  --from-key "prod|<YOUR_PROD_ADMIN_KEY>" \
  --to-url http://192.168.87.58:3210 \
  --to-key "contextforge|..." \
  --dry-run
```

### Using Environment Variables

Instead of passing flags every time, set env vars:

```bash
export FROM_URL=https://next-chickadee-334.convex.cloud
export FROM_KEY="prod|<YOUR_PROD_ADMIN_KEY>"
export TO_URL=http://192.168.87.58:3210
export TO_KEY="contextforge|01eb1f25f94fd7b2bbb849737a182a5454e9605538280c7f079bfbf8686aad6ecc3f0b55e9"

# Then just pass the workflow ID:
node scripts/migrate-workflow.mjs <WORKFLOW_ID>
```

### Assigning to a Specific User

By default, the script auto-detects the first user on the target deployment. To assign to a specific user:

```bash
node scripts/migrate-workflow.mjs <WORKFLOW_ID> \
  --from-url ... --from-key ... \
  --to-url ... --to-key ... \
  --to-user <TARGET_USER_ID>
```

## What Gets Copied

| Copied | Not Copied |
|---|---|
| Workflow name, description, steps config | Sessions / live blocks |
| All linked templates (with embedded blocks) | Projects |
| Template-to-step linkage | User ownership (re-assigned on target) |
| Carry-forward zone settings | Marketplace publish status |

## Example Output

```
Migrating workflow j57abc123def456
  From: https://next-chickadee-334.convex.cloud
  To:   http://192.168.87.58:3210

1. Fetching workflow...
   Found: "PM Brief Pipeline" (3 steps)
2. Fetching templates...
   Template: "Research Brief" (4 blocks)
   Template: "Analysis" (3 blocks)
   Template: "Final Report" (5 blocks)

Migration summary:
  Workflow: "PM Brief Pipeline"
  Steps: 3
  Templates: 3
  Total blocks: 12

3. Auto-detecting target user...
   Using first user: j571234abcdef
4. Creating templates on target...
   Created template "Research Brief" -> j579876fedcba
   Created template "Analysis" -> j579876fedcbb
   Created template "Final Report" -> j579876fedcbc
5. Creating workflow on target...
   Created workflow "PM Brief Pipeline" -> j578888abcdef
6. Linking templates to workflow...
   Linked 3 templates

Migration complete!
  New workflow ID: j578888abcdef
```

## Troubleshooting

**"Query migrations:getWorkflow failed: 400"**
- The `convex/migrations.ts` functions haven't been deployed to the source. Run `npx convex deploy` on both deployments.

**"Workflow ... not found on source"**
- Double-check the workflow ID. Copy it from the Convex Dashboard data browser.

**"Mutation migrations:createTemplate failed: 400"**
- Schema mismatch between deployments. Make sure both are on the same codebase version.

**Templates show 0 blocks after migration**
- The source templates may have been created before the blocks-in-template feature. Re-save them from a session first.
