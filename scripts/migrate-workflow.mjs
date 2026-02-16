#!/usr/bin/env node

/**
 * Migrate a workflow (with all its templates) from one Convex deployment to another.
 *
 * Usage:
 *   node scripts/migrate-workflow.mjs <workflow-id> \
 *     --from-url <source-url> --from-key <source-admin-key> \
 *     --to-url <target-url> --to-key <target-admin-key>
 *
 * Example (cloud → local):
 *   node scripts/migrate-workflow.mjs j57abc123def456 \
 *     --from-url https://next-chickadee-334.convex.cloud --from-key "prod|..." \
 *     --to-url http://192.168.87.58:3210 --to-key "contextforge|..."
 *
 * Environment variables (alternative to flags):
 *   FROM_URL, FROM_KEY, TO_URL, TO_KEY
 *
 * What it copies:
 *   - The workflow record (name, description, steps config)
 *   - All linked templates (with embedded blocks)
 *   - Re-links step templateIds to the new template IDs
 *
 * What it does NOT copy:
 *   - User ownership (assigns to first user on target, or --to-user)
 *   - Sessions, projects, or live blocks
 *   - Marketplace publish status
 *
 * Backend functions used (convex/migrations.ts — internal, admin-auth only):
 *   - migrations:getWorkflow
 *   - migrations:getTemplate
 *   - migrations:createTemplate
 *   - migrations:createWorkflow
 *   - migrations:linkTemplateToWorkflow
 *   - migrations:listUsers
 */

// --- Arg parsing ---

function parseArgs() {
  const args = process.argv.slice(2)
  const flags = {}
  let workflowId = null

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].replace(/^--/, "")
      flags[key] = args[i + 1]
      i++
    } else if (!workflowId) {
      workflowId = args[i]
    }
  }

  return {
    workflowId,
    fromUrl: flags["from-url"] || process.env.FROM_URL,
    fromKey: flags["from-key"] || process.env.FROM_KEY,
    toUrl: flags["to-url"] || process.env.TO_URL,
    toKey: flags["to-key"] || process.env.TO_KEY,
    toUser: flags["to-user"] || process.env.TO_USER,
    dryRun: "dry-run" in flags,
  }
}

function usage() {
  console.error(`
Usage: node scripts/migrate-workflow.mjs <workflow-id> \\
  --from-url <source-url> --from-key <source-admin-key> \\
  --to-url <target-url> --to-key <target-admin-key> \\
  [--to-user <target-user-id>] [--dry-run]

Environment variables: FROM_URL, FROM_KEY, TO_URL, TO_KEY, TO_USER
`)
  process.exit(1)
}

// --- Convex admin API helpers ---

async function adminQuery(url, adminKey, path, args = {}) {
  const resp = await fetch(`${url}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${adminKey}`,
    },
    body: JSON.stringify({ path, args, format: "json" }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Query ${path} failed: ${resp.status} ${text}`)
  }
  const data = await resp.json()
  if (data.status === "error") {
    throw new Error(`Query ${path} error: ${data.errorMessage}`)
  }
  return data.value
}

async function adminMutation(url, adminKey, path, args = {}) {
  const resp = await fetch(`${url}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${adminKey}`,
    },
    body: JSON.stringify({ path, args, format: "json" }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Mutation ${path} failed: ${resp.status} ${text}`)
  }
  const data = await resp.json()
  if (data.status === "error") {
    throw new Error(`Mutation ${path} error: ${data.errorMessage}`)
  }
  return data.value
}

// --- Main ---

async function main() {
  const opts = parseArgs()

  if (!opts.workflowId || !opts.fromUrl || !opts.fromKey || !opts.toUrl || !opts.toKey) {
    usage()
  }

  console.log(`Migrating workflow ${opts.workflowId}`)
  console.log(`  From: ${opts.fromUrl}`)
  console.log(`  To:   ${opts.toUrl}`)
  if (opts.dryRun) console.log("  (DRY RUN — no writes)")
  console.log()

  // 1. Fetch the workflow from source
  console.log("1. Fetching workflow...")
  const workflow = await adminQuery(opts.fromUrl, opts.fromKey, "migrations:getWorkflow", {
    workflowId: opts.workflowId,
  })

  if (!workflow) {
    console.error(`Workflow ${opts.workflowId} not found on source`)
    process.exit(1)
  }

  console.log(`   Found: "${workflow.name}" (${workflow.steps.length} steps)`)

  // 2. Fetch all linked templates
  console.log("2. Fetching templates...")
  const templateIds = workflow.steps.map((s) => s.templateId).filter(Boolean)
  const uniqueTemplateIds = [...new Set(templateIds)]

  const templates = []
  for (const tid of uniqueTemplateIds) {
    const tmpl = await adminQuery(opts.fromUrl, opts.fromKey, "migrations:getTemplate", {
      templateId: tid,
    })
    if (tmpl) {
      templates.push(tmpl)
      console.log(`   Template: "${tmpl.name}" (${tmpl.blocks.length} blocks)`)
    } else {
      console.warn(`   WARNING: Template ${tid} not found, will be unlinked`)
    }
  }

  // 3. Summary
  console.log()
  console.log("Migration summary:")
  console.log(`  Workflow: "${workflow.name}"`)
  console.log(`  Steps: ${workflow.steps.length}`)
  console.log(`  Templates: ${templates.length}`)
  console.log(`  Total blocks: ${templates.reduce((sum, t) => sum + t.blocks.length, 0)}`)
  console.log()

  if (opts.dryRun) {
    console.log("DRY RUN complete. No changes made.")
    return
  }

  // 4. Auto-detect target user if not specified
  let targetUserId = opts.toUser
  if (!targetUserId) {
    console.log("3. Auto-detecting target user...")
    const users = await adminQuery(opts.toUrl, opts.toKey, "migrations:listUsers", {})
    if (users && users.length > 0) {
      targetUserId = users[0]._id
      console.log(`   Using first user: ${targetUserId}`)
    } else {
      console.log("   No users found on target — workflow will be unowned")
    }
  }

  // 5. Create templates on target
  console.log("4. Creating templates on target...")
  const oldToNewTemplateId = new Map()

  for (const tmpl of templates) {
    const newId = await adminMutation(opts.toUrl, opts.toKey, "migrations:createTemplate", {
      name: tmpl.name,
      description: tmpl.description || "",
      blocks: tmpl.blocks.map((b) => ({
        content: b.content,
        type: b.type,
        zone: b.zone,
        position: b.position,
        ...(b.metadata ? { metadata: b.metadata } : {}),
      })),
      ...(targetUserId ? { userId: targetUserId } : {}),
    })
    oldToNewTemplateId.set(tmpl._id, newId)
    console.log(`   Created template "${tmpl.name}" -> ${newId}`)
  }

  // 6. Create workflow on target with remapped template IDs
  console.log("5. Creating workflow on target...")
  const newSteps = workflow.steps.map((step) => ({
    name: step.name,
    ...(step.description ? { description: step.description } : {}),
    ...(step.carryForwardZones ? { carryForwardZones: step.carryForwardZones } : {}),
    ...(step.templateId && oldToNewTemplateId.has(step.templateId)
      ? { templateId: oldToNewTemplateId.get(step.templateId) }
      : {}),
  }))

  const newWorkflowId = await adminMutation(opts.toUrl, opts.toKey, "migrations:createWorkflow", {
    name: workflow.name,
    description: workflow.description || "",
    steps: newSteps,
    ...(targetUserId ? { userId: targetUserId } : {}),
  })

  console.log(`   Created workflow "${workflow.name}" -> ${newWorkflowId}`)

  // 7. Link templates back to workflow
  console.log("6. Linking templates to workflow...")
  let linked = 0
  for (const [oldId, newId] of oldToNewTemplateId) {
    const oldTmpl = templates.find((t) => t._id === oldId)
    if (oldTmpl?.stepOrder !== undefined) {
      await adminMutation(opts.toUrl, opts.toKey, "migrations:linkTemplateToWorkflow", {
        templateId: newId,
        workflowId: newWorkflowId,
        stepOrder: oldTmpl.stepOrder,
      })
      linked++
    }
  }
  console.log(`   Linked ${linked} templates`)

  console.log()
  console.log("Migration complete!")
  console.log(`  New workflow ID: ${newWorkflowId}`)
}

main().catch((err) => {
  console.error("Migration failed:", err.message)
  process.exit(1)
})
