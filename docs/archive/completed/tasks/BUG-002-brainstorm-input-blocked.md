# BUG-002: Brainstorm Input Blocked Until Provider Switch

## Overview

The brainstorm input field is disabled on initial page load and only becomes enabled after the user manually switches the LLM provider at least once.

## Symptoms

- User opens brainstorm panel
- Input field is disabled (can't type)
- User switches provider from Claude to Ollama (or any other)
- Input becomes enabled
- Switching back to Claude also works now

## Root Cause

**Race condition between provider initialization and health check:**

1. Provider state is hardcoded to `"claude"` on initial load (useBrainstorm.ts:79)
2. Claude health starts with `{ ok: false, disabled: true }` (BrainstormPanel.tsx:19-23)
3. Input is disabled when `!isProviderAvailable` (BrainstormDialog.tsx:482)
4. For Claude: `isProviderAvailable = claude.ok && !claude.disabled` = `false && !true` = **false**
5. Health check only runs after feature flags load (async)
6. Input stays disabled until health check completes OR user switches provider

**Why switching "fixes" it:**

For Ollama/OpenRouter, the code uses `?? true` fallback:
```typescript
provider === "ollama" ? providerHealth?.ollama?.ok ?? true : ...
```
When `ollama.ok` is `null` (before health check), it defaults to `true`, enabling input.

## Affected Files

| File | Line | Issue |
|------|------|-------|
| `src/hooks/useBrainstorm.ts` | 79 | `useState<Provider>("claude")` - hardcoded default |
| `src/components/BrainstormPanel.tsx` | 19-23 | Claude initialized with `disabled: true` |
| `src/components/BrainstormDialog.tsx` | 351-356 | `isProviderAvailable` logic |
| `src/components/BrainstormDialog.tsx` | 482 | Input `disabled={... \|\| !isProviderAvailable}` |

## Timeline of Bug

```
Time   Event                              Input State
─────  ─────                              ───────────
0ms    Initial render, provider="claude"  DISABLED (claude.disabled=true)
5ms    User opens brainstorm              DISABLED
100ms  Feature flags loading...           DISABLED
200ms  Features loaded, health check runs DISABLED (still checking)
300ms  Health check completes             ENABLED (too late, user frustrated)

Alternative flow:
200ms  User switches to "ollama"          ENABLED (fallback ?? true)
```

## Proposed Fixes

### Option A: Smart Default Provider (Recommended)

Initialize provider based on what's actually available:

```typescript
// In useBrainstorm.ts or BrainstormPanel.tsx
const getDefaultProvider = (health: ProviderHealth, features: Features): Provider => {
  // If Ollama is configured and healthy, use it
  if (health.ollama?.ok) return "ollama"

  // If OpenRouter has API key, use it
  if (health.openrouter?.ok) return "openrouter"

  // If Claude is enabled (feature flag), use it
  if (features?.claudeCodeEnabled && !health.claude?.disabled) return "claude"

  // Fallback to ollama (most common local setup)
  return "ollama"
}
```

### Option B: Optimistic Input Enable

Allow input while health checks are pending, show error on send if provider unavailable:

```typescript
// In BrainstormDialog.tsx
const isProviderAvailable =
  providerHealth === null || // Still loading - be optimistic
  (provider === "ollama" ? providerHealth?.ollama?.ok ?? true :
   provider === "openrouter" ? providerHealth?.openrouter?.ok ?? true :
   (providerHealth?.claude?.ok && !providerHealth?.claude?.disabled) ?? true)
```

### Option C: Loading State

Show "Checking providers..." instead of disabled input:

```typescript
if (healthCheckPending) {
  return <div>Checking available providers...</div>
}
```

### Option D: Fix Fallback Logic

Make Claude fallback consistent with others:

```typescript
const isProviderAvailable =
  provider === "ollama" ? (providerHealth?.ollama?.ok ?? true) :
  provider === "openrouter" ? (providerHealth?.openrouter?.ok ?? true) :
  // Fix: Also use ?? true for Claude when health is still loading
  providerHealth?.claude === undefined ? true :
  (providerHealth.claude.ok && !providerHealth.claude.disabled)
```

## Recommendation

Combine **Option A + Option B**:

1. Smart default: Pick first available provider on load
2. Optimistic enable: Allow typing while health checks run
3. Graceful error: If send fails due to unavailable provider, show helpful error

## Testing Checklist

- [ ] Fresh page load - input is enabled immediately
- [ ] No providers configured - shows helpful message
- [ ] Ollama running - auto-selects Ollama
- [ ] Only OpenRouter configured - auto-selects OpenRouter
- [ ] Claude feature enabled - Claude available after health check
- [ ] Switching providers still works
- [ ] Error message if selected provider becomes unavailable

## Related

- Bug Report Item 13: "Brainstorm message input wasn't available until I successfully connected Ollama"
- Item 14: "Strange system that you first need to save, then test connection" (related UX)

## Priority

High - This blocks the primary feature (brainstorming) on first use

## Status

Not yet fixed - needs implementation
