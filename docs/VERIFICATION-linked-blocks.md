# Linked Blocks — Manual Verification Guide

## Prerequisites

- Convex dev server running (`npx convex dev`)
- App running (`pnpm dev`)
- At least 2 sessions created

---

## V1: Schema + Manual Link + Visual + Edit

### 1. Manual linking via popover

1. Open **Session A**, create a block with content: `# Project Guidelines\nAlways use TypeScript.`
2. Open **Session B**
3. In any zone column header, click the **Link2 (chain) icon** button
4. A popover appears — search for Session A by name
5. Click Session A — see block list with type badges and content preview
6. Click the guidelines block

**Expected:**
- Block appears in Session B's zone with a **teal left border** and a **Link2 icon** in the header
- Block content shows the guidelines text from Session A

### 2. Editing a linked block

1. In Session B, click **Edit** on the linked block
2. Verify the editor shows a **teal banner**: "Linked block — edits will update all sessions using this block."
3. Change the content to: `# Project Guidelines\nAlways use TypeScript strict mode.`
4. Save
5. Switch to **Session A**

**Expected:**
- Session A's block now shows the updated content ("strict mode")
- The edit propagated through the linked reference

### 3. Unlinking

1. In Session B, hover over the linked block
2. Click the **Unlink2 icon** in the hover actions
3. Verify the teal border and Link2 icon disappear
4. Edit the block in Session B — change content
5. Switch to Session A

**Expected:**
- Session A's block is **unchanged** — the blocks are now independent
- Session B's block is a regular block with no link indicators

---

## V2: Content Hash + Auto-Suggest

### 4. Auto-suggest on block create

1. In **Session A**, create a block with content: `Use conventional commits: feat:, fix:, docs:`
2. Note the block is created normally
3. Switch to **Session B**
4. Create a NEW block with the **exact same content**: `Use conventional commits: feat:, fix:, docs:`
5. After creation, look at the block card

**Expected:**
- A small accent bar appears below the block: "Same as block in [Session A name]. **Link?**"
- Clicking "Link?" replaces the block with a linked reference (teal border appears)

### 5. Auto-suggest on block edit (hash backfill)

1. In **Session C**, find an old block (created before linked blocks feature)
2. Edit it — change some text and save
3. If the exact same content exists in another session, the "Link?" suggestion should appear

**Expected:**
- Editing an old block computes its content hash (backfill)
- Future duplicate detection works for legacy blocks after they're edited

---

## V3: Session Delete Safety + Workflows

### 6. Session delete promotes references

1. Create a block in **Session A** with content: `Important reference material`
2. Link it into **Session B** (via popover)
3. Verify Session B shows the linked block with teal border
4. **Delete Session A** from the session list
5. Check Session B

**Expected:**
- Session B's block is **still there** with full content preserved
- The teal border is **gone** — the block was promoted to a regular block
- **No data loss**

### 7. Session clear promotes references

1. Create a linked block across two sessions
2. Use "Clear session" on the source session
3. Check the other session

**Expected:**
- Same as delete — references are promoted before clearing

### 8. Workflow carry-forward

1. Create a **project with a workflow** (at least 2 steps)
2. In step 1's session, add a block to **PERMANENT** zone and one to **WORKING** zone
3. Click "Next Step" to advance the workflow

**Expected:**
- PERMANENT block carries forward as a **linked reference** (teal border in step 2)
- WORKING block carries forward as an **independent copy** (no teal border)
- Edit the PERMANENT block in step 2 → change appears in step 1 too
- Edit the WORKING block in step 2 → step 1 is unchanged

---

## V4: Template/Snapshot Resolution

### 9. Save template with linked blocks

1. In a session with linked blocks, click **Save as Template**
2. Open the template (or apply it to a new session)

**Expected:**
- Template blocks have **resolved content** — no references, no teal borders
- The template is self-contained (deleting the source session won't affect it)

### 10. Save snapshot with linked blocks

1. In a session with linked blocks, save a **snapshot**
2. Restore the snapshot

**Expected:**
- Snapshot blocks have **resolved content** — self-contained
- Restored blocks are regular blocks (no linked references)

---

## Edge Cases

### 11. Dangling reference protection

1. Create a linked block (A → B)
2. Delete the **canonical block** directly (not the session — just the block) in Session A

**Expected:**
- Session B's block is promoted — content copied, reference cleared
- No errors or empty blocks

### 12. Compress guard

1. Try to compress a linked block

**Expected:**
- Error: "Cannot compress a linked block — unlink first"
- Unlink it first, then compression works

---

## Summary

| Test | Feature | Status |
|------|---------|--------|
| 1 | Manual link via popover | |
| 2 | Edit propagation | |
| 3 | Unlink to independent copy | |
| 4 | Auto-suggest on create | |
| 5 | Hash backfill on edit | |
| 6 | Session delete safety | |
| 7 | Session clear safety | |
| 8 | Workflow carry-forward | |
| 9 | Template resolution | |
| 10 | Snapshot resolution | |
| 11 | Direct block delete protection | |
| 12 | Compress guard | |
