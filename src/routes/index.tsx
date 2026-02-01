/**
 * Home page - Zone layout with blocks.
 * Compact UI optimized for vertical space.
 */

import { useState, useMemo } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import type { Id } from "../../convex/_generated/dataModel"
import { DroppableZone, SortableBlock, ZONES, type Zone } from "@/components/dnd"
import { useFileDrop } from "@/hooks/useFileDrop"
import { useSession } from "@/contexts/SessionContext"
import { GeneratePanel } from "@/components/GeneratePanel"
import { BrainstormPanel } from "@/components/BrainstormPanel"
import { SessionMetrics, ZoneHeader } from "@/components/metrics"
import { ContextExport } from "@/components/ContextExport"
import { cn } from "@/lib/utils"
import {
  BLOCK_TYPE_METADATA,
  getBlockTypesByCategory,
  getBlockTypeMetadata,
  CATEGORY_LABELS,
  type BlockType,
} from "@/lib/blockTypes"
import { useNavigate } from "@tanstack/react-router"
import { useCompression } from "@/hooks/useCompression"
import { useConfirmDelete } from "@/hooks/useConfirmDelete"
import { Minimize2 } from "lucide-react"
import { CompressionDialog } from "@/components/compression/CompressionDialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DebouncedButton } from "@/components/ui/debounced-button"
import { useToast } from "@/components/ui/toast"

// Zone display info
const ZONE_INFO: Record<Zone, { label: string; description: string }> = {
  PERMANENT: { label: "Permanent", description: "Always included" },
  STABLE: { label: "Stable", description: "Reference material" },
  WORKING: { label: "Working", description: "Draft content" },
}

// Simple client-side token estimation (4 chars/token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Compact add block form
function AddBlockForm({ sessionId }: { sessionId: Id<"sessions"> }) {
  const [content, setContent] = useState("")
  const [type, setType] = useState<BlockType>("note")
  const [zone, setZone] = useState<Zone>("WORKING")
  const [isExpanded, setIsExpanded] = useState(false)
  const blockTypesByCategory = useMemo(() => getBlockTypesByCategory(), [])
  const createBlock = useMutation(api.blocks.create)
  const metrics = useQuery(api.metrics.getZoneMetrics, { sessionId })

  const estimatedTokens = useMemo(() => {
    if (!content.trim()) return 0
    return estimateTokens(content.trim())
  }, [content])

  const budgetStatus = useMemo(() => {
    if (!metrics || !content.trim()) return null
    const zoneData = metrics.zones[zone]
    if (!zoneData) return null
    const newTotal = zoneData.tokens + estimatedTokens
    const percentUsed = Math.round((newTotal / zoneData.budget) * 100)
    return {
      percentUsed,
      wouldExceed: newTotal > zoneData.budget,
      isWarning: percentUsed > 80 && percentUsed <= 95,
      isDanger: percentUsed > 95,
    }
  }, [metrics, zone, estimatedTokens, content])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || budgetStatus?.wouldExceed) return
    await createBlock({ sessionId, content: content.trim(), type, zone })
    setContent("")
    setIsExpanded(false)
  }

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="h-7 text-xs"
      >
        + Add Block
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded border border-border bg-card p-3 space-y-2">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => {
            const newType = e.target.value as BlockType
            setType(newType)
            const meta = BLOCK_TYPE_METADATA[newType]
            if (meta) setZone(meta.defaultZone)
          }}
          className="rounded border border-input bg-background px-2 py-1 text-xs flex-1"
        >
          {Object.entries(blockTypesByCategory).map(([category, types]) => (
            <optgroup key={category} label={CATEGORY_LABELS[category]}>
              {types.map((t) => (
                <option key={t} value={t}>{BLOCK_TYPE_METADATA[t].displayName}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value as Zone)}
          className="rounded border border-input bg-background px-2 py-1 text-xs"
        >
          {ZONES.map((z) => (
            <option key={z} value={z}>{ZONE_INFO[z].label}</option>
          ))}
        </select>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Block content..."
        rows={2}
        className={cn(
          "w-full rounded border bg-background px-2 py-1.5 text-sm resize-none",
          budgetStatus?.wouldExceed ? "border-destructive" : "border-input"
        )}
        autoFocus
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {estimatedTokens > 0 && `~${estimatedTokens} tokens`}
          {budgetStatus?.wouldExceed && (
            <span className="text-destructive ml-2">Exceeds budget</span>
          )}
        </span>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setIsExpanded(false)}>
            Cancel
          </Button>
          <DebouncedButton type="submit" size="sm" className="h-6 px-2 text-xs" disabled={!content.trim() || budgetStatus?.wouldExceed} debounceMs={300}>
            Add
          </DebouncedButton>
        </div>
      </div>
    </form>
  )
}

// Collapsible tools section
function ToolsSection({ sessionId }: { sessionId: Id<"sessions"> }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-7 px-2 text-xs text-muted-foreground"
      >
        {isOpen ? "▼" : "▶"} Tools
      </Button>
      {isOpen && (
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SessionMetrics sessionId={sessionId} />
            <ContextExport sessionId={sessionId} />
          </div>
          <GeneratePanel sessionId={sessionId} />
        </div>
      )}
    </div>
  )
}

// Format relative time
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return "now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

// Compact block card
function BlockCard({
  id,
  content,
  type,
  zone,
  createdAt,
  tokens,
  isCompressed,
  compressionRatio,
  sessionId,
  isSelected,
  onSelect,
}: {
  id: Id<"blocks">
  content: string
  type: string
  zone: Zone
  createdAt: number
  tokens?: number
  isCompressed?: boolean
  compressionRatio?: number
  sessionId: Id<"sessions">
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
}) {
  const [showActions, setShowActions] = useState(false)
  const removeBlock = useMutation(api.blocks.remove)
  const moveBlock = useMutation(api.blocks.move)
  const { toast } = useToast()

  // Delete confirmation
  const deleteConfirm = useConfirmDelete({
    onDelete: async () => {
      await removeBlock({ id })
    },
    getTitle: () => "Delete this block?",
    getDescription: () => {
      const preview = content.slice(0, 100)
      return `"${preview}${content.length > 100 ? "..." : ""}" will be permanently deleted.`
    },
  })

  // Compression hook
  const { compressSingle, isCompressing } = useCompression({
    sessionId,
    onSuccess: (result) => {
      toast.success(
        "Block compressed!",
        `Saved ${result.tokensSaved} tokens (${result.compressionRatio.toFixed(1)}x)`
      )
    },
    onError: (error) => {
      toast.error("Compression failed", error)
    },
  })

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteConfirm.requestDelete({ id, content })
  }

  const handleMove = async (e: React.MouseEvent, targetZone: Zone) => {
    e.stopPropagation()
    await moveBlock({ id, zone: targetZone })
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(content)
  }

  const handleCompress = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await compressSingle(
      { _id: id, content, type, tokens, isCompressed },
      "semantic"
    )
  }

  const typeMeta = getBlockTypeMetadata(type)
  const otherZones = ZONES.filter((z) => z !== zone)

  // Check if block is suitable for compression
  // Allow re-compression of already compressed blocks
  const canCompress = (tokens ?? 0) >= 100

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    onSelect?.(e.target.checked)
  }

  return (
    <div
      className={cn(
        "rounded border bg-card p-2 select-none hover:border-border/80 transition-colors",
        isSelected ? "border-primary bg-primary/5" : "border-border"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {onSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
              className="shrink-0 w-3 h-3 rounded border-input"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", typeMeta.color)}>
            {typeMeta.displayName}
          </span>
          <span className="text-[10px] text-muted-foreground">{formatTimeAgo(createdAt)}</span>
          {tokens && <span className="text-[10px] text-muted-foreground font-mono">{tokens}t</span>}
          {isCompressed && compressionRatio && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
              <Minimize2 className="w-2.5 h-2.5" />
              {compressionRatio.toFixed(1)}x
            </span>
          )}
        </div>
        {showActions && (
          <div className="flex gap-0.5 shrink-0">
            {canCompress && (
              <DebouncedButton
                onClick={handleCompress}
                disabled={isCompressing}
                variant="ghost"
                size="sm"
                className="h-auto px-1.5 py-0.5 text-[10px]"
                debounceMs={300}
              >
                {isCompressing ? "..." : "Compress"}
              </DebouncedButton>
            )}
            <button onClick={handleCopy} className="px-1.5 py-0.5 text-[10px] rounded hover:bg-muted">Copy</button>
            <Link
              to="/blocks/$blockId"
              params={{ blockId: id }}
              onClick={(e) => e.stopPropagation()}
              className="px-1.5 py-0.5 text-[10px] rounded hover:bg-muted"
            >
              Edit
            </Link>
            <button onClick={handleDelete} className="px-1.5 py-0.5 text-[10px] rounded hover:bg-destructive/10 text-destructive">Del</button>
          </div>
        )}
      </div>
      <p className="text-xs text-foreground whitespace-pre-wrap break-words line-clamp-2 leading-tight">
        {content}
      </p>
      {showActions && (
        <div className="flex gap-1 mt-1">
          {otherZones.map((z) => (
            <button
              key={z}
              onClick={(e) => handleMove(e, z)}
              className="px-1.5 py-0.5 text-[10px] rounded border border-input hover:bg-muted"
            >
              → {ZONE_INFO[z].label}
            </button>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteConfirm.isOpen}
        onOpenChange={(open) => !open && deleteConfirm.cancelDelete()}
        title={deleteConfirm.title}
        description={deleteConfirm.description}
        onConfirm={deleteConfirm.confirmDelete}
        loading={deleteConfirm.isDeleting}
      />
    </div>
  )
}

// Zone column
function ZoneColumn({
  sessionId,
  zone,
  zoneMetrics,
  selectedBlockIds,
  onBlockSelect,
}: {
  sessionId: Id<"sessions">
  zone: Zone
  zoneMetrics?: { blocks: number; tokens: number; budget: number; percentUsed: number }
  selectedBlockIds: Set<Id<"blocks">>
  onBlockSelect: (blockId: Id<"blocks">, selected: boolean) => void
}) {
  const [isZoneCompressionDialogOpen, setIsZoneCompressionDialogOpen] = useState(false)
  const blocks = useQuery(api.blocks.listByZone, { sessionId, zone })
  const info = ZONE_INFO[zone]
  const { toast } = useToast()
  const { isDragOver, dropProps } = useFileDrop({
    sessionId,
    zone,
    onSuccess: () => {},
    onError: () => {},
  })

  // Compression hook for zone compression
  const {
    compressAndMerge,
    isCompressing: isZoneCompressing,
    result: zoneCompressResult,
    error: zoneCompressError,
  } = useCompression({
    sessionId,
    onSuccess: (result) => {
      toast.success(
        `${info.label} zone compressed!`,
        `Merged ${blocks?.length} blocks, saved ${result.tokensSaved} tokens`
      )
    },
    onError: (error) => {
      toast.error(`Zone compression failed`, error)
    },
  })

  const handleZoneCompress = () => {
    setIsZoneCompressionDialogOpen(true)
  }

  const handleZoneCompressConfirm = async (targetZone: string, targetType: string) => {
    if (!blocks || blocks.length === 0) return
    await compressAndMerge(
      blocks.map((b) => ({
        _id: b._id,
        content: b.content,
        type: b.type,
        tokens: b.tokens ?? undefined,
        isCompressed: b.isCompressed,
      })),
      {
        strategy: "semantic",
        targetZone: zone, // Keep in same zone
        targetType,
      }
    )
  }

  const sortedBlocks = blocks ? [...blocks].sort((a, b) => a.position - b.position) : []
  const blockIds = sortedBlocks.map((b) => b._id)
  const isDanger = zoneMetrics && zoneMetrics.percentUsed > 95
  const isWarning = zoneMetrics && zoneMetrics.percentUsed > 80 && zoneMetrics.percentUsed <= 95

  return (
    <div className="flex flex-col h-full relative" {...dropProps}>
      <div className="mb-2">
        {zoneMetrics ? (
          <ZoneHeader
            zone={info.label}
            blockCount={zoneMetrics.blocks}
            tokens={zoneMetrics.tokens}
            budget={zoneMetrics.budget}
            onCompress={handleZoneCompress}
            isCompressing={isZoneCompressing}
          />
        ) : (
          <h3 className="text-sm font-semibold">{info.label}</h3>
        )}
        {isDanger && (
          <div className="mt-1 p-1 rounded bg-destructive/10 text-destructive text-[10px]">
            {zoneMetrics?.percentUsed}% - consider archiving
          </div>
        )}
        {isWarning && (
          <div className="mt-1 p-1 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[10px]">
            {zoneMetrics?.percentUsed}% used
          </div>
        )}
      </div>

      <DroppableZone zone={zone} itemIds={blockIds}>
        <div className="flex-1 space-y-1.5 min-h-[60px] overflow-y-auto">
          {blocks === undefined ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : sortedBlocks.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded">
              Drop here
            </div>
          ) : (
            sortedBlocks.map((block) => (
              <SortableBlock key={block._id} id={block._id} zone={block.zone} position={block.position}>
                <BlockCard
                  id={block._id}
                  content={block.content}
                  type={block.type}
                  zone={block.zone}
                  createdAt={block.createdAt}
                  tokens={block.tokens ?? undefined}
                  isCompressed={block.isCompressed}
                  compressionRatio={block.compressionRatio}
                  sessionId={sessionId}
                  isSelected={selectedBlockIds.has(block._id)}
                  onSelect={(selected) => onBlockSelect(block._id, selected)}
                />
              </SortableBlock>
            ))
          )}
        </div>
      </DroppableZone>

      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded z-10">
          <div className="text-xs font-medium text-primary">Drop file</div>
        </div>
      )}

      {/* Zone compression dialog */}
      {blocks && (
        <CompressionDialog
          isOpen={isZoneCompressionDialogOpen}
          onClose={() => setIsZoneCompressionDialogOpen(false)}
          blocks={blocks.map((b) => ({
            _id: b._id,
            content: b.content,
            type: b.type,
            tokens: b.tokens ?? undefined,
            isCompressed: b.isCompressed,
          }))}
          onCompress={handleZoneCompressConfirm}
          isCompressing={isZoneCompressing}
          result={zoneCompressResult}
          error={zoneCompressError}
        />
      )}
    </div>
  )
}

// Zone layout
function ZoneLayout({
  sessionId,
  selectedBlockIds,
  onBlockSelect,
}: {
  sessionId: Id<"sessions">
  selectedBlockIds: Set<Id<"blocks">>
  onBlockSelect: (blockId: Id<"blocks">, selected: boolean) => void
}) {
  const metrics = useQuery(api.metrics.getZoneMetrics, { sessionId })

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 min-h-0">
      {ZONES.map((zone) => (
        <div key={zone} className="rounded border border-border bg-card p-2 flex flex-col min-h-0 overflow-hidden">
          <ZoneColumn
            sessionId={sessionId}
            zone={zone}
            zoneMetrics={metrics?.zones[zone]}
            selectedBlockIds={selectedBlockIds}
            onBlockSelect={onBlockSelect}
          />
        </div>
      ))}
    </div>
  )
}

// No session message
function NoSessionSelected() {
  const { createSession } = useSession()
  return (
    <div className="text-center py-12">
      <h2 className="text-lg font-semibold mb-2">No Session Selected</h2>
      <p className="text-sm text-muted-foreground mb-4">Create a session to start.</p>
      <Button onClick={() => createSession("My First Session")}>Create Session</Button>
    </div>
  )
}

// Workflow step indicator with next step button
function WorkflowStepIndicator({ sessionId }: { sessionId: Id<"sessions"> }) {
  const navigate = useNavigate()
  const { switchSession } = useSession()
  const workflowContext = useQuery(api.sessions.getWorkflowContext, { sessionId })
  const goToNextStep = useMutation(api.sessions.goToNextStep)
  const [isAdvancing, setIsAdvancing] = useState(false)

  // Don't render if not part of a workflow
  if (!workflowContext) return null

  const handleNextStep = async () => {
    setIsAdvancing(true)
    try {
      const result = await goToNextStep({ sessionId })
      // Update localStorage synchronously (same fix as in SessionContext)
      localStorage.setItem("contextforge-session-id", result.sessionId)
      switchSession(result.sessionId)
      // Force a re-render by navigating to the same page
      navigate({ to: "/" })
    } finally {
      setIsAdvancing(false)
    }
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50 border border-border text-xs">
      {/* Workflow name and step progress */}
      <Link
        to="/projects/$projectId"
        params={{ projectId: workflowContext.projectId }}
        className="text-muted-foreground hover:text-foreground"
      >
        {workflowContext.workflowName}
      </Link>
      <span className="text-muted-foreground">·</span>
      <span className="font-medium">
        Step {workflowContext.currentStepIndex + 1}/{workflowContext.totalSteps}
      </span>
      <span className="text-muted-foreground">·</span>
      <span>{workflowContext.currentStepName}</span>

      {/* Next step button */}
      {workflowContext.hasNextStep && (
        <>
          <span className="text-muted-foreground">·</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextStep}
            disabled={isAdvancing}
            className="h-5 px-2 text-xs"
          >
            {isAdvancing ? "..." : `Next: ${workflowContext.nextStepName} →`}
          </Button>
        </>
      )}

      {/* Completed indicator */}
      {!workflowContext.hasNextStep && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-green-600 dark:text-green-400">✓ Final step</span>
        </>
      )}
    </div>
  )
}

// Home page
function HomePage() {
  const { sessionId, isLoading } = useSession()
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<Id<"blocks">>>(new Set())
  const [isCompressionDialogOpen, setIsCompressionDialogOpen] = useState(false)
  const { toast } = useToast()

  // Fetch all blocks for multi-select compression
  const allBlocks = useQuery(api.blocks.list, sessionId ? { sessionId } : "skip")

  // Compression hook for multi-block merge
  const {
    compressAndMerge,
    isCompressing: isMergeCompressing,
    result: mergeResult,
    error: mergeError,
  } = useCompression({
    sessionId: sessionId!,
    onSuccess: (result) => {
      // Clear selection after successful compression
      setSelectedBlockIds(new Set())
      toast.success(
        "Compression successful!",
        `Saved ${result.tokensSaved} tokens (${result.compressionRatio.toFixed(1)}x compression)`
      )
    },
    onError: (error) => {
      toast.error("Compression failed", error)
    },
  })

  const selectedBlocks = allBlocks
    ? allBlocks.filter((b) => selectedBlockIds.has(b._id))
    : []

  const handleBlockSelect = (blockId: Id<"blocks">, selected: boolean) => {
    setSelectedBlockIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(blockId)
      } else {
        next.delete(blockId)
      }
      return next
    })
  }

  const handleClearSelection = () => {
    setSelectedBlockIds(new Set())
  }

  const handleOpenCompressionDialog = () => {
    setIsCompressionDialogOpen(true)
  }

  const handleCompress = async (targetZone: string, targetType: string) => {
    await compressAndMerge(selectedBlocks, {
      strategy: "semantic",
      targetZone,
      targetType,
    })
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>
  }

  if (!sessionId) {
    return <NoSessionSelected />
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-120px)]">
      {/* Workflow step indicator (if session is part of workflow) */}
      <WorkflowStepIndicator sessionId={sessionId} />

      {/* Compact toolbar row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <SessionMetrics sessionId={sessionId} collapsed />
          <AddBlockForm sessionId={sessionId} />
        </div>
        <div className="flex items-center gap-2">
          <BrainstormPanel sessionId={sessionId} compact />
          <ToolsSection sessionId={sessionId} />
        </div>
      </div>

      {/* Zones take remaining space */}
      <ZoneLayout
        sessionId={sessionId}
        selectedBlockIds={selectedBlockIds}
        onBlockSelect={handleBlockSelect}
      />

      {/* Floating action bar for multi-select */}
      {selectedBlockIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3 z-40">
          <span className="text-sm font-medium">
            {selectedBlockIds.size} block{selectedBlockIds.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleClearSelection}>
              Clear
            </Button>
            <Button
              size="sm"
              onClick={handleOpenCompressionDialog}
              disabled={selectedBlockIds.size < 2}
            >
              <Minimize2 className="w-4 h-4 mr-1" />
              Compress & Merge
            </Button>
          </div>
        </div>
      )}

      {/* Compression dialog */}
      <CompressionDialog
        isOpen={isCompressionDialogOpen}
        onClose={() => setIsCompressionDialogOpen(false)}
        blocks={selectedBlocks}
        onCompress={handleCompress}
        isCompressing={isMergeCompressing}
        result={mergeResult}
        error={mergeError}
      />
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: HomePage,
})
