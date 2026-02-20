# Claude Subscription Usage API

## Endpoint

```
GET https://api.anthropic.com/api/oauth/usage
```

## Authentication

- OAuth Bearer token from `~/.claude/.credentials.json`
- Path: `creds.claudeAiOauth.accessToken`
- Required header: `anthropic-beta: oauth-2025-04-20`

## Response Shape

```json
{
  "five_hour": {
    "utilization": 7.0,
    "resets_at": "2026-02-20T19:00:00+00:00"
  },
  "seven_day": {
    "utilization": 17.0,
    "resets_at": "2026-02-25T20:00:00+00:00"
  }
}
```

- `utilization` — percentage (0–100) of the rate limit consumed
- `resets_at` — ISO 8601 timestamp when the window resets

## Two Rate Limit Windows

1. **5-hour window**: Short-term burst limit. Resets every 5 hours.
2. **7-day window**: Longer-term rolling limit. Resets weekly.

When the 5-hour window hits 100%, requests are throttled until reset. The 7-day window acts as a secondary cap.

## Caveats

- This is an **undocumented/internal API** — may change without notice
- The `anthropic-beta` header version may need updating
- OAuth token may expire; no refresh logic implemented yet
- Only relevant for Claude Pro/Max subscribers using OAuth (not API keys)
- The default model for Max 5x subscriptions is Opus (most expensive)

## Usage in ContextForge

- Backend: `convex/claudeNode.ts` → `getSubscriptionUsage` action
- Hook: `src/hooks/useSubscriptionUsage.ts` — polls every 60s
- Component: `src/components/SubscriptionUsage.tsx` — color-coded chip in BrainstormDialog header
  - Green: < 70%
  - Amber: 70–89% (includes reset time)
  - Red: >= 90% (includes 7-day utilization)
