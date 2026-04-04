# Review of new-functions branch — notes for Anna

Hi Anna,

We reviewed your `new-functions` branch and used it as a source of improvements. Rather than merging directly (the branches had diverged and would have conflicted in several places), we cherry-picked the ideas and implemented them from scratch in our codebase. This doc explains what we took, what we skipped, and why.

---

## What we built from your work

### Memory injection for Ollama and OpenRouter

This was the biggest gap. Your commit `877a395` added memory injection for these providers. We had the same missing piece — our implementation injected memory server-side for Claude but the Ollama and OpenRouter paths (which stream client-side) skipped it entirely.

We created `src/lib/llm/memoryRendering.ts` as a frontend mirror of the existing `convex/lib/memoryRendering.ts`, then wired it into `useBrainstorm.ts` so both providers now receive project memory in their system prompt. Same tag scoring and pinned-entry logic.

### Auth UX

Your commit `674c3f3` improved the auth form significantly. We implemented the same ideas:
- Per-field error display (under email and password, not just a generic banner)
- `mapAuthError()` to translate Convex error codes to human-readable messages
- Eye/EyeOff password visibility toggle

### Validate button improvements

Your `6497de2` added a `criteria` block type. We already had validation infrastructure (a different approach — any block can be marked as "Criteria" via a context mode selector), so we didn't take the new block type. But two specific UX ideas from your commit were good:
- Gate the Validate button on whether any criteria blocks exist (instead of always showing it)
- Allow the button to fire with empty input and supply a default prompt

Both are now in.

### Bug fixes

- **contentHash propagation** (`5419ebc`): Your fix matched a gap we also had. Blocks created via brainstorm save, template application, and workflow step advancement were missing `contentHash`, so the "Link?" duplicate detection feature silently didn't work for them. Fixed across all six creation paths.

- **Suppress Link? for template-sourced blocks** (`3b374ab`): Good catch. We added a `sourceTemplateId` field to the blocks schema and use it to skip `findDuplicate` matches between blocks that came from the same template — they're identical by design, not user-created duplicates.

- **cascadeDeleteSessions 16MB limit**: We found this independently during our analysis. The function was doing three full-table `.collect()` calls; rewrote it to query per-session using the existing `by_session` indexes.

- **Security fix in findDuplicate**: We also noticed `findDuplicate` returned results from any user's sessions, not just the current user's. Added ownership check.

---

## What we didn't take and why

### `criteria` block type

Your approach: dedicated `criteria` block type with orange metadata.  
Our approach: `contextMode: "validation"` field — any existing block can be marked as criteria via a dropdown in the block header.

Our approach is more flexible (you can mark a `guideline` or `note` as criteria without creating a new block), so we kept it. The Validate button now correctly gates on whether any blocks have `contextMode === "validation"`.

### Entry questions for workflow steps

Interesting feature (`16a2be0`), but it's a new workflow UX pattern that needs its own design pass. Leaving it for a separate discussion.

### Resolve→ button (tension → decision)

Same — new memory workflow feature, needs separate discussion.

### Convex version bump

We'll handle dependency updates separately when we're ready to test for breaking changes.

---

## What's different architecturally

One thing worth noting: your branch's validation implementation used a `validate: boolean` flag name; ours uses `isValidation`. Both do the same thing. Since we implemented from scratch we kept our naming to stay consistent with the existing codebase.

---

## Would love a PR

The remaining commits in your branch — entry questions, the Resolve→ button, and the memory lifecycle UX improvements — would make great PRs against our `main`. Happy to review. The branches are now close enough that conflicts should be minimal for focused PRs.

Thanks for the solid work — the bug catches especially (contentHash paths, template-sourced duplicates) were things we would have hit eventually.
