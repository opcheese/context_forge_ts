import { describe, it, expect } from "vitest"
import { resolveBlockContent } from "./resolve"

// Mock block shapes (not full Convex docs, just the fields we need)
const makeBlock = (overrides: Record<string, unknown> = {}) => ({
  _id: "block1" as any,
  content: "original content",
  refBlockId: undefined as any,
  ...overrides,
})

describe("resolveBlockContent", () => {
  it("returns own content for regular blocks", () => {
    const block = makeBlock({ content: "hello" })
    const result = resolveBlockContent(block, new Map())
    expect(result).toBe("hello")
  })

  it("returns canonical content for linked blocks", () => {
    const canonical = makeBlock({ _id: "canonical1", content: "canonical content" })
    const ref = makeBlock({ _id: "ref1", content: "", refBlockId: "canonical1" })
    const lookup = new Map([["canonical1", canonical]])
    const result = resolveBlockContent(ref, lookup)
    expect(result).toBe("canonical content")
  })

  it("returns empty string if canonical not found (dangling ref)", () => {
    const ref = makeBlock({ _id: "ref1", content: "", refBlockId: "deleted1" })
    const result = resolveBlockContent(ref, new Map())
    expect(result).toBe("")
  })
})
