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
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
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
  const moveAndReorder = useMutation(api.blocks.moveAndReorder)
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

    // Determine target zone
    const overData = over.data.current as BlockDragData | ZoneDropData | undefined

    let targetZone: Zone

    if (overData?.type === "zone") {
      targetZone = overData.zone
    } else if (overData?.type === "block") {
      targetZone = overData.zone
    } else {
      return
    }

    // Skip if dropped on itself in same zone
    if (blockId === over.id && sourceZone === targetZone) {
      return
    }

    if (sourceZone === targetZone) {
      // ── Same-zone reorder ──
      // Use arrayMove to compute the new order — this matches @dnd-kit's
      // verticalListSortingStrategy visual feedback exactly.
      const zoneBlocks = blocks.filter((b) => b.zone === sourceZone).sort((a, b) => a.position - b.position)
      const ids = zoneBlocks.map((b) => b._id)

      if (overData?.type === "zone") {
        // Dropped on empty zone area — move to end
        const idsWithout = ids.filter((id) => id !== blockId)
        idsWithout.push(blockId)
        setOptimisticOrder({ [sourceZone]: idsWithout })

        const newPosition = getPositionAtEnd(zoneBlocks.filter((b) => b._id !== blockId))
        await reorderBlock({ id: blockId, newPosition })
      } else {
        const oldIndex = ids.indexOf(blockId)
        const newIndex = ids.indexOf(over.id as Id<"blocks">)

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

        // arrayMove: matches the visual sort preview
        const reordered = arrayMove(ids, oldIndex, newIndex)
        setOptimisticOrder({ [sourceZone]: reordered })

        // Derive position from the new neighbors in the reordered list
        const newPos = reordered.indexOf(blockId)
        const beforeId = newPos > 0 ? reordered[newPos - 1] : null
        const afterId = newPos < reordered.length - 1 ? reordered[newPos + 1] : null
        const beforePosition = beforeId ? zoneBlocks.find((b) => b._id === beforeId)?.position ?? null : null
        const afterPosition = afterId ? zoneBlocks.find((b) => b._id === afterId)?.position ?? null : null
        const newPosition = getPositionBetween(beforePosition, afterPosition)

        await reorderBlock({ id: blockId, newPosition })
      }
    } else {
      // ── Cross-zone move ──
      // Remove from source
      const sourceIds = blocks
        .filter((b) => b.zone === sourceZone)
        .sort((a, b) => a.position - b.position)
        .map((b) => b._id)
        .filter((id) => id !== blockId)

      // Insert into target
      const targetBlocks = blocks.filter((b) => b.zone === targetZone).sort((a, b) => a.position - b.position)
      const targetIds = targetBlocks.map((b) => b._id)

      let newPosition: number

      if (overData?.type === "block") {
        // Dropped on a block in target zone — insert before it
        const overIdx = targetIds.indexOf(over.id as Id<"blocks">)
        if (overIdx !== -1) {
          targetIds.splice(overIdx, 0, blockId)
          const before = overIdx > 0 ? targetBlocks[overIdx - 1].position : null
          const after = targetBlocks[overIdx].position
          newPosition = getPositionBetween(before, after)
        } else {
          targetIds.push(blockId)
          newPosition = getPositionAtEnd(targetBlocks)
        }
      } else {
        // Dropped on zone area — append to end
        targetIds.push(blockId)
        newPosition = getPositionAtEnd(targetBlocks)
      }

      setOptimisticOrder({ [sourceZone]: sourceIds, [targetZone]: targetIds })

      // Single mutation — no intermediate render between move and reorder
      await moveAndReorder({ id: blockId, zone: targetZone, newPosition })
    }
  }, [moveAndReorder, reorderBlock])

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
