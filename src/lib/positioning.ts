/**
 * Fractional positioning utilities for drag-and-drop ordering.
 *
 * Uses fractional numbers to avoid reindexing all items on every move.
 * Example: Moving between positions 1.0 and 2.0 results in 1.5
 */

export interface PositionedItem {
  _id: string
  position: number
}

/**
 * Calculate new position when dropping between two items.
 */
export function getPositionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) {
    // First item in empty zone
    return 1.0
  }

  if (before === null) {
    // Dropping at the start
    return after! / 2
  }

  if (after === null) {
    // Dropping at the end
    return before + 1.0
  }

  // Dropping between two items
  return (before + after) / 2
}

/**
 * Calculate new position for dropping at a specific index in a sorted list.
 */
export function getPositionAtIndex<T extends PositionedItem>(
  items: T[],
  targetIndex: number
): number {
  // Sort by position
  const sorted = [...items].sort((a, b) => a.position - b.position)

  if (sorted.length === 0) {
    return 1.0
  }

  if (targetIndex <= 0) {
    // Drop at start
    return sorted[0].position / 2
  }

  if (targetIndex >= sorted.length) {
    // Drop at end
    return sorted[sorted.length - 1].position + 1.0
  }

  // Drop between items
  const before = sorted[targetIndex - 1].position
  const after = sorted[targetIndex].position
  return (before + after) / 2
}

/**
 * Calculate position when dropping on a specific item (before or after based on mouse position).
 */
export function getPositionRelativeToItem<T extends PositionedItem>(
  items: T[],
  targetItemId: string,
  dropBefore: boolean
): number {
  const sorted = [...items].sort((a, b) => a.position - b.position)
  const targetIndex = sorted.findIndex((item) => item._id === targetItemId)

  if (targetIndex === -1) {
    // Target not found, append to end
    return sorted.length > 0 ? sorted[sorted.length - 1].position + 1.0 : 1.0
  }

  if (dropBefore) {
    // Drop before target item
    const before = targetIndex > 0 ? sorted[targetIndex - 1].position : null
    const after = sorted[targetIndex].position
    return getPositionBetween(before, after)
  } else {
    // Drop after target item
    const before = sorted[targetIndex].position
    const after = targetIndex < sorted.length - 1 ? sorted[targetIndex + 1].position : null
    return getPositionBetween(before, after)
  }
}

/**
 * Get position for appending to end of a zone.
 */
export function getPositionAtEnd<T extends PositionedItem>(items: T[]): number {
  if (items.length === 0) {
    return 1.0
  }
  const maxPosition = Math.max(...items.map((item) => item.position))
  return maxPosition + 1.0
}
