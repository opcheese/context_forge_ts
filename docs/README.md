# Documentation

## Quick Start

- **[ROADMAP.md](./ROADMAP.md)** — Current priorities and feature status
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Technical design and LLM integration patterns

### Development Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev:all` | Run SPA + Astro site + Convex dev concurrently |
| `pnpm dev` | Run only the SPA (Vite) at `localhost:5173/app/` |
| `cd site && pnpm dev` | Run only the Astro site at `localhost:4321/` |
| `pnpm preview` | Build everything and serve locally (production-like) at `localhost:3000/` |
| `pnpm build:all` | Build SPA then Astro site (same as Vercel build) |

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
| [CONTEXT_OPTIMIZATION_AND_CACHING.md](./CONTEXT_OPTIMIZATION_AND_CACHING.md) | Zone optimization and LLM caching strategies |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical design and LLM integration patterns |
| [REFERENCES.md](./REFERENCES.md) | External resources and links |

### Planning
| Document | Description |
|----------|-------------|
| [ROADMAP.md](./ROADMAP.md) | Feature slices and development status |

### Tasks & Bugs
| Directory | Description |
|-----------|-------------|
| [tasks/](./tasks/) | Open tasks and bug reports |
| [archive/completed/tasks/](./archive/completed/tasks/) | Completed task documentation |

### Features
| Feature | Status | Documentation |
|---------|--------|---------------|
| Compression | ✅ Completed | [features/compression/](./features/compression/) |
| SKILL.md Import | ✅ Completed | [design doc](./archive/completed/2026-02-11-skill-import-design.md) |
| Context-Map Import/Export | ✅ Completed | [design doc](./archive/completed/2026-02-12-context-map-import-export-design.md) |
| Stop Generation | ✅ Completed | [task](./archive/completed/tasks/TASK-012-stop-generation.md) |
| Draft Blocks | ✅ Completed | [task](./archive/completed/tasks/TASK-013-draft-blocks.md) |
| Linked Blocks | ✅ Completed | [plans/2026-02-19-linked-blocks-shaping.md](./plans/2026-02-19-linked-blocks-shaping.md) |

### Active Plans
| Document | Description |
|----------|-------------|
| [plans/2026-02-20-astro-migration-blog-design.md](./plans/2026-02-20-astro-migration-blog-design.md) | Astro public site + blog + SEO (implemented) |
| [plans/2026-02-16-ephemeral-skills-design.md](./archive/2026-02-16-ephemeral-skills-design.md) | Ephemeral skills for brainstorming (approved, not started) |

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
| [VERIFICATION-linked-blocks.md](./VERIFICATION-linked-blocks.md) | Manual verification for linked blocks |
| [archive/VERIFICATION-context-map-import-export.md](./archive/VERIFICATION-context-map-import-export.md) | Manual verification for context-map import/export |

---

## Completed Plans

Documents for features that have been fully implemented. Kept for historical reference.

| Document | Description |
|----------|-------------|
| [TOKEN_BUDGETS_PLAN.md](./archive/completed/TOKEN_BUDGETS_PLAN.md) | Token counting and zone budgets (implemented) |
| [WORKFLOW_SYSTEM_PLAN.md](./archive/completed/WORKFLOW_SYSTEM_PLAN.md) | Templates, projects, workflows (implemented) |
| [LLM_IMPLEMENTATION_PLAN.md](./archive/completed/LLM_IMPLEMENTATION_PLAN.md) | Original LLM integration plan (implemented) |
| [PROMPT_ASSEMBLY_REFACTOR.md](./archive/completed/PROMPT_ASSEMBLY_REFACTOR.md) | System prompt extraction (implemented) |
| [CONVEX_VERCEL_AI_ARCHITECTURE.md](./archive/completed/CONVEX_VERCEL_AI_ARCHITECTURE.md) | Vercel AI evaluation (decided not to use) |
| [2026-02-11-skill-import-design.md](./archive/completed/2026-02-11-skill-import-design.md) | SKILL.md import system (implemented) |
| [2026-02-12-context-map-import-export-design.md](./archive/completed/2026-02-12-context-map-import-export-design.md) | Context-map bidirectional import/export (implemented) |
| [2026-02-19-linked-blocks-plan.md](./plans/2026-02-19-linked-blocks-plan.md) | Linked blocks implementation plan (implemented) |
| [2026-02-19-linked-blocks-shaping.md](./plans/2026-02-19-linked-blocks-shaping.md) | Linked blocks Shape Up shaping doc (implemented) |
| [2026-02-18-frontend-polish-ideas.md](./archive/2026-02-18-frontend-polish-ideas.md) | Frontend polish ideas (partially implemented) |
| [2026-02-18-micro-delights-design.md](./archive/2026-02-18-micro-delights-design.md) | Motion design system (partially implemented) |

---

## Archive

Documents that are outdated or superseded. Kept for historical reference only.

| Document | Description |
|----------|-------------|
| [LLM_INTEGRATION.md](./archive/LLM_INTEGRATION.md) | Early LLM research (superseded by implementation) |
| [DBC_PROPOSAL.md](./archive/DBC_PROPOSAL.md) | Design by Contract proposal (not implemented) |
