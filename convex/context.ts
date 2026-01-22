/**
 * Context assembly and export queries.
 */

import { query } from "./_generated/server"
import { v } from "convex/values"
import { assembleContext, extractSystemPromptFromBlocks, type ContextMessage } from "./lib/context"
import { countTokens } from "./lib/tokenizer"

/**
 * Format for context export.
 */
type ExportFormat = "plain" | "markdown" | "xml"

/**
 * Format messages as plain text.
 */
function formatPlain(messages: ContextMessage[]): string {
  return messages
    .map((m) => {
      const roleLabel = m.role.toUpperCase()
      return `[${roleLabel}]\n${m.content}`
    })
    .join("\n\n---\n\n")
}

/**
 * Format messages as markdown.
 */
function formatMarkdown(messages: ContextMessage[]): string {
  return messages
    .map((m) => {
      const roleLabel = m.role.charAt(0).toUpperCase() + m.role.slice(1)
      return `## ${roleLabel}\n\n${m.content}`
    })
    .join("\n\n---\n\n")
}

/**
 * Format messages as XML (Claude-style).
 */
function formatXml(messages: ContextMessage[]): string {
  return messages
    .map((m) => `<${m.role}>\n${m.content}\n</${m.role}>`)
    .join("\n\n")
}

/**
 * Get assembled context for export/copy.
 * Returns the context as formatted text ready for clipboard.
 */
export const getAssembled = query({
  args: {
    sessionId: v.id("sessions"),
    format: v.optional(v.union(v.literal("plain"), v.literal("markdown"), v.literal("xml"))),
    includePromptPlaceholder: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const format = args.format ?? "plain"
    const includePlaceholder = args.includePromptPlaceholder ?? true

    // Get all blocks for session
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    // Extract system prompt from blocks (for export, we want to show it)
    const systemPrompt = extractSystemPromptFromBlocks(blocks)

    // Assemble context with placeholder prompt (excludes system_prompt blocks)
    const promptPlaceholder = includePlaceholder ? "[Your prompt here]" : ""
    const contextMessages = assembleContext(blocks, promptPlaceholder)

    // Prepend system prompt for export so users see their full context
    const messages: ContextMessage[] = systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...contextMessages]
      : contextMessages

    // Remove the placeholder message if not wanted
    const messagesToFormat = includePlaceholder
      ? messages
      : messages.filter((m) => m.content !== "")

    // Format based on requested format
    let text: string
    switch (format) {
      case "markdown":
        text = formatMarkdown(messagesToFormat)
        break
      case "xml":
        text = formatXml(messagesToFormat)
        break
      default:
        text = formatPlain(messagesToFormat)
    }

    // Calculate token count
    const tokens = countTokens(text)

    return {
      text,
      tokens,
      format,
      blockCount: blocks.length,
    }
  },
})

/**
 * Get context preview with token breakdown by zone.
 */
export const getPreview = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const blocks = await ctx.db
      .query("blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect()

    // Group by zone and calculate tokens
    const zones = {
      PERMANENT: { blocks: 0, tokens: 0, content: "" },
      STABLE: { blocks: 0, tokens: 0, content: "" },
      WORKING: { blocks: 0, tokens: 0, content: "" },
    }

    for (const block of blocks) {
      const zone = block.zone as keyof typeof zones
      zones[zone].blocks++
      zones[zone].tokens += block.tokens ?? countTokens(block.content)
    }

    // Sort and build content for each zone
    const sorted = {
      PERMANENT: blocks.filter((b) => b.zone === "PERMANENT").sort((a, b) => a.position - b.position),
      STABLE: blocks.filter((b) => b.zone === "STABLE").sort((a, b) => a.position - b.position),
      WORKING: blocks.filter((b) => b.zone === "WORKING").sort((a, b) => a.position - b.position),
    }

    zones.PERMANENT.content = sorted.PERMANENT.map((b) => b.content).join("\n\n")
    zones.STABLE.content = sorted.STABLE.map((b) => b.content).join("\n\n")
    zones.WORKING.content = sorted.WORKING.map((b) => b.content).join("\n\n")

    const totalTokens = zones.PERMANENT.tokens + zones.STABLE.tokens + zones.WORKING.tokens

    return {
      zones,
      totalBlocks: blocks.length,
      totalTokens,
    }
  },
})
