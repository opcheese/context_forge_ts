# SKILL.md Import System Design

## Problem

LLM users increasingly expect skills (reusable workflow/instruction packages) in their tools. ContextForge needs to support the SKILL.md open standard without relying on Claude Code's native skill loading — the anti-agent suffix disables all of Claude Code's built-in skill/CLAUDE.md processing to prevent file system tool use in the web app context.

We need a custom mechanism that is:
- **Compatible** with the SKILL.md open standard (Agent Skills spec at agentskills.io)
- **Easy to use** — automatic import, not manual copy-paste
- **Transparent** — skills are visible, editable blocks the user fully controls
- **Load/unload at will** — users add and remove skills as context, preserving ContextForge's core promise of low-level context management

## Design

### 1. Skill Block Type

New block type `skill` added to the existing 12 types.

**Schema additions to the `blocks` table:**

- `type: "skill"` — new enum value
- `metadata` — optional object field storing:
  - `skillName: string` — from SKILL.md frontmatter `name` (required)
  - `skillDescription: string` — from frontmatter `description`
  - `sourceType: "local" | "upload" | "url"` — how the skill was imported
  - `sourceRef: string` — folder path, filename, or URL (provenance)

**Content** is the SKILL.md markdown body (instructions), stripped of YAML frontmatter.

**Default zone:** STABLE. Users can move to PERMANENT (always-on methodology) or WORKING (temporary) like any block.

**UI rendering:**
- Distinct icon (puzzle piece or lightning bolt)
- `skillName` displayed as block title
- `skillDescription` as subtitle/tooltip
- Small provenance indicator (local/uploaded/link icon)
- Content viewable and editable like any other block
- Same drag-and-drop, zone movement, and delete behavior

### 2. SKILL.md Parser

A pure function shared across client-side and server-side contexts.

**Location:** `src/lib/skills/parser.ts`

**Input:** Raw SKILL.md file content (string)

**Processing:**
1. Detect YAML frontmatter between `---` delimiters at top of file
2. Extract `name` (required) and `description` from frontmatter
3. Optionally extract other frontmatter fields (version, author, tags) for future use
4. Everything after the closing `---` is the markdown body → block `content`

**Output:**
```typescript
interface ParsedSkill {
  content: string;        // markdown body
  metadata: {
    skillName: string;
    skillDescription: string;
  };
}
```

**Constraints:**
- Zero external dependencies — frontmatter is `---\nkey: value\n---`, parseable with regex + line splitting
- Pure function, no side effects — easy to test
- NOT imported into Convex queries/mutations directly

**Edge cases:**
- No frontmatter → reject with error ("Not a valid SKILL.md: missing frontmatter")
- Missing `name` → reject
- Missing `description` → warn, use filename as fallback
- Very large body (>5000 tokens per spec recommendation) → import anyway, show token count warning in UI

### 3. Intake Mechanisms

Three import paths, all converging on the same parser and the same Convex mutation.

#### 3a. Local Folder Scan (local deployment only)

- Settings panel: "Skills folder" path field (default: `~/.claude/skills/`)
- "Scan & Import" action reads directory, finds all `*/SKILL.md` files
- Presents checklist dialog: skill name, description, token estimate, checkbox
- User selects which to import → creates skill blocks in STABLE zone
- Gated by feature flag (same pattern as `CLAUDE_CODE_ENABLED`)
- Implementation: Convex Node action (`"use node"`) for filesystem access

#### 3b. File Upload (web)

- "Import Skill" in the Add Block menu
- Accepts `.md` file (single SKILL.md) or `.zip` (skill directory)
- For zip: locates SKILL.md inside, extracts content
- Client-side parsing → calls Convex mutation with parsed data
- `sourceType: "upload"`, `sourceRef: original filename`

#### 3c. URL Import (web)

- "Import Skill from URL" text input
- Accepts raw GitHub URLs (e.g., `https://raw.githubusercontent.com/.../SKILL.md`)
- Also accepts GitHub directory URLs — resolves to raw SKILL.md
- Client-side fetch + parse → calls Convex mutation with parsed data
- `sourceType: "url"`, `sourceRef: the URL`

### 4. Data Flow & Runtime Separation

```
Client-side (upload/URL):
  Browser parses SKILL.md
    → calls mutation: skills.importSkill({ content, metadata, sessionId, zone })
    → mutation creates block

Server-side (local scan):
  Convex Node action reads filesystem
    → parses SKILL.md files
    → calls internal mutation with parsed data
    → mutation creates blocks
```

The Convex mutation receives already-parsed data as plain arguments. No parser dependency in mutation code. No special imports in the Convex default runtime.

### 5. Template-Based Persistence

No new "skill library" concept. Existing templates handle persistence:

- User imports skills into a session, arranges them across zones
- Saves session as template — skill blocks are preserved like any other blocks
- New sessions from that template come pre-loaded with the right skills in the right zones
- Example: "Research Session" template with literature-review and data-cleaning skills in STABLE

**Skill identity across sessions:**
- `metadata.skillName` allows the UI to show provenance even after template instantiation
- To update a skill: user re-imports newer version, replaces old block by name
- No automatic update mechanism in v1

**Template composition:**
- Users can import skills into any session at any time
- "Save as template" captures current state including all skills
- Organic template evolution: start from base, add skills, save updated template

### 6. UI Integration

Minimal new UI, maximum reuse of existing patterns.

#### Add Block Menu
- New entry: "Import Skill" (with skill icon)
- Opens modal with sections:
  - **Upload** — file drop zone for `.md` / `.zip` (always visible)
  - **From URL** — text input + "Fetch" button (always visible)
  - **From Folder** — path input + "Scan" button (visible only with local feature flag)

#### Skill Block Card
- Existing block card component with:
  - Skill icon in type badge
  - `skillName` as title, `skillDescription` as subtitle
  - Provenance indicator (local / uploaded / link)
  - Full markdown body viewable and editable
  - Standard drag-and-drop, zone movement, delete

#### Folder Scan Dialog
- Checklist of discovered skills: checkbox, name, description, token estimate
- "Import Selected" button
- All imported to current session's STABLE zone

#### No Separate Skills Panel
- Skills are blocks. The session view is the skills view.
- Block type filtering (existing or trivially addable) lets users see "just skills" if needed

**Principle:** A user who's never heard of SKILL.md sees a block they can read, move, and delete. A user who knows skills sees familiar content they imported effortlessly.

## Out of Scope (v1)

- **Filtering tool-invoking instructions** from skill content — parked as nice-to-have
- **Automatic skill updates** — no version checking or re-fetch; manual re-import only
- **Marketplace browser panel** — v1 is paste-a-URL; browsing Open Skills/SkillsMP is future
- **Progressive disclosure levels 2/3** — no loading of `references/` or `scripts/` directories; body only
- **Skill dependencies** — some skills reference other skills; ignored in v1
- **Changes to anti-agent suffix** — stays as-is; skills are pure context injection

## Implementation Scope

| Component | Estimated size | Notes |
|---|---|---|
| Schema: block type enum + metadata field | ~10 lines | Convex schema change |
| Parser: `src/lib/skills/parser.ts` | ~50 lines | Zero deps, pure function |
| Convex mutation: `skills.importSkill` | ~30 lines | Receives parsed data, creates block |
| Convex Node action: folder scan | ~80 lines | Reuses `"use node"` pattern from `claudeNode.ts` |
| Client upload handler | ~60 lines | File read + parse + mutation call |
| Client URL handler | ~60 lines | Fetch + parse + mutation call |
| UI: import modal component | ~150 lines | Three-section modal, reuses existing patterns |
| UI: skill block card variant | ~40 lines | Extends existing block card |
| UI: folder scan checklist dialog | ~80 lines | Checklist + import action |
| Block type config (`blockTypes.ts`) | ~10 lines | Icon, label, color for `skill` type |
