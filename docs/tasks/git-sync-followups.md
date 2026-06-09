# Git Sync — Follow-up Tasks

Follow-ups identified during post-merge analysis of the Git Sync feature (PR #6, "Feat/git export", merged into `main` as `19adb5d`). The feature is functional and ships with passing types and unit tests; these items harden it. None block deployment.

## Authorization checks on sync mutations

**Priority: high (security).** Four mutations in `convex/syncMappings.ts` write or delete without verifying the caller owns the underlying sync mapping:

- `upsertSyncBlock`
- `removeSyncBlock`
- `setRejectedContent`
- `clearRejectedContent`

The read queries (`getSyncMapping`, `getSyncMappingBySession`) already scope by `getAuthUserId`, and the content-write path (`blocks.update`) enforces `requireSessionAccess`, so the actual blast radius is limited to sync *metadata* (the `syncBlocks` table). Still, in Convex every public mutation is callable by any client with the deployment URL, so these are IDOR-style gaps.

**Fix:** in each mutation, resolve the `syncMapping` (directly or via the `syncBlock`), call `getAuthUserId`, and verify `mapping.userId === userId` before patching/deleting. Reject otherwise.

## Test coverage for git-export

**Priority: high.** The feature merged with no tests covering ~861 lines in `src/lib/git-export/` plus the `SyncDialog` and Convex backend. Start with the pure functions, which have clear edge cases:

- `markdown.ts`: `stripFrontmatter` (no frontmatter, unterminated marker, trailing content on the close line), `buildBaseFilePath` (folder trimming, unknown block type fallback)
- `github.ts` / `gitlab.ts`: `parseRepoUrl` (SSH vs HTTPS, `.git` suffix, self-hosted hosts, invalid input)
- `sync.ts`: `checkForUpdates` (rejected-content dedupe, path dedupe across linked blocks, missing convex block)

Provider `pushFiles`/`pullFiles` can be covered with a mocked `fetch`.

## Reconsider force-push on GitHub ref update

**Priority: medium.** `github.ts` `pushFiles` updates the branch ref with `force: true`. The commit is already built on the branch's `base_tree` and parent commit, so the force flag mainly risks clobbering a concurrent commit pushed between read and write. Evaluate dropping `force`, or detecting the lost-update case and surfacing a conflict.

## Document the PAT storage model

**Priority: low.** Personal access tokens are stored in `localStorage` (`settings.ts`) and never sent to the server — all provider API calls are client-side. This keeps tokens off the backend but leaves them exposed to XSS, and the app renders LLM/user-generated content. Document the tradeoff (in the feature docs and/or a security note) so the decision is explicit and revisitable.

## Lint cleanup in new files

**Priority: low (cosmetic).** No behavioral bugs, but eslint flags:

- `adapter.ts`: unused imports `ghListDir`, `glListDir`
- `markdown.ts`: unused `_sessionName` parameter on `renderBlockToMarkdown`
- `SyncDialog.tsx`: `cond ? set.add(id) : set.delete(id)` ternaries used as statements (`no-unused-expressions`)
