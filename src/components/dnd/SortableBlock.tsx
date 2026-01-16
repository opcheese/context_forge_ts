/**
 * Wrapper component that makes a block draggable and sortable.
 */

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Id } from "../../../convex/_generated/dataModel"
import type { BlockDragData, Zone } from "./types"

interface SortableBlockProps {
  id: Id<"blocks">
  zone: Zone
  position: number
  children: React.ReactNode
}

export function SortableBlock({ id, zone, position, children }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type: "block",
      blockId: id,
      zone,
      position,
    } satisfies BlockDragData,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-block-id={id}
      data-zone={zone}
      data-dragging={isDragging}
    >
      {children}
    </div>
  )
}
