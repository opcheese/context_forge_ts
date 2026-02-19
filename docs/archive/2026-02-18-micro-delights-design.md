# Micro Delights Design — Animation System for ContextForge

**Date:** 2026-02-18
**Status:** Approved
**Goal:** Add polished, professional micro-interactions across the entire app so every action brings joy without being overwhelming.

## Design Decisions

- **Tone:** Polished & professional (Linear/Notion territory, not playful)
- **Library:** Framer Motion (~30KB gzipped) — spring physics, AnimatePresence, layout animations
- **DnD constraint:** Never touch dnd-kit internals. Blocks get create/delete animations only — dnd-kit owns all drag/reorder transforms
- **Approach:** Animation design system with reusable motion primitives, applied progressively

## Motion Design System — Primitives

### Spring Presets

| Name | Stiffness | Damping | Use Case |
|------|-----------|---------|----------|
| `snappy` | 500 | 30 | Instant-feel: buttons, toggles, hover |
| `smooth` | 300 | 30 | Default: modals, panels, block enter/exit |
| `gentle` | 200 | 25 | Ambient: progress bars, token meters |

### Transition Patterns

| Pattern | Animation | Use Case |
|---------|-----------|----------|
| **Enter** | Fade in + scale 0.97→1.0 | Blocks appearing, toasts, modals |
| **Exit** | Fade out + scale 1.0→0.95 | Blocks removed, dialogs closing |
| **Emphasize** | Scale pulse 1.0→1.02→1.0 | Success confirmation (compression, save) |
| **Press** | Scale 1.0→0.98→1.0 | Button press/release feedback |

### Wrapper Components

| Component | Purpose |
|-----------|---------|
| `AnimatedList` | Staggered enter/exit for lists of items |
| `AnimatedPresence` | Drop-in wrapper for conditional rendering with enter/exit |
| `ScaleFeedback` | Press/hover scale on interactive elements |
| `AnimatedNumber` | Smooth number interpolation for counters |

## Application Map

### Block Lifecycle (NOT reorder)

- Block **created** — fades in + scales from 0.97 with `smooth` spring
- Block **deleted** — fades out + scales to 0.95 via AnimatePresence exit
- Block **compressed** — brief `emphasize` pulse after compression completes
- **No changes to SortableBlock transforms or dnd-kit overlay**

### Dialogs & Panels

- All modals (Brainstorm, SaveTemplate, ImportSkill, Confirm) — fade + scale from 0.97 on open, reverse on close
- Backdrop — fade opacity 0→1
- AddBlockForm expand/collapse — height animation with `smooth` spring

### Toasts

- Enter: spring-based slide from right + fade (replaces current CSS slide)
- Exit: fade + slide out

### Token & Zone Feedback

- Zone budget bars — animated width with `gentle` spring (values flow instead of jumping)
- Compression ratio badge — count-up animation on the number
- Token count in AddBlockForm — smooth number transition as user types

### Buttons & Interactive Elements

- Submit/action buttons — scale down to 0.98 on press, back to 1.0 on release
- Icon buttons on hover — scale up to 1.05 with `snappy` spring

### AI / Brainstorm

- Streaming indicator — pulsing dot cursor
- Generation complete — soft `emphasize` pulse on final message
- Provider health dots — smooth color transition instead of instant swap

### Page-Level

- Route transitions — fade with 150ms duration (fast, professional)

## File Structure

```
src/lib/motion.ts                    — spring presets, transition configs, shared constants
src/components/ui/animated/
  AnimatedList.tsx                    — staggered list with enter/exit
  AnimatedPresence.tsx               — thin wrapper with default transitions
  ScaleFeedback.tsx                  — press/hover scale on interactive elements
  AnimatedNumber.tsx                 — smooth number interpolation
```

- `motion.ts` + 4 wrapper components (~200 lines total)
- Touch ~10-12 existing files with small wrapping changes
- Zero changes to any dnd-kit code, hooks, or overlay components

## Implementation Priority

1. **Motion primitives + wrapper components** — foundation
2. **Dialogs & modals** — immediately visible polish, low risk
3. **Toasts** — small change, big feel improvement
4. **Block create/delete animations** — core workflow delight (careful around DnD)
5. **Buttons & hover feedback** — ScaleFeedback on key actions
6. **Token/zone number animations** — AnimatedNumber on budget bars
7. **AI streaming polish** — cursor, completion pulse
8. **Page transitions** — route-level fade (lowest priority)

## Research Sources

- [UI Trends 2026 — UX Studio](https://www.uxstudioteam.com/ux-blog/ui-trends-2019)
- [Micro-interaction Examples — Userpilot](https://userpilot.com/blog/micro-interaction-examples/)
- [Micro-interaction Patterns — Vev](https://www.vev.design/blog/micro-interaction-examples/)
- [Microinteractions & react-rewards — Develobear](https://www.thedevelobear.com/post/microinteractions/)
- [Partycles — React particle animations](https://jonathanleane.github.io/partycles/)
