/**
 * Unit tests for context assembly functions.
 */
import { describe, it, expect } from "vitest"
import {
  extractSystemPromptFromBlocks,
  assembleContext,
  assembleContextWithConversation,
  assembleSystemPromptWithContext,
  estimateTokenCount,
  getContextStats,
  NO_TOOLS_SUFFIX,
  NO_SELF_TALK_SUFFIX,
  formatPromptForSDK,
} from "./context"
import type { ContextMessage } from "./context"
import type { Doc } from "../_generated/dataModel"

// Helper to create mock blocks
function createBlock(
  overrides: Partial<Doc<"blocks">> & { content: string; zone: string; type?: string }
): Doc<"blocks"> {
  return {
    _id: `block_${Math.random().toString(36).substr(2, 9)}` as Doc<"blocks">["_id"],
    _creationTime: Date.now(),
    sessionId: "session_123" as Doc<"blocks">["sessionId"],
    content: overrides.content,
    type: overrides.type ?? "note",
    zone: overrides.zone,
    position: overrides.position ?? 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe("extractSystemPromptFromBlocks", () => {
  it("returns undefined when no system_prompt blocks exist", () => {
    const blocks = [
      createBlock({ content: "Note 1", zone: "PERMANENT", type: "note" }),
      createBlock({ content: "Note 2", zone: "WORKING", type: "note" }),
    ]
    expect(extractSystemPromptFromBlocks(blocks)).toBeUndefined()
  })

  it("returns the first system_prompt block in PERMANENT zone by position", () => {
    const blocks = [
      createBlock({ content: "Second prompt", zone: "PERMANENT", type: "system_prompt", position: 1 }),
      createBlock({ content: "First prompt", zone: "PERMANENT", type: "system_prompt", position: 0 }),
      createBlock({ content: "Note", zone: "PERMANENT", type: "note", position: 2 }),
    ]
    expect(extractSystemPromptFromBlocks(blocks)).toBe("First prompt")
  })

  it("ignores system_prompt blocks not in PERMANENT zone", () => {
    const blocks = [
      createBlock({ content: "Working prompt", zone: "WORKING", type: "system_prompt" }),
      createBlock({ content: "Stable prompt", zone: "STABLE", type: "system_prompt" }),
      createBlock({ content: "Permanent prompt", zone: "PERMANENT", type: "system_prompt" }),
    ]
    expect(extractSystemPromptFromBlocks(blocks)).toBe("Permanent prompt")
  })

  it("returns undefined when system_prompt blocks exist but none in PERMANENT", () => {
    const blocks = [
      createBlock({ content: "Working prompt", zone: "WORKING", type: "system_prompt" }),
    ]
    expect(extractSystemPromptFromBlocks(blocks)).toBeUndefined()
  })
})

describe("assembleContext", () => {
  it("assembles blocks in order: PERMANENT → STABLE → WORKING → user prompt", () => {
    const blocks = [
      createBlock({ content: "Working content", zone: "WORKING", position: 0 }),
      createBlock({ content: "Permanent content", zone: "PERMANENT", position: 0 }),
      createBlock({ content: "Stable content", zone: "STABLE", position: 0 }),
    ]

    const messages = assembleContext(blocks, "User question")

    expect(messages).toHaveLength(4)
    expect(messages[0]).toEqual({ role: "system", content: "Permanent content" })
    expect(messages[1]).toEqual({ role: "user", content: "Reference Material:\n\nStable content" })
    expect(messages[2]).toEqual({ role: "user", content: "Current Context:\n\nWorking content" })
    expect(messages[3]).toEqual({ role: "user", content: "User question" })
  })

  it("excludes system_prompt blocks from context messages", () => {
    const blocks = [
      createBlock({ content: "System prompt", zone: "PERMANENT", type: "system_prompt", position: 0 }),
      createBlock({ content: "Regular content", zone: "PERMANENT", type: "note", position: 1 }),
    ]

    const messages = assembleContext(blocks, "Question")

    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: "system", content: "Regular content" })
    expect(messages[1]).toEqual({ role: "user", content: "Question" })
  })

  it("sorts blocks within each zone by position", () => {
    const blocks = [
      createBlock({ content: "Second", zone: "PERMANENT", position: 1 }),
      createBlock({ content: "First", zone: "PERMANENT", position: 0 }),
      createBlock({ content: "Third", zone: "PERMANENT", position: 2 }),
    ]

    const messages = assembleContext(blocks, "Question")

    expect(messages[0].content).toBe("First\n\nSecond\n\nThird")
  })

  it("skips empty zones", () => {
    const blocks = [
      createBlock({ content: "Working only", zone: "WORKING", position: 0 }),
    ]

    const messages = assembleContext(blocks, "Question")

    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: "user", content: "Current Context:\n\nWorking only" })
    expect(messages[1]).toEqual({ role: "user", content: "Question" })
  })

  it("handles empty blocks array", () => {
    const messages = assembleContext([], "Question")

    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual({ role: "user", content: "Question" })
  })
})

describe("assembleContextWithConversation", () => {
  it("includes conversation history after context blocks", () => {
    const blocks = [
      createBlock({ content: "Permanent", zone: "PERMANENT", position: 0 }),
    ]
    const history = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there!" },
    ]

    const messages = assembleContextWithConversation(blocks, history, "New message")

    expect(messages).toHaveLength(4)
    expect(messages[0]).toEqual({ role: "system", content: "Permanent" })
    expect(messages[1]).toEqual({ role: "user", content: "Hello" })
    expect(messages[2]).toEqual({ role: "assistant", content: "Hi there!" })
    expect(messages[3]).toEqual({ role: "user", content: "New message" })
  })

  it("excludes system_prompt blocks from context", () => {
    const blocks = [
      createBlock({ content: "System prompt", zone: "PERMANENT", type: "system_prompt", position: 0 }),
      createBlock({ content: "Regular", zone: "PERMANENT", type: "note", position: 1 }),
    ]

    const messages = assembleContextWithConversation(blocks, [], "Question")

    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: "system", content: "Regular" })
  })

  it("handles empty conversation history", () => {
    const blocks = [
      createBlock({ content: "Context", zone: "STABLE", position: 0 }),
    ]

    const messages = assembleContextWithConversation(blocks, [], "First message")

    expect(messages).toHaveLength(2)
    expect(messages[0].content).toContain("Context")
    expect(messages[1].content).toBe("First message")
  })
})

describe("estimateTokenCount", () => {
  it("estimates ~4 chars per token", () => {
    const messages = [
      { role: "user" as const, content: "1234567890123456" }, // 16 chars = 4 tokens
    ]
    expect(estimateTokenCount(messages)).toBe(4)
  })

  it("rounds up", () => {
    const messages = [
      { role: "user" as const, content: "12345" }, // 5 chars = 2 tokens (rounded up)
    ]
    expect(estimateTokenCount(messages)).toBe(2)
  })

  it("sums all messages", () => {
    const messages = [
      { role: "system" as const, content: "12345678" }, // 8 chars = 2 tokens
      { role: "user" as const, content: "12345678" }, // 8 chars = 2 tokens
    ]
    expect(estimateTokenCount(messages)).toBe(4)
  })
})

describe("getContextStats", () => {
  it("counts blocks and chars per zone", () => {
    const blocks = [
      createBlock({ content: "1234", zone: "PERMANENT" }),
      createBlock({ content: "12345678", zone: "PERMANENT" }),
      createBlock({ content: "12", zone: "STABLE" }),
      createBlock({ content: "123456", zone: "WORKING" }),
    ]

    const stats = getContextStats(blocks)

    expect(stats.permanent).toEqual({ count: 2, chars: 12 })
    expect(stats.stable).toEqual({ count: 1, chars: 2 })
    expect(stats.working).toEqual({ count: 1, chars: 6 })
    expect(stats.total).toEqual({ count: 4, chars: 20 })
  })

  it("handles empty blocks array", () => {
    const stats = getContextStats([])

    expect(stats.total).toEqual({ count: 0, chars: 0 })
  })
})

describe("draft block filtering", () => {
  it("excludes draft blocks from assembleContext", () => {
    const blocks = [
      createBlock({ content: "Active note", zone: "WORKING", position: 0 }),
      createBlock({ content: "Draft note", zone: "WORKING", position: 1, isDraft: true }),
    ]
    const messages = assembleContext(blocks, "Question")
    const workingMsg = messages.find((m) => m.content.includes("Current Context"))
    expect(workingMsg?.content).toContain("Active note")
    expect(workingMsg?.content).not.toContain("Draft note")
  })

  it("excludes draft system_prompt from extractSystemPromptFromBlocks", () => {
    const blocks = [
      createBlock({ content: "Draft prompt", zone: "PERMANENT", type: "system_prompt", position: 0, isDraft: true }),
      createBlock({ content: "Active prompt", zone: "PERMANENT", type: "system_prompt", position: 1 }),
    ]
    expect(extractSystemPromptFromBlocks(blocks)).toBe("Active prompt")
  })

  it("returns undefined when only draft system_prompt exists", () => {
    const blocks = [
      createBlock({ content: "Draft prompt", zone: "PERMANENT", type: "system_prompt", position: 0, isDraft: true }),
    ]
    expect(extractSystemPromptFromBlocks(blocks)).toBeUndefined()
  })

  it("excludes draft blocks from assembleContextWithConversation", () => {
    const blocks = [
      createBlock({ content: "Active ref", zone: "STABLE", position: 0 }),
      createBlock({ content: "Draft ref", zone: "STABLE", position: 1, isDraft: true }),
    ]
    const messages = assembleContextWithConversation(blocks, [], "Hello")
    const refMsg = messages.find((m) => m.content.includes("Reference Material"))
    expect(refMsg?.content).toContain("Active ref")
    expect(refMsg?.content).not.toContain("Draft ref")
  })

  it("excludes draft blocks from getContextStats", () => {
    const blocks = [
      createBlock({ content: "ABCD", zone: "PERMANENT", position: 0 }),
      createBlock({ content: "EFGH", zone: "PERMANENT", position: 1, isDraft: true }),
    ]
    const stats = getContextStats(blocks)
    expect(stats.permanent).toEqual({ count: 1, chars: 4 })
    expect(stats.total).toEqual({ count: 1, chars: 4 })
  })
})

describe("NO_TOOLS_SUFFIX", () => {
  it("contains anti-agent instructions", () => {
    expect(NO_TOOLS_SUFFIX).toContain("do NOT have access to tools")
    expect(NO_TOOLS_SUFFIX).toContain("Do NOT say")
  })
})

describe("NO_SELF_TALK_SUFFIX", () => {
  it("contains anti-self-talk instructions", () => {
    expect(NO_SELF_TALK_SUFFIX).toContain("ONLY your single assistant response")
    expect(NO_SELF_TALK_SUFFIX).toContain("Do NOT")
  })
})

describe("assembleSystemPromptWithContext", () => {
  it("combines extracted system prompt with PERMANENT zone content", () => {
    const blocks = [
      createBlock({ content: "System prompt", zone: "PERMANENT", type: "system_prompt", position: 0 }),
      createBlock({ content: "PM persona", zone: "PERMANENT", type: "note", position: 1 }),
      createBlock({ content: "Reference card", zone: "PERMANENT", type: "reference", position: 2 }),
    ]
    const result = assembleSystemPromptWithContext(blocks)
    expect(result).toContain("System prompt")
    expect(result).toContain("PM persona")
    expect(result).toContain("Reference card")
  })

  it("returns only PERMANENT content when no system_prompt block exists", () => {
    const blocks = [
      createBlock({ content: "PM persona", zone: "PERMANENT", type: "note", position: 0 }),
    ]
    const result = assembleSystemPromptWithContext(blocks)
    expect(result).toContain("PM persona")
  })

  it("returns undefined when no PERMANENT blocks exist at all", () => {
    const blocks = [
      createBlock({ content: "Working doc", zone: "WORKING", type: "note", position: 0 }),
    ]
    const result = assembleSystemPromptWithContext(blocks)
    expect(result).toBeUndefined()
  })

  it("excludes draft blocks", () => {
    const blocks = [
      createBlock({ content: "Active", zone: "PERMANENT", type: "note", position: 0 }),
      createBlock({ content: "Draft", zone: "PERMANENT", type: "note", position: 1, isDraft: true }),
    ]
    const result = assembleSystemPromptWithContext(blocks)
    expect(result).toContain("Active")
    expect(result).not.toContain("Draft")
  })

  it("orders by position", () => {
    const blocks = [
      createBlock({ content: "Second", zone: "PERMANENT", type: "note", position: 1 }),
      createBlock({ content: "First", zone: "PERMANENT", type: "system_prompt", position: 0 }),
    ]
    const result = assembleSystemPromptWithContext(blocks)!
    expect(result.indexOf("First")).toBeLessThan(result.indexOf("Second"))
  })
})

describe("formatPromptForSDK", () => {
  it("formats context zones with markdown headers, not XML tags", () => {
    const messages: ContextMessage[] = [
      { role: "system", content: "PM persona instructions" },
      { role: "user", content: "Reference Material:\n\nSome ref" },
      { role: "user", content: "Current Context:\n\nSome context" },
    ]
    const result = formatPromptForSDK(messages)

    expect(result).not.toContain("<system>")
    expect(result).not.toContain("</system>")
    expect(result).not.toContain("<user>")
    expect(result).not.toContain("</user>")
    expect(result).not.toContain("<assistant>")
    expect(result).not.toContain("</assistant>")

    expect(result).toContain("PM persona instructions")
    expect(result).toContain("Some ref")
    expect(result).toContain("Some context")
  })

  it("formats conversation history with labeled turns", () => {
    const messages: ContextMessage[] = [
      { role: "user", content: "What about study groups?" },
      { role: "assistant", content: "Great question..." },
      { role: "user", content: "Now the IRD" },
    ]
    const result = formatPromptForSDK(messages)

    expect(result).toContain("What about study groups?")
    expect(result).toContain("Great question...")
    expect(result).toContain("Now the IRD")
    expect(result).not.toContain("<user>")
    expect(result).not.toContain("<assistant>")
  })

  it("separates system content from conversation", () => {
    const messages: ContextMessage[] = [
      { role: "system", content: "Instructions" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
      { role: "user", content: "Question" },
    ]
    const result = formatPromptForSDK(messages)
    const sysIdx = result.indexOf("Instructions")
    const convIdx = result.indexOf("Hello")
    expect(sysIdx).toBeLessThan(convIdx)
  })
})
