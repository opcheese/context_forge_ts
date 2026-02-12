/**
 * DnD Provider component that wraps the app and handles drag events.
 * Provides optimistic zone ordering to prevent flash-of-old-order on drop.
 */

import { useState, useCallback, useRef, useEffect, createContext, useContext } from "react"
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { BlockDragOverlay } from "./BlockDragOverlay"
import { getPositionBetween, getPositionAtEnd } from "../../lib/positioning"
import type { BlockDragData, Zone, ZoneDropData } from "./types"
import { useSession } from "../../contexts/SessionContext"
import type { Id } from "../../../convex/_generated/dataModel"

// Optimistic zone ordering — maps zone name to expected block ID order
type OptimisticZoneOrder = Partial<Record<Zone, Id<"blocks">[]>>
const DndOptimisticContext = createContext<OptimisticZoneOrder>({})
export function useDndOptimistic() { return useContext(DndOptimisticContext) }

interface DndProviderProps {
  children: React.ReactNode
}

export function DndProvider({ children }: DndProviderProps) {
  const [activeBlock, setActiveBlock] = useState<{ content: string; type: string } | null>(null)
  const [optimisticOrder, setOptimisticOrder] = useState<OptimisticZoneOrder>({})

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

  // Ref-stabilize allBlocks so callbacks don't recreate on every Convex update
  const allBlocksRef = useRef(allBlocks)
  allBlocksRef.current = allBlocks

  // Clear optimistic state when server data catches up
  useEffect(() => {
    setOptimisticOrder({})
  }, [allBlocks])

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

  // Handle drag start — uses ref to avoid recreating on Convex updates
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as BlockDragData | undefined
    if (data?.type === "block") {
      const block = allBlocksRef.current?.find((b) => b._id === data.blockId)
      if (block) {
        setActiveBlock({ content: block.content, type: block.type })
      }
    }
  }, [])

  // Handle drag end — uses ref to avoid recreating on Convex updates
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveBlock(null)

    // Blur the drag handle so Enter doesn't re-trigger a keyboard drag
    ;(document.activeElement as HTMLElement)?.blur()

    const blocks = allBlocksRef.current
    if (!over || !blocks) return

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
      const zoneBlocks = blocks.filter((b) => b.zone === targetZone)
      newPosition = getPositionAtEnd(zoneBlocks)
    } else if (overData?.type === "block") {
      // Dropped on another block
      targetZone = overData.zone
      const zoneBlocks = blocks.filter((b) => b.zone === targetZone)
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

    // Compute optimistic order for immediate visual feedback before mutation round-trip.
    // Must mirror position calculation logic: remove block, insert before target.
    if (sourceZone === targetZone) {
      // Same-zone reorder: remove then insert-before-target (matches fractional position calc)
      const zoneBlocks = blocks.filter((b) => b.zone === sourceZone).sort((a, b) => a.position - b.position)
      const ids = zoneBlocks.map((b) => b._id)
      const idsWithout = ids.filter((id) => id !== blockId)
      const targetIdx = idsWithout.indexOf(over.id as Id<"blocks">)
      if (targetIdx !== -1) {
        idsWithout.splice(targetIdx, 0, blockId)
        setOptimisticOrder({ [sourceZone]: idsWithout })
      }
    } else {
      // Cross-zone: remove from source, add to target end
      const sourceIds = blocks
        .filter((b) => b.zone === sourceZone)
        .sort((a, b) => a.position - b.position)
        .map((b) => b._id)
        .filter((id) => id !== blockId)
      const targetBlocks = blocks.filter((b) => b.zone === targetZone).sort((a, b) => a.position - b.position)
      const targetIds = targetBlocks.map((b) => b._id)
      // Insert at the drop position
      if (overData?.type === "block") {
        const overIdx = targetIds.indexOf(over.id as Id<"blocks">)
        if (overIdx !== -1) {
          targetIds.splice(overIdx, 0, blockId)
        } else {
          targetIds.push(blockId)
        }
      } else {
        targetIds.push(blockId)
      }
      setOptimisticOrder({ [sourceZone]: sourceIds, [targetZone]: targetIds })
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
  }, [moveBlock, reorderBlock])

  return (
    <DndOptimisticContext.Provider value={optimisticOrder}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
        <BlockDragOverlay activeBlock={activeBlock} />
      </DndContext>
    </DndOptimisticContext.Provider>
  )
}
