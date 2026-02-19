import type { Doc } from "../_generated/dataModel"

/**
 * Resolve a single block's effective content.
 * If it has a refBlockId, look up the canonical block in the provided map.
 * Pure function — no DB access. Caller must pre-fetch canonical blocks.
 */
export function resolveBlockContent(
  block: Pick<Doc<"blocks">, "content" | "refBlockId">,
  canonicalLookup: Map<string, Pick<Doc<"blocks">, "content">>
): string {
  if (!block.refBlockId) {
    return block.content
  }
  const canonical = canonicalLookup.get(block.refBlockId as string)
  return canonical?.content ?? ""
}

/**
 * Resolve content for an array of blocks.
 * Returns new array with content replaced by canonical content where applicable.
 * Does NOT mutate input blocks.
 */
export function resolveBlocks<T extends Pick<Doc<"blocks">, "content" | "refBlockId">>(
  blocks: T[],
  canonicalLookup: Map<string, Pick<Doc<"blocks">, "content">>
): (T & { content: string })[] {
  return blocks.map((block) => ({
    ...block,
    content: resolveBlockContent(block, canonicalLookup),
  }))
}
