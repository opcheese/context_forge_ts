/**
 * HTTP routes for Convex.
 *
 * These endpoints are for:
 * - Testing utilities (/testing/*)
 * - Ollama streaming (/api/chat) - SSE streaming for Ollama LLM
 * - Health checks (/api/health/*)
 *
 * Note: Claude uses Convex reactive streaming (see generations.ts and claudeNode.ts),
 * not HTTP endpoints. The frontend calls startClaudeGeneration mutation directly.
 */

import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import {
  assembleContext,
  assembleContextWithConversation,
  extractSystemPromptFromBlocks,
} from "./lib/context"
import {
  streamChat as streamOllama,
  checkHealth as checkOllamaHealth,
} from "./lib/ollama"

// Claude health status type (for health check endpoints)
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

/**
 * Ollama chat endpoint - streams LLM response with SSE.
 *
 * For Claude, use the Convex reactive approach instead:
 * - Call startClaudeGeneration mutation
 * - Subscribe to generation via useQuery(api.generations.get, { generationId })
 * See useClaudeGenerate.ts for the frontend hook.
 */
http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()
    const { sessionId, prompt } = body as {
      sessionId: string
      prompt: string
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

    // Check Ollama availability
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

    // Get blocks for context assembly
    const blocks = await ctx.runQuery(api.blocks.list, {
      sessionId: sessionId as Id<"sessions">,
    })

    // Extract system prompt from blocks (first system_prompt block in PERMANENT zone)
    const systemPrompt = extractSystemPromptFromBlocks(blocks)

    // Assemble context (PERMANENT → STABLE → WORKING), excludes system_prompt blocks
    const contextMessages = assembleContext(blocks, prompt)

    // Prepend system prompt as first message for Ollama
    const messages = systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }, ...contextMessages]
      : contextMessages

    // Create streaming response using TransformStream
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Stream in background (don't await)
    ;(async () => {
      try {
        let fullResponse = ""

        // Stream from Ollama
        for await (const chunk of streamOllama(messages)) {
          fullResponse += chunk
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ type: "text-delta", delta: chunk })}\n\n`
            )
          )
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

/**
 * Ollama brainstorm endpoint - streams LLM response with conversation history.
 *
 * Unlike /api/chat, this:
 * - Accepts conversation history for multi-turn conversations
 * - Does NOT auto-save to blocks (user manually saves)
 */
http.route({
  path: "/api/brainstorm",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()
    const { sessionId, conversationHistory, newMessage } = body as {
      sessionId: string
      conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
      newMessage: string
    }

    // Validate required fields
    if (!sessionId || !newMessage) {
      return new Response(
        JSON.stringify({ error: "sessionId and newMessage are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      )
    }

    // Check Ollama availability
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

    // Get blocks for context assembly
    const blocks = await ctx.runQuery(api.blocks.list, {
      sessionId: sessionId as Id<"sessions">,
    })

    // Extract system prompt from blocks (first system_prompt block in PERMANENT zone)
    const systemPrompt = extractSystemPromptFromBlocks(blocks)

    // Assemble context with conversation history (excludes system_prompt blocks)
    const contextMessages = assembleContextWithConversation(
      blocks,
      conversationHistory || [],
      newMessage
    )

    // Prepend system prompt as first message for Ollama
    const messages = systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }, ...contextMessages]
      : contextMessages

    // Create streaming response using TransformStream
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Stream in background (don't await)
    ;(async () => {
      try {
        let fullResponse = ""

        // Stream from Ollama
        for await (const chunk of streamOllama(messages)) {
          fullResponse += chunk
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ type: "text-delta", delta: chunk })}\n\n`
            )
          )
        }

        // Send finish event with full response (for client to add to conversation)
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({ type: "finish", finishReason: "stop", fullText: fullResponse })}\n\n`
          )
        )
        await writer.write(encoder.encode("data: [DONE]\n\n"))

        // NOTE: No auto-save for brainstorm - user manually saves messages

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

// Handle CORS preflight for brainstorm endpoint
http.route({
  path: "/api/brainstorm",
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
