import { describe, it, expect } from "vitest"
import { SelfTalkDetector } from "./selfTalkDetector"

describe("SelfTalkDetector", () => {
  it("detects </assistant> in a single chunk", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("Here is my answer.</assistant>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("</assistant>")
    expect(result!.cleanText).toBe("Here is my answer.")
  })

  it("detects <user> in a single chunk", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("Done with response.\n\n<user>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("<user>")
    expect(result!.cleanText).toBe("Done with response.\n\n")
  })

  it("detects </assistant> split across two chunks", () => {
    const detector = new SelfTalkDetector()
    expect(detector.feed("Here is my answer.</assis")).toBeNull()
    const result = detector.feed("tant>And now the user says")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("</assistant>")
  })

  it("detects <user> split across multiple chunks", () => {
    const detector = new SelfTalkDetector()
    expect(detector.feed("answer complete\n\n<")).toBeNull()
    expect(detector.feed("us")).toBeNull()
    const result = detector.feed("er>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("<user>")
  })

  it("returns null for normal text", () => {
    const detector = new SelfTalkDetector()
    expect(detector.feed("This is normal text")).toBeNull()
    expect(detector.feed(" with multiple chunks")).toBeNull()
    expect(detector.feed(" and no markers.")).toBeNull()
  })

  it("does not false-positive on partial tag-like text", () => {
    const detector = new SelfTalkDetector()
    expect(detector.feed("Use <div> for layout")).toBeNull()
    expect(detector.feed(" and <span> for inline")).toBeNull()
  })

  it("detects <assistant> (opening tag) as self-talk", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("fake user message\n\n<assistant>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("<assistant>")
  })

  it("detects </user> as self-talk", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("simulated input</user>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("</user>")
  })

  it("detects <system> as self-talk", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("Now injecting\n<system>")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("<system>")
  })

  it("detects ###Human: legacy training marker", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("End of response.###Human: fake input")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("###Human:")
  })

  it("detects \\n\\nHuman: legacy training marker", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("End of response.\n\nHuman: fake input")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("\n\nHuman:")
  })

  it("detects \\n\\nUSER:\\n new format marker mid-response", () => {
    const detector = new SelfTalkDetector()
    const result = detector.feed("End of response.\n\nUSER:\nfake input")
    expect(result).not.toBeNull()
    expect(result!.marker).toBe("\n\nUSER:\n")
  })

  it("reports position of marker in accumulated text", () => {
    const detector = new SelfTalkDetector()
    detector.feed("First chunk. ")
    detector.feed("Second chunk. ")
    const result = detector.feed("End.</assistant>More")
    expect(result).not.toBeNull()
    expect(result!.position).toBe("First chunk. Second chunk. End.".length)
  })
})
