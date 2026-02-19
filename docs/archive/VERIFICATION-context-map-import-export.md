# Manual Verification: Context-Map Import/Export

Step-by-step guide for manually testing the context-map import/export feature.

All sample data is in `docs/data/`. Pre-built ZIPs are ready to use.

## Sample Data Layout

```
docs/data/
  test-skill-simple/          Part 2: single .md import
    SKILL.md
  test-skill-zip/             Part 3: ZIP import without context-map
    SKILL.md
    references/permanent/rules.md
    references/stable/api-spec.md
    references/working/draft.md
  test-skill-zip.zip           Pre-built ZIP of above
  test-skill-multicontext/    Part 4: multi-context project import
    SKILL.md
    context-map.yaml
    references/permanent/coding-standards.md
    references/stable/requirements.md
    references/stable/api-design.md
    references/working/research-notes.md
    references/working/implementation-plan.md
  test-skill-multicontext.zip  Pre-built ZIP of above
```

To rebuild ZIPs after editing samples:

```bash
cd docs/data
zip -r test-skill-zip.zip test-skill-zip/
zip -r test-skill-multicontext.zip test-skill-multicontext/
```

## Prerequisites

1. Start Convex backend: `pnpm exec convex dev`
2. Start dev server: `pnpm dev`
3. Open app at `http://127.0.0.1:5173`
4. Create or select a session with at least a few blocks in different zones

---

## Part 1: Automated Tests

Run all tests first to confirm no regressions:

```bash
pnpm vitest run
```

Expected: all tests pass (94+), including:
- `contextMapParser.test.ts` — 13 tests (YAML parsing, topological sort, circular deps)
- `directoryParser.test.ts` — 13 tests (ZIP structure, context-map detection)
- `titleExtractor.test.ts` — 19 tests (heading extraction, sanitization, dedup)
- `parser.test.ts` — 12 tests (SKILL.md frontmatter parsing)

```bash
pnpm tsc --noEmit
```

Expected: clean, no errors.

---

## Part 2: Single .md Import (Existing Behavior)

**Goal:** Confirm existing single-file import still works.

**Sample:** `docs/data/test-skill-simple/SKILL.md`

1. In the app, click **Import Skill** in the toolbar
2. Click "Click or drop a .md file here" and select `docs/data/test-skill-simple/SKILL.md`
3. **Verify:** Success message shows "Imported skill: Test Skill"
4. **Verify:** A new "skill" block appears in the STABLE zone with the skill content
5. **Verify:** Block card shows the skill icon and "Test Skill" label

---

## Part 3: ZIP Import Without Context-Map (Existing Behavior)

**Goal:** Confirm ZIP import with references still works.

**Sample:** `docs/data/test-skill-zip.zip`

1. In the app, click **Import Skill**
2. Upload `docs/data/test-skill-zip.zip`
3. **Verify:** Success message shows "Imported skill: ZIP Test Skill (+ 3 references)"
4. **Verify:** Skill block appears in STABLE zone
5. **Verify:** Reference blocks appear in their respective zones:
   - `rules.md` in PERMANENT
   - `api-spec.md` in STABLE
   - `draft.md` in WORKING

---

## Part 4: Multi-Context ZIP Import (New — Project Creation)

**Goal:** Confirm multi-context context-map triggers project import dialog.

**Sample:** `docs/data/test-skill-multicontext.zip`

1. In the app, click **Import Skill**
2. Upload `docs/data/test-skill-multicontext.zip`
3. **Verify:** Confirmation dialog appears titled "Import as Project"
4. **Verify:** Dialog shows "Multi-Step Workflow defines a 3-step workflow:"
5. **Verify:** Three steps listed:
   - 1. Research & Planning (3 references)
   - 2. Implementation (3 references)
   - 3. Testing & Review (3 references)
6. **Verify:** Info text says "Your current session becomes step 1: Research & Planning"
7. Click **Import as Project**
8. **Verify:** Success message appears
9. **Verify:** Workflow step indicator appears at top of page showing "Step 1/3"
10. **Verify:** Current session has:
    - Skill block in STABLE zone
    - `coding-standards.md` in PERMANENT zone
    - `requirements.md` in STABLE zone
    - `research-notes.md` in WORKING zone

---

## Part 5: Single-Session Export

**Goal:** Confirm session exports as a valid skill ZIP.

1. Make sure the current session has some blocks (use the session from Part 2 or 3)
2. Click **Export Skill** in the toolbar
3. **Verify:** Dialog appears titled "Export as Skill"
4. **Verify:** Shows block count
5. **Verify:** ZIP contents list shows SKILL.md + references per zone
6. Click **Download ZIP**
7. **Verify:** A `.zip` file downloads
8. Inspect the ZIP:

```bash
unzip -l ~/Downloads/*.zip  # adjust filename
```

9. **Verify:** Contains:
   - `SKILL.md` with frontmatter (`name:`, `description:`)
   - `references/permanent/` folder (if permanent blocks exist)
   - `references/stable/` folder (if stable blocks exist)
   - `references/working/` folder (if working blocks exist)

10. Extract and verify SKILL.md content:

```bash
mkdir -p /tmp/verify-export && cd /tmp/verify-export
unzip -o ~/Downloads/*.zip
cat SKILL.md
```

11. **Verify:** SKILL.md has valid frontmatter with `---` delimiters and `name:`/`description:` fields

---

## Part 6: Project Export with Context-Map

**Goal:** Confirm project export generates context-map.yaml.

1. Use the session from Part 4 (must be part of a project — check for workflow indicator)
2. Click **Export Skill** in the toolbar
3. **Verify:** Dialog shows "Export Project" (not "Export as Skill")
4. **Verify:** Shows block count and step count
5. **Verify:** ZIP contents list includes "context-map.yaml"
6. Click **Download ZIP**
7. Inspect:

```bash
mkdir -p /tmp/verify-project-export && cd /tmp/verify-project-export
unzip -o ~/Downloads/*.zip
cat context-map.yaml
```

8. **Verify:** `context-map.yaml` has `contexts:` key with step entries
9. **Verify:** Each step has `label:`, and file references in `permanent:`/`stable:`/`working:`
10. **Verify:** Steps after the first have `depends_on:`

---

## Part 7: Round-Trip Test

**Goal:** Export a session, re-import it, verify structure is preserved.

1. Create a session with mixed blocks across all three zones
2. Export via **Export Skill** -> **Download ZIP**
3. Create a **new session** (or clear current one)
4. Import the exported ZIP via **Import Skill**
5. **Verify:** All blocks appear in the correct zones
6. **Verify:** Block content matches the original

---

## Part 8: Edge Cases

### 8a. Cancel Project Import
1. Upload `docs/data/test-skill-multicontext.zip`
2. When confirmation dialog appears, click **Cancel**
3. **Verify:** Dialog closes, no blocks imported, no project created

### 8b. Empty Session Export
1. Create a brand new session with no blocks
2. Click **Export Skill**
3. **Verify:** Download button is disabled (isReady = false)

### 8c. Drag and Drop Import
1. Open file manager
2. Drag `docs/data/test-skill-zip.zip` onto the import dialog's drop zone
3. **Verify:** Same behavior as file picker upload (Part 3 results)

### 8d. URL Import
1. Click **Import Skill**
2. Paste a raw GitHub URL to a SKILL.md file (or any valid URL to a .md file)
3. Click **Import**
4. **Verify:** Skill imports successfully (or shows clear error for invalid URLs)

### 8e. Metadata Carry-Forward (Workflow Steps)
1. After Part 4 project import, advance to Step 2 using the "Next" button in the workflow indicator
2. **Verify:** PERMANENT zone blocks carry forward with their metadata intact
3. **Verify:** Block cards show the correct skill name and source info

---

## Part 9: Zone Scrolling Fix

1. Add 10+ blocks to any single zone (e.g., STABLE)
2. **Verify:** The zone scrolls vertically — all blocks are accessible
3. **Verify:** Other zones remain visible and independently scrollable
