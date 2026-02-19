import { describe, it, expect } from "vitest"
import { computeContentHash } from "./contentHash"

describe("computeContentHash", () => {
  it("returns consistent hash for same content", () => {
    const h1 = computeContentHash("hello world")
    const h2 = computeContentHash("hello world")
    expect(h1).toBe(h2)
  })

  it("returns different hash for different content", () => {
    const h1 = computeContentHash("hello world")
    const h2 = computeContentHash("hello world!")
    expect(h1).not.toBe(h2)
  })

  it("returns 16-char hex string", () => {
    const h = computeContentHash("test content")
    expect(h).toMatch(/^[0-9a-f]{16}$/)
  })

  it("returns empty string for empty content", () => {
    const h = computeContentHash("")
    expect(h).toBe("")
  })
})
