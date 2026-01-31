# BUG-003: Test Connection Requires Save First (Should Be Reversed)

## Overview

The "Test Connection" button in settings only works after saving, but it should test BEFORE saving so users can verify their configuration works before committing it.

## Symptoms

1. User enters new Ollama URL or OpenRouter API key
2. User clicks "Test Connection"
3. Test fails or uses old saved values
4. User must save first, then test
5. If test fails after save, they've already saved bad config

## Expected Behavior

1. User enters new configuration values
2. User clicks "Test Connection"
3. Test uses the CURRENT FORM VALUES (not saved values)
4. If test passes, user saves with confidence
5. If test fails, user can fix before saving

## Current Behavior

The test connection likely reads from:
- Saved localStorage values, OR
- Database/persisted settings

Instead of reading from the current form state.

## Root Cause (To Investigate)

Need to check settings page to see:
1. Where test connection reads its values from
2. How form state is managed
3. Whether test function accepts parameters or reads from storage

Likely locations:
- `src/routes/settings.tsx`
- Settings-related hooks or API calls

## Proposed Fix

Pass current form values to test function instead of reading from storage:

```typescript
// Before (likely current behavior)
const handleTestConnection = async () => {
  const savedUrl = localStorage.getItem('ollama-url')
  const result = await testOllama(savedUrl)
}

// After (correct behavior)
const handleTestConnection = async () => {
  // Use current form value, not saved value
  const result = await testOllama(ollamaUrlInput)
}
```

## Testing Checklist

- [ ] Enter new Ollama URL without saving
- [ ] Click Test Connection
- [ ] Test should use the entered URL (not saved one)
- [ ] Same for OpenRouter API key
- [ ] After successful test, save works
- [ ] After failed test, user can modify and re-test without saving

## Related

- Bug Report Item 14: "Strange system that you first need to save, then test connection"
- BUG-002: Brainstorm input blocked (related settings/provider issues)

## Priority

Medium - Confusing UX, but workaround exists (save first)

## Status

Not yet fixed - needs investigation of settings page
