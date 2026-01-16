/**
 * DnD Provider component that wraps the app and handles drag events.
 */

import { useState, useCallback } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { BlockDragOverlay } from "./BlockDragOverlay"
import { getPositionBetween, getPositionAtEnd } from "../../lib/positioning"
import type { BlockDragData, Zone, ZoneDropData } from "./types"
import { useSession } from "../../contexts/SessionContext"

interface DndProviderProps {
  children: React.ReactNode
}

export function DndProvider({ children }: DndProviderProps) {
  const [activeBlockId, setActiveBlockId] = useState<Id<"blocks"> | null>(null)
  const [activeBlock, setActiveBlock] = useState<{ content: string; type: string } | null>(null)

  // Get session from context
  const { sessionId } = useSession()

  // Convex mutations
  const moveBlock = useMutation(api.blocks.move)
  const reorderBlock = useMutation(api.blocks.reorder)

  // Query all blocks for position calculations (skip if no session)
  const allBlocks = useQuery(
    api.blocks.list,
    sessionId ? { sessionId } : "skip"
  )

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as BlockDragData | undefined
    if (data?.type === "block") {
      setActiveBlockId(data.blockId)
      // Find the block content for the overlay
      const block = allBlocks?.find((b) => b._id === data.blockId)
      if (block) {
        setActiveBlock({ content: block.content, type: block.type })
      }
    }
  }, [allBlocks])

  // Handle drag end
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveBlockId(null)
    setActiveBlock(null)

    if (!over || !allBlocks) return

    const activeData = active.data.current as BlockDragData | undefined
    if (activeData?.type !== "block") return

    const blockId = activeData.blockId
    const sourceZone = activeData.zone

    // Determine target zone and position
    const overData = over.data.current as BlockDragData | ZoneDropData | undefined

    let targetZone: Zone
    let newPosition: number

    if (overData?.type === "zone") {
      // Dropped on empty zone area
      targetZone = overData.zone
      const zoneBlocks = allBlocks.filter((b) => b.zone === targetZone)
      newPosition = getPositionAtEnd(zoneBlocks)
    } else if (overData?.type === "block") {
      // Dropped on another block
      targetZone = overData.zone
      const zoneBlocks = allBlocks.filter((b) => b.zone === targetZone)
      const sortedBlocks = [...zoneBlocks].sort((a, b) => a.position - b.position)

      const overIndex = sortedBlocks.findIndex((b) => b._id === over.id)
      if (overIndex === -1) {
        newPosition = getPositionAtEnd(sortedBlocks)
      } else {
        // Insert before the target block
        const before = overIndex > 0 ? sortedBlocks[overIndex - 1].position : null
        const after = sortedBlocks[overIndex].position
        newPosition = getPositionBetween(before, after)
      }
    } else {
      // Unknown drop target
      return
    }

    // Skip if dropped on itself in same position
    if (blockId === over.id && sourceZone === targetZone) {
      return
    }

    // Perform the move/reorder
    if (sourceZone !== targetZone) {
      // Cross-zone move
      await moveBlock({ id: blockId, zone: targetZone })
      // Update position after move
      await reorderBlock({ id: blockId, newPosition })
    } else {
      // Same-zone reorder
      await reorderBlock({ id: blockId, newPosition })
    }
  }, [allBlocks, moveBlock, reorderBlock])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <BlockDragOverlay activeBlock={activeBlock} />
    </DndContext>
  )
}
