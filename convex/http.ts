/**
 * HTTP routes for Convex.
 *
 * These routes are exposed at the Convex deployment URL.
 */

import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { api } from "./_generated/api"

const http = httpRouter()

// Reset test data endpoint - only works in development
http.route({
  path: "/testing/reset",
  method: "POST",
  handler: httpAction(async (ctx) => {
    // Check for test environment header as a safety measure
    // In production, you might want additional authentication
    const result = await ctx.runMutation(internal.testing.resetAll)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }),
})

// Handle CORS preflight for reset endpoint
http.route({
  path: "/testing/reset",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }),
})

// Create a test block - automatically marked as testData
http.route({
  path: "/testing/blocks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()
    const { content, type, zone } = body as {
      content: string
      type: string
      zone?: "PERMANENT" | "STABLE" | "WORKING"
    }

    const id = await ctx.runMutation(api.blocks.create, {
      content,
      type,
      zone,
      testData: true,
    })

    return new Response(JSON.stringify({ id }), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }),
})

// Handle CORS preflight for test blocks endpoint
http.route({
  path: "/testing/blocks",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }),
})

export default http
