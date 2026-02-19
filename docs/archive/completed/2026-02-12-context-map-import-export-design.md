# Context Map: Bidirectional Skill Import/Export Design

## Problem

ContextForge imports skills as blocks, but two gaps remain:

1. **Multi-step skills have no workflow mapping.** A skill with 57 reference files and 8 pipeline stages imports everything into one session. The user gets 57 blocks when they need 7 for the current step.

2. **No export path.** Users can build context layouts in ContextForge's visual UI but can't export them as Claude Code-compatible skill packages. ContextForge is read-only relative to the skill ecosystem.

Both gaps are addressed by supporting the `context-map.yaml` specification — a YAML file inside a skill package that maps workflow steps to their required reference files, organized by zone.

## Scope

This design covers three capabilities:

- **Import with context-map** — multi-context skills become ContextForge projects with workflows
- **Import without context-map** — unchanged from current behavior (blocks into current session)
- **Export** — ContextForge sessions/projects become Claude Code-compatible skill packages

## Context Map Format (Reference)

The full specification lives in the [context-map-spec](../../docs/context-map-spec.md). Key points:

```yaml
contexts:
  step-key:
    label: "Human-readable name"
    permanent: [files...]     # → PERMANENT zone
    stable: [files...]        # → STABLE zone
    working: [files...]       # → WORKING zone
    depends_on: [keys...]     # Ordering
    output: path/to/output.md # Deliverable
    optional_stable: [files...]
    splits:
      sub-key:
        label: "Sub-context"
        additional_stable: [files...]
        output: path/to/split-output.md
```

All paths are relative to the skill root. Zones map 1:1 to ContextForge zones.

## Design

### 1. Import: Detection and Routing

On import (ZIP upload, folder scan, or URL), the system checks what's in the package:

| Package contents | Import behavior |
|---|---|
| `SKILL.md` only | Skill block in current session (existing behavior) |
| `SKILL.md` + `references/` | Skill block + reference blocks in current session (existing behavior) |
| `SKILL.md` + `context-map.yaml` (1 context) | Same as above — single context treated as simple import |
| `SKILL.md` + `context-map.yaml` (N contexts) | **Project import** — see below |

The routing decision: if `context-map.yaml` exists AND has more than one context, it's a project import. Otherwise, simple import.

### 2. Project Import Flow

When importing a multi-context skill:

**Step 1: Parse and announce.**
Parse `SKILL.md`, `context-map.yaml`, and all referenced files. Show the user:
> "This skill defines a N-step workflow. Your current session will become step 1: {label}. {N-1} additional steps will be created."

User confirms to proceed.

**Step 2: Import step 1 into current session.**
Read the first context (topologically sorted by `depends_on`). For each file path in `permanent`, `stable`, `working`:
- Read file content from the package
- Create a `reference` block in the corresponding ContextForge zone
- Set `metadata.parentSkillName` to the skill name
- Set `metadata.sourceRef` to the file's relative path

Create the `skill` block from SKILL.md body in STABLE zone.

Existing blocks in the session are preserved — new blocks are added alongside them.

**Step 3: Generate templates for steps 2–N.**
For each remaining context, create a template containing:
- Block snapshots for each file path, placed in the zone the context-map specifies
- File list order in the YAML determines block position within each zone

**Step 4: Create workflow and project.**
- Create a workflow with one step per context
- Step ordering determined by topological sort of `depends_on`
- Each step links to its template
- Carry-forward zones per step:
  - PERMANENT always carries forward
  - WORKING always carries forward (accumulates)
  - STABLE does NOT carry forward (replaced by next step's template)
- Wrap the current session into a project with the workflow

**Step 5: Activate workflow UI.**
The workflow step indicator appears in the toolbar:
> "Step 1/8 · L0: Context and Constraints · Next: L1: Aesthetic Profile →"

The user works through steps using existing transition UI.

### 3. Carry-Forward on Step Transition

When the user advances to the next step:

| Zone | Behavior |
|---|---|
| PERMANENT | Kept from previous session |
| STABLE | Replaced with next step's template blocks |
| WORKING | Carried forward, plus any new working files from the template |

This matches the existing `carryForwardZones` logic in `workflows.ts` and `sessions.ts`, with one addition: STABLE zone blocks from the previous step are NOT carried forward (they're replaced by the new template's stable blocks).

### 4. Single-Context Context-Map

If `context-map.yaml` has exactly one context, treat it as a simple import:
- Import files into current session using zone assignments from the YAML
- No project, no workflow, no templates
- The context-map adds value by providing explicit zone assignments (vs. folder convention guessing)

### 5. Export: Single Session

The most common export case. User has one session, wants a Claude Code skill package.

**SKILL.md generation:**
1. Look for a block with `type: "skill"` → its metadata becomes frontmatter, its content becomes SKILL.md body
2. Fallback: generate minimal SKILL.md from session name as `name`, first 100 chars of concatenated block content as `description`, empty body (user should edit)

**Reference file generation:**
For each non-skill block in the session:
1. Extract title from block content (first heading, first line, or `{type}-{index}`)
2. Sanitize to filename: lowercase, replace spaces with hyphens, strip special chars
3. Deduplicate with index suffix on collision
4. Write to `references/{zone}/{filename}.md`

**Output structure:**
```
my-skill/
├── SKILL.md
└── references/
    ├── permanent/
    │   └── persona.md
    ├── stable/
    │   └── style-guide.md
    │   └── api-patterns.md
    └── working/
        └── draft-notes.md
```

No `context-map.yaml` generated — single session means the folder convention is sufficient. Claude Code and ContextForge both understand zone subfolders.

**Delivery:** ZIP download.

### 6. Export: Project with Workflow

User has a project with multiple workflow steps. Each step has a session with blocks.

**SKILL.md generation:** Same as single-session export.

**Reference file generation:** Same process, but scan ALL sessions across all steps. Deduplicate by content — if the same persona block appears in PERMANENT across 4 steps, it's one file referenced 4 times in the context-map.

**Context-map generation:**
For each workflow step:
```yaml
contexts:
  step-{index}:
    label: "{step name}"
    permanent:
      - references/permanent/persona.md
    stable:
      - references/stable/style-guide.md
    working:
      - references/working/prior-output.md
    depends_on: [step-{prev}]  # from workflow step ordering
```

**Output structure:**
```
my-skill/
├── SKILL.md
├── context-map.yaml
└── references/
    └── ...
```

### 7. What We Don't Export

Export is lossy by design. We drop:
- **Token budgets** — ContextForge-internal optimization, not relevant to Claude Code
- **Block type semantics** — encoded implicitly via markdown structure (headers, filenames)
- **Compression state** — runtime optimization, not part of the skill
- **Block positions within a zone** — YAML list order captures this

This is deliberate. The format is export/import, not save/load.

## Import UI

The import dialog needs a new confirmation step for context-map imports:

```
┌─────────────────────────────────────────────┐
│ Import Skill: Game Design Pipeline          │
│                                             │
│ This skill defines an 8-step workflow:      │
│                                             │
│  1. L0: Context and Constraints  (7 refs)   │
│  2. L1: Aesthetic Profile        (4 refs)   │
│  3. L2: Core Mechanics           (6 refs)   │
│  ...                                        │
│                                             │
│ Your current session will become step 1.    │
│ 7 additional steps will be created as a     │
│ project workflow.                           │
│                                             │
│              [Cancel]  [Import as Project]  │
└─────────────────────────────────────────────┘
```

For single-context context-maps, no confirmation — imports directly like a simple skill.

Future: this UI could allow modifying the import (selecting which contexts to include, overriding zone assignments). Not in v1.

## Implementation Notes

### YAML Parsing

The existing skill parser is regex-based (zero deps). Context-map requires real YAML parsing. Options:
- `yaml` package (~60KB) — full YAML spec, well-maintained
- `js-yaml` (~40KB) — lighter, covers YAML 1.2

Either works. The parser runs client-side (for uploads) and in Node actions (for folder scan). Not in Convex default runtime.

### Context-Map Parser

New module: `src/lib/skills/contextMapParser.ts`

```typescript
interface ContextMapContext {
  key: string
  label: string
  permanent: string[]
  stable: string[]
  working: string[]
  optionalStable: string[]
  dependsOn: string[]
  output?: string
  splits: ContextMapSplit[]
}

interface ParsedContextMap {
  contexts: ContextMapContext[]
  // Topologically sorted by depends_on
}
```

Validates: all referenced paths exist in the package, no circular dependencies, at least one context.

### Block Title Extraction for Export

Reuse or extract the existing title-derivation logic used in block card rendering:
1. First markdown heading (`# Title` or `## Title`)
2. First non-empty line
3. Fallback: `{blockType}-{index}`

Sanitize for filenames: `My Great Persona!` → `my-great-persona.md`

### Carry-Forward Fix

The explore agent identified that `advanceStep()` and `goToNextStep()` don't carry forward token metadata or skill metadata during step transitions. This needs fixing for context-map workflows to work correctly — reference blocks must retain their `metadata.parentSkillName` and `metadata.sourceRef` across steps.

### Deduplication Strategy for Export

When exporting a project, the same block may appear in multiple steps (e.g., persona in PERMANENT across all 8 steps). Dedup by content hash:
1. Collect all blocks across all step sessions
2. Hash content (simple string hash, not crypto)
3. Same hash = same file, referenced multiple times in context-map
4. Different content but same derived filename = append index

## Design Decisions

**Why project import, not template import?** The context-map defines a multi-session workflow. Templates are single-session snapshots. A project with a workflow is the correct ContextForge primitive for multi-step pipelines.

**Why current session becomes step 1?** The user initiated the import from a session — they expect to start working immediately. Creating a separate project and making them navigate to it adds friction.

**Why existing blocks stay on import?** The user may have set up context (notes, personas) before importing. Wiping the session would lose that work. Imported blocks are additive.

**Why no context-map for single-session export?** The folder convention (`references/permanent/`, `references/stable/`, `references/working/`) is sufficient for one context. Adding a context-map with a single entry adds complexity without value.

**Why export is lossy?** ContextForge has richer metadata than the skill format needs (token budgets, compression state, block types). Exporting only what Claude Code can consume keeps the output clean. Block type semantics survive via markdown structure — a file named `persona.md` with `# Persona` header communicates its type to both humans and LLMs without an explicit type field.

**Why new import, not update?** Overwrite logic requires identity matching (which block maps to which file?) and conflict resolution (user edited a block, skill updated the source file). For v1, always creating new blocks is simpler and safer. Users clean up duplicates manually.

## Out of Scope (v1)

- **Import modification UI** — letting users change zone assignments or select contexts before importing
- **Skill update/sync** — detecting newer versions and merging changes
- **`optional_stable` runtime logic** — including/excluding blocks based on conditions
- **`splits` UI** — presenting sub-context choices within a step
- **Export UI beyond download** — no direct publish to GitHub/registry
- **Non-markdown references** — only `.md` files; images, YAML data files, etc. are ignored
