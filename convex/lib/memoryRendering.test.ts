import { describe, it, expect } from "vitest"
import { renderMemoryBlock, scoreEntryByTags } from "./memoryRendering"

describe("scoreEntryByTags", () => {
  it("returns 0 when no tags overlap", () => {
    expect(scoreEntryByTags(["#ch19", "#renn"], ["#lien", "#ch1"])).toBe(0)
  })

  it("counts overlapping tags", () => {
    expect(scoreEntryByTags(["#ch19", "#renn"], ["#ch19", "#renn", "#plot"])).toBe(2)
  })

  it("handles empty session tags", () => {
    expect(scoreEntryByTags([], ["#ch19"])).toBe(0)
  })

  it("handles empty entry tags", () => {
    expect(scoreEntryByTags(["#ch19"], [])).toBe(0)
  })
})

describe("renderMemoryBlock", () => {
  const entries = [
    { type: "character", title: "Renn", content: "Chief engineer, POV ch 9-19", tags: ["#ch19", "#renn"] },
    { type: "character", title: "Lien", content: "Chief cartographer", tags: ["#ch1"] },
    { type: "tension", title: "Okafor location", content: "Ch 18 med bay vs ch 19 cargo bay", tags: ["#ch19", "#okafor"] },
    { type: "place", title: "Cargo Bay 3", content: "Cavernous, dim emergency lighting", tags: ["#ch19"] },
  ]

  it("groups entries by type and renders markdown", () => {
    const result = renderMemoryBlock(entries, ["#ch19"], [])
    expect(result).toContain("## Project Memory")
    expect(result).toContain("### character")
    expect(result).toContain("**Renn**")
  })

  it("orders types by total tag overlap score (most relevant first)", () => {
    const result = renderMemoryBlock(entries, ["#ch19"], [])
    // character has Renn (#ch19) = 1, tension has Okafor (#ch19) = 1, place has Cargo Bay (#ch19) = 1
    // character has more matched entries (Renn matches), so should appear first or equal
    expect(result.indexOf("### character")).toBeLessThan(result.indexOf("### place"))
  })

  it("includes pinned entries regardless of tag match", () => {
    // Lien has tag #ch1, session tags are #ch19 — no overlap
    // But if we pin Lien, she should appear
    const lienEntry = entries[1]
    const result = renderMemoryBlock(entries, ["#ch19"], [lienEntry])
    expect(result).toContain("**Lien**")
  })

  it("excludes entries with no tag overlap and not pinned", () => {
    const result = renderMemoryBlock(entries, ["#ch1"], [])
    expect(result).toContain("**Lien**")
    expect(result).not.toContain("**Renn**")
    expect(result).not.toContain("**Okafor**")
  })

  it("returns empty string when no entries match", () => {
    const result = renderMemoryBlock(entries, ["#nomatch"], [])
    expect(result).toBe("")
  })

  it("handles empty entries array", () => {
    const result = renderMemoryBlock([], ["#ch19"], [])
    expect(result).toBe("")
  })
})
