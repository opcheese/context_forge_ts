# Frontend Polish Ideas

Identified 2026-02-18 during design review. Ranked by impact.

## Status Key
- [ ] Not started
- [x] Done

## Tier 1 — High impact, low effort

### 1. Nav active indicator animation
- [x] Add a `motion.div` underline that slides between nav items (like Linear's nav)
- Currently: NavLink just toggles `font-medium` on active
- Target: animated underline using `layoutId` that smoothly moves between items

### 2. Theme toggle animation
- [ ] Rotate+scale transition on Sun/Moon icon swap (like GitHub's toggle)
- Currently: instant icon swap

### 3. Empty state illustrations
- [ ] "No Session Selected", "No projects yet", "No templates yet", "No workflows yet" — all plain text
- Add geometric/icon illustrations using the Anvil motif
- These are high-frequency screens users see often

### 4. Auth loading state
- [ ] `LoadingLayout` shows "Loading..." twice
- Replace with centered Anvil icon with gentle pulse — feels branded

## Tier 2 — Medium impact

### 5. Focus-visible rings
- [ ] No custom focus styles beyond global `outline-ring/50`
- Add visible, branded focus rings for keyboard navigation (accessibility + polish)

### 6. "Drop here" zone empty state
- [ ] Currently bare dashed border with text
- Add subtle icon (plus or arrow-down) with reduced opacity to invite action

### 7. Block card hover elevation
- [ ] Currently `hover:shadow-sm hover:border-border/80`
- Add subtle `translateY(-1px)` lift on hover for depth

### 8. Staggered page transitions
- [ ] Route changes are instant (except initial opacity fade)
- Add content slide-up on route change

## Tier 3 — Nice to have

### 9. Replace raw select dropdowns
- [ ] Block type/zone pickers use raw `<select>` elements
- Replace with shadcn Select or Popover for visual consistency

### 10. Login page atmosphere
- [ ] Currently plain white/dark background
- Add subtle gradient mesh or noise texture for premium first impression

### 11. Toast icon differentiation
- [ ] Success/error toasts could have colored icons (checkmark/x) for faster scanning
