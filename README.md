# ContextForge TypeScript

A context window management application for LLM interactions. TypeScript rewrite of the original Python-based ContextForge.

## What is ContextForge?

ContextForge helps manage the context window when working with Large Language Models. It organizes content into a **three-zone architecture**:

| Zone | Purpose | Behavior |
|------|---------|----------|
| **PERMANENT** | System prompts, core instructions | Always included first, never evicted |
| **STABLE** | Reference material, task context | Cached per session, rarely changes |
| **WORKING** | Recent work, generated content | Frequently updated, first to evict |

**Key Features:**
- Visual zone management with drag-and-drop
- Multi-turn brainstorming with LLMs
- Real-time streaming from multiple providers
- Session isolation with snapshots
- Auto-save generated content to context

## Current Status

| Feature | Status |
|---------|--------|
| Zone-based block management | ✅ Complete |
| Drag-and-drop reordering | ✅ Complete |
| Block editor | ✅ Complete |
| Sessions & snapshots | ✅ Complete |
| LLM streaming (Ollama) | ✅ Complete |
| LLM streaming (Claude Code) | ✅ Complete |
| Token counting & budgets | 🔜 Planned |
| Brainstorming chat interface | 🔜 Planned |

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Backend | [Convex](https://convex.dev) | Real-time database, serverless functions |
| Frontend | React 19 + TypeScript | UI components |
| Routing | TanStack Router | Type-safe client-side routing |
| Styling | Tailwind CSS v4 + shadcn/ui | Utility-first CSS + components |
| Drag-and-Drop | @dnd-kit | Accessible drag-and-drop |
| Testing | Vitest + Playwright | Unit + E2E tests |

### LLM Providers

| Provider | Type | Use Case |
|----------|------|----------|
| [Ollama](https://ollama.ai) | Local | Free, private, development |
| [Claude Code](https://claude.ai/code) | Subscription | Production, advanced reasoning |

> **Note:** We use **Claude Code** (the CLI tool via Claude Agent SDK), not the Anthropic API. See [Architecture](docs/ARCHITECTURE.md) for details on why.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- For Ollama: [Install Ollama](https://ollama.ai/download) and pull a model
- For Claude Code: [Install Claude Code CLI](https://claude.ai/code)

### Installation

```bash
# Clone and install
cd ContextForgeTS
pnpm install

# Start Convex backend (terminal 1)
pnpm exec convex dev

# Start frontend (terminal 2)
pnpm dev
```

Visit `http://localhost:5173`

### LLM Provider Setup

#### Ollama (Recommended for Development)

```bash
# Install Ollama from https://ollama.ai/download

# Pull a model
ollama pull llama3.2

# Start Ollama server (usually auto-starts)
ollama serve
```

Ollama runs at `http://localhost:11434` by default.

#### Claude Code

```bash
# Install Claude Code CLI
# See: https://claude.ai/code

# Find your Claude Code path
which claude
# Example: /home/user/.local/bin/claude

# Add to .env.local
echo 'CLAUDE_CODE_PATH=/path/to/claude' >> .env.local
```

Requires an active Claude subscription.

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Auto | Convex deployment URL (auto-generated) |
| `CLAUDE_CODE_PATH` | For Claude | Path to Claude Code CLI executable |
| `OLLAMA_URL` | No | Ollama server URL (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | No | Default Ollama model (default: `llama3.2`) |

## Development

```bash
# Run all checks
pnpm lint && pnpm test:run && pnpm build

# Format code
pnpm format

# Run E2E tests (requires app + Convex running)
pnpm test:e2e

# View Convex dashboard
# URL shown when running `convex dev`
```

### Project Structure

```
ContextForgeTS/
├── convex/                 # Backend (Convex)
│   ├── schema.ts           # Database schema
│   ├── blocks.ts           # Block CRUD operations
│   ├── sessions.ts         # Session management
│   ├── generations.ts      # LLM generation tracking
│   ├── claudeNode.ts       # Claude Code integration
│   ├── http.ts             # HTTP endpoints
│   └── lib/
│       ├── context.ts      # Context assembly
│       └── ollama.ts       # Ollama client
│
├── src/
│   ├── routes/             # Pages (TanStack Router)
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   ├── contexts/           # React contexts
│   └── lib/                # Utilities
│
├── e2e/                    # Playwright tests
└── docs/                   # Documentation
```

## Documentation

### Getting Started
| Document | Description |
|----------|-------------|
| [Convex Guide](docs/CONVEX_GUIDE.md) | Backend patterns for developers from Express/FastAPI |
| [Frontend Guide](docs/FRONTEND_GUIDE.md) | Frontend patterns for developers from React Router/Redux |
| [Data Model](docs/DATA_MODEL.md) | Schema explanation and relationships |
| [API Reference](docs/API_REFERENCE.md) | All Convex functions with args and returns |

### Technical Deep-Dives
| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Technical design, LLM integration patterns |
| [Structure](docs/STRUCTURE.md) | Detailed file layout |
| [Progress](docs/PROGRESS.md) | Development log and decisions |
| [Roadmap](docs/ROADMAP.md) | Feature slices and status |
| [Token Budgets Plan](docs/TOKEN_BUDGETS_PLAN.md) | Upcoming token counting feature |

## Key Concepts

### Zones

Content is organized into three zones with different caching behaviors:

```
Context Assembly Order:
┌─────────────┐
│  PERMANENT  │ ← System prompts (always first, best cache hits)
├─────────────┤
│   STABLE    │ ← Reference material (rarely changes)
├─────────────┤
│   WORKING   │ ← Recent work (frequently updated)
├─────────────┤
│   Prompt    │ ← User's current request
└─────────────┘
```

### Sessions

Sessions provide isolated workspaces. Each session has its own blocks and can be saved/restored via snapshots.

### LLM Streaming

Two different patterns based on provider capabilities:

- **Ollama:** HTTP streaming via Server-Sent Events
- **Claude Code:** Convex reactive queries (database-backed streaming)

See [Architecture](docs/ARCHITECTURE.md) for details.

## License

MIT
