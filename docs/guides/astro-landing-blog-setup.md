# Adding an Astro Landing Page & Blog to an Existing Vite App

A guide for replicating the ContextForge pattern: a static Astro marketing site with blog, coexisting with a Vite SPA (React frontend + Python backend).

## Why Astro

| Concern | Astro | Vite SPA alone |
|---|---|---|
| SEO | Full static HTML, crawlable by default | Requires SSR or prerendering hacks |
| Blog/content | Built-in content collections, MDX, RSS | Roll your own or bolt on a CMS |
| Performance | Zero JS by default, islands for interactivity | Ships full React bundle on every page |
| Coexistence | Serves static pages alongside the SPA | N/A |

**Decision:** Astro owns the marketing site (`/`, `/blog/`, `/privacy/`, etc.). The Vite SPA owns the app (`/app/**`). They are built independently and composed at deploy time.

## Architecture Overview

```
project-root/
├── site/                    # Astro project (landing + blog)
│   ├── astro.config.mjs
│   ├── package.json
│   ├── src/
│   │   ├── pages/           # File-based routing
│   │   ├── layouts/         # HTML shells
│   │   ├── components/      # .astro (static) + react/ (islands)
│   │   ├── content/         # Blog posts (MDX)
│   │   ├── content.config.ts
│   │   ├── styles/
│   │   └── lib/             # Shared utilities (animation presets, etc.)
│   └── public/              # Static assets + pre-built SPA
│       ├── app/             # ← Vite SPA build output copied here
│       └── og-default.png
├── src/                     # Vite SPA (your existing app)
├── vite.config.ts
└── package.json
```

The SPA is built separately (`vite build`), then its `dist/` output is copied into `site/public/app/`. Astro treats `public/` as pass-through static files — no processing, just served as-is.

## Step-by-Step Setup

### 1. Create the Astro project

```bash
cd project-root
mkdir site && cd site
pnpm init
pnpm add astro @astrojs/react @astrojs/mdx @astrojs/sitemap @astrojs/rss
pnpm add react react-dom
pnpm add tailwindcss @tailwindcss/vite @tailwindcss/typography
pnpm add -D @types/react @types/react-dom typescript
```

### 2. Configure Astro

**`site/astro.config.mjs`:**

```js
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import mdx from "@astrojs/mdx"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  site: "https://your-domain.com",
  output: "static",
  trailingSlash: "always",
  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => !page.includes("/app/"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
```

Key choices:
- **`output: "static"`** — pure SSG, no server needed.
- **`trailingSlash: "always"`** — consistent URLs for SEO.
- **Sitemap excludes `/app/`** — the SPA shouldn't be crawled.
- **Tailwind v4 as Vite plugin** — no PostCSS config needed.

**`site/tsconfig.json`:**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

### 3. Set up Tailwind v4

**`site/src/styles/global.css`:**

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --font-sans: "Your Font", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.6 0.2 30);
  /* ... define your full palette */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.95 0 0);
  /* ... dark overrides */
}
```

This follows the shadcn/ui semantic token pattern — components reference `bg-background`, `text-foreground`, etc.

### 4. Create layouts

**`site/src/layouts/Base.astro`** — the HTML shell:

```astro
---
import "@/styles/global.css"
import SEOHead from "@/components/SEOHead.astro"
import Header from "@/components/Header.astro"
import Footer from "@/components/Footer.astro"

interface Props {
  title: string
  description: string
  ogImage?: string
  ogType?: string
}

const { title, description, ogImage, ogType } = Astro.props
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <SEOHead {title} {description} {ogImage} {ogType} />
    <!-- Dark mode init — prevents flash of wrong theme -->
    <script is:inline>
      if (localStorage.theme === "dark" ||
        (!("theme" in localStorage) && matchMedia("(prefers-color-scheme: dark)").matches)) {
        document.documentElement.classList.add("dark")
      }
    </script>
  </head>
  <body class="bg-background text-foreground">
    <Header />
    <slot />
    <Footer />
  </body>
</html>
```

**`site/src/layouts/BlogPost.astro`** — wraps individual posts:

```astro
---
import Base from "./Base.astro"
const { title, description, publishedAt, tags } = Astro.props
---
<Base title={title} description={description} ogType="article">
  <article class="max-w-3xl mx-auto px-4 py-16">
    <header class="mb-8">
      <h1 class="text-3xl font-bold">{title}</h1>
      <time class="text-muted-foreground text-sm">
        {publishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </time>
      <div class="flex gap-2 mt-2">
        {tags.map((tag) => (
          <span class="text-xs px-2 py-0.5 rounded-full bg-muted">{tag}</span>
        ))}
      </div>
    </header>
    <div class="prose prose-neutral dark:prose-invert max-w-none">
      <slot />
    </div>
  </article>
</Base>
```

### 5. Set up the blog content collection

**`site/src/content.config.ts`:**

```ts
import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

const blog = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string().default("Your Team"),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    ogImage: z.string().optional(),
  }),
})

export const collections = { blog }
```

This uses Astro v5's content layer API with the `glob()` loader.

### 6. Create blog pages

**`site/src/pages/blog/index.astro`** — listing page:

```astro
---
import { getCollection } from "astro:content"
import Base from "@/layouts/Base.astro"

const posts = (await getCollection("blog"))
  .filter((p) => !p.data.draft)
  .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())
---
<Base title="Blog" description="Latest posts">
  <div class="max-w-3xl mx-auto px-4 py-16">
    <h1 class="text-3xl font-bold mb-8">Blog</h1>
    {posts.map((post) => (
      <a href={`/blog/${post.id}/`} class="block mb-6 group">
        <h2 class="text-xl font-semibold group-hover:text-primary">{post.data.title}</h2>
        <p class="text-muted-foreground text-sm">{post.data.description}</p>
      </a>
    ))}
  </div>
</Base>
```

**`site/src/pages/blog/[...id].astro`** — individual posts:

```astro
---
import { getCollection, render } from "astro:content"
import BlogPost from "@/layouts/BlogPost.astro"

export async function getStaticPaths() {
  const posts = (await getCollection("blog")).filter((p) => !p.data.draft)
  return posts.map((post) => ({ params: { id: post.id }, props: { post } }))
}

const { post } = Astro.props
const { Content } = await render(post)
---
<BlogPost {...post.data}>
  <Content />
</BlogPost>
```

### 7. Add an RSS feed

**`site/src/pages/rss.xml.ts`:**

```ts
import rss from "@astrojs/rss"
import { getCollection } from "astro:content"

export async function GET(context) {
  const posts = (await getCollection("blog"))
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime())

  return rss({
    title: "Your Site",
    description: "Your description",
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: `/blog/${post.id}/`,
    })),
  })
}
```

### 8. Add React islands (interactive components)

React components go in `site/src/components/react/`. Use them in `.astro` files with client directives:

```astro
---
import HeroDemo from "@/components/react/HeroDemo.tsx"
import FeatureCards from "@/components/react/FeatureCards.tsx"
---
<!-- Hydrate immediately (above the fold) -->
<HeroDemo client:load />

<!-- Hydrate when scrolled into view (below the fold) -->
<FeatureCards client:visible />
```

| Directive | When it hydrates | Use for |
|---|---|---|
| `client:load` | Immediately on page load | Above-fold interactive content |
| `client:visible` | When element enters viewport | Below-fold sections |
| `client:idle` | When browser is idle | Non-critical interactivity |
| (none) | Never — static HTML only | Content that doesn't need JS |

For scroll animations with framer-motion, create a shared presets file:

**`site/src/lib/motion.ts`:**

```ts
export const springs = {
  snappy: { type: "spring" as const, stiffness: 500, damping: 30 },
  smooth: { type: "spring" as const, stiffness: 300, damping: 30 },
  gentle: { type: "spring" as const, stiffness: 200, damping: 25 },
}

export const sectionStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

export const sectionStaggerItem = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: springs.smooth },
}
```

Use in components:

```tsx
<motion.div
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true, margin: "-80px" }}
  variants={sectionStagger}
>
  <motion.h2 variants={sectionStaggerItem}>...</motion.h2>
  <motion.div variants={sectionStaggerItem}>...</motion.div>
</motion.div>
```

### 9. SEO component

**`site/src/components/SEOHead.astro`:**

```astro
---
const { title, description, ogImage = "/og-default.png", ogType = "website" } = Astro.props
const canonicalURL = new URL(Astro.url.pathname, Astro.site)
---
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonicalURL} />
<meta property="og:type" content={ogType} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonicalURL} />
<meta property="og:image" content={new URL(ogImage, Astro.site)} />
<meta name="twitter:card" content="summary_large_image" />
<link rel="alternate" type="application/rss+xml" title="RSS" href="/rss.xml" />
```

### 10. SPA coexistence

The key insight: **Astro and the Vite SPA are built separately and composed via the filesystem.**

1. Build the SPA: `cd project-root && pnpm build` → outputs to `dist/`
2. Copy SPA into Astro's public dir: `cp -r dist/* site/public/app/`
3. Build Astro: `cd site && pnpm build` → outputs to `dist/`
4. Deploy `site/dist/` — it contains both the static pages and the SPA

For the SPA's client-side routing to work, your hosting must fall back `/app/**` requests to `/app/index.html`. How to configure this depends on your hosting:

- **Nginx:** `try_files $uri $uri/ /app/index.html;` inside a `location /app/` block
- **Caddy:** `try_files {path} /app/index.html` in a `handle_path /app/*` block
- **`serve` (local/self-hosted):** add `site/public/serve.json`:

```json
{
  "rewrites": [
    { "source": "/app/**", "destination": "/app/index.html" }
  ]
}
```

Other routing considerations:
- `robots.txt` should disallow `/app/`
- Sitemap filter excludes `/app/` pages (configured in `astro.config.mjs`)
- Landing page CTAs link to `/app/` for sign-in / get-started

### 11. Adding a blog post

Create an MDX file in `site/src/content/blog/`:

```mdx
---
title: "Your Post Title"
description: "A short summary for SEO and listing pages."
publishedAt: 2026-02-21
tags: ["topic-a", "topic-b"]
draft: false
---

Your content here. MDX supports:

- Standard markdown
- {expressions} and JSX components
- Import and use React components inline
```

Set `draft: true` while writing — drafts are filtered from the listing, RSS, and static paths.

## Build Script (for CI or manual builds)

```bash
#!/bin/bash
# Build the SPA
pnpm build              # → dist/

# Copy SPA into Astro's public dir
rm -rf site/public/app
mkdir -p site/public/app
cp -r dist/* site/public/app/

# Build Astro
cd site && pnpm build   # → site/dist/

# site/dist/ is your deploy artifact
```

## Summary of Technologies

| Layer | Technology | Version |
|---|---|---|
| Static site generator | Astro | 5.x |
| Content format | MDX | via @astrojs/mdx |
| Interactive islands | React | 19.x |
| Styling | Tailwind CSS | 4.x (Vite plugin) |
| Animation | framer-motion | 12.x |
| SEO | @astrojs/sitemap + custom SEOHead | — |
| RSS | @astrojs/rss | — |
| Color system | shadcn/ui semantic tokens (oklch) | — |
| Dark mode | Class-based (.dark) with localStorage | — |
| SPA | Vite + React (existing app) | — |
| Backend | Python (existing) | — |
