# Astro Migration + Blog — Design Document

**Date:** 2026-02-20
**Status:** Draft — pending approval

## Problem

The ContextForge landing page is a pure client-side SPA. Crawlers receive an empty `<div id="root"></div>` — the H1, features, CTAs are invisible to Google, Bing, and social preview bots. Adding a blog on this foundation would be pointless.

## Decision

Migrate all public-facing pages (landing, legal, blog) to Astro in a `site/` directory within the existing monorepo. The Vite SPA continues to serve `/app/*` unchanged.

## Architecture

```
convexforgets.com/          → Astro (static HTML)
convexforgets.com/blog/*    → Astro (static HTML)
convexforgets.com/privacy   → Astro (static HTML)
convexforgets.com/terms     → Astro (static HTML)
convexforgets.com/app/*     → Vite SPA (client-side)
```

Vercel build root: `site/`. The SPA builds separately and Vercel rewrites `/app/*` to its output.

### Tech Stack (site/)

- Astro 5 with `@astrojs/vercel` adapter (static output)
- `@astrojs/react` for interactive islands (HeroZoneDemo, AnimatedNumber)
- `@astrojs/mdx` for blog posts
- `@astrojs/sitemap` for auto-generated sitemap
- `@astrojs/rss` for RSS feed
- Tailwind CSS v4 (shared design tokens with SPA)
- framer-motion via React islands (`client:visible`)

### File Structure

```
site/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── public/
│   ├── robots.txt
│   ├── og-default.png
│   └── favicon.svg
└── src/
    ├── layouts/
    │   ├── Base.astro           # <head> SEO, global styles
    │   └── BlogPost.astro       # post layout with prose
    ├── components/
    │   ├── Header.astro
    │   ├── Footer.astro
    │   ├── SEOHead.astro        # canonical, OG, JSON-LD
    │   └── react/               # client:visible islands
    │       ├── HeroZoneDemo.tsx
    │       └── AnimatedNumber.tsx
    ├── pages/
    │   ├── index.astro          # landing page
    │   ├── privacy.astro
    │   ├── terms.astro
    │   ├── 404.astro
    │   ├── rss.xml.ts
    │   └── blog/
    │       ├── index.astro      # listing
    │       └── [...slug].astro  # post
    ├── content/
    │   ├── config.ts
    │   └── blog/
    │       └── *.mdx
    └── styles/
        └── global.css
```

## SEO Fixes (bundled)

| Fix | Implementation |
|-----|---------------|
| Prerendered HTML | Astro default — all pages are static HTML |
| `<link rel="canonical">` | In `SEOHead.astro`, per-page |
| `og:image` | Default 1200x630 branded card + per-post override |
| `twitter:card` `summary_large_image` | In `SEOHead.astro` |
| `sitemap.xml` | `@astrojs/sitemap` auto-generates |
| JSON-LD | `WebApplication` on landing, `BlogPosting` on posts |
| RSS feed | `@astrojs/rss` at `/rss.xml` |
| Proper 404 | `404.astro` → Vercel serves with HTTP 404 |
| www → apex redirect | Vercel domain settings |

## Blog Content Strategy

### Content model (frontmatter)

```yaml
title: string
description: string        # used for meta description + listing
publishedAt: date
updatedAt: date            # optional
tags: string[]
author: string
ogImage: string            # optional, falls back to default
draft: boolean
```

### Foundational cluster (launch with 6 posts)

| Post | Target keyword | Persona |
|------|---------------|---------|
| What is context engineering for LLMs? | "context engineering LLM" | General awareness |
| How I manage context for a TypeScript SaaS project | "LLM context management developer" | Developer |
| Context engineering for product managers | "AI for product managers" | PM |
| How game designers use structured context for world-building | "AI game design prompts" | Game designer |
| 5 context templates you can steal | "AI prompt templates examples" | All |
| From messy prompts to structured context | "organize AI prompts" | Visual walkthrough |

Post names are placeholders — final titles TBD.

Each persona guide walks through a real workflow: blocks created, zone organization, session structure. Screenshots from the app.

**Post-launch cadence:** 1-2 posts per month, AI-assisted drafts.

## Landing Page Migration

- Static content → Astro markup (zero JS)
- Interactive bits → React islands with `client:visible`:
  - `HeroZoneDemo` (drag-and-drop demo)
  - `AnimatedNumber` (token count animation)
- Scroll-triggered stagger animations: keep as React islands with framer-motion
- Hero fade-up: convert to CSS `@starting-style` or keep as thin framer-motion island
- Legal page footer links: change from GitHub URLs to `/privacy`, `/terms`

## Vercel Configuration

```json
{
  "buildCommand": "cd site && pnpm build",
  "outputDirectory": "site/dist",
  "rewrites": [
    { "source": "/app/:path*", "destination": "/app/index.html" }
  ],
  "redirects": [
    { "source": "/app", "destination": "/app/", "statusCode": 308 }
  ]
}
```

SPA build output placed at `site/public/app/` during build, or handled as a separate Vercel build with path routing.

## Implementation Phases

### Phase 1: Scaffold Astro (half day)
- `pnpm create astro` in `site/`
- Add integrations
- Configure Tailwind v4
- Create base layout with SEO head

### Phase 2: Port landing page (1 day)
- Convert index.tsx → index.astro
- Move interactive components as React islands
- Port header/nav and footer
- Verify view-source shows real HTML

### Phase 3: Blog infrastructure (half day)
- Content collection schema
- Blog listing + post pages
- Blog layout (prose, TOC, prev/next, tags)
- RSS feed

### Phase 4: Placeholder blog posts (half day)
- 6 MDX files with real frontmatter
- First 1-2 posts with real content

### Phase 5: SEO + Vercel config (half day)
- OG image
- sitemap, JSON-LD, canonical tags
- 404 page
- Update vercel.json
- Move legal pages from GitHub markdown to Astro routes
- www → apex redirect

### Phase 6: Verify (2 hours)
- `pnpm build` — all static HTML
- View source — real content
- Social card preview
- Lighthouse SEO ≥ 95
- `/app/*` still loads SPA
- 404 returns HTTP 404

**Total estimate:** 2-3 days
