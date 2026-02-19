# Documentation

## Quick Start

- **[IMPLEMENTATION-ORDER.md](./IMPLEMENTATION-ORDER.md)** - Prioritized task list and sprint planning
- **[PROGRESS.md](./PROGRESS.md)** - Development log and decisions

## Active Documentation

### Getting Started
| Document | Description |
|----------|-------------|
| [CONVEX_GUIDE.md](./CONVEX_GUIDE.md) | Backend patterns for developers from Express/FastAPI |
| [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) | Frontend patterns for developers from React Router/Redux |
| [CLI_COMMANDS.md](./CLI_COMMANDS.md) | Quick reference for `convex run` commands |

### User Guides
| Document | Description |
|----------|-------------|
| [GUIDE-skill-writing.md](./GUIDE-skill-writing.md) | Using ContextForge to write Claude Code skills (TDD workflow) |

### Reference
| Document | Description |
|----------|-------------|
| [API_REFERENCE.md](./API_REFERENCE.md) | All Convex functions with args and returns |
| [DATA_MODEL.md](./DATA_MODEL.md) | Database schema and relationships |
| [archive/STRUCTURE.md](./archive/STRUCTURE.md) | Repository file layout (outdated) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical design and LLM integration patterns |
| [REFERENCES.md](./REFERENCES.md) | External resources and links |

### Planning
| Document | Description |
|----------|-------------|
| [ROADMAP.md](./ROADMAP.md) | Feature slices and development status |
| [CONTEXT_OPTIMIZATION_AND_CACHING.md](./CONTEXT_OPTIMIZATION_AND_CACHING.md) | LLM caching strategies |

### Tasks & Bugs
| Directory | Description |
|-----------|-------------|
| [tasks/](./tasks/) | Open tasks and bug reports (6 remaining) |
| [BugReports/](./BugReports/) | Bug analysis documents |
| [completed/tasks/](./completed/tasks/) | Completed task documentation |

### Features
| Feature | Status | Documentation |
|---------|--------|---------------|
| Compression | ✅ Completed | [features/compression/](./features/compression/) |
| SKILL.md Import | ✅ Completed | [completed/2026-02-11-skill-import-design.md](./completed/2026-02-11-skill-import-design.md) |
| Context-Map Import/Export | ✅ Completed | [completed/2026-02-12-context-map-import-export-design.md](./completed/2026-02-12-context-map-import-export-design.md) |
| Stop Generation | ✅ Completed | [completed/tasks/TASK-012-stop-generation.md](./completed/tasks/TASK-012-stop-generation.md) |
| Draft Blocks | ✅ Completed | [completed/tasks/TASK-013-draft-blocks.md](./completed/tasks/TASK-013-draft-blocks.md) |
| Linked Blocks | 🔨 In Progress | [plans/2026-02-19-linked-blocks-shaping.md](./plans/2026-02-19-linked-blocks-shaping.md) |

### Active Plans
| Document | Description |
|----------|-------------|
| [plans/2026-02-19-linked-blocks-shaping.md](./plans/2026-02-19-linked-blocks-shaping.md) | Linked blocks — cross-session block references (anchor feature) |
| [plans/2026-02-18-frontend-polish-ideas.md](./plans/2026-02-18-frontend-polish-ideas.md) | Frontend polish ideas ranked by impact |
| [plans/2026-02-18-micro-delights-design.md](./plans/2026-02-18-micro-delights-design.md) | Motion design system (partially implemented) |
| [plans/2026-02-16-ephemeral-skills-design.md](./plans/2026-02-16-ephemeral-skills-design.md) | Ephemeral skills for brainstorming (approved, not started) |

### Research
| Document | Description |
|----------|-------------|
| [research/claude-code-skills-pm-pipeline.md](./research/claude-code-skills-pm-pipeline.md) | Claude Code PM skills evaluation |
| [research/claude-code-pm-skills-evaluation.md](./research/claude-code-pm-skills-evaluation.md) | PM skills stack recommendations |
| [research/convex-full-text-search.md](./research/convex-full-text-search.md) | Convex search capabilities |
| [research/N_PLUS_ONE.md](./research/N_PLUS_ONE.md) | N+1 prevention patterns in Convex |

### Design
| Document | Description |
|----------|-------------|
| [design/DESIGN-block-type-usage.md](./design/DESIGN-block-type-usage.md) | Block type documentation |
| [design/DESIGN-brainstorm-questioning.md](./design/DESIGN-brainstorm-questioning.md) | Future: Brainstorm questioning modes |

---

### Verification Guides
| Document | Description |
|----------|-------------|
| [VERIFICATION-context-map-import-export.md](./VERIFICATION-context-map-import-export.md) | Manual verification for context-map import/export |

---

## Completed Plans

Documents for features that have been fully implemented. Kept for historical reference.

| Document | Description |
|----------|-------------|
| [TOKEN_BUDGETS_PLAN.md](./completed/TOKEN_BUDGETS_PLAN.md) | Token counting and zone budgets (implemented) |
| [WORKFLOW_SYSTEM_PLAN.md](./completed/WORKFLOW_SYSTEM_PLAN.md) | Templates, projects, workflows (implemented) |
| [LLM_IMPLEMENTATION_PLAN.md](./completed/LLM_IMPLEMENTATION_PLAN.md) | Original LLM integration plan (implemented) |
| [PROMPT_ASSEMBLY_REFACTOR.md](./completed/PROMPT_ASSEMBLY_REFACTOR.md) | System prompt extraction (implemented) |
| [CONVEX_VERCEL_AI_ARCHITECTURE.md](./completed/CONVEX_VERCEL_AI_ARCHITECTURE.md) | Vercel AI evaluation (decided not to use) |
| [2026-02-11-skill-import-design.md](./completed/2026-02-11-skill-import-design.md) | SKILL.md import system (implemented) |
| [2026-02-12-context-map-import-export-design.md](./completed/2026-02-12-context-map-import-export-design.md) | Context-map bidirectional import/export (implemented) |

---

## Archive

Documents that are outdated or superseded. Kept for historical reference only.

| Document | Description |
|----------|-------------|
| [LLM_INTEGRATION.md](./archive/LLM_INTEGRATION.md) | Early LLM research (superseded by implementation) |
| [DBC_PROPOSAL.md](./archive/DBC_PROPOSAL.md) | Design by Contract proposal (not implemented) |
