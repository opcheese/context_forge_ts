/**
 * HTTP routes for Convex.
 *
 * These routes are exposed at the Convex deployment URL.
 */

import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { assembleContext, type ContextMessage } from "./lib/context"
import {
  streamChat as streamOllama,
  checkHealth as checkOllamaHealth,
} from "./lib/ollama"

// Provider type
type Provider = "ollama" | "claude"

// Claude health status type
interface ClaudeHealthStatus {
  ok: boolean
  error?: string
  version?: string
}

const http = httpRouter()

// CORS headers helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

// Reset test data endpoint - only works in development
http.route({
  path: "/testing/reset",
  method: "POST",
  handler: httpAction(async (ctx) => {
    const result = await ctx.runMutation(internal.testing.resetAll)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }),
})

// Handle CORS preflight for reset endpoint
http.route({
  path: "/testing/reset",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders })
  }),
})

// Create a test session - returns session ID for use in tests
http.route({
  path: "/testing/sessions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()
    const { name } = body as { name?: string }

    const id = await ctx.runMutation(api.sessions.create, {
      name: name ?? "Test Session",
    })

    return new Response(JSON.stringify({ id }), {
      status: 201,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }),
})

// Handle CORS preflight for test sessions endpoint
http.route({
  path: "/testing/sessions",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders })
  }),
})

// Create a test block - requires sessionId, automatically marked as testData
http.route({
  path: "/testing/blocks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()
    const { sessionId, content, type, zone } = body as {
      sessionId: Id<"sessions">
      content: string
      type: string
      zone?: "PERMANENT" | "STABLE" | "WORKING"
    }

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    const id = await ctx.runMutation(api.blocks.create, {
      sessionId,
      content,
      type,
      zone,
      testData: true,
    })

    return new Response(JSON.stringify({ id }), {
      status: 201,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }),
})

// Handle CORS preflight for test blocks endpoint
http.route({
  path: "/testing/blocks",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders })
  }),
})

// ============ LLM Generation Endpoints ============

// Chat endpoint - streams LLM response with context from session blocks
// Supports multiple providers: ollama (default), claude
http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()
    const { sessionId, prompt, systemPrompt, provider = "ollama" } = body as {
      sessionId: string
      prompt: string
      systemPrompt?: string
      provider?: Provider
    }

    // Validate required fields
    if (!sessionId || !prompt) {
      return new Response(
        JSON.stringify({ error: "sessionId and prompt are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      )
    }

    // Check provider availability
    if (provider === "ollama") {
      const ollamaStatus = await checkOllamaHealth()
      if (!ollamaStatus.ok) {
        return new Response(
          JSON.stringify({
            error: `Ollama is not available at ${ollamaStatus.url}`,
            details: ollamaStatus.error,
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        )
      }
    } else if (provider === "claude") {
      const claudeStatus = await ctx.runAction(api.claudeNode.checkHealth, {}) as ClaudeHealthStatus
      if (!claudeStatus.ok) {
        return new Response(
          JSON.stringify({
            error: "Claude Code is not available",
            details: claudeStatus.error,
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        )
      }
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      )
    }

    // Get blocks for context assembly
    const blocks = await ctx.runQuery(api.blocks.list, {
      sessionId: sessionId as Id<"sessions">,
    })

    // Assemble context with correct zone ordering (PERMANENT → STABLE → WORKING)
    const messages = assembleContext(blocks, prompt, systemPrompt)

    // Create streaming response using TransformStream
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Stream in background (don't await)
    ;(async () => {
      try {
        let fullResponse = ""

        if (provider === "claude") {
          // Claude uses Convex action (non-streaming) - we call it and send result as SSE
          const result = await ctx.runAction(api.claudeNode.generate, {
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            systemPrompt,
          }) as { text: string; error?: string }

          if (result.error) {
            throw new Error(result.error)
          }

          fullResponse = result.text

          // Send the full response as a single chunk (simulated streaming)
          // For better UX, we could split into smaller chunks
          const chunkSize = 50 // characters per chunk for simulated streaming
          for (let i = 0; i < fullResponse.length; i += chunkSize) {
            const chunk = fullResponse.slice(i, i + chunkSize)
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text-delta", delta: chunk })}\n\n`
              )
            )
          }
        } else {
          // Ollama supports true streaming
          for await (const chunk of streamOllama(messages)) {
            fullResponse += chunk
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({ type: "text-delta", delta: chunk })}\n\n`
              )
            )
          }
        }

        // Send finish event
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({ type: "finish", finishReason: "stop" })}\n\n`
          )
        )
        await writer.write(encoder.encode("data: [DONE]\n\n"))

        // Auto-save generated content to WORKING zone
        if (fullResponse.trim()) {
          await ctx.runMutation(api.blocks.create, {
            sessionId: sessionId as Id<"sessions">,
            content: fullResponse,
            type: "ASSISTANT",
            zone: "WORKING",
          })
        }

        await writer.close()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        try {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`
            )
          )
        } catch {
          // Writer may already be closed
        }
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...corsHeaders,
      },
    })
  }),
})

// Handle CORS preflight for chat endpoint
http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders })
  }),
})

// Ollama health check endpoint
http.route({
  path: "/api/health/ollama",
  method: "GET",
  handler: httpAction(async () => {
    const status = await checkOllamaHealth()
    return new Response(JSON.stringify(status), {
      status: status.ok ? 200 : 503,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }),
})

// Handle CORS preflight for Ollama health endpoint
http.route({
  path: "/api/health/ollama",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders })
  }),
})

// Claude Code health check endpoint
http.route({
  path: "/api/health/claude",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const status = await ctx.runAction(api.claudeNode.checkHealth, {}) as ClaudeHealthStatus
    return new Response(JSON.stringify(status), {
      status: status.ok ? 200 : 503,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }),
})

// Handle CORS preflight for Claude health endpoint
http.route({
  path: "/api/health/claude",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders })
  }),
})

// Combined providers health check endpoint
http.route({
  path: "/api/health",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const [ollamaStatus, claudeStatus] = await Promise.all([
      checkOllamaHealth(),
      ctx.runAction(api.claudeNode.checkHealth, {}) as Promise<ClaudeHealthStatus>,
    ])

    return new Response(
      JSON.stringify({
        ollama: ollamaStatus,
        claude: claudeStatus,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    )
  }),
})

// Handle CORS preflight for combined health endpoint
http.route({
  path: "/api/health",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders })
  }),
})

export default http
