/**
 * Types for drag-and-drop system.
 */

import type { Id } from "../../../convex/_generated/dataModel"

// Zone types
export const ZONES = ["PERMANENT", "STABLE", "WORKING"] as const
export type Zone = (typeof ZONES)[number]

// Drag data attached to draggable items
export interface BlockDragData {
  type: "block"
  blockId: Id<"blocks">
  zone: Zone
  position: number
}

// Drop data attached to droppable zones
export interface ZoneDropData {
  type: "zone"
  zone: Zone
}

// Combined drag/drop data type
export type DragData = BlockDragData | ZoneDropData
