/**
 * DnD Provider component that wraps the app and handles drag events.
 * Provides optimistic zone ordering to prevent flash-of-old-order on drop.
 */

import { useState, useCallback, useRef, useEffect, useMemo, createContext, useContext } from "react"
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
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

interface ActiveBlockInfo {
  _id: Id<"blocks">
  content: string
  type: string
  zone: Zone
  position: number
  createdAt: number
  tokens?: number
  isCompressed?: boolean
  compressionRatio?: number
  metadata?: Record<string, unknown>
}

interface DndOptimisticState {
  optimisticOrder: OptimisticZoneOrder
  activeBlock: ActiveBlockInfo | null
}

const DndOptimisticContext = createContext<DndOptimisticState>({
  optimisticOrder: {},
  activeBlock: null,
})
export function useDndOptimistic() { return useContext(DndOptimisticContext) }

interface DndProviderProps {
  children: React.ReactNode
}

export function DndProvider({ children }: DndProviderProps) {
  const [activeBlock, setActiveBlock] = useState<{ content: string; type: string } | null>(null)
  const [activeBlockInfo, setActiveBlockInfo] = useState<ActiveBlockInfo | null>(null)
  const [optimisticOrder, setOptimisticOrder] = useState<OptimisticZoneOrder>({})
  const activeContainerRef = useRef<Zone | null>(null)
  const sourceZoneRef = useRef<Zone | null>(null)   // original zone, never changes during drag
  const isDraggingRef = useRef(false)
  const optimisticOrderRef = useRef(optimisticOrder)
  optimisticOrderRef.current = optimisticOrder

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

  // Clear optimistic state when server data catches up (but not mid-drag)
  useEffect(() => {
    if (!isDraggingRef.current) {
      setOptimisticOrder({})
      setActiveBlockInfo(null)
    }
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
        setActiveBlockInfo({
          _id: block._id,
          content: block.content,
          type: block.type,
          zone: data.zone,
          position: block.position,
          createdAt: block.createdAt,
          tokens: block.tokens ?? undefined,
          isCompressed: block.isCompressed,
          compressionRatio: block.compressionRatio ?? undefined,
          metadata: block.metadata ?? undefined,
        })
        activeContainerRef.current = data.zone
        sourceZoneRef.current = data.zone
        isDraggingRef.current = true
      }
    }
  }, [])

  // Handle drag over — only handles zone boundary crossings.
  // Within-zone visual reordering is handled by SortableContext transforms.
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as BlockDragData | undefined
    if (activeData?.type !== "block") return

    const overData = over.data.current as BlockDragData | ZoneDropData | undefined
    if (!overData) return

    const overZone = overData.zone
    if (!overZone || overZone === activeContainerRef.current) return

    const blockId = activeData.blockId
    const currentZone = activeContainerRef.current!
    const blocks = allBlocksRef.current
    if (!blocks) return

    // Remove from current zone
    const currentZoneBlocks = blocks
      .filter((b) => b.zone === currentZone)
      .sort((a, b) => a.position - b.position)
    const sourceIds = currentZoneBlocks.map((b) => b._id).filter((id) => id !== blockId)

    // Add to target zone (filter blockId first — may exist if dragging back to source)
    const targetZoneBlocks = blocks
      .filter((b) => b.zone === overZone)
      .sort((a, b) => a.position - b.position)
    const targetIds = targetZoneBlocks.map((b) => b._id).filter((id) => id !== blockId)

    if (overData.type === "block") {
      const overIdx = targetIds.indexOf(over.id as Id<"blocks">)
      if (overIdx !== -1) {
        targetIds.splice(overIdx, 0, blockId)
      } else {
        targetIds.push(blockId)
      }
    } else {
      targetIds.push(blockId)
    }

    activeContainerRef.current = overZone

    setOptimisticOrder((prev) => ({
      ...prev,
      [currentZone]: sourceIds,
      [overZone]: targetIds,
    }))
  }, [])

  // Handle drag cancel — reset all drag state
  const handleDragCancel = useCallback(() => {
    setActiveBlock(null)
    setActiveBlockInfo(null)
    setOptimisticOrder({})
    activeContainerRef.current = null
    sourceZoneRef.current = null
    isDraggingRef.current = false
  }, [])

  // Handle drag end — uses ref to avoid recreating on Convex updates
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveBlock(null)
    // Keep activeBlockInfo alive — needed for optimistic rendering of the
    // synthetic block in the target zone until server data catches up.
    // Cleared by the useEffect when allBlocks updates.
    const draggedToZone = activeContainerRef.current
    const sourceZone = sourceZoneRef.current  // original zone — immune to SortableBlock re-registration
    isDraggingRef.current = false
    activeContainerRef.current = null
    sourceZoneRef.current = null

    // Blur the drag handle so Enter doesn't re-trigger a keyboard drag
    ;(document.activeElement as HTMLElement)?.blur()

    const blocks = allBlocksRef.current
    const activeData = active.data.current as BlockDragData | undefined
    if (activeData?.type !== "block" || !blocks || !sourceZone) {
      setActiveBlockInfo(null)
      setOptimisticOrder({})
      return
    }

    const blockId = activeData.blockId

    // Determine target zone from cursor position — closestCorners can attribute
    // the cursor to the wrong zone near boundaries, so we check which zone
    // container actually contains the drag cursor.
    let targetZone: Zone | null = null
    const overData = over?.data.current as BlockDragData | ZoneDropData | undefined

    const activeTranslated = active.rect.current.translated
    if (activeTranslated) {
      const cursorX = activeTranslated.left + activeTranslated.width / 2
      const cursorY = activeTranslated.top + activeTranslated.height / 2
      const zoneEls = document.querySelectorAll("[data-droppable-zone]")
      for (const el of zoneEls) {
        const rect = el.getBoundingClientRect()
        if (cursorX >= rect.left && cursorX <= rect.right && cursorY >= rect.top && cursorY <= rect.bottom) {
          targetZone = el.getAttribute("data-droppable-zone") as Zone
          break
        }
      }
    }

    // Fallback: over element's zone, then draggedToZone from onDragOver
    if (!targetZone) {
      if (overData?.type === "zone" || overData?.type === "block") {
        targetZone = overData.zone
      } else if (draggedToZone && draggedToZone !== sourceZone) {
        targetZone = draggedToZone
      }
    }

    if (!targetZone) {
      setActiveBlockInfo(null)
      setOptimisticOrder({})
      return
    }

    // Skip if dropped on itself in same zone
    if (over && blockId === over.id && sourceZone === targetZone) {
      setActiveBlockInfo(null)
      setOptimisticOrder({})
      return
    }

    if (sourceZone === targetZone) {
      // ── Same-zone reorder — no synthetic block needed ──
      setActiveBlockInfo(null)

      const zoneBlocks = blocks.filter((b) => b.zone === sourceZone).sort((a, b) => a.position - b.position)
      const ids = zoneBlocks.map((b) => b._id)

      if (!over || overData?.type === "zone") {
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
      // Keep activeBlockInfo for optimistic rendering — useEffect clears it.

      // Remove from source
      const sourceIds = blocks
        .filter((b) => b.zone === sourceZone)
        .sort((a, b) => a.position - b.position)
        .map((b) => b._id)
        .filter((id) => id !== blockId)

      // Compute position from the `over` element directly using a midpoint
      // check (center-to-center) to determine before/after. Don't use the
      // stale optimistic order — SortableContext transforms may have moved
      // the ghost to a different visual position than the optimistic array index.
      const targetBlocks = blocks.filter((b) => b.zone === targetZone).sort((a, b) => a.position - b.position)
      const targetIds = targetBlocks.map((b) => b._id).filter((id) => id !== blockId)
      let newPosition: number

      if (over && overData?.type === "block" && over.id !== blockId) {
        const overIdx = targetIds.indexOf(over.id as Id<"blocks">)
        if (overIdx !== -1) {
          // Midpoint check: is the drag center below the over element's center?
          // Use live DOM rect (getBoundingClientRect includes CSS transforms)
          // instead of over.rect which may be stale if SortableContext shifted items.
          const activeTranslated = active.rect.current.translated
          const overEl = document.querySelector(`[data-block-id="${over.id}"]`)
          const overRect = overEl ? overEl.getBoundingClientRect() : over.rect
          const insertAfter = activeTranslated != null &&
            activeTranslated.top + activeTranslated.height / 2 > overRect.top + overRect.height / 2
          const insertIdx = insertAfter ? overIdx + 1 : overIdx
          targetIds.splice(insertIdx, 0, blockId)

          // Compute fractional position from neighbors at the insertion point
          const beforeBlock = insertIdx > 0 ? targetBlocks.find((b) => b._id === targetIds[insertIdx - 1]) : null
          const afterBlock = insertIdx < targetIds.length - 1 ? targetBlocks.find((b) => b._id === targetIds[insertIdx + 1]) : null
          newPosition = getPositionBetween(beforeBlock?.position ?? null, afterBlock?.position ?? null)
        } else {
          targetIds.push(blockId)
          newPosition = getPositionAtEnd(targetBlocks)
        }
      } else if (over && over.id === blockId && targetIds.length > 0) {
        // Phantom: cursor landed on the ghost block in the target zone.
        // Use DOM measurement to determine visual insertion point relative
        // to other blocks (which SortableContext may have shifted via transforms).
        const activeTranslated = active.rect.current.translated
        if (activeTranslated) {
          const dragCenter = activeTranslated.top + activeTranslated.height / 2
          let insertIdx = targetIds.length // default: after all blocks
          for (let i = 0; i < targetIds.length; i++) {
            const el = document.querySelector(`[data-block-id="${targetIds[i]}"]`)
            if (el) {
              const rect = el.getBoundingClientRect()
              if (dragCenter < rect.top + rect.height / 2) {
                insertIdx = i
                break
              }
            }
          }
          targetIds.splice(insertIdx, 0, blockId)
          const beforeBlock = insertIdx > 0 ? targetBlocks.find((b) => b._id === targetIds[insertIdx - 1]) : null
          const afterBlock = insertIdx < targetIds.length - 1 ? targetBlocks.find((b) => b._id === targetIds[insertIdx + 1]) : null
          newPosition = getPositionBetween(beforeBlock?.position ?? null, afterBlock?.position ?? null)
        } else {
          targetIds.push(blockId)
          newPosition = getPositionAtEnd(targetBlocks)
        }
      } else {
        // Dropped on zone droppable or no over — append to end
        targetIds.push(blockId)
        newPosition = getPositionAtEnd(targetBlocks)
      }

      setOptimisticOrder({ [sourceZone]: sourceIds, [targetZone]: targetIds })

      await moveAndReorder({ id: blockId, zone: targetZone, newPosition })
    }
  }, [moveAndReorder, reorderBlock])

  const contextValue = useMemo<DndOptimisticState>(() => ({
    optimisticOrder,
    activeBlock: activeBlockInfo,
  }), [optimisticOrder, activeBlockInfo])

  return (
    <DndOptimisticContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <BlockDragOverlay activeBlock={activeBlock} />
      </DndContext>
    </DndOptimisticContext.Provider>
  )
}
