import { describe, it, expect } from "vitest"
import { renderMemoryBlock, scoreEntryByTags, type MemoryEntry } from "./memoryRendering"

describe("scoreEntryByTags", () => {
  it("returns 0 when no overlap", () => {
    expect(scoreEntryByTags(["#ch1"], ["#ch2"])).toBe(0)
  })

  it("counts overlapping tags", () => {
    expect(scoreEntryByTags(["#ch1", "#renn"], ["#ch1", "#renn", "#plot"])).toBe(2)
  })

  it("handles empty arrays", () => {
    expect(scoreEntryByTags([], ["#ch1"])).toBe(0)
    expect(scoreEntryByTags(["#ch1"], [])).toBe(0)
  })
})

describe("renderMemoryBlock", () => {
  const entries: MemoryEntry[] = [
    { type: "character", title: "Renn", content: "Chief engineer", tags: ["#ch1"] },
    { type: "tension", title: "Conflict A", content: "Unresolved", tags: [] },
  ]

  it("returns a string starting with ## Project Memory", () => {
    expect(renderMemoryBlock(entries, [], [])).toMatch(/^## Project Memory/)
  })

  it("groups entries by type", () => {
    const result = renderMemoryBlock(entries, [], [])
    expect(result).toContain("character")
    expect(result).toContain("tension")
  })

  it("places pinned entries first", () => {
    const result = renderMemoryBlock(entries, [], [entries[1]])
    const tensionIndex = result.indexOf("Conflict A")
    const characterIndex = result.indexOf("Renn")
    expect(tensionIndex).toBeLessThan(characterIndex)
  })

  it("returns empty string for empty entries", () => {
    expect(renderMemoryBlock([], [], [])).toBe("")
  })
})
