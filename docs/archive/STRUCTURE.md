# Repository Structure

```
ContextForgeTS/
│
├── convex/                        # Convex backend
│   ├── _generated/                # Auto-generated types (gitignored)
│   │
│   ├── schema.ts                  # Database schema definitions
│   ├── blocks.ts                  # Block CRUD + zone operations
│   ├── sessions.ts                # Session management
│   ├── snapshots.ts               # State save/restore
│   ├── generations.ts             # LLM generation tracking
│   ├── claudeNode.ts              # Claude Code SDK integration ("use node")
│   ├── http.ts                    # HTTP actions (Ollama streaming, testing)
│   ├── testing.ts                 # E2E test utilities
│   ├── counters.ts                # Demo counter (can be removed)
│   │
│   └── lib/                       # Shared utilities
│       ├── context.ts             # Context assembly for LLMs
│       ├── ollama.ts              # Ollama API client
│       └── validators.ts          # Shared validators (zones, etc.)
│
├── src/                           # Frontend source code
│   │
│   ├── routes/                    # TanStack Router pages
│   │   ├── __root.tsx             # Root layout (header, providers)
│   │   ├── index.tsx              # Home page (zones view)
│   │   └── blocks/
│   │       └── $blockId.tsx       # Block editor page
│   │
│   ├── components/
│   │   ├── GeneratePanel.tsx      # LLM generation UI
│   │   │
│   │   ├── dnd/                   # Drag-and-drop system (@dnd-kit)
│   │   │   ├── DndProvider.tsx    # Context + sensors + handlers
│   │   │   ├── SortableBlock.tsx  # Draggable block wrapper
│   │   │   ├── DroppableZone.tsx  # Zone drop target
│   │   │   ├── BlockDragOverlay.tsx # Ghost preview during drag
│   │   │   ├── types.ts           # DragData types
│   │   │   └── index.ts           # Exports
│   │   │
│   │   └── ui/                    # shadcn/ui components
│   │       └── button.tsx         # Button component
│   │
│   ├── hooks/
│   │   ├── useGenerate.ts         # Ollama HTTP streaming hook
│   │   ├── useClaudeGenerate.ts   # Claude Convex reactive hook
│   │   └── useFileDrop.ts         # File drag-and-drop handler
│   │
│   ├── contexts/
│   │   └── SessionContext.tsx     # Current session provider
│   │
│   ├── lib/
│   │   ├── positioning.ts         # Fractional ordering utilities
│   │   └── utils.ts               # General utilities (cn, etc.)
│   │
│   ├── test/                      # Unit tests (Vitest)
│   │   ├── setup.ts               # Test setup (jest-dom)
│   │   └── button.test.tsx        # Component tests
│   │
│   ├── main.tsx                   # Entry point + providers
│   ├── index.css                  # Global styles + Tailwind
│   └── routeTree.gen.ts           # Auto-generated route tree
│
├── e2e/                           # End-to-end tests (Playwright)
│   ├── app.spec.ts                # Main E2E test specs
│   ├── generation.spec.ts         # LLM generation tests
│   └── global-setup.ts            # Test data reset
│
├── docs/                          # Documentation
│   ├── ARCHITECTURE.md            # Technical design and decisions
│   ├── STRUCTURE.md               # This file
│   ├── PROGRESS.md                # Development log
│   ├── ROADMAP.md                 # Feature slices and status
│   ├── REFERENCES.md              # External resources
│   ├── TOKEN_BUDGETS_PLAN.md      # Upcoming token counting feature
│   ├── LLM_INTEGRATION.md         # [HISTORICAL] Early LLM research
│   ├── LLM_IMPLEMENTATION_PLAN.md # [HISTORICAL] Original implementation plan
│   └── CONVEX_VERCEL_AI_ARCHITECTURE.md # [HISTORICAL] Streaming research
│
├── public/                        # Static assets
│   └── vite.svg
│
│── Configuration Files ────────────────────────────────────────────
│
├── package.json                   # Dependencies and scripts
├── pnpm-lock.yaml                 # Lockfile
├── tsconfig.json                  # TypeScript config (root)
├── tsconfig.app.json              # TypeScript config (app)
├── tsconfig.node.json             # TypeScript config (node/vite)
├── vite.config.ts                 # Vite configuration
├── vitest.config.ts               # Vitest configuration
├── playwright.config.ts           # Playwright configuration
├── eslint.config.js               # ESLint configuration
├── .prettierrc                    # Prettier configuration
├── .prettierignore                # Prettier ignore patterns
├── components.json                # shadcn/ui configuration
├── index.html                     # HTML entry point
│
│── Environment ────────────────────────────────────────────────────
│
├── .env.example                   # Environment variable template
├── .env.local                     # Local environment (gitignored)
│
│── Git ────────────────────────────────────────────────────────────
│
├── .gitignore                     # Git ignore patterns
└── README.md                      # Project overview
```

## Key Directories

### `convex/`

Convex backend code. Contains:

| File | Purpose |
|------|---------|
| `schema.ts` | Database tables: sessions, blocks, snapshots, generations |
| `blocks.ts` | Block CRUD, zone operations, reordering |
| `sessions.ts` | Session create, list, rename, delete |
| `snapshots.ts` | State save/restore functionality |
| `generations.ts` | LLM streaming state management |
| `claudeNode.ts` | Claude Code SDK integration (Node.js action) |
| `http.ts` | HTTP endpoints for Ollama streaming, health checks, testing |
| `testing.ts` | E2E test data isolation utilities |
| `lib/context.ts` | Context assembly for LLM prompts |
| `lib/ollama.ts` | Ollama API client with streaming |
| `lib/validators.ts` | Shared validators (zones, etc.) |

For detailed Convex patterns and how to extend, see [CONVEX_GUIDE.md](./CONVEX_GUIDE.md).

The `_generated/` folder contains auto-generated TypeScript types. Never edit manually.

### `src/routes/`

TanStack Router file-based routing:

| File | Route | Purpose |
|------|-------|---------|
| `__root.tsx` | (layout) | Root layout with header, session selector |
| `index.tsx` | `/` | Home page with zones and generation panel |
| `blocks/$blockId.tsx` | `/blocks/:id` | Block editor page |

### `src/components/`

React components organized by feature:

| Directory | Purpose |
|-----------|---------|
| `dnd/` | Drag-and-drop system using @dnd-kit |
| `ui/` | shadcn/ui component library |
| `GeneratePanel.tsx` | LLM generation interface |

### `src/hooks/`

Custom React hooks:

| Hook | Purpose |
|------|---------|
| `useGenerate.ts` | Ollama HTTP streaming with SSE |
| `useClaudeGenerate.ts` | Claude via Convex reactive queries |
| `useFileDrop.ts` | Native file drop to create blocks |

### `e2e/`

Playwright end-to-end tests. Run against full application.

Test data isolation:
- `testData: true` flag on records
- HTTP endpoint `POST /testing/reset` clears test data
- Content prefix `"E2E Test:"` pattern matching

### `docs/`

| Document | Status | Purpose |
|----------|--------|---------|
| `ARCHITECTURE.md` | ✅ Current | Technical design, LLM patterns |
| `CONVEX_GUIDE.md` | ✅ Current | Convex patterns and how to extend |
| `STRUCTURE.md` | ✅ Current | This file |
| `PROGRESS.md` | ✅ Current | Development log |
| `ROADMAP.md` | ✅ Current | Feature slices |
| `TOKEN_BUDGETS_PLAN.md` | ✅ Current | Next feature plan |
| `REFERENCES.md` | ✅ Current | External links |
| `LLM_INTEGRATION.md` | ⚠️ Historical | Early research (superseded) |
| `LLM_IMPLEMENTATION_PLAN.md` | ⚠️ Historical | Original plan (completed) |
| `CONVEX_VERCEL_AI_ARCHITECTURE.md` | ⚠️ Historical | Streaming research |
| `CONTEXT_OPTIMIZATION_AND_CACHING.md` | ⚠️ Historical | Caching research |

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `BlockCard.tsx` |
| Hooks | camelCase with `use` prefix | `useGenerate.ts` |
| Utilities | camelCase | `utils.ts` |
| Convex functions | camelCase | `blocks.ts` |
| Routes | lowercase, `$param` for dynamic | `$blockId.tsx` |
| Tests | `*.test.tsx` or `*.spec.ts` | `app.spec.ts` |

## Import Aliases

The `@/` alias points to `src/`:

```typescript
// Instead of
import { Button } from "../../../components/ui/button"

// Use
import { Button } from "@/components/ui/button"
```

Configured in `tsconfig.json` and `vite.config.ts`.

## Data Flow

```
User Action
    │
    ▼
React Component
    │
    ├─── useQuery(api.blocks.list) ───► Convex Query ───► Database
    │                                        │
    │◄─────── Real-time updates ─────────────┘
    │
    └─── useMutation(api.blocks.create) ───► Convex Mutation ───► Database
```

For LLM generation, see [Architecture](./ARCHITECTURE.md#llm-integration).
