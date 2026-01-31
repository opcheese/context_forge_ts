# TASK-011: Interface Design Enhancement

## Overview

Apply intentional interface design principles to evolve ContextForge from a generic dashboard into a distinctive, craft-forward product with clear visual identity.

## Design Reference

Methodology: Intent-First Framework (interface-design skill)

---

## Intent-First Analysis

### Who is this person?

**Context architect** — someone managing complexity in AI conversations:
- Power users comfortable with technical tools
- Working with structured information (rules, lore, context blocks)
- Needs to see relationships and flow between context pieces
- Values efficiency over decoration
- May work in long sessions (hours of context building)

### What must they accomplish?

- **Orchestrate** context blocks across stability zones
- **Compress** information without losing meaning
- **Track** token budgets to stay within limits
- **Brainstorm** with AI using curated context
- **Refine** content iteratively through editing

### What should this feel like?

**A control room, not a notepad.**

Specific qualities:
- **Structured** — clear hierarchy, everything in its place
- **Responsive** — immediate feedback on every action
- **Dense but legible** — information-rich without overwhelm
- **Precise** — feels technical/professional, not playful
- **Calm** — can work for hours without visual fatigue

---

## Product Domain Exploration

### Domain Vocabulary

5+ concepts from ContextForge's world:

| Concept | Visual Implication |
|---------|-------------------|
| **Zones** | Tiered stability (permanent → stable → working) |
| **Tokens** | Countable units, budgets, meters |
| **Compression** | Density, compaction, reduction |
| **Context Window** | Bounded space, viewport into larger data |
| **Blocks** | Discrete units, stackable, movable |
| **Forge** | Crafting, shaping, heat/transformation |

### Color World

Colors naturally existing in this domain (not generic temperature labels):

| Color | Source | Potential Use |
|-------|--------|---------------|
| **Slate/Graphite** | Foundry materials, control rooms | Primary surfaces |
| **Amber/Gold** | Heat indicators, warning states, "forge" glow | Accents, warnings |
| **Steel Blue** | Technical precision, data screens | Information displays |
| **Patina Green** | Aged metal, stability | Permanent zone accent |
| **Iron Red** | Hot metal, urgency | Destructive actions, over-budget |
| **Silver/Chrome** | Polished tools | Interactive elements |

### Signature Element

**One unique visual/structural element for ContextForge:**

**Token Pressure Visualization** — The three zones should feel like pressure vessels:
- Visual "weight" indicator showing how full each zone is
- Zones that are near capacity feel visually "strained"
- Empty zones feel spacious and inviting
- This makes the token budget tangible, not just a number

Implementation ideas:
- Subtle background gradient that intensifies near capacity
- Border/glow that shifts color as tokens approach limit
- Zone header that visually "compresses" when full

### Defaults to Reject

| Default | Why Problematic | Alternative |
|---------|----------------|-------------|
| **White cards on gray** | Generic dashboard look | Subtle layering with near-identical surfaces |
| **Rounded-lg everywhere** | Friendly/casual feel | Sharper corners (technical precision) |
| **Centered modal dialogs** | Feels like interruption | Slide-out panels or inline expansion |
| **Standard form inputs** | Native browser feel | Custom-styled controls matching system |
| **Colorful block badges** | Too playful, overwhelming | Monochromatic icons with subtle type indicators |

---

## Current State Analysis

### What's Working

1. **Three-zone architecture** — strong mental model, good information architecture
2. **Token budget display** — functional and important
3. **Dark mode support** — well-implemented with OKLCH
4. **Compact toolbar** — efficient use of space
5. **Provider status indicators** — clear feedback

### What's Generic

1. **Button styles** — standard Tailwind CVA, no brand feel
2. **Card surfaces** — white on gray, no depth hierarchy
3. **Typography** — no defined scale, arbitrary sizes
4. **Block type badges** — 12 pastel colors are visually noisy
5. **Modals** — center overlay is standard but disruptive
6. **Spacing** — inconsistent (p-2, p-3, p-4, p-6 mixed)

### Inconsistencies Found

- Padding: mixes `p-2`, `p-3`, `p-4`, `p-6` without hierarchy
- Font sizes: custom `text-[10px]` alongside standard sizes
- Button heights: `h-6`, `h-7`, `h-8`, `h-9` without system
- Shadows: minimal but inconsistent application
- Border radius: varies between components

---

## Design System Specification

### Depth Strategy: **Borders Only**

No shadows for elevation. Use border opacity and background tint for layering.

```css
/* Surface hierarchy */
--surface-0: oklch(0.98 0.005 250);   /* Page background */
--surface-1: oklch(0.96 0.005 250);   /* Cards, panels */
--surface-2: oklch(0.94 0.005 250);   /* Elevated (hover, active) */
--surface-3: oklch(0.92 0.005 250);   /* Highest elevation */

/* Dark mode */
--surface-0-dark: oklch(0.12 0.01 250);
--surface-1-dark: oklch(0.16 0.01 250);
--surface-2-dark: oklch(0.20 0.01 250);
--surface-3-dark: oklch(0.24 0.01 250);
```

### Spacing Scale: **4px Base**

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
```

Usage:
- `space-1`: Tight internal (badge padding)
- `space-2`: Default gaps between inline elements
- `space-3`: Card internal padding
- `space-4`: Section spacing
- `space-6`: Container padding
- `space-8+`: Page-level spacing

### Typography Scale

```css
/* Size scale */
--text-xs: 0.6875rem;    /* 11px - badges, meta */
--text-sm: 0.8125rem;    /* 13px - body, labels */
--text-base: 0.9375rem;  /* 15px - primary content */
--text-lg: 1.125rem;     /* 18px - section headers */
--text-xl: 1.375rem;     /* 22px - page titles */

/* Weight usage */
Regular (400): Body text, descriptions
Medium (500): Labels, important text
Semibold (600): Headings, emphasis
```

### Border Radius: **Sharp-Medium**

```css
--radius-sm: 4px;   /* Inputs, small buttons */
--radius-md: 6px;   /* Cards, panels */
--radius-lg: 8px;   /* Modals, large containers */
--radius-full: 9999px; /* Pills, badges */
```

Technical feel — sharper than default Tailwind.

### Color System

#### Brand Colors

```css
/* Primary: Steel Blue (precision, technical) */
--brand-primary: oklch(0.55 0.12 250);
--brand-primary-hover: oklch(0.50 0.14 250);

/* Accent: Amber (forge, warmth) */
--brand-accent: oklch(0.75 0.15 70);
--brand-accent-muted: oklch(0.85 0.08 70);

/* Success: Patina Green */
--semantic-success: oklch(0.65 0.15 150);

/* Warning: Amber */
--semantic-warning: oklch(0.75 0.15 70);

/* Error: Iron Red */
--semantic-error: oklch(0.55 0.2 25);
```

#### Zone Colors (Subtle, Not Overwhelming)

```css
/* Zone accents - very subtle tints */
--zone-permanent: oklch(0.65 0.08 150);  /* Patina green */
--zone-stable: oklch(0.60 0.10 250);     /* Steel blue */
--zone-working: oklch(0.70 0.12 70);     /* Amber */

/* Applied as very subtle border/header accents, not backgrounds */
```

#### Block Type Indicators (Monochromatic)

Replace 12 pastel colors with icon-based system:
- Each block type has a distinct icon (already using Lucide)
- Use single accent color for "active" state
- Type shown via icon + label, not background color

---

## Implementation Phases

### Phase 1: Design Tokens & Foundation

**Goal:** Establish consistent design tokens.

#### 1.1 Create System File

Create `.interface-design/system.md` with design decisions.

#### 1.2 Update CSS Variables

Update `src/index.css`:
- Add surface hierarchy variables
- Add spacing scale
- Add typography scale
- Add brand colors
- Add zone accent colors

#### 1.3 Create Tailwind Plugin/Config

Extend Tailwind config with:
- Custom spacing scale mapping
- Custom color tokens
- Custom radius values

**Files:**
- [ ] `.interface-design/system.md` - NEW
- [ ] `src/index.css` - Update tokens
- [ ] `tailwind.config.ts` - Extend theme

---

### Phase 2: Surface & Depth

**Goal:** Implement subtle layering.

#### 2.1 Surface Hierarchy

Replace white-on-gray with subtle surface tints:
- Page background: `surface-0`
- Zone columns: `surface-1`
- Block cards: `surface-2`
- Hover/active: `surface-3`

#### 2.2 Remove Shadows

Replace any `shadow-*` with border-based depth:
- Light borders for elevation
- No dramatic jumps

**Files:**
- [ ] `src/components/Block/BlockCard.tsx`
- [ ] `src/components/Layout/ZoneColumn.tsx`
- [ ] `src/components/ui/button.tsx`

---

### Phase 3: Typography Consistency

**Goal:** Apply typography scale throughout.

#### 3.1 Eliminate Custom Sizes

Replace `text-[10px]` and other custom sizes with scale values.

#### 3.2 Establish Hierarchy

- Page titles: `text-xl font-semibold`
- Section headers: `text-lg font-medium`
- Body: `text-sm`
- Meta/badges: `text-xs`

**Files:**
- [ ] All components using `text-[*px]`
- [ ] `src/components/Block/BlockTypeIcon.tsx`
- [ ] `src/components/Block/BlockHeader.tsx`

---

### Phase 4: Spacing Normalization

**Goal:** Consistent spacing using scale.

#### 4.1 Audit Padding

Replace arbitrary padding with scale:
- `p-2` → `p-2` (keep, equals space-2)
- `p-3` → `p-3` (keep, equals space-3)
- `p-4` → `p-4` (keep, equals space-4)
- `p-6` → `p-6` (keep, equals space-6)

Remove odd combinations like `px-8 py-4` → use `p-6` or `p-4` consistently.

#### 4.2 Standardize Gaps

Use `gap-*` consistently instead of `space-y-*` for flex containers.

**Files:**
- [ ] `src/routes/__root.tsx`
- [ ] `src/routes/index.tsx`
- [ ] Various component files

---

### Phase 5: Block Type Redesign

**Goal:** Reduce visual noise from 12 colors.

#### 5.1 Icon-Primary System

Block types shown via:
- Distinct icon (already exists)
- Type label on hover/detail view
- Single muted background (no per-type colors)

#### 5.2 Optional: Subtle Type Indicator

If color needed, use single-hue variant:
- All types use same hue (steel blue)
- Different saturation/lightness for grouping

**Files:**
- [ ] `src/constants/blockTypes.ts`
- [ ] `src/components/Block/BlockTypeIcon.tsx`
- [ ] `src/components/Block/BlockCard.tsx`

---

### Phase 6: Zone Visual Identity

**Goal:** Implement "pressure vessel" signature.

#### 6.1 Zone Header Enhancement

- Add subtle zone accent color to header border
- Show token usage as visual indicator (not just number)
- Visual "strain" as zone approaches capacity

#### 6.2 Zone Background Gradient

Subtle gradient in zone column:
- Empty: neutral
- Near capacity: slight tint shift toward warning

**Files:**
- [ ] `src/components/Layout/ZoneColumn.tsx`
- [ ] `src/routes/index.tsx`

---

### Phase 7: Interactive States

**Goal:** Consistent hover/focus/active states.

#### 7.1 Define State System

```css
/* Interactive element states */
:hover { background: surface-2; }
:active { background: surface-3; }
:focus-visible { outline: 2px solid brand-primary; }
:disabled { opacity: 0.5; cursor: not-allowed; }
```

#### 7.2 Apply to All Interactive Elements

- Buttons
- Block cards
- Zone headers
- Navigation links

**Files:**
- [ ] `src/components/ui/button.tsx`
- [ ] `src/components/Block/BlockCard.tsx`
- [ ] Navigation components

---

### Phase 8: Animation & Transitions

**Goal:** Subtle, fast micro-interactions.

#### 8.1 Define Transition Tokens

```css
--transition-fast: 100ms ease-out;
--transition-normal: 150ms ease-out;
--transition-slow: 250ms ease-out;
```

#### 8.2 Apply Transitions

- Hover states: `transition-fast`
- Dialogs/panels: `transition-normal`
- Page transitions: `transition-slow`

**Files:**
- [ ] `src/index.css` - Add transition tokens
- [ ] Various components - Apply transitions

---

## File Checklist

### New Files
- [ ] `.interface-design/system.md` - Design system documentation
- [ ] `src/styles/tokens.css` - Design tokens (optional, can be in index.css)

### Files to Modify
- [ ] `src/index.css` - Design tokens
- [ ] `tailwind.config.ts` - Theme extension
- [ ] `src/components/ui/button.tsx` - States, radius
- [ ] `src/components/Block/BlockCard.tsx` - Surfaces, typography, states
- [ ] `src/components/Block/BlockHeader.tsx` - Typography
- [ ] `src/components/Block/BlockTypeIcon.tsx` - Icon-primary system
- [ ] `src/components/Layout/ZoneColumn.tsx` - Zone identity, surfaces
- [ ] `src/constants/blockTypes.ts` - Simplify colors
- [ ] `src/routes/__root.tsx` - Spacing
- [ ] `src/routes/index.tsx` - Spacing, zone styling

---

## Testing Checklist (Mandate Checks)

### Swap Test
- [ ] Replacing typeface with default feels different
- [ ] Replacing colors with Tailwind defaults feels different
- [ ] Layout without custom tokens loses identity

### Squint Test
- [ ] Blur eyes — hierarchy visible without harsh contrast
- [ ] Zone boundaries distinguishable
- [ ] Block cards scannable

### Signature Test
Locate 5 elements showing ContextForge identity:
- [ ] Zone pressure visualization
- [ ] Token budget indicators
- [ ] Block type icon system
- [ ] Steel blue + amber color palette
- [ ] Sharp-medium radius (technical feel)

### Token Test
- [ ] CSS variables sound product-specific (`--zone-permanent`, `--surface-*`)
- [ ] Not generic (`--gray-100`, `--blue-500`)

---

## Out of Scope

- Logo/branding design
- Marketing pages
- Mobile-specific layouts
- Animation library integration (Framer Motion, etc.)
- Component library extraction (Storybook)

---

## Priority

Medium — Enhances perceived quality without blocking functionality

## Related

- TASK-004: Block editor improvements (may conflict with typography changes)
- Current shadcn/ui integration

## Notes

- Apply changes incrementally to avoid breaking existing functionality
- Test dark mode after each phase
- Consider creating before/after screenshots for comparison
- May want to create a `/design-preview` route for testing changes in isolation
