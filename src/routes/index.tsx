/**
 * Home page - Zone layout with blocks.
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
import { SessionMetrics, BlockTokenBadge, ZoneHeader } from "@/components/metrics"
import { ContextExport } from "@/components/ContextExport"
import { cn } from "@/lib/utils"
import {
  BLOCK_TYPES,
  BLOCK_TYPE_METADATA,
  getBlockTypesByCategory,
  getBlockTypeMetadata,
  CATEGORY_LABELS,
  type BlockType,
} from "@/lib/blockTypes"

// Zone display info
const ZONE_INFO: Record<Zone, { label: string; description: string }> = {
  PERMANENT: {
    label: "Permanent",
    description: "Always included in context",
  },
  STABLE: {
    label: "Stable",
    description: "Included when relevant",
  },
  WORKING: {
    label: "Working",
    description: "Temporary/draft content",
  },
}

// Simple client-side token estimation (4 chars/token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Add block form with budget validation
function AddBlockForm({
  sessionId,
  defaultZone = "WORKING",
}: {
  sessionId: Id<"sessions">
  defaultZone?: Zone
}) {
  const [content, setContent] = useState("")
  const [type, setType] = useState<BlockType>("note")
  const [zone, setZone] = useState<Zone>(defaultZone)
  const blockTypesByCategory = useMemo(() => getBlockTypesByCategory(), [])
  const [budgetWarning, setBudgetWarning] = useState<string | null>(null)
  const createBlock = useMutation(api.blocks.create)

  // Get zone metrics for budget checking
  const metrics = useQuery(api.metrics.getZoneMetrics, { sessionId })

  // Estimate tokens for current content
  const estimatedTokens = useMemo(() => {
    if (!content.trim()) return 0
    return estimateTokens(content.trim())
  }, [content])

  // Check budget status for selected zone
  const budgetStatus = useMemo(() => {
    if (!metrics || !content.trim()) return null

    const zoneData = metrics.zones[zone]
    if (!zoneData) return null

    const newTotal = zoneData.tokens + estimatedTokens
    const percentUsed = Math.round((newTotal / zoneData.budget) * 100)

    return {
      currentTokens: zoneData.tokens,
      newTotal,
      budget: zoneData.budget,
      percentUsed,
      wouldExceed: newTotal > zoneData.budget,
      isWarning: percentUsed > 80 && percentUsed <= 95,
      isDanger: percentUsed > 95,
    }
  }, [metrics, zone, estimatedTokens, content])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    // Check if would exceed budget
    if (budgetStatus?.wouldExceed) {
      setBudgetWarning(
        `This would exceed the ${ZONE_INFO[zone].label} zone budget (${budgetStatus.percentUsed}% of limit). Content not added.`
      )
      return
    }

    // Clear any existing warning
    setBudgetWarning(null)

    await createBlock({ sessionId, content: content.trim(), type, zone })
    setContent("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="block-type"
            className="block text-sm font-medium mb-1 text-foreground"
          >
            Type
          </label>
          <select
            id="block-type"
            value={type}
            onChange={(e) => {
              const newType = e.target.value as BlockType
              setType(newType)
              // Update zone to match type's default zone
              const meta = BLOCK_TYPE_METADATA[newType]
              if (meta) {
                setZone(meta.defaultZone)
              }
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.entries(blockTypesByCategory).map(([category, types]) => (
              <optgroup key={category} label={CATEGORY_LABELS[category]}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {BLOCK_TYPE_METADATA[t].displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="block-zone"
            className="block text-sm font-medium mb-1 text-foreground"
          >
            Zone
          </label>
          <select
            id="block-zone"
            value={zone}
            onChange={(e) => {
              setZone(e.target.value as Zone)
              setBudgetWarning(null) // Clear warning on zone change
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {ZONE_INFO[z].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="block-content"
            className="block text-sm font-medium text-foreground"
          >
            Content
          </label>
          {estimatedTokens > 0 && (
            <span
              className={cn(
                "text-xs font-mono",
                budgetStatus?.isDanger && "text-destructive",
                budgetStatus?.isWarning && "text-yellow-600 dark:text-yellow-500"
              )}
            >
              ~{estimatedTokens.toLocaleString()} tokens
              {budgetStatus && ` (${budgetStatus.percentUsed}% after add)`}
            </span>
          )}
        </div>
        <textarea
          id="block-content"
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            setBudgetWarning(null) // Clear warning on content change
          }}
          placeholder="Enter block content..."
          rows={3}
          className={cn(
            "w-full rounded-md border bg-background px-3 py-2 text-sm resize-none",
            budgetStatus?.wouldExceed
              ? "border-destructive"
              : budgetStatus?.isWarning
                ? "border-yellow-500"
                : "border-input"
          )}
        />
      </div>

      {/* Budget warning */}
      {budgetStatus?.isWarning && !budgetStatus.wouldExceed && (
        <div className="p-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 text-xs">
          Warning: {ZONE_INFO[zone].label} zone will be at {budgetStatus.percentUsed}% capacity after adding this block.
        </div>
      )}

      {/* Error warning */}
      {(budgetWarning || budgetStatus?.wouldExceed) && (
        <div className="p-2 rounded-md bg-destructive/10 border border-destructive text-destructive text-xs">
          {budgetWarning || `This would exceed the ${ZONE_INFO[zone].label} zone budget (${budgetStatus?.percentUsed}% of limit).`}
        </div>
      )}

      <Button
        type="submit"
        disabled={!content.trim() || budgetStatus?.wouldExceed}
      >
        Add Block
      </Button>
    </form>
  )
}

// Format relative time
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Single block card (content only, wrapped by SortableBlock for DnD)
function BlockCard({
  id,
  content,
  type,
  zone,
  createdAt,
  tokens,
}: {
  id: Id<"blocks">
  content: string
  type: string
  zone: Zone
  createdAt: number
  tokens?: number
}) {
  const [copied, setCopied] = useState(false)
  const removeBlock = useMutation(api.blocks.remove)
  const moveBlock = useMutation(api.blocks.move)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    await removeBlock({ id })
  }

  const handleMove = async (e: React.MouseEvent, targetZone: Zone) => {
    e.stopPropagation()
    e.preventDefault()
    await moveBlock({ id, zone: targetZone })
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const timeAgo = formatTimeAgo(createdAt)
  const otherZones = ZONES.filter((z) => z !== zone)
  const typeMeta = getBlockTypeMetadata(type)

  return (
    <div className="rounded-lg border border-border bg-card p-3 select-none">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
            typeMeta.color
          )}>
            {typeMeta.displayName}
          </span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          <BlockTokenBadge tokens={tokens} />
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 px-2 text-xs"
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Link
            to="/blocks/$blockId"
            params={{ blockId: id }}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center h-6 px-2 text-xs rounded-md border border-input bg-background hover:bg-accent"
          >
            Edit
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-6 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Delete
          </Button>
        </div>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap break-words mb-2 line-clamp-3">
        {content}
      </p>
      <div className="flex gap-1">
        {otherZones.map((z) => (
          <Button
            key={z}
            variant="outline"
            size="sm"
            onClick={(e) => handleMove(e, z)}
            className="h-6 px-2 text-xs"
          >
            → {ZONE_INFO[z].label}
          </Button>
        ))}
      </div>
    </div>
  )
}

// Zone column with droppable area and file drop support
function ZoneColumn({
  sessionId,
  zone,
  zoneMetrics,
}: {
  sessionId: Id<"sessions">
  zone: Zone
  zoneMetrics?: { blocks: number; tokens: number; budget: number; percentUsed: number }
}) {
  const blocks = useQuery(api.blocks.listByZone, { sessionId, zone })
  const info = ZONE_INFO[zone]

  // File drop handling
  const { isDragOver, dropProps } = useFileDrop({
    sessionId,
    zone,
    onSuccess: (fileName) => console.log(`Added file "${fileName}" to ${zone}`),
    onError: (error) => console.warn(error),
  })

  // Sort blocks by position for display
  const sortedBlocks = blocks
    ? [...blocks].sort((a, b) => a.position - b.position)
    : []

  const blockIds = sortedBlocks.map((b) => b._id)

  // Budget status
  const isWarning = zoneMetrics && zoneMetrics.percentUsed > 80 && zoneMetrics.percentUsed <= 95
  const isDanger = zoneMetrics && zoneMetrics.percentUsed > 95

  return (
    <div className="flex flex-col h-full relative" {...dropProps}>
      <div className="mb-3">
        {zoneMetrics ? (
          <>
            <ZoneHeader
              zone={info.label}
              blockCount={zoneMetrics.blocks}
              tokens={zoneMetrics.tokens}
              budget={zoneMetrics.budget}
            />
            <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold">{info.label}</h3>
            <p className="text-xs text-muted-foreground">{info.description}</p>
          </>
        )}

        {/* Budget warning alerts */}
        {isDanger && (
          <div className="mt-2 p-2 rounded-md bg-destructive/10 border border-destructive text-destructive text-xs">
            Zone at {zoneMetrics?.percentUsed}% capacity - consider archiving content
          </div>
        )}
        {isWarning && (
          <div className="mt-2 p-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 text-xs">
            Zone approaching limit ({zoneMetrics?.percentUsed}%)
          </div>
        )}
      </div>

      <DroppableZone zone={zone} itemIds={blockIds}>
        <div className="flex-1 space-y-2 min-h-[100px]">
          {blocks === undefined ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : sortedBlocks.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
              Drop blocks or files here
            </div>
          ) : (
            sortedBlocks.map((block) => (
              <SortableBlock
                key={block._id}
                id={block._id}
                zone={block.zone}
                position={block.position}
              >
                <BlockCard
                  id={block._id}
                  content={block.content}
                  type={block.type}
                  zone={block.zone}
                  createdAt={block.createdAt}
                  tokens={block.tokens ?? undefined}
                />
              </SortableBlock>
            ))
          )}
        </div>
      </DroppableZone>

      <div className="mt-3 text-xs text-muted-foreground text-center">
        {blocks?.length ?? 0} blocks
      </div>

      {/* File drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10">
          <div className="text-center">
            <div className="text-3xl mb-2">📄</div>
            <div className="text-sm font-medium text-primary">
              Drop .txt or .md file
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Three-zone layout
function ZoneLayout({ sessionId }: { sessionId: Id<"sessions"> }) {
  const metrics = useQuery(api.metrics.getZoneMetrics, { sessionId })

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
      {ZONES.map((zone) => (
        <div
          key={zone}
          className="rounded-lg border border-border bg-card p-4 flex flex-col"
        >
          <ZoneColumn
            sessionId={sessionId}
            zone={zone}
            zoneMetrics={metrics?.zones[zone]}
          />
        </div>
      ))}
    </div>
  )
}

// No session selected message
function NoSessionSelected() {
  const { createSession } = useSession()

  const handleCreate = async () => {
    await createSession("My First Session")
  }

  return (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold mb-2">No Session Selected</h2>
      <p className="text-muted-foreground mb-4">
        Create a session to start managing your context blocks.
      </p>
      <Button onClick={handleCreate}>Create Session</Button>
    </div>
  )
}

// Home page component
function HomePage() {
  const { sessionId, isLoading } = useSession()

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading...</div>
    )
  }

  if (!sessionId) {
    return <NoSessionSelected />
  }

  return (
    <div className="space-y-6">
      {/* Session metrics and export */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SessionMetrics sessionId={sessionId} />
        <ContextExport sessionId={sessionId} />
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-xl font-semibold mb-4">Add New Block</h2>
        <AddBlockForm sessionId={sessionId} />
      </section>

      {/* LLM Generation Panel */}
      <section>
        <GeneratePanel sessionId={sessionId} />
      </section>

      {/* Brainstorm Panel */}
      <section>
        <BrainstormPanel sessionId={sessionId} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Context Zones</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Drag blocks to reorder or move between zones
        </p>
        <ZoneLayout sessionId={sessionId} />
      </section>
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: HomePage,
})
