/**
 * Ghost preview shown during drag operations.
 */

import { DragOverlay } from "@dnd-kit/core"

interface BlockDragOverlayProps {
  activeBlock: {
    content: string
    type: string
  } | null
}

export function BlockDragOverlay({ activeBlock }: BlockDragOverlayProps) {
  if (!activeBlock) return null

  return (
    <DragOverlay>
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg rotate-2 opacity-90 max-w-xs">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {activeBlock.type}
          </span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap break-words line-clamp-3">
          {activeBlock.content}
        </p>
      </div>
    </DragOverlay>
  )
}
