"use node"

import { v } from "convex/values"
import { action } from "./_generated/server"
import { internal } from "./_generated/api"
import { query as claudeQuery } from "@anthropic-ai/claude-agent-sdk"
import { getClaudeCodePath } from "./claudeNode"

export const draftMemoryEntry = action({
  args: {
    projectId: v.id("projects"),
    selectedText: v.string(),
  },
  handler: async (ctx, args): Promise<{
    type: string
    title: string
    content: string
    tags: string[]
    duplicateWarning?: string
  }> => {
    const schema = await ctx.runQuery(internal.memorySchemas.getByProjectInternal, {
      projectId: args.projectId,
    })
    const entries = await ctx.runQuery(internal.memoryEntries.listByProjectInternal, {
      projectId: args.projectId,
    })

    if (!schema) {
      throw new Error("No memory schema configured for this project")
    }

    const typesDescription = schema.types
      .map((t: { name: string; icon: string }) => `- ${t.name} (${t.icon}): use for ${t.name}-related knowledge`)
      .join("\n")

    const existingEntriesText = entries.length > 0
      ? entries.map((e: { type: string; title: string; content: string; tags: string[] }) =>
          `[${e.type}] "${e.title}" — ${e.content}\n  Tags: ${e.tags.join(", ")}`
        ).join("\n\n")
      : "(no existing entries)"

    const systemPrompt = `You are a memory entry drafting assistant. Given selected text from a conversation, create a structured memory entry for the project's knowledge base.

Available memory types:
${typesDescription}

Existing entries:
${existingEntriesText}

Rules:
- Pick the most appropriate type from the available types
- Write a concise, specific title (not just the first line of the selection)
- Distill the content — extract the insight, don't just copy the text verbatim
- Reuse existing tags where they fit. Use lowercase, #-prefixed tags
- If a very similar entry already exists, include a duplicateWarning suggesting the user update that entry instead

Respond with ONLY valid JSON (no markdown, no explanation):
{"type": "...", "title": "...", "content": "...", "tags": ["#...", "#..."], "duplicateWarning": "..." or null}`

    const prompt = `Draft a memory entry from this selected text:\n\n${args.selectedText}`

    let responseText = ""

    for await (const message of claudeQuery({
      prompt,
      options: {
        systemPrompt,
        allowedTools: [],
        maxTurns: 1,
        maxBudgetUsd: 0.05,
        pathToClaudeCodeExecutable: getClaudeCodePath(),
        model: process.env.MEMORY_DRAFT_MODEL || undefined,
      },
    })) {
      const msgType = (message as Record<string, unknown>).type as string
      if (msgType === "assistant") {
        const msg = message as Record<string, unknown>
        const msgMessage = msg.message as Record<string, unknown>
        const content = msgMessage.content as Array<Record<string, unknown>>
        responseText = content
          .filter((block) => block.type === "text")
          .map((block) => block.text as string)
          .join("")
      }
    }

    try {
      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      const parsed = JSON.parse(cleaned)
      return {
        type: parsed.type ?? schema.types[0]?.name ?? "note",
        title: parsed.title ?? "Untitled",
        content: parsed.content ?? args.selectedText,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        duplicateWarning: parsed.duplicateWarning ?? undefined,
      }
    } catch {
      return {
        type: schema.types[0]?.name ?? "note",
        title: args.selectedText.slice(0, 60).split("\n")[0],
        content: args.selectedText,
        tags: [],
      }
    }
  },
})
