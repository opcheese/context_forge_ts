# LLM Implementation Plan

> **⚠️ HISTORICAL DOCUMENT - IMPLEMENTATION COMPLETE**
>
> This was the original step-by-step implementation plan for LLM integration. **This work has been completed.**
>
> **For current implementation details, see:**
> - [ARCHITECTURE.md](../ARCHITECTURE.md#llm-integration) - How it actually works
> - [PROGRESS.md](../PROGRESS.md) - Session 8: Slice 5 - LLM Integration
>
> **What changed during implementation:**
> - Claude Code uses Convex reactive queries (database-backed streaming), not HTTP
> - Added `generations` table for streaming state management
> - Claude Agent SDK requires `stream_event` handling, not `content_block_delta`

---

## Overview

Step-by-step plan for adding LLM generation to ContextForge TypeScript.

**Architecture:** Client → Convex HTTP Action → Provider (Ollama/Claude Code)

**Providers:**
1. Ollama (local, free) - primary for development
2. Claude Code (subscription) - for production use

---

## Current State

### What Exists
- ✅ Sessions and blocks with zones (PERMANENT, STABLE, WORKING)
- ✅ Convex backend running locally (127.0.0.1:3210)
- ✅ HTTP actions infrastructure (convex/http.ts)
- ✅ Zone-based block queries
- ✅ React UI with drag-and-drop

### What's Missing
- ❌ LLM provider integration
- ❌ Streaming HTTP endpoint
- ❌ Context assembly function
- ❌ Generation UI
- ❌ Token counting

---

## Implementation Steps

### Step 1: Install Dependencies

**Files:** `package.json`

```bash
# Vercel AI SDK for provider abstraction
pnpm add ai @ai-sdk/openai

# For token estimation (optional, for later)
pnpm add gpt-tokenizer
```

**Why these packages:**
- `ai` - Vercel AI SDK core (streamText, generateText)
- `@ai-sdk/openai` - Works with Ollama (OpenAI-compatible API)
- `gpt-tokenizer` - Pure JS tokenizer (for future token counting)

**Note:** We're NOT using `@ai-sdk/anthropic` yet. Claude Code handles Anthropic differently.

---

### Step 2: Create Context Assembly Function

**File:** `convex/lib/context.ts` (new)

This function assembles blocks into the correct message format for LLM calls.

```typescript
import type { Doc } from "../_generated/dataModel"

export type Zone = "PERMANENT" | "STABLE" | "WORKING"

export interface ContextMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Assemble blocks into messages for LLM.
 * Order: PERMANENT → STABLE → WORKING (critical for caching)
 */
export function assembleContext(
  blocks: Doc<"blocks">[],
  userPrompt: string,
  systemPrompt?: string
): ContextMessage[] {
  const messages: ContextMessage[] = []

  // Group blocks by zone
  const byZone: Record<Zone, Doc<"blocks">[]> = {
    PERMANENT: [],
    STABLE: [],
    WORKING: [],
  }

  for (const block of blocks) {
    byZone[block.zone as Zone].push(block)
  }

  // Sort each zone by position
  for (const zone of Object.keys(byZone) as Zone[]) {
    byZone[zone].sort((a, b) => a.position - b.position)
  }

  // 1. PERMANENT zone as system message (most stable, cached first)
  const permanentContent = byZone.PERMANENT.map((b) => b.content).join("\n\n")
  if (permanentContent) {
    messages.push({
      role: "system",
      content: permanentContent,
    })
  }

  // 2. Optional system prompt from user
  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt,
    })
  }

  // 3. STABLE zone as context
  const stableContent = byZone.STABLE.map((b) => b.content).join("\n\n")
  if (stableContent) {
    messages.push({
      role: "user",
      content: `Reference Material:\n\n${stableContent}`,
    })
  }

  // 4. WORKING zone as recent context
  const workingContent = byZone.WORKING.map((b) => b.content).join("\n\n")
  if (workingContent) {
    messages.push({
      role: "user",
      content: `Current Context:\n\n${workingContent}`,
    })
  }

  // 5. Current user prompt (always last)
  messages.push({
    role: "user",
    content: userPrompt,
  })

  return messages
}
```

**Key points:**
- Zone order is critical: PERMANENT → STABLE → WORKING → prompt
- This enables prefix caching with OpenAI/Anthropic
- PERMANENT becomes system message (highest cache priority)

---

### Step 3: Create Ollama Provider Module

**File:** `convex/lib/ollama.ts` (new)

```typescript
/**
 * Ollama API client for local LLM inference.
 * Ollama runs at localhost:11434 and provides OpenAI-compatible API.
 */

export interface OllamaMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface OllamaStreamChunk {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
}

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gpt-oss:latest"

/**
 * Stream chat completion from Ollama.
 * Returns an async generator of text chunks.
 */
export async function* streamChat(
  messages: OllamaMessage[],
  options?: {
    model?: string
    temperature?: number
  }
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options?.model || OLLAMA_MODEL,
      messages,
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`)
  }

  if (!response.body) {
    throw new Error("No response body from Ollama")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const chunk: OllamaStreamChunk = JSON.parse(line)
        if (chunk.message?.content) {
          yield chunk.message.content
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
}

/**
 * Check if Ollama is available.
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
    })
    return response.ok
  } catch {
    return false
  }
}
```

---

### Step 4: Create Streaming HTTP Endpoint

**File:** `convex/http.ts` (modify)

Add the `/api/chat` endpoint for streaming generation.

```typescript
// Add to existing http.ts

import { assembleContext } from "./lib/context"
import { streamChat, checkOllamaHealth } from "./lib/ollama"

// Chat endpoint - streams LLM response
http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()
    const { sessionId, prompt, systemPrompt } = body as {
      sessionId: Id<"sessions">
      prompt: string
      systemPrompt?: string
    }

    if (!sessionId || !prompt) {
      return new Response(
        JSON.stringify({ error: "sessionId and prompt are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    // Check Ollama availability
    const ollamaOk = await checkOllamaHealth()
    if (!ollamaOk) {
      return new Response(
        JSON.stringify({ error: "Ollama is not available at localhost:11434" }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    // Get blocks for context assembly
    const blocks = await ctx.runQuery(api.blocks.list, { sessionId })

    // Assemble context with correct zone ordering
    const messages = assembleContext(blocks, prompt, systemPrompt)

    // Create streaming response
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Stream in background
    ;(async () => {
      try {
        let fullResponse = ""

        for await (const chunk of streamChat(messages)) {
          fullResponse += chunk
          // Send SSE format for Vercel AI SDK compatibility
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: "text-delta", delta: chunk })}\n\n`)
          )
        }

        // Send finish event
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\n`)
        )
        await writer.write(encoder.encode("data: [DONE]\n\n"))

        // Auto-save to WORKING zone
        await ctx.runMutation(api.blocks.create, {
          sessionId,
          content: fullResponse,
          type: "ASSISTANT",
          zone: "WORKING",
        })

        await writer.close()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`)
        )
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        ...corsHeaders,
      },
    })
  }),
})

// CORS preflight for chat endpoint
http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders })
  }),
})

// Health check for Ollama
http.route({
  path: "/api/health/ollama",
  method: "GET",
  handler: httpAction(async () => {
    const ok = await checkOllamaHealth()
    return new Response(
      JSON.stringify({ ok, url: process.env.OLLAMA_URL || "http://localhost:11434" }),
      {
        status: ok ? 200 : 503,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    )
  }),
})
```

---

### Step 5: Create Generation Hook

**File:** `src/hooks/useGenerate.ts` (new)

React hook for streaming generation.

```typescript
import { useState, useCallback, useRef } from "react"
import type { Id } from "../../convex/_generated/dataModel"

interface UseGenerateOptions {
  sessionId: Id<"sessions">
  onChunk?: (chunk: string) => void
  onComplete?: (fullText: string) => void
  onError?: (error: string) => void
}

interface UseGenerateResult {
  generate: (prompt: string, systemPrompt?: string) => Promise<void>
  isGenerating: boolean
  streamedText: string
  error: string | null
  stop: () => void
}

// Convex HTTP endpoint (port 3211 for HTTP actions)
const CHAT_API_URL =
  import.meta.env.VITE_CONVEX_URL?.replace(":3210", ":3211") + "/api/chat" ||
  "http://127.0.0.1:3211/api/chat"

export function useGenerate(options: UseGenerateOptions): UseGenerateResult {
  const { sessionId, onChunk, onComplete, onError } = options
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamedText, setStreamedText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsGenerating(false)
  }, [])

  const generate = useCallback(
    async (prompt: string, systemPrompt?: string) => {
      setIsGenerating(true)
      setStreamedText("")
      setError(null)

      abortControllerRef.current = new AbortController()

      try {
        const response = await fetch(CHAT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, prompt, systemPrompt }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        if (!response.body) {
          throw new Error("No response body")
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let fullText = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const data = line.slice(6)

            if (data === "[DONE]") continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === "text-delta" && parsed.delta) {
                fullText += parsed.delta
                setStreamedText(fullText)
                onChunk?.(parsed.delta)
              } else if (parsed.type === "error") {
                throw new Error(parsed.error)
              } else if (parsed.type === "finish") {
                onComplete?.(fullText)
              }
            } catch (parseError) {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User stopped generation
          return
        }
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        onError?.(message)
      } finally {
        setIsGenerating(false)
        abortControllerRef.current = null
      }
    },
    [sessionId, onChunk, onComplete, onError]
  )

  return { generate, isGenerating, streamedText, error, stop }
}
```

---

### Step 6: Create Generation UI Component

**File:** `src/components/GeneratePanel.tsx` (new)

Simple generation panel below the zones.

```typescript
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useGenerate } from "@/hooks/useGenerate"
import type { Id } from "../../convex/_generated/dataModel"

interface GeneratePanelProps {
  sessionId: Id<"sessions">
}

export function GeneratePanel({ sessionId }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [showSystem, setShowSystem] = useState(false)

  const { generate, isGenerating, streamedText, error, stop } = useGenerate({
    sessionId,
    onComplete: () => {
      setPrompt("") // Clear prompt on success
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return
    await generate(prompt.trim(), systemPrompt.trim() || undefined)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Generate</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSystem(!showSystem)}
        >
          {showSystem ? "Hide" : "Show"} System Prompt
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {showSystem && (
          <div>
            <label
              htmlFor="system-prompt"
              className="block text-sm font-medium mb-1 text-foreground"
            >
              System Prompt (optional)
            </label>
            <textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Override or add to system instructions..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              disabled={isGenerating}
            />
          </div>
        )}

        <div>
          <label
            htmlFor="user-prompt"
            className="block text-sm font-medium mb-1 text-foreground"
          >
            Prompt
          </label>
          <textarea
            id="user-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What would you like to generate?"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            disabled={isGenerating}
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={!prompt.trim() || isGenerating}>
            {isGenerating ? "Generating..." : "Generate"}
          </Button>
          {isGenerating && (
            <Button type="button" variant="outline" onClick={stop}>
              Stop
            </Button>
          )}
        </div>
      </form>

      {/* Streaming output */}
      {(streamedText || isGenerating) && (
        <div className="mt-4 p-4 rounded-md bg-muted/50 border border-border">
          <div className="text-sm font-medium mb-2 text-muted-foreground">
            {isGenerating ? "Generating..." : "Generated"}
          </div>
          <div className="text-sm whitespace-pre-wrap">
            {streamedText || (
              <span className="text-muted-foreground">Waiting for response...</span>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-4 p-4 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">
          Error: {error}
        </div>
      )}
    </div>
  )
}
```

---

### Step 7: Add Generate Panel to Home Page

**File:** `src/routes/index.tsx` (modify)

Add the GeneratePanel to the home page.

```typescript
// Add import at top
import { GeneratePanel } from "@/components/GeneratePanel"

// In HomePage component, add after ZoneLayout:
function HomePage() {
  const { sessionId, isLoading } = useSession()

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading...</div>
    )
  }

  if (!sessionId) {
    return <NoSessionSelected />
  }

  return (
    <div className="space-y-6">
      {/* Existing Add Block form */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Add New Block</h2>
        <AddBlockForm sessionId={sessionId} />
      </section>

      {/* NEW: Generate Panel */}
      <section>
        <GeneratePanel sessionId={sessionId} />
      </section>

      {/* Existing Zone Layout */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Context Zones</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Drag blocks to reorder or move between zones
        </p>
        <ZoneLayout sessionId={sessionId} />
      </section>
    </div>
  )
}
```

---

### Step 8: Add E2E Tests

**File:** `e2e/generation.spec.ts` (new)

```typescript
import { test, expect } from "@playwright/test"

const CONVEX_SITE_URL = "http://127.0.0.1:3211"

test.describe("Generation", () => {
  test.beforeAll(async () => {
    // Check Ollama is available
    const response = await fetch(`${CONVEX_SITE_URL}/api/health/ollama`)
    const data = await response.json()
    if (!data.ok) {
      console.warn("Ollama not available, skipping generation tests")
      test.skip()
    }
  })

  test("should show generate panel", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Generate" })).toBeVisible()
    await expect(page.getByPlaceholder("What would you like to generate?")).toBeVisible()
  })

  test("should generate and save to WORKING zone", async ({ page }) => {
    await page.goto("/")

    // Enter prompt
    await page.getByPlaceholder("What would you like to generate?").fill("Say hello")

    // Click generate
    await page.getByRole("button", { name: "Generate" }).click()

    // Wait for generation to complete (with timeout for slow models)
    await expect(page.getByText("Generated")).toBeVisible({ timeout: 60000 })

    // Check that response appeared in WORKING zone
    // (The block should be auto-saved)
    await expect(page.locator('[data-zone="WORKING"]').getByText(/hello/i)).toBeVisible({
      timeout: 5000,
    })
  })
})
```

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `ai`, `@ai-sdk/openai`, `gpt-tokenizer` |
| `convex/lib/context.ts` | Create | Context assembly with zone ordering |
| `convex/lib/ollama.ts` | Create | Ollama streaming client |
| `convex/http.ts` | Modify | Add `/api/chat` streaming endpoint |
| `src/hooks/useGenerate.ts` | Create | React hook for streaming |
| `src/components/GeneratePanel.tsx` | Create | Generation UI component |
| `src/routes/index.tsx` | Modify | Add GeneratePanel to home |
| `e2e/generation.spec.ts` | Create | E2E tests for generation |

---

## Environment Variables

Add to `.env.local` (optional, has defaults):

```bash
# Ollama configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gpt-oss:latest
```

---

## Testing Checklist

Before each step, verify:

- [ ] Convex dev server running (`pnpm exec convex dev`)
- [ ] Vite dev server running (`pnpm dev`)
- [ ] Ollama running (`ollama serve`)
- [ ] Model pulled (`ollama pull gpt-oss:latest`)

After implementation:

- [ ] Health check passes: `curl http://127.0.0.1:3211/api/health/ollama`
- [ ] Generate works in UI
- [ ] Response streams in real-time
- [ ] Block auto-saves to WORKING zone
- [ ] Stop button works
- [ ] Error handling works (try with Ollama stopped)

---

## Future Steps (Not in This Plan)

1. **Token counting** - Add `tokens` field to blocks, display counts
2. **Claude Code provider** - Add alternative provider for subscription use
3. **Provider switching** - UI to select Ollama vs Claude Code
4. **Brainstorming mode** - Multi-turn without auto-save
5. **Cache validation** - Test with OpenAI/Anthropic to verify cache hits

---

## Dependencies Between Steps

```
Step 1 (deps) ─────────────────────────────────────┐
                                                   │
Step 2 (context) ──────────────────────────────────┤
                                                   │
Step 3 (ollama) ───────────────────────────────────┼── Step 4 (http endpoint)
                                                   │         │
                                                   │         ▼
                                                   │   Step 5 (hook)
                                                   │         │
                                                   │         ▼
                                                   │   Step 6 (UI)
                                                   │         │
                                                   │         ▼
                                                   └── Step 7 (integrate)
                                                             │
                                                             ▼
                                                       Step 8 (tests)
```

Steps 1-3 can be done in parallel. Steps 4-8 are sequential.
