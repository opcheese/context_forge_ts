/**
 * Compute a content hash for duplicate detection.
 * Uses a simple DJB2-based hash (no crypto dependency needed in Convex).
 * Returns first 16 hex chars for compact storage + index efficiency.
 * Returns empty string for empty content (no hash for empty blocks).
 */
export function computeContentHash(content: string): string {
  if (!content) return ""

  // DJB2 hash — fast, good distribution, no dependencies
  let h1 = 0x811c9dc5 // FNV offset basis
  let h2 = 0x01000193 // FNV prime seed
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    h1 = ((h1 ^ c) * 0x01000193) >>> 0
    h2 = ((h2 ^ c) * 0x811c9dc5) >>> 0
  }

  // Combine into 16-char hex
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")
}
