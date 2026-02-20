# ContextForge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Convex](https://img.shields.io/badge/Convex-Backend-ff6b6b.svg)](https://convex.dev/)

A context window management application for LLM interactions. Organize your prompts, reference materials, and generated content with a **three-zone architecture** designed for optimal context caching.

## What is ContextForge?

ContextForge helps you manage the context window when working with Large Language Models. Instead of manually copying and pasting content, organize it into zones that optimize for LLM caching and token efficiency.

| Zone | Purpose | Behavior |
|------|---------|----------|
| **PERMANENT** | System prompts, personas, guidelines | Always included first, best cache hits |
| **STABLE** | Reference material, templates, frameworks | Cached per session, rarely changes |
| **WORKING** | Recent work, generated content, notes | Frequently updated, first to evict |

### Key Features

- **Visual Zone Management** - Drag-and-drop blocks between zones
- **Multi-Turn Brainstorming** - Have conversations with LLMs using your context
- **Three LLM Providers** - Ollama (local), Claude Code, and OpenRouter
- **Real-Time Streaming** - See responses as they generate
- **Workflows & Templates** - Create reusable document pipelines
- **Projects** - Organize related sessions together
- **Session Snapshots** - Save and restore context states
- **LLM Observability** - LangFuse integration for tracing

## Current Status

| Feature | Status |
|---------|--------|
| Zone-based block management | ✅ Complete |
| Drag-and-drop reordering | ✅ Complete |
| Block editor with 12 types | ✅ Complete |
| Sessions & snapshots | ✅ Complete |
| Multi-turn brainstorming | ✅ Complete |
| LLM streaming (Ollama) | ✅ Complete |
| LLM streaming (Claude Code) | ✅ Complete |
| LLM streaming (OpenRouter) | ✅ Complete |
| Templates & workflows | ✅ Complete |
| Projects & organization | ✅ Complete |
| LangFuse observability | ✅ Complete |
| Token counting & budgets | ✅ Complete |
| SKILL.md import & context-map export | ✅ Complete |
| Compression system | ✅ Complete |
| Draft blocks | ✅ Complete |
| Animation system (framer-motion) | ✅ Complete |
| Linked blocks (cross-session references) | ✅ Complete |
| Astro public site + blog + SEO | ✅ Complete |

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- At least one LLM provider (see below)

### Installation

```bash
# Clone the repository
git clone https://github.com/opcheese/context_forge_ts.git
cd context_forge_ts

# Install dependencies
pnpm install
cd site && pnpm install && cd ..

# Copy environment file
cp .env.example .env.local

# Start everything (SPA + Astro site + Convex)
pnpm dev:all
```

- **Landing page / blog:** `http://localhost:4321/`
- **App (SPA):** `http://localhost:5173/app/`

### Other Commands

```bash
# Preview production build locally (builds + serves with SPA rewrites)
pnpm preview

# Build everything (same as Vercel deploy)
pnpm build:all
```

## LLM Providers

ContextForge supports three LLM providers. You need at least one configured.

### Ollama (Recommended for Development)

Free, local, private. Great for development and testing.

```bash
# Install from https://ollama.ai/download
# Pull a model
ollama pull llama3.2

# Ollama runs at http://localhost:11434 by default
```

### OpenRouter (Recommended for Production)

Access Claude, GPT-4, Llama, and 100+ models through one API.

```bash
# Get API key from https://openrouter.ai/keys
# Add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-...
```

Then set via Convex:
```bash
pnpm exec convex env set OPENROUTER_API_KEY sk-or-v1-...
```

### Claude Code

Uses the Claude Code CLI (requires Claude subscription).

```bash
# Install Claude Code CLI from https://claude.ai/code
# Find path: which claude
# Add to .env.local:
CLAUDE_CODE_PATH=/path/to/claude
```

Then set via Convex:
```bash
pnpm exec convex env set CLAUDE_CODE_PATH /path/to/claude
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | Auto | Convex deployment URL (auto-generated) |
| **Ollama** | | |
| `OLLAMA_URL` | No | Server URL (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | No | Default model (default: `llama3.2`) |
| **OpenRouter** | | |
| `OPENROUTER_API_KEY` | For OpenRouter | API key from openrouter.ai |
| `OPENROUTER_MODEL` | No | Default model (default: `anthropic/claude-3.5-sonnet`) |
| **Claude Code** | | |
| `CLAUDE_CODE_PATH` | For Claude | Path to Claude Code CLI |
| **LangFuse** | | |
| `LANGFUSE_SECRET_KEY` | No | LangFuse secret key for tracing |
| `LANGFUSE_PUBLIC_KEY` | No | LangFuse public key |
| `LANGFUSE_BASE_URL` | No | LangFuse server URL |

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Backend | [Convex](https://convex.dev) | Real-time database, serverless functions |
| App Frontend | React 19 + TypeScript | SPA served at `/app/` |
| Public Site | [Astro 5](https://astro.build) | Landing page, blog, legal (static HTML for SEO) |
| Routing | TanStack Router | Type-safe client-side routing (app) |
| Styling | Tailwind CSS v4 + shadcn/ui | Utility-first CSS + components |
| Blog | Astro Content Collections + MDX | Static blog with RSS and sitemap |
| Drag-and-Drop | @dnd-kit | Accessible drag-and-drop |
| Testing | Vitest + Playwright | Unit + E2E tests |

## Project Structure

```
contextforge/
├── convex/                 # Backend (Convex)
│   ├── schema.ts           # Database schema
│   ├── blocks.ts           # Block CRUD operations
│   ├── sessions.ts         # Session management
│   ├── templates.ts        # Template management
│   ├── workflows.ts        # Workflow management
│   ├── projects.ts         # Project management
│   ├── generations.ts      # LLM generation tracking
│   ├── claudeNode.ts       # Claude Code integration
│   ├── http.ts             # HTTP endpoints (Ollama, OpenRouter)
│   └── lib/                # Shared backend utilities
│
├── src/                    # App SPA (React 19 + TanStack Router)
│   ├── routes/             # Pages (file-based routing)
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   ├── contexts/           # React contexts
│   └── lib/                # Utilities
│
├── site/                   # Public site (Astro 5)
│   ├── src/pages/          # Landing, blog, legal pages
│   ├── src/content/blog/   # MDX blog posts
│   ├── src/components/     # Astro + React island components
│   └── src/layouts/        # Page layouts (Base, BlogPost)
│
├── docs/                   # Documentation
└── e2e/                    # Playwright tests
```

## Development

```bash
# Start everything concurrently
pnpm dev:all

# Run all checks
pnpm lint && pnpm test:run && pnpm build:all

# Format code
pnpm format

# Run E2E tests (requires app + Convex running)
pnpm test:e2e

# Type check
pnpm exec tsc --noEmit
```

### Deployment

The app deploys to Vercel as a single project. Vite builds the SPA into `site/public/app/`,
then Astro builds all static pages into `site/dist/`. Vercel serves `site/dist/` with a
rewrite rule for `/app/*` to enable SPA client-side routing.

## Key Concepts

### Context Assembly

Content is assembled in a specific order to optimize LLM caching:

```
┌─────────────────┐
│  System Prompt  │ ← Extracted from system_prompt blocks
├─────────────────┤
│   PERMANENT     │ ← Guidelines, personas (best cache hits)
├─────────────────┤
│    STABLE       │ ← Reference material, templates
├─────────────────┤
│    WORKING      │ ← Recent work, notes, documents
├─────────────────┤
│   User Prompt   │ ← Current request
└─────────────────┘
```

### Block Types

ContextForge uses 12 semantic block types:

| Category | Types |
|----------|-------|
| Core | `system_prompt`, `note`, `code` |
| Document | `guideline`, `template`, `reference`, `document` |
| Conversation | `user_message`, `assistant_message`, `instruction` |
| Meta | `persona`, `framework` |

### Workflows

Create multi-step document creation pipelines:

1. Define templates for each step
2. Configure which zones carry forward
3. Start a project from the workflow
4. Progress through steps, building on previous outputs

## Documentation

See [docs/README.md](docs/README.md) for a complete list of documentation.

### Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Technical design and LLM integration patterns |
| [Data Model](docs/DATA_MODEL.md) | Schema and relationships |
| [API Reference](docs/API_REFERENCE.md) | All Convex functions |
| [Convex Guide](docs/CONVEX_GUIDE.md) | Backend patterns for new contributors |
| [Frontend Guide](docs/FRONTEND_GUIDE.md) | Frontend patterns and components |
| [Roadmap](docs/ROADMAP.md) | Feature development status |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) - see LICENSE file for details.
