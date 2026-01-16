/**
 * Wrapper component that makes a zone a drop target.
 * Also provides SortableContext for items within the zone.
 */

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import type { Id } from "../../../convex/_generated/dataModel"
import type { Zone, ZoneDropData } from "./types"

interface DroppableZoneProps {
  zone: Zone
  itemIds: Id<"blocks">[]
  children: React.ReactNode
}

export function DroppableZone({ zone, itemIds, children }: DroppableZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `zone-${zone}`,
    data: {
      type: "zone",
      zone,
    } satisfies ZoneDropData,
  })

  return (
    <div
      ref={setNodeRef}
      data-droppable-zone={zone}
      data-drop-active={isOver}
      className={`
        flex-1 transition-colors duration-200
        ${isOver ? "bg-primary/5 ring-2 ring-primary/20 ring-inset" : ""}
      `}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  )
}
