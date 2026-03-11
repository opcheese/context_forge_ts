/**
 * Shared tag parsing utility.
 * Normalizes comma-separated tag input: trims, lowercases, and ensures # prefix.
 */
export function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
}
