# Claude Code "process exited with code 1" — Debug Notes

## Symptom
- Brainstorm/generation starts, receives initial tokens (streaming works)
- After some time, Claude Code subprocess exits with code 1
- Error: `Claude Code error: Claude Code process exited with code 1`
- Intermittent — doesn't happen every time

## Observations
- WebSocket closes with `code 1011: InternalServerError` right before the error
- Convex backend logs show NO explicit error — action reports as completed
- Server swap is heavily used (2.9 GB / 4 GB)
- Earlier isolate restarts seen: `TooMuchMemoryCarryOver("55.72 MiB", "96 MiB")`
- Claude CLI works fine standalone: `echo "hello" | claude --print` succeeds
- SDK version: @anthropic-ai/claude-agent-sdk@0.2.9

## Hypotheses (ordered by likelihood)

### 1. Memory pressure kills claude subprocess
- Server has only ~2 GB free RAM, 2.9 GB swap used
- Convex backend + Node executor + claude CLI = significant memory
- OOM killer or memory limits could terminate the claude child process
- The child exits with code 1 (not signal), SDK reports it

### 2. Convex Node executor recycling
- Self-hosted backend recycles isolates on `TooMuchMemoryCarryOver`
- If the Node executor is recycled mid-stream, child processes get killed
- The streaming action has high memory usage (SDK + buffers + AbortController)

### 3. AbortController / isCancelled interaction
- User suspects "stop function" (added AbortController + isCancelled checks)
- The `isCancelled()` query runs on every throttle interval (100ms default)
- Each check is a database roundtrip — adds latency and memory
- If a check fails or times out, could cascade to process issues
- However: AbortController is only triggered on explicit cancel

### 4. SDK bug with includePartialMessages
- `includePartialMessages: true` enables stream_event messages
- Could have edge cases with long responses or specific content

## Next Steps
1. Increase server RAM (user already plans to)
2. Test if issue reproduces on cloud Convex (isolates separate concern)
3. Try increasing throttleMs from 100ms to 500ms (fewer isCancelled checks)
4. Add logging around the exact moment of failure
5. Check if `includePartialMessages: false` avoids the issue
6. Monitor `dmesg` during a generation for OOM events
