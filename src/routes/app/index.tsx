/**
 * Home page - Zone layout with blocks.
 * Compact UI optimized for vertical space.
 */

import { useState, useMemo, useCallback } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import type { Id } from "../../../convex/_generated/dataModel"
import { DroppableZone, SortableBlock, ZONES, useDndOptimistic, type Zone } from "@/components/dnd"
import { useFileDrop } from "@/hooks/useFileDrop"
import { useSession } from "@/contexts/SessionContext"
import { BrainstormPanel } from "@/components/BrainstormPanel"
import { SessionMetrics, ZoneHeader, ZoneHeaderSkeleton } from "@/components/metrics"
import { Skeleton } from "@/components/ui/skeleton"
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
import { Minimize2, Puzzle, Upload, Link as LinkIcon, FolderSearch, Download, Link2, Unlink2 } from "lucide-react"
import { CompressionDialog } from "@/components/compression/CompressionDialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DebouncedButton } from "@/components/ui/debounced-button"
import { useToast } from "@/components/ui/toast"
import { ImportSkillDialog } from "@/components/skills/ImportSkillDialog"
import { ImportProjectConfirmDialog } from "@/components/skills/ImportProjectConfirmDialog"
import { ExportSkillDialog } from "@/components/skills/ExportSkillDialog"
import { useSkillImport } from "@/hooks/useSkillImport"
import { LinkBlockPopover } from "@/components/LinkBlockPopover"
import { SaveTemplateDialog, ApplyTemplateDialog } from "@/components/templates"
import { AddToProjectDialog } from "@/components/projects"
import { Save, FolderPlus, FileDown } from "lucide-react"

// Zone display info with subtle color tints
const ZONE_INFO: Record<Zone, { label: string; description: string; tint: string }> = {
  PERMANENT: { label: "Permanent", description: "Always included", tint: "bg-blue-500/[0.02] dark:bg-blue-400/[0.03] border-blue-500/10 dark:border-blue-400/10" },
  STABLE: { label: "Stable", description: "Reference material", tint: "bg-emerald-500/[0.02] dark:bg-emerald-400/[0.03] border-emerald-500/10 dark:border-emerald-400/10" },
  WORKING: { label: "Working", description: "Draft content", tint: "bg-amber-500/[0.02] dark:bg-amber-400/[0.03] border-amber-500/10 dark:border-amber-400/10" },
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
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="h-7 text-xs px-2"
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
  isDraft,
  isCompressed,
  compressionRatio,
  sessionId,
  isSelected,
  onSelect,
  metadata,
  refBlockId,
  contentHash,
}: {
  id: Id<"blocks">
  content: string
  type: string
  zone: Zone
  createdAt: number
  tokens?: number
  isDraft?: boolean
  isCompressed?: boolean
  compressionRatio?: number
  sessionId: Id<"sessions">
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
  metadata?: {
    skillName: string
    skillDescription?: string
    sourceType: "local" | "upload" | "url"
    sourceRef?: string
    parentSkillName?: string
  }
  refBlockId?: string
  contentHash?: string
}) {
  const [showActions, setShowActions] = useState(false)
  const [copied, setCopied] = useState(false)
  const removeBlock = useMutation(api.blocks.remove)
  const moveBlock = useMutation(api.blocks.move)
  const toggleDraft = useMutation(api.blocks.toggleDraft)
  const unlinkBlock = useMutation(api.blocks.unlink)
  const createLinkedBlock = useMutation(api.blocks.createLinked)
  const { toast } = useToast()

  // Duplicate detection for non-linked blocks
  const duplicate = useQuery(
    api.blocks.findDuplicate,
    contentHash && !refBlockId ? { contentHash, excludeSessionId: sessionId } : "skip"
  )

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
    if (!navigator.clipboard) {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textArea);
      }
    } else {
      await navigator.clipboard.writeText(content);
      }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleCompress = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await compressSingle(
      { _id: id, content, type, tokens, isCompressed },
      "semantic"
    )
  }

  const handleToggleDraft = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await toggleDraft({ id })
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
        "rounded-lg border bg-card p-2.5 select-none transition-all duration-150",
        "hover:shadow-sm hover:border-border/80",
        isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border",
        isDraft && "opacity-50",
        refBlockId ? "border-l-2 border-l-[oklch(0.65_0.08_220)]" : ""
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
          {isDraft && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              Draft
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{formatTimeAgo(createdAt)}</span>
          {tokens != null && <span className="text-[10px] text-muted-foreground font-mono">{tokens}t</span>}
          {isCompressed && compressionRatio && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
              <Minimize2 className="w-2.5 h-2.5" />
              {compressionRatio.toFixed(1)}x
            </span>
          )}
          {refBlockId && (
            <span title="Linked block — used in multiple sessions" className="inline-flex items-center">
              <Link2 className="w-2.5 h-2.5 text-muted-foreground" />
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
            <button onClick={handleToggleDraft} className="px-1.5 py-0.5 text-[10px] rounded hover:bg-muted">{isDraft ? "Undraft" : "Draft"}</button>
            <button 
              onClick={handleCopy} 
              className={cn(
                "px-1.5 py-0.5 text-[10px] rounded transition-colors",
                copied && "bg-emerald-300/20 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <Link
              to="/app/blocks/$blockId"
              params={{ blockId: id }}
              onClick={(e) => e.stopPropagation()}
              className="px-1.5 py-0.5 text-[10px] rounded hover:bg-muted"
            >
              Edit
            </Link>
            {refBlockId && (
              <DebouncedButton
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px]"
                onClick={() => unlinkBlock({ id })}
                title="Unlink — make independent copy"
              >
                <Unlink2 className="w-3 h-3" />
              </DebouncedButton>
            )}
            <button onClick={handleDelete} className="px-1.5 py-0.5 text-[10px] rounded hover:bg-destructive/10 text-destructive">Del</button>
          </div>
        )}
      </div>
      {type === "skill" && metadata?.skillName && (
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-xs font-medium truncate">{metadata.skillName}</span>
          {metadata.sourceType === "local" && <FolderSearch className="w-3 h-3 text-muted-foreground shrink-0" />}
          {metadata.sourceType === "upload" && <Upload className="w-3 h-3 text-muted-foreground shrink-0" />}
          {metadata.sourceType === "url" && <LinkIcon className="w-3 h-3 text-muted-foreground shrink-0" />}
        </div>
      )}
      {type === "skill" && metadata?.skillDescription && (
        <p className="text-[10px] text-muted-foreground line-clamp-1 mb-0.5">{metadata.skillDescription}</p>
      )}
      {type === "reference" && metadata?.parentSkillName && (
        <div className="flex items-center gap-1 mb-0.5">
          <Puzzle className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground truncate">from: {metadata.parentSkillName}</span>
        </div>
      )}
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

      {duplicate && !refBlockId && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent/50 text-[10px] text-muted-foreground mt-1">
          <Link2 className="w-3 h-3 shrink-0" />
          <span className="truncate">Same as block in {duplicate.sessionName}.</span>
          <button
            className="text-primary hover:underline font-medium shrink-0"
            onClick={async () => {
              // Replace this block with a linked reference
              await createLinkedBlock({ sessionId, refBlockId: duplicate.blockId, zone })
              await removeBlock({ id })
            }}
          >
            Link?
          </button>
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
  onSkillFile,
}: {
  sessionId: Id<"sessions">
  zone: Zone
  zoneMetrics?: { blocks: number; tokens: number; budget: number; percentUsed: number }
  selectedBlockIds: Set<Id<"blocks">>
  onBlockSelect: (blockId: Id<"blocks">, selected: boolean) => void
  onSkillFile?: (file: File, zone: Zone) => void
}) {
  const [isZoneCompressionDialogOpen, setIsZoneCompressionDialogOpen] = useState(false)
  const blocks = useQuery(api.blocks.listByZone, { sessionId, zone })
  const info = ZONE_INFO[zone]
  const { toast } = useToast()
  const { isDragOver, dropProps } = useFileDrop({
    sessionId,
    zone,
    onSkillFile,
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

  // Use optimistic order if available (prevents flash-of-old-order after drop)
  const { optimisticOrder: optimistic, activeBlock: activeBlockInfo } = useDndOptimistic()
  const optimisticIds = optimistic[zone]
  const blockMap = useMemo(() => new Map(sortedBlocks.map((b) => [b._id, b])), [sortedBlocks])

  const displayBlocks = useMemo(() => {
    if (!optimisticIds) return sortedBlocks
    return optimisticIds.map((id) => {
      const local = blockMap.get(id)
      if (local) return local
      // Foreign block being dragged into this zone — build synthetic entry
      if (activeBlockInfo && activeBlockInfo._id === id) {
        return {
          _id: activeBlockInfo._id,
          content: activeBlockInfo.content,
          type: activeBlockInfo.type,
          zone,
          position: activeBlockInfo.position,
          createdAt: activeBlockInfo.createdAt,
          tokens: activeBlockInfo.tokens ?? null,
          isCompressed: activeBlockInfo.isCompressed ?? false,
          compressionRatio: activeBlockInfo.compressionRatio ?? null,
          metadata: (activeBlockInfo.metadata as typeof sortedBlocks[number]["metadata"]) ?? null,
          sessionId,
          _creationTime: activeBlockInfo.createdAt,
        }
      }
      return null
    }).filter(Boolean) as typeof sortedBlocks
  }, [optimisticIds, sortedBlocks, blockMap, activeBlockInfo, sessionId, zone])

  const displayIds = useMemo(() => displayBlocks.map((b) => b._id), [displayBlocks])

  const isDanger = zoneMetrics && zoneMetrics.percentUsed > 95
  const isWarning = zoneMetrics && zoneMetrics.percentUsed > 80 && zoneMetrics.percentUsed <= 95

  return (
    <div className="flex flex-col h-full relative" {...dropProps}>
      <div className="mb-3">
        {zoneMetrics ? (
          <ZoneHeader
            zone={info.label}
            blockCount={zoneMetrics.blocks}
            tokens={zoneMetrics.tokens}
            budget={zoneMetrics.budget}
            onCompress={handleZoneCompress}
            isCompressing={isZoneCompressing}
            linkButton={
              <LinkBlockPopover sessionId={sessionId} zone={zone}>
                <button
                  className="w-5 h-5 rounded border border-dashed border-border hover:border-foreground/30 flex items-center justify-center transition-colors shrink-0"
                  title="Link a block from another session"
                >
                  <Link2 className="w-3 h-3 text-muted-foreground" />
                </button>
              </LinkBlockPopover>
            }
          />
        ) : (
          <ZoneHeaderSkeleton />
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

      <DroppableZone zone={zone} itemIds={displayIds}>
        <div className="flex-1 space-y-1.5 min-h-[60px] overflow-y-auto">
          {blocks === undefined ? (
            <div className="space-y-1.5">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Skeleton className="h-4 w-14 rounded" />
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : displayBlocks.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded">
              Drop here
            </div>
          ) : (
            displayBlocks.map((block) => (
              <SortableBlock key={block._id} id={block._id} zone={block.zone} position={block.position}>
                <BlockCard
                  id={block._id}
                  content={block.content}
                  type={block.type}
                  zone={block.zone}
                  createdAt={block.createdAt}
                  tokens={block.tokens ?? undefined}
                  isDraft={block.isDraft}
                  isCompressed={block.isCompressed}
                  compressionRatio={block.compressionRatio}
                  sessionId={sessionId}
                  isSelected={selectedBlockIds.has(block._id)}
                  onSelect={(selected) => onBlockSelect(block._id, selected)}
                  metadata={block.metadata ?? undefined}
                  refBlockId={block.refBlockId}
                  contentHash={block.contentHash}
                />
              </SortableBlock>
            ))
          )}
        </div>
      </DroppableZone>

      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded z-10 pointer-events-none">
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
  onSkillFile,
}: {
  sessionId: Id<"sessions">
  selectedBlockIds: Set<Id<"blocks">>
  onBlockSelect: (blockId: Id<"blocks">, selected: boolean) => void
  onSkillFile?: (file: File, zone: Zone) => void
}) {
  const metrics = useQuery(api.metrics.getZoneMetrics, { sessionId })

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 min-h-0">
      {ZONES.map((zone) => (
        <div key={zone} className={cn("rounded-lg border p-3 flex flex-col min-h-0 overflow-hidden", ZONE_INFO[zone].tint)}>
          <ZoneColumn
            sessionId={sessionId}
            zone={zone}
            zoneMetrics={metrics?.zones[zone]}
            selectedBlockIds={selectedBlockIds}
            onBlockSelect={onBlockSelect}
            onSkillFile={onSkillFile}
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
      navigate({ to: "/app" })
    } finally {
      setIsAdvancing(false)
    }
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50 border border-border text-xs">
      {/* Workflow name and step progress */}
      <Link
        to="/app/projects/$projectId"
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
  const [isImportSkillOpen, setIsImportSkillOpen] = useState(false)
  const [isExportSkillOpen, setIsExportSkillOpen] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showApplyTemplate, setShowApplyTemplate] = useState(false)
  const [showAddToProject, setShowAddToProject] = useState(false)
  const { toast } = useToast()

  // Skill import for drag-and-drop (shared across all zones)
  const {
    importFromFile: skillImportFromFile,
    isImporting: isSkillImporting,
    pendingProjectImport,
    confirmProjectImport,
    cancelProjectImport,
  } = useSkillImport({
    sessionId: sessionId!,
    onSuccess: (name, refCount) => {
      const refText = refCount ? ` (+ ${refCount} reference${refCount !== 1 ? "s" : ""})` : ""
      toast.success("Skill imported", `${name}${refText}`)
    },
    onError: (msg) => toast.error("Skill import failed", msg),
  })

  const handleSkillFileDrop = useCallback(
    (file: File, zone: Zone) => {
      skillImportFromFile(file, zone)
    },
    [skillImportFromFile]
  )

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
    return (
      <div className="flex flex-col gap-3 h-[calc(100vh-120px)]">
        {/* Toolbar skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-1.5 w-12 rounded-full" />
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        {/* 3-column zone skeleton */}
        <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
          {[0, 1, 2].map((col) => (
            <div key={col} className="flex flex-col h-full">
              <div className="mb-2">
                <ZoneHeaderSkeleton />
              </div>
              <div className="flex-1 space-y-1.5">
                {[0, 1].map((i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Skeleton className="h-4 w-14 rounded" />
                      <Skeleton className="h-3 w-10" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-3 w-full mb-1" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
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
        <div className="flex items-center gap-1">
          <SessionMetrics sessionId={sessionId} collapsed />
          <div className="w-px h-4 bg-border mx-1" />
          <AddBlockForm sessionId={sessionId} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsImportSkillOpen(true)}
            className="h-7 text-xs px-2"
          >
            <Puzzle className="w-3 h-3 mr-1" />
            Import Skill
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExportSkillOpen(true)}
            className="h-7 text-xs px-2"
          >
            <Download className="w-3 h-3 mr-1" />
            Export Skill
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSaveTemplate(true)}
            title="Save current session as a reusable template"
            className="h-7 text-xs px-2"
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowApplyTemplate(true)}
            title="Apply a template to this session"
            className="h-7 text-xs px-2"
          >
            <FileDown className="w-3 h-3 mr-1" />
            Apply
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddToProject(true)}
            title="Add this session to a project"
            className="h-7 text-xs px-2"
          >
            <FolderPlus className="w-3 h-3 mr-1" />
            Project
          </Button>
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
        onSkillFile={handleSkillFileDrop}
      />

      {/* Floating action bar for multi-select */}
      {selectedBlockIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-xl shadow-black/5 dark:shadow-black/20 p-3 flex items-center gap-3 z-40 backdrop-blur-sm">
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

      {/* Import Skill dialog */}
      {sessionId && (
        <ImportSkillDialog
          isOpen={isImportSkillOpen}
          onClose={() => setIsImportSkillOpen(false)}
          sessionId={sessionId}
        />
      )}

      {/* Export Skill dialog */}
      {sessionId && (
        <ExportSkillDialog
          isOpen={isExportSkillOpen}
          onClose={() => setIsExportSkillOpen(false)}
          sessionId={sessionId}
        />
      )}

      {/* Project import confirmation from drag-and-drop */}
      {pendingProjectImport && (
        <ImportProjectConfirmDialog
          pending={pendingProjectImport}
          onConfirm={confirmProjectImport}
          onCancel={cancelProjectImport}
          isImporting={isSkillImporting}
        />
      )}

      {/* Template & project dialogs */}
      {sessionId && (
        <>
          <SaveTemplateDialog
            isOpen={showSaveTemplate}
            onClose={() => setShowSaveTemplate(false)}
            sessionId={sessionId}
          />
          <ApplyTemplateDialog
            isOpen={showApplyTemplate}
            onClose={() => setShowApplyTemplate(false)}
            sessionId={sessionId}
          />
          <AddToProjectDialog
            isOpen={showAddToProject}
            onClose={() => setShowAddToProject(false)}
            sessionId={sessionId}
          />
        </>
      )}
    </div>
  )
}

export const Route = createFileRoute("/app/")({
  component: HomePage,
})
